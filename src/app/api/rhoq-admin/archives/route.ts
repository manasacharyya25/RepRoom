import { NextResponse } from "next/server";
import { readRhoqAdminSession } from "@/lib/rhoq-admin";
import { normalizeAvailableChunks } from "@/lib/streaming/list-archive-chunks";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const pageRaw = Number(searchParams.get("page") ?? 1);
  const limitRaw = Number(searchParams.get("limit") ?? DEFAULT_PAGE_SIZE);
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(
      1,
      Number.isFinite(limitRaw) ? Math.floor(limitRaw) : DEFAULT_PAGE_SIZE
    )
  );
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const admin = createAdminClient();

  const { count: totalCount, error: countError } = await admin
    .from("archive_sessions")
    .select("session_id", { count: "exact", head: true });

  if (countError) {
    console.error("[rhoq-admin/archives count]", countError);
    return NextResponse.json(
      { error: countError.message || "Could not load archives" },
      { status: 500 }
    );
  }

  const total = totalCount ?? 0;

  const { data, error } = await admin
    .from("archive_sessions")
    .select(
      "session_id, user_id, room_id, r2_folder, status, started_at, ended_at, last_chunk_number, last_chunk_uploaded_at, archived_at, archive_reason, available_chunks"
    )
    .order("ended_at", { ascending: false, nullsFirst: false })
    .order("last_chunk_uploaded_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[rhoq-admin/archives]", error);
    return NextResponse.json(
      { error: error.message || "Could not load archives" },
      { status: 500 }
    );
  }

  const hasMore = from + (data?.length ?? 0) < total;

  const userIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.user_id as string)
        .filter((id) => Boolean(id))
    )
  ];

  const profileById = new Map<
    string,
    { displayName: string | null; username: string | null }
  >();

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, display_name, username")
      .in("id", userIds);

    if (profilesError) {
      console.warn("[rhoq-admin/archives] profiles", profilesError);
    } else {
      for (const profile of profiles ?? []) {
        profileById.set(profile.id as string, {
          displayName: (profile.display_name as string | null) ?? null,
          username: (profile.username as string | null) ?? null
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    page,
    limit,
    total,
    hasMore,
    sessions: (data ?? []).map((row) => {
      const userId = row.user_id as string;
      const profile = profileById.get(userId);
      return {
        sessionId: row.session_id as string,
        userId,
        displayName: profile?.displayName ?? null,
        username: profile?.username ?? null,
        roomId: row.room_id as string,
        r2Folder: row.r2_folder as string,
        status: row.status as string,
        startedAt: row.started_at as string,
        endedAt: (row.ended_at as string | null) ?? null,
        lastChunkNumber: row.last_chunk_number as number,
        lastChunkUploadedAt:
          (row.last_chunk_uploaded_at as string | null) ?? null,
        archivedAt: (row.archived_at as string | null) ?? null,
        archiveReason: (row.archive_reason as string | null) ?? null,
        availableChunks: normalizeAvailableChunks(row.available_chunks)
      };
    })
  });
}
