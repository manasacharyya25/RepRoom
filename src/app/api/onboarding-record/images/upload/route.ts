import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  imageExtensionForContentType,
  onboardingImageKey,
  readOnboardingSession
} from "@/lib/onboarding-recorder";
import {
  createR2Client,
  isR2Configured,
  publicObjectUrl
} from "@/lib/streaming/r2";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function isUploadBlob(value: unknown): value is Blob {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === "function" &&
    typeof (value as Blob).size === "number"
  );
}

export async function POST(request: Request) {
  if (!isR2Configured()) {
    return NextResponse.json({ error: "R2 is not configured" }, { status: 503 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Onboarding recorder is not configured" },
      { status: 503 }
    );
  }

  const auth = await readOnboardingSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!isUploadBlob(file) || file.size < 64) {
    return NextResponse.json({ error: "Missing image file" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image too large (max 10MB)" }, { status: 413 });
  }

  const contentType = (file.type || "application/octet-stream").trim().toLowerCase();
  const ext = imageExtensionForContentType(contentType);
  if (!ext) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, and WebP images are allowed" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { count, error: countError } = await admin
    .from("onboarding_recorder_images")
    .select("image_id", { count: "exact", head: true })
    .eq("recorder_id", auth.recorderId);

  if (countError) {
    console.error("[onboarding-record/images/upload] count", countError);
    return NextResponse.json({ error: "Could not upload image" }, { status: 500 });
  }

  if ((count ?? 0) >= 5) {
    return NextResponse.json(
      {
        error: "You can upload up to 5 images",
        reason: "image_limit"
      },
      { status: 403 }
    );
  }

  const imageId = randomUUID();
  const key = onboardingImageKey(auth.recorderId, imageId, ext);
  const body = Buffer.from(await file.arrayBuffer());
  const originalFilename = String(form.get("filename") ?? "").trim().slice(0, 200) || null;

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
        "[onboarding-record/images/upload] R2 PUT failed",
        putResponse.status,
        detail
      );
      return NextResponse.json(
        { error: `Upload failed (${putResponse.status})` },
        { status: 500 }
      );
    }

    const { error: insertError } = await admin.from("onboarding_recorder_images").insert({
      image_id: imageId,
      recorder_id: auth.recorderId,
      r2_key: key,
      content_type: contentType,
      bytes: body.length,
      original_filename: originalFilename
    });

    if (insertError) {
      console.error("[onboarding-record/images/upload] insert", insertError);
      return NextResponse.json({ error: "Could not save image" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      imageId,
      key,
      bytes: body.length,
      publicUrl: publicObjectUrl(key)
    });
  } catch (error) {
    console.error("[onboarding-record/images/upload]", error);
    return NextResponse.json({ error: "Could not upload image" }, { status: 500 });
  }
}
