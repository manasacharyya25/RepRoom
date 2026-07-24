import { NextResponse } from "next/server";
import {
  ACTIVE_SESSION_STALE_SECONDS,
  canAccessRoom
} from "@/lib/entitlements";
import { guestCookieHeaderValue } from "@/lib/guest-identity";
import { getUsage, resolveAccessContext } from "@/lib/room-access";
import { isRoomId } from "@/lib/rooms";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    roomId?: string;
    fingerprint?: string;
    clientGuestId?: string;
  } | null;

  const roomId = body?.roomId?.trim() ?? "";
  if (!isRoomId(roomId)) {
    return NextResponse.json({ error: "Invalid room" }, { status: 400 });
  }

  const ctx = await resolveAccessContext(
    body?.fingerprint ?? "",
    body?.clientGuestId
  );
  const responseHeaders = new Headers();
  if (ctx.guestId) {
    responseHeaders.set("Set-Cookie", guestCookieHeaderValue(ctx.guestId));
  }

  if (!canAccessRoom(ctx.tier, roomId)) {
    return NextResponse.json(
      {
        allowed: false,
        reason: "locked_room",
        tier: ctx.tier,
        remainingSeconds: null,
        guestId: ctx.guestId
      },
      { status: 403, headers: responseHeaders }
    );
  }

  const supabase = await createClient();

  let remainingSeconds: number | null = null;
  let secondsUsed = 0;
  let quotaSeconds = 0;

  // Broadcast remaining for signed-in users (viewing is not metered).
  if (ctx.userId) {
    quotaSeconds = ctx.quotaSeconds;
    if (ctx.metersBroadcast) {
      const usage = await getUsage(supabase, ctx.subjectKey, ctx.quotaSeconds);
      remainingSeconds = usage.remainingSeconds;
      secondsUsed = usage.secondsUsed;
    } else {
      remainingSeconds = null;
    }
  }

  const { data: claim, error: claimError } = await supabase.rpc(
    "active_room_claim",
    {
      p_subject_key: ctx.subjectKey,
      p_room_id: roomId,
      p_device_hash: ctx.deviceHash,
      p_ip_hash: ctx.ipHash,
      p_stale_seconds: ACTIVE_SESSION_STALE_SECONDS
    }
  );

  if (claimError) {
    return NextResponse.json(
      { error: claimError.message },
      { status: 500, headers: responseHeaders }
    );
  }

  const claimObj = claim as { ok?: boolean; message?: string } | null;
  if (claimObj && claimObj.ok === false) {
    return NextResponse.json(
      {
        allowed: false,
        reason: "device_conflict",
        message: claimObj.message ?? "Already active on another device",
        tier: ctx.tier,
        remainingSeconds,
        guestId: ctx.guestId
      },
      { status: 409, headers: responseHeaders }
    );
  }

  return NextResponse.json(
    {
      allowed: true,
      tier: ctx.tier,
      remainingSeconds,
      secondsUsed,
      quotaSeconds,
      metersBroadcast: ctx.metersBroadcast,
      guestId: ctx.guestId
    },
    { headers: responseHeaders }
  );
}
