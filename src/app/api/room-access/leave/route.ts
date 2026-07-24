import { NextResponse } from "next/server";
import { guestCookieHeaderValue } from "@/lib/guest-identity";
import { resolveAccessContext } from "@/lib/room-access";
import { createClient } from "@/lib/supabase/server";

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

  await supabase.rpc("active_room_release", {
    p_subject_key: ctx.subjectKey,
    p_device_hash: ctx.deviceHash
  });

  return NextResponse.json(
    { ok: true, guestId: ctx.guestId },
    { headers }
  );
}
