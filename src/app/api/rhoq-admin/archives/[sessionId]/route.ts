import { NextResponse } from "next/server";
import { readRhoqAdminSession } from "@/lib/rhoq-admin";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

/**
 * Delete an archive session from the DB (archive_sessions + ended live_sessions
 * with the same id). Does not delete R2 objects.
 */
export async function DELETE(_request: Request, context: RouteContext) {
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

  const { sessionId: rawId } = await context.params;
  const sessionId = rawId?.trim() ?? "";
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: archived, error: loadError } = await admin
    .from("archive_sessions")
    .select("session_id, r2_folder")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (loadError) {
    console.error("[rhoq-admin/archives DELETE] load", loadError);
    return NextResponse.json(
      { error: loadError.message || "Could not load archive" },
      { status: 500 }
    );
  }
  if (!archived) {
    return NextResponse.json({ error: "Archive not found" }, { status: 404 });
  }

  const { error: archiveDeleteError } = await admin
    .from("archive_sessions")
    .delete()
    .eq("session_id", sessionId);

  if (archiveDeleteError) {
    console.error("[rhoq-admin/archives DELETE] archive", archiveDeleteError);
    return NextResponse.json(
      { error: archiveDeleteError.message || "Could not delete archive" },
      { status: 500 }
    );
  }

  // Also remove ended live_sessions row so discovery fallback cannot resurface it.
  const { error: liveDeleteError } = await admin
    .from("live_sessions")
    .delete()
    .eq("session_id", sessionId)
    .eq("status", "ended");

  if (liveDeleteError) {
    console.warn(
      "[rhoq-admin/archives DELETE] live_sessions cleanup",
      liveDeleteError
    );
  }

  return NextResponse.json({
    ok: true,
    sessionId,
    r2Folder: (archived.r2_folder as string) ?? null
  });
}
