import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("mark_revenue_share_interest");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (data ?? {}) as { ok?: boolean };
  if (result.ok === false) {
    return NextResponse.json({ error: "Could not apply" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
