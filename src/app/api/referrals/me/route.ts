import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  REFERRAL_COOKIE,
  normalizeReferralCode
} from "@/lib/referral-cookie";
import {
  REFERRAL_PREMIUM_GOAL,
  referralSharePath,
  type ReferralPerson
} from "@/lib/referrals";
import { resolveSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ReferralRow = {
  referee_id: string;
  created_at: string;
  converted_to_premium_at: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const pendingCode = normalizeReferralCode(
    cookieStore.get(REFERRAL_COOKIE)?.value ?? null
  );

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "referral_code, referred_by, revenue_share_eligible, revenue_share_interested"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { data: rows, error: listError } = await supabase
    .from("referrals")
    .select("referee_id, created_at, converted_to_premium_at")
    .eq("referrer_id", user.id)
    .order("created_at", { ascending: false });

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const referralRows = (rows ?? []) as ReferralRow[];
  const refereeIds = referralRows.map((row) => row.referee_id);
  let people: ReferralPerson[] = [];

  if (refereeIds.length > 0) {
    const { data: profiles, error: peopleError } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", refereeIds);

    if (peopleError) {
      return NextResponse.json({ error: peopleError.message }, { status: 500 });
    }

    const byId = new Map(
      ((profiles ?? []) as ProfileRow[]).map((item) => [item.id, item])
    );

    people = referralRows.map((row) => {
      const person = byId.get(row.referee_id);
      return {
        id: row.referee_id,
        displayName: person?.display_name?.trim() || "Athlete",
        username: person?.username ?? null,
        avatarUrl: person?.avatar_url ?? null,
        createdAt: row.created_at,
        premium: Boolean(row.converted_to_premium_at)
      };
    });
  }

  const referralCode =
    typeof profile?.referral_code === "string" ? profile.referral_code : null;
  const origin = resolveSiteUrl();

  return NextResponse.json({
    referralCode,
    shareUrl: referralCode ? `${origin}${referralSharePath(referralCode)}` : null,
    referredBy: Boolean(profile?.referred_by),
    pendingCode,
    revenueShareEligible: Boolean(profile?.revenue_share_eligible),
    revenueShareInterested: Boolean(profile?.revenue_share_interested),
    premiumCount: people.filter((person) => person.premium).length,
    goal: REFERRAL_PREMIUM_GOAL,
    referrals: people
  });
}
