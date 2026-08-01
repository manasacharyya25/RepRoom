import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createWorkoutLog } from "@/lib/workout-log-api";
import type { CreateWorkoutLogInput } from "@/lib/types/workout-log";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CreateWorkoutLogInput | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const result = await createWorkoutLog(supabase, user.id, body);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not log workout.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
