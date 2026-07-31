import type { SupabaseClient } from "@supabase/supabase-js";
import { onboardingR2Folder } from "@/lib/onboarding-recorder";
import {
  listChunkIndicesInFolder,
  normalizeAvailableChunks
} from "@/lib/streaming/list-archive-chunks";

type ResolveResult = {
  chunks: number[];
  r2Folder: string;
  listed: boolean;
};

/**
 * Resolve playable chunk indices for an ended onboarding recorder session.
 * Uses DB cache when present; otherwise lists R2 once and persists.
 */
export async function resolveOnboardingArchiveChunks(
  admin: SupabaseClient,
  options: { recorderId: string; sessionId: string }
): Promise<ResolveResult | { error: string; status: number }> {
  const { data, error } = await admin
    .from("onboarding_recorder_sessions")
    .select(
      "session_id, recorder_id, status, last_chunk_number, available_chunks"
    )
    .eq("session_id", options.sessionId)
    .eq("recorder_id", options.recorderId)
    .maybeSingle();

  if (error) {
    console.error("[resolveOnboardingArchiveChunks]", error);
    return { error: "Could not load session", status: 500 };
  }
  if (!data) {
    return { error: "Session not found", status: 404 };
  }
  if ((data.status as string) !== "ended") {
    return {
      error: "Chunk listing is only available for ended archive sessions",
      status: 409
    };
  }
  if ((data.last_chunk_number as number) < 1) {
    return { error: "Session has no chunks", status: 404 };
  }

  const r2Folder = onboardingR2Folder(
    options.recorderId,
    options.sessionId
  );
  const cached = normalizeAvailableChunks(data.available_chunks);
  if (cached) {
    return { chunks: cached, r2Folder, listed: false };
  }

  const chunks = await listChunkIndicesInFolder(r2Folder);
  if (chunks.length === 0) {
    return { error: "No chunk files found in storage", status: 404 };
  }

  const { error: updateError } = await admin
    .from("onboarding_recorder_sessions")
    .update({ available_chunks: chunks })
    .eq("session_id", options.sessionId)
    .eq("recorder_id", options.recorderId);

  if (updateError) {
    console.error("[resolveOnboardingArchiveChunks] persist", updateError);
    // Still return listed chunks so playback can proceed this time.
  }

  return { chunks, r2Folder, listed: true };
}

type LiveArchiveRow = {
  session_id: string;
  r2_folder: string;
  status: string;
  last_chunk_number: number;
  available_chunks: unknown;
  source: "archive_sessions" | "live_sessions";
};

/**
 * Resolve playable chunk indices for a room archive (archive_sessions or ended live_sessions).
 */
export async function resolveLiveArchiveChunks(
  admin: SupabaseClient,
  sessionId: string
): Promise<ResolveResult | { error: string; status: number }> {
  const { data: archived, error: archiveError } = await admin
    .from("archive_sessions")
    .select("session_id, r2_folder, status, last_chunk_number, available_chunks")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (archiveError) {
    console.error("[resolveLiveArchiveChunks] archive_sessions", archiveError);
  }

  let row: LiveArchiveRow | null = null;
  if (archived) {
    row = {
      ...(archived as Omit<LiveArchiveRow, "source">),
      source: "archive_sessions"
    };
  } else {
    const { data: liveEnded, error: liveError } = await admin
      .from("live_sessions")
      .select(
        "session_id, r2_folder, status, last_chunk_number, available_chunks"
      )
      .eq("session_id", sessionId)
      .eq("status", "ended")
      .maybeSingle();

    if (liveError) {
      console.error("[resolveLiveArchiveChunks] live_sessions", liveError);
      return { error: "Could not load session", status: 500 };
    }
    if (liveEnded) {
      row = {
        ...(liveEnded as Omit<LiveArchiveRow, "source">),
        source: "live_sessions"
      };
    }
  }

  if (!row) {
    return { error: "Archive session not found", status: 404 };
  }
  if ((row.status as string) === "live") {
    return {
      error: "Chunk listing is only available for ended archive sessions",
      status: 409
    };
  }
  if (row.last_chunk_number < 1) {
    return { error: "Session has no chunks", status: 404 };
  }

  const r2Folder = String(row.r2_folder ?? "").trim();
  if (!r2Folder) {
    return { error: "Session folder missing", status: 500 };
  }

  const cached = normalizeAvailableChunks(row.available_chunks);
  if (cached) {
    return { chunks: cached, r2Folder, listed: false };
  }

  const chunks = await listChunkIndicesInFolder(r2Folder);
  if (chunks.length === 0) {
    return { error: "No chunk files found in storage", status: 404 };
  }

  const table =
    row.source === "archive_sessions" ? "archive_sessions" : "live_sessions";
  const { error: updateError } = await admin
    .from(table)
    .update({ available_chunks: chunks })
    .eq("session_id", sessionId);

  if (updateError) {
    console.error("[resolveLiveArchiveChunks] persist", updateError);
  }

  return { chunks, r2Folder, listed: true };
}
