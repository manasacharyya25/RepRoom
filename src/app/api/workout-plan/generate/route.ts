import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkoutPlan } from "@/lib/workout-plan-resolve";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  primaryGoal?: string;
  fitnessExperience?: string;
  daysPerWeek?: number;
  sessionMinutes?: number;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await resolveWorkoutPlan({
    primaryGoal: body.primaryGoal ?? "",
    fitnessExperience: body.fitnessExperience ?? "",
    daysPerWeek: Number(body.daysPerWeek),
    sessionMinutes: Number(body.sessionMinutes)
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    plan: result.plan,
    cached: result.cached,
    source: result.source
  });
}
