import { NextResponse } from "next/server";
import { onboardingR2Folder } from "@/lib/onboarding-recorder";
import { readRhoqAdminSession } from "@/lib/rhoq-admin";
import { normalizeAvailableChunks } from "@/lib/streaming/list-archive-chunks";
import { publicObjectUrl } from "@/lib/streaming/r2";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Admin client is not configured" },
      { status: 503 }
    );
  }

  const auth = await readRhoqAdminSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const recorderId = id?.trim();
  if (!recorderId) {
    return NextResponse.json({ error: "Missing recorder id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: recorder, error: recorderError } = await admin
    .from("onboarding_recorders")
    .select(
      "id, username, max_seconds, seconds_used, active, created_at, updated_at, promoted_at, promoted_user_id"
    )
    .eq("id", recorderId)
    .maybeSingle();

  if (recorderError) {
    console.error("[rhoq-admin/recorders/id]", recorderError);
    return NextResponse.json({ error: "Could not load recorder" }, { status: 500 });
  }
  if (!recorder) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [{ data: sessions, error: sessionsError }, { data: images, error: imagesError }] =
    await Promise.all([
      admin
        .from("onboarding_recorder_sessions")
        .select(
          "session_id, status, started_at, ended_at, last_chunk_number, last_chunk_uploaded_at, available_chunks"
        )
        .eq("recorder_id", recorderId)
        .gt("last_chunk_number", 0)
        .order("started_at", { ascending: false }),
      admin
        .from("onboarding_recorder_images")
        .select("image_id, r2_key, content_type, bytes, original_filename, created_at")
        .eq("recorder_id", recorderId)
        .order("created_at", { ascending: false })
    ]);

  if (sessionsError) {
    console.error("[rhoq-admin/recorders/id] sessions", sessionsError);
    return NextResponse.json({ error: "Could not load sessions" }, { status: 500 });
  }
  if (imagesError) {
    console.error("[rhoq-admin/recorders/id] images", imagesError);
    return NextResponse.json({ error: "Could not load images" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    recorder: {
      id: recorder.id as string,
      username: (recorder.username as string).toLowerCase(),
      maxSeconds: recorder.max_seconds as number,
      secondsUsed: recorder.seconds_used as number,
      active: Boolean(recorder.active),
      createdAt: recorder.created_at as string,
      updatedAt: recorder.updated_at as string,
      promotedAt: (recorder.promoted_at as string | null) ?? null,
      promotedUserId: (recorder.promoted_user_id as string | null) ?? null
    },
    recordings: (sessions ?? []).map((row) => ({
      sessionId: row.session_id as string,
      status: row.status as string,
      startedAt: row.started_at as string,
      endedAt: (row.ended_at as string | null) ?? null,
      lastChunkNumber: row.last_chunk_number as number,
      lastChunkUploadedAt: (row.last_chunk_uploaded_at as string | null) ?? null,
      availableChunks: normalizeAvailableChunks(row.available_chunks),
      r2Folder: onboardingR2Folder(recorderId, row.session_id as string),
      previewUrl: publicObjectUrl(
        `${onboardingR2Folder(recorderId, row.session_id as string)}/chunk_000001.webm`
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
