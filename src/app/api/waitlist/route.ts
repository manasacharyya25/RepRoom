import { NextResponse } from "next/server";
import {
  isValidWaitlistEmail,
  isWaitlistMode,
  normalizeWaitlistEmail
} from "@/lib/waitlist";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isWaitlistMode()) {
    return NextResponse.json(
      { error: "Waitlist is not open." },
      { status: 404 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    source?: string;
  } | null;

  const email = normalizeWaitlistEmail(body?.email ?? "");
  if (!isValidWaitlistEmail(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  const source =
    typeof body?.source === "string" && body.source.trim()
      ? body.source.trim().slice(0, 80)
      : "landing";

  const supabase = await createClient();
  const { error } = await supabase.from("waitlist_emails").insert({
    email,
    source
  });

  if (error) {
    // Unique violation — already on the list.
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, alreadyJoined: true });
    }
    console.error("[waitlist]", error);
    return NextResponse.json(
      { error: "Could not join the waitlist. Try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, alreadyJoined: false });
}
