import { NextResponse } from "next/server";
import { readRhoqAdminSession } from "@/lib/rhoq-admin";
import { resolveOnboardingArchiveChunks } from "@/lib/streaming/resolve-archive-chunks";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Admin: resolve/persist archive chunk list for an onboarding session. */
export async function GET(request: Request, context: RouteContext) {
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
  const sessionId =
    new URL(request.url).searchParams.get("sessionId")?.trim() ?? "";

  if (!recorderId || !sessionId) {
    return NextResponse.json(
      { error: "recorder id and sessionId required" },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();
    const result = await resolveOnboardingArchiveChunks(admin, {
      recorderId,
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
    console.error("[rhoq-admin/recorders/chunks]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not list chunks" },
      { status: 500 }
    );
  }
}
