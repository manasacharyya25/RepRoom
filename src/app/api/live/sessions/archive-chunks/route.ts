import { NextResponse } from "next/server";
import { resolveLiveArchiveChunks } from "@/lib/streaming/resolve-archive-chunks";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Resolve playable chunk indices for a room archive session.
 * Lists R2 at most once and persists available_chunks. Live sessions are rejected.
 */
export async function GET(request: Request) {
  const sessionId =
    new URL(request.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  // Prefer service-role writes for persist; fall back to user client if admin unset.
  const supabase = isAdminConfigured()
    ? createAdminClient()
    : await createClient();

  try {
    const result = await resolveLiveArchiveChunks(supabase, sessionId);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    return NextResponse.json({
      ok: true,
      chunks: result.chunks,
      r2Folder: result.r2Folder,
      listed: result.listed
    });
  } catch (error) {
    console.error("[live/sessions/archive-chunks]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not list chunks" },
      { status: 500 }
    );
  }
}
