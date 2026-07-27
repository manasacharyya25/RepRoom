import { NextResponse } from "next/server";
import { readRhoqAdminSession } from "@/lib/rhoq-admin";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Mark / unmark an onboarding recorder as promoted (moves between active list and archive).
 * Body: { promoted: boolean, userId?: string }
 */
export async function POST(request: Request, context: RouteContext) {
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

  const body = (await request.json().catch(() => null)) as {
    promoted?: boolean;
    userId?: string;
  } | null;

  if (typeof body?.promoted !== "boolean") {
    return NextResponse.json(
      { error: "promoted (boolean) is required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const patch = body.promoted
    ? {
        promoted_at: now,
        promoted_user_id: body.userId?.trim() || null,
        active: false,
        updated_at: now
      }
    : {
        promoted_at: null,
        promoted_user_id: null,
        active: true,
        updated_at: now
      };

  const { data, error } = await admin
    .from("onboarding_recorders")
    .update(patch)
    .eq("id", recorderId)
    .select(
      "id, username, active, promoted_at, promoted_user_id, updated_at"
    )
    .maybeSingle();

  if (error) {
    console.error("[rhoq-admin/recorders/id/promote-status]", error);
    return NextResponse.json(
      { error: error.message || "Could not update recorder" },
      { status: 500 }
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Recorder not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    recorder: {
      id: data.id as string,
      username: (data.username as string).toLowerCase(),
      active: Boolean(data.active),
      promotedAt: (data.promoted_at as string | null) ?? null,
      promotedUserId: (data.promoted_user_id as string | null) ?? null,
      updatedAt: data.updated_at as string
    }
  });
}
