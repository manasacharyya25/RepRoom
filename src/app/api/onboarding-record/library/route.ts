import { NextResponse } from "next/server";
import {
  onboardingR2Folder,
  readOnboardingSession
} from "@/lib/onboarding-recorder";
import { normalizeAvailableChunks } from "@/lib/streaming/list-archive-chunks";
import { publicObjectUrl } from "@/lib/streaming/r2";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
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

  const admin = createAdminClient();

  const [{ data: sessions, error: sessionsError }, { data: images, error: imagesError }] =
    await Promise.all([
      admin
        .from("onboarding_recorder_sessions")
        .select(
          "session_id, status, started_at, ended_at, last_chunk_number, last_chunk_uploaded_at, available_chunks"
        )
        .eq("recorder_id", auth.recorderId)
        .gt("last_chunk_number", 0)
        .order("started_at", { ascending: false }),
      admin
        .from("onboarding_recorder_images")
        .select("image_id, r2_key, content_type, bytes, original_filename, created_at")
        .eq("recorder_id", auth.recorderId)
        .order("created_at", { ascending: false })
    ]);

  if (sessionsError) {
    console.error("[onboarding-record/library] sessions", sessionsError);
    return NextResponse.json({ error: "Could not load library" }, { status: 500 });
  }
  if (imagesError) {
    console.error("[onboarding-record/library] images", imagesError);
    return NextResponse.json({ error: "Could not load library" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    recordings: (sessions ?? []).map((row) => ({
      sessionId: row.session_id as string,
      status: row.status as string,
      startedAt: row.started_at as string,
      endedAt: (row.ended_at as string | null) ?? null,
      lastChunkNumber: row.last_chunk_number as number,
      lastChunkUploadedAt: (row.last_chunk_uploaded_at as string | null) ?? null,
      availableChunks: normalizeAvailableChunks(row.available_chunks),
      r2Folder: onboardingR2Folder(auth.recorderId, row.session_id as string),
      previewUrl: publicObjectUrl(
        `${onboardingR2Folder(auth.recorderId, row.session_id as string)}/chunk_000001.webm`
      )
    })),
    images: (images ?? []).map((row) => ({
      imageId: row.image_id as string,
      r2Key: row.r2_key as string,
      contentType: row.content_type as string,
      bytes: row.bytes as number,
      originalFilename: (row.original_filename as string | null) ?? null,
      createdAt: row.created_at as string,
      publicUrl: publicObjectUrl(row.r2_key as string)
    }))
  });
}
