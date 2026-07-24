import { NextResponse } from "next/server";
import { guestCookieHeaderValue } from "@/lib/guest-identity";
import { resolveAccessContext } from "@/lib/room-access";
import { createClient } from "@/lib/supabase/server";

/** Keepalive for active room session — does not meter time. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    fingerprint?: string;
    clientGuestId?: string;
  } | null;

  const ctx = await resolveAccessContext(
    body?.fingerprint ?? "",
    body?.clientGuestId
  );
  const headers = new Headers();
  if (ctx.guestId) {
    headers.set("Set-Cookie", guestCookieHeaderValue(ctx.guestId));
  }

  const supabase = await createClient();

  await supabase.rpc("active_room_heartbeat", {
    p_subject_key: ctx.subjectKey,
    p_device_hash: ctx.deviceHash
  });

  return NextResponse.json(
    {
      ok: true,
      tier: ctx.tier,
      guestId: ctx.guestId
    },
    { headers }
  );
}
