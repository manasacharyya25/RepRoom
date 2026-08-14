import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clearReferralCookie,
  normalizeReferralCode,
  REFERRAL_COOKIE
} from "@/lib/referral-cookie";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ApplyResult = {
  ok?: boolean;
  reason?: string;
};

function errorMessage(reason: string) {
  if (reason === "self") return "You can’t use your own referral code.";
  if (reason === "not_found" || reason === "invalid") {
    return "That referral code isn’t valid.";
  }
  return "Could not apply referral code.";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let bodyCode: string | null = null;
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      code?: unknown;
    } | null;
    bodyCode = normalizeReferralCode(
      typeof body?.code === "string" ? body.code : null
    );
  }

  const cookieStore = await cookies();
  const cookieCode = normalizeReferralCode(
    cookieStore.get(REFERRAL_COOKIE)?.value ?? null
  );
  const code = bodyCode || cookieCode;

  if (!code) {
    return NextResponse.json({ ok: true, reason: "skipped" as const });
  }

  const { data, error } = await supabase.rpc("apply_referral_code", {
    p_code: code
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (data ?? {}) as ApplyResult;
  const reason = typeof result.reason === "string" ? result.reason : "applied";
  const failed =
    result.ok === false ||
    reason === "invalid" ||
    reason === "not_found" ||
    reason === "self" ||
    reason === "unauthenticated";

  if (failed && bodyCode) {
    return NextResponse.json(
      { ok: false, reason, error: errorMessage(reason) },
      { status: 400 }
    );
  }

  const response = NextResponse.json({
    ok: !failed,
    reason
  });
  clearReferralCookie(response);
  return response;
}
