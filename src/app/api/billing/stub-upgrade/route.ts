import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Demo unlock — replace with Stripe Checkout later. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ plan: "premium" })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, plan: "premium" });
}
