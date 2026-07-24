import { NextResponse } from "next/server";
import { guestCookieHeaderValue } from "@/lib/guest-identity";
import { getUsage, resolveAccessContext } from "@/lib/room-access";
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

  // Guests: view quota is browser-local only.
  if (ctx.tier === "guest") {
    return NextResponse.json(
      {
        tier: ctx.tier,
        plan: ctx.plan,
        remainingSeconds: null,
        secondsUsed: 0,
        quotaSeconds: 0,
        metersBroadcast: false,
        guestId: ctx.guestId
      },
      { headers }
    );
  }

  if (!ctx.metersBroadcast) {
    return NextResponse.json(
      {
        tier: ctx.tier,
        plan: ctx.plan,
        remainingSeconds: null,
        secondsUsed: 0,
        quotaSeconds: 0,
        metersBroadcast: false,
        guestId: ctx.guestId
      },
      { headers }
    );
  }

  const supabase = await createClient();
  const usage = await getUsage(supabase, ctx.subjectKey, ctx.quotaSeconds);

  return NextResponse.json(
    {
      tier: ctx.tier,
      plan: ctx.plan,
      remainingSeconds: usage.remainingSeconds,
      secondsUsed: usage.secondsUsed,
      quotaSeconds: ctx.quotaSeconds,
      metersBroadcast: true,
      guestId: ctx.guestId
    },
    { headers }
  );
}
