import { NextResponse } from "next/server";
import { ROOM_HEARTBEAT_SECONDS } from "@/lib/entitlements";
import { guestCookieHeaderValue } from "@/lib/guest-identity";
import {
  addUsageSeconds,
  resolveAccessContext
} from "@/lib/room-access";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    fingerprint?: string;
    seconds?: number;
  } | null;

  const ctx = await resolveAccessContext(body?.fingerprint ?? "");
  const headers = new Headers();
  if (ctx.guestId) {
    headers.set("Set-Cookie", guestCookieHeaderValue(ctx.guestId));
  }

  const seconds = Math.min(
    120,
    Math.max(1, Math.round(body?.seconds ?? ROOM_HEARTBEAT_SECONDS))
  );

  const supabase = await createClient();

  await supabase.rpc("active_room_heartbeat", {
    p_subject_key: ctx.subjectKey,
    p_device_hash: ctx.deviceHash
  });

  const usage = await addUsageSeconds(
    supabase,
    ctx.subjectKey,
    ctx.quotaSeconds <= 0 ? 0 : seconds,
    ctx.quotaSeconds
  );

  const exhausted =
    usage.remainingSeconds !== null && usage.remainingSeconds <= 0;

  return NextResponse.json(
    {
      ok: true,
      tier: ctx.tier,
      secondsUsed: usage.secondsUsed,
      remainingSeconds: usage.remainingSeconds,
      exhausted,
      reason: exhausted
        ? ctx.tier === "guest"
          ? "guest_time"
          : "free_time"
        : null
    },
    { headers }
  );
}
