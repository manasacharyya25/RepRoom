import { NextResponse } from "next/server";
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

  const supabase = await createClient();
  const flushSeconds = Math.min(
    600,
    Math.max(0, Math.round(body?.seconds ?? 0))
  );

  if (flushSeconds > 0 && ctx.quotaSeconds > 0) {
    await addUsageSeconds(
      supabase,
      ctx.subjectKey,
      flushSeconds,
      ctx.quotaSeconds
    );
  }

  await supabase.rpc("active_room_release", {
    p_subject_key: ctx.subjectKey,
    p_device_hash: ctx.deviceHash
  });

  return NextResponse.json({ ok: true }, { headers });
}
