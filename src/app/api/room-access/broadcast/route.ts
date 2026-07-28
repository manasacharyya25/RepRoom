import { NextResponse } from "next/server";
import {
  applyBroadcastSeconds,
  resolveAccessContext
} from "@/lib/room-access";
import { createClient } from "@/lib/supabase/server";

/** Report broadcast (Go Live) seconds for the signed-in user. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    fingerprint?: string;
    seconds?: number;
  } | null;

  const ctx = await resolveAccessContext(body?.fingerprint ?? "");
  if (!ctx.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const seconds = Math.min(
    600,
    Math.max(0, Math.round(body?.seconds ?? 0))
  );

  const supabase = await createClient();
  const result = await applyBroadcastSeconds(supabase, ctx, seconds);

  return NextResponse.json({
    ok: true,
    tier: ctx.tier,
    plan: ctx.plan,
    remainingSeconds: result.remainingSeconds,
    secondsUsed: result.secondsUsed,
    creditSeconds: result.creditSeconds,
    metersBroadcast: ctx.metersBroadcastUx,
    exhausted: result.exhaustedUx,
    serverStop: result.serverStop,
    reason: result.exhaustedUx ? "free_time" : null
  });
}
