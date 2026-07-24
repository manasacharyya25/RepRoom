import { NextResponse } from "next/server";
import {
  addUsageSeconds,
  getUsage,
  resolveAccessContext
} from "@/lib/room-access";
import { createClient } from "@/lib/supabase/server";

/** Report broadcast (Go Live) seconds for the signed-in free user. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    fingerprint?: string;
    seconds?: number;
  } | null;

  const ctx = await resolveAccessContext(body?.fingerprint ?? "");
  if (!ctx.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ctx.metersBroadcast) {
    return NextResponse.json({
      ok: true,
      tier: ctx.tier,
      remainingSeconds: null,
      secondsUsed: 0,
      exhausted: false
    });
  }

  const seconds = Math.min(
    600,
    Math.max(0, Math.round(body?.seconds ?? 0))
  );

  const supabase = await createClient();
  const usage =
    seconds > 0
      ? await addUsageSeconds(
          supabase,
          ctx.subjectKey,
          seconds,
          ctx.quotaSeconds
        )
      : await getUsage(supabase, ctx.subjectKey, ctx.quotaSeconds);

  const exhausted =
    usage.remainingSeconds !== null && usage.remainingSeconds <= 0;

  return NextResponse.json({
    ok: true,
    tier: ctx.tier,
    remainingSeconds: usage.remainingSeconds,
    secondsUsed: usage.secondsUsed,
    exhausted,
    reason: exhausted ? "free_time" : null
  });
}
