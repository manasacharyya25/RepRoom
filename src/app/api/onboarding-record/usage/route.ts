import { NextResponse } from "next/server";
import {
  readOnboardingSession,
  remainingSeconds,
  type OnboardingRecorderRow
} from "@/lib/onboarding-recorder";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_SECONDS_PER_REQUEST = 600;

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Onboarding recorder is not configured" },
      { status: 503 }
    );
  }

  const auth = await readOnboardingSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    seconds?: number;
  } | null;

  const seconds = Math.min(
    MAX_SECONDS_PER_REQUEST,
    Math.max(0, Math.round(body?.seconds ?? 0))
  );

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("onboarding_recorders")
    .select("id, max_seconds, seconds_used, active")
    .eq("id", auth.recorderId)
    .maybeSingle();

  if (error || !data || !data.active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = data as Pick<
    OnboardingRecorderRow,
    "id" | "max_seconds" | "seconds_used" | "active"
  >;

  let secondsUsed = row.seconds_used;
  if (seconds > 0) {
    const room = Math.max(0, row.max_seconds - row.seconds_used);
    const add = Math.min(seconds, room);
    if (add > 0) {
      const next = row.seconds_used + add;
      const { data: updated, error: updateError } = await admin
        .from("onboarding_recorders")
        .update({
          seconds_used: next,
          updated_at: new Date().toISOString()
        })
        .eq("id", row.id)
        .eq("seconds_used", row.seconds_used)
        .select("seconds_used, max_seconds")
        .maybeSingle();

      if (updateError) {
        console.error("[onboarding-record/usage]", updateError);
        return NextResponse.json(
          { error: "Could not update usage" },
          { status: 500 }
        );
      }

      if (updated) {
        secondsUsed = updated.seconds_used as number;
        row.max_seconds = updated.max_seconds as number;
      } else {
        // Concurrent flush — re-read current totals.
        const { data: fresh } = await admin
          .from("onboarding_recorders")
          .select("seconds_used, max_seconds")
          .eq("id", row.id)
          .maybeSingle();
        if (fresh) {
          secondsUsed = fresh.seconds_used as number;
          row.max_seconds = fresh.max_seconds as number;
        }
      }
    }
  }

  const remaining = remainingSeconds({
    max_seconds: row.max_seconds,
    seconds_used: secondsUsed
  });

  return NextResponse.json({
    ok: true,
    secondsUsed,
    maxSeconds: row.max_seconds,
    remainingSeconds: remaining,
    exhausted: remaining <= 0
  });
}
