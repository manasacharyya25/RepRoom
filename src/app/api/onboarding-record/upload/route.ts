import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import {
  onboardingChunkKey,
  readOnboardingSession
} from "@/lib/onboarding-recorder";
import {
  createR2Client,
  isR2Configured,
  publicObjectUrl
} from "@/lib/streaming/r2";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_CHUNK_BYTES = 8 * 1024 * 1024;

function isUploadBlob(value: unknown): value is Blob {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === "function" &&
    typeof (value as Blob).size === "number"
  );
}

function awsErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Could not upload chunk";
  }
  const err = error as {
    message?: string;
    name?: string;
    Code?: string;
    code?: string;
  };
  const parts = [err.name, err.Code || err.code, err.message].filter(Boolean);
  return parts.join(": ") || "Could not upload chunk";
}

export async function POST(request: Request) {
  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "R2 is not configured" },
      { status: 503 }
    );
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
    return NextResponse.json(
      { error: "Expected multipart form" },
      { status: 400 }
    );
  }

  const sessionId = String(form.get("sessionId") ?? "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const chunkIndex = Number(form.get("chunkIndex"));
  if (!Number.isFinite(chunkIndex) || chunkIndex < 1 || chunkIndex > 1_000_000) {
    return NextResponse.json({ error: "Invalid chunkIndex" }, { status: 400 });
  }

  const file = form.get("file");
  if (!isUploadBlob(file) || file.size < 64) {
    return NextResponse.json({ error: "Missing chunk file" }, { status: 400 });
  }
  if (file.size > MAX_CHUNK_BYTES) {
    return NextResponse.json({ error: "Chunk too large" }, { status: 413 });
  }

  const admin = createAdminClient();
  const { data: liveSession, error: sessionError } = await admin
    .from("onboarding_recorder_sessions")
    .select("session_id, status, recorder_id")
    .eq("session_id", sessionId)
    .eq("recorder_id", auth.recorderId)
    .maybeSingle();

  if (
    sessionError ||
    !liveSession ||
    liveSession.status !== "live" ||
    liveSession.recorder_id !== auth.recorderId
  ) {
    return NextResponse.json(
      { error: "Live session not found or not active" },
      { status: 404 }
    );
  }

  const key = onboardingChunkKey({
    userId: auth.recorderId,
    sessionId,
    chunkIndex
  });
  const contentType = "video/webm";
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
        "[onboarding-record/upload] R2 PUT failed",
        putResponse.status,
        detail
      );
      return NextResponse.json(
        {
          error: `R2 PUT failed (${putResponse.status})`,
          detail: detail.slice(0, 500)
        },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();
    await admin
      .from("onboarding_recorder_sessions")
      .update({
        last_chunk_number: chunkIndex,
        last_chunk_uploaded_at: now
      })
      .eq("session_id", sessionId)
      .eq("recorder_id", auth.recorderId)
      .eq("status", "live");

    return NextResponse.json({
      ok: true,
      key,
      sessionId,
      chunkIndex,
      bytes: body.length,
      publicUrl: publicObjectUrl(key)
    });
  } catch (error) {
    console.error("[onboarding-record/upload]", error);
    return NextResponse.json(
      { error: awsErrorMessage(error) },
      { status: 500 }
    );
  }
}
