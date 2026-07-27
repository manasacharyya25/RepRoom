import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { postImageR2Key } from "@/lib/rhoq-admin";
import {
  createR2Client,
  isR2Configured,
  publicObjectUrl
} from "@/lib/streaming/r2";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const ALLOWED_KINDS = new Set(["post", "before", "after"]);

function isUploadBlob(value: unknown): value is Blob {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === "function" &&
    typeof (value as Blob).size === "number"
  );
}

function extensionForContentType(contentType: string) {
  const type = contentType.trim().toLowerCase();
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return null;
}

export async function POST(request: Request) {
  if (!isR2Configured()) {
    return NextResponse.json({ error: "R2 is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }

  const kindRaw = String(form.get("kind") ?? "post").trim();
  if (!ALLOWED_KINDS.has(kindRaw)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  const kind = kindRaw as "post" | "before" | "after";

  const file = form.get("file");
  if (!isUploadBlob(file) || file.size < 64) {
    return NextResponse.json({ error: "Missing image file" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image too large (max 12MB)" }, { status: 413 });
  }

  const contentType = (file.type || "image/webp").trim().toLowerCase();
  const ext = extensionForContentType(contentType);
  if (!ext) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, and WebP images are allowed" },
      { status: 400 }
    );
  }

  const imageId = randomUUID();
  const key = postImageR2Key(user.id, kind, ext, imageId);
  const body = Buffer.from(await file.arrayBuffer());

  try {
    const { client, bucket } = createR2Client();
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType
      }),
      {
        expiresIn: 60,
        signableHeaders: new Set(["content-type"])
      }
    );

    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body
    });

    if (!putResponse.ok) {
      const detail = await putResponse.text().catch(() => "");
      console.error(
        "[posts/upload-image] R2 PUT failed",
        putResponse.status,
        detail
      );
      return NextResponse.json(
        { error: `Upload failed (${putResponse.status})` },
        { status: 500 }
      );
    }

    const publicUrl = publicObjectUrl(key);
    if (!publicUrl) {
      return NextResponse.json(
        { error: "R2 public base URL is not configured" },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      key,
      bytes: body.length,
      publicUrl
    });
  } catch (error) {
    console.error("[posts/upload-image]", error);
    return NextResponse.json({ error: "Could not upload image" }, { status: 500 });
  }
}
