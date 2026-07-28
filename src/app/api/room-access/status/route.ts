import { NextResponse } from "next/server";
import { guestCookieHeaderValue } from "@/lib/guest-identity";
import {
  applyBroadcastSeconds,
  resolveAccessContext
} from "@/lib/room-access";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fingerprint = searchParams.get("fingerprint") ?? "";
  const clientGuestId = searchParams.get("clientGuestId");

  const ctx = await resolveAccessContext(fingerprint, clientGuestId);
  const headers = new Headers();
  if (ctx.guestId) {
    headers.set("Set-Cookie", guestCookieHeaderValue(ctx.guestId));
  }

  if (ctx.tier === "guest" || ctx.meterMode === "none") {
    return NextResponse.json(
      {
        tier: ctx.tier,
        plan: ctx.plan,
        remainingSeconds: null,
        secondsUsed: 0,
        quotaSeconds: 0,
        creditSeconds: 0,
        metersBroadcast: false,
        guestId: ctx.guestId
      },
      { headers }
    );
  }

  if (ctx.meterMode === "premium_silent_daily") {
    return NextResponse.json(
      {
        tier: ctx.tier,
        plan: ctx.plan,
        remainingSeconds: null,
        secondsUsed: 0,
        quotaSeconds: 0,
        creditSeconds: ctx.creditSeconds,
        metersBroadcast: false,
        guestId: ctx.guestId
      },
      { headers }
    );
  }

  const supabase = await createClient();
  const result = await applyBroadcastSeconds(supabase, ctx, 0);

  return NextResponse.json(
    {
      tier: ctx.tier,
      plan: ctx.plan,
      remainingSeconds: result.remainingSeconds,
      secondsUsed: result.secondsUsed,
      quotaSeconds:
        ctx.meterMode === "credit_bank" ? ctx.creditSeconds : ctx.quotaSeconds,
      creditSeconds: result.creditSeconds,
      metersBroadcast: ctx.metersBroadcastUx,
      guestId: ctx.guestId
    },
    { headers }
  );
}
