import { NextResponse } from "next/server";
import { readOnboardingSession } from "@/lib/onboarding-recorder";
import { resolveOnboardingArchiveChunks } from "@/lib/streaming/resolve-archive-chunks";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Resolve playable chunk indices for an ended onboarding recording.
 * Lists R2 at most once per session and persists available_chunks.
 */
export async function GET(request: Request) {
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

  const sessionId =
    new URL(request.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const result = await resolveOnboardingArchiveChunks(admin, {
      recorderId: auth.recorderId,
      sessionId
    });
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
    console.error("[onboarding-record/chunks]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not list chunks" },
      { status: 500 }
    );
  }
}
