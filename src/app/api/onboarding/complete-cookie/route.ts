import { NextResponse } from "next/server";
import { setOnboardingCompleteCookie } from "@/lib/onboarding-status-cookie";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Marks onboarding complete in a signed cookie after profile save. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarding_completed_at) {
    return NextResponse.json(
      { error: "Onboarding not completed" },
      { status: 400 }
    );
  }

  const response = NextResponse.json({ ok: true });
  await setOnboardingCompleteCookie(response, user.id);
  return response;
}
