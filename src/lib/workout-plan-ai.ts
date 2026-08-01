import {
  normalizeWorkoutPlan,
  scalePlanToSessionDuration,
  type WorkoutActivity,
  type WorkoutPlan,
  type WorkoutPlanDay
} from "@/lib/workout-plan";
import {
  experienceLabel,
  goalLabel,
  type WorkoutPlanCacheKey
} from "@/lib/workout-plan-seed";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function sanitizeActivity(raw: unknown): WorkoutActivity | null {
  if (!isRecord(raw)) return null;
  const type = String(raw.type ?? "");
  if (type === "rest") return null;
  if (type !== "warmup" && type !== "exercise" && type !== "cooldown") {
    return null;
  }

  let name = String(raw.name ?? "").trim();
  if (!name) return null;

  // Normalize add-on naming: "ADD-ON : Name"
  const addOnMatch = name.match(/^add[- ]?on\s*:?\s*(.+)$/i);
  if (addOnMatch?.[1]) {
    name = `ADD-ON : ${addOnMatch[1].trim()}`;
  }

  return {
    type,
    name,
    sets: asNullableNumber(raw.sets),
    reps: asNullableString(raw.reps),
    restSeconds: type === "exercise" ? 60 : asNullableNumber(raw.restSeconds),
    durationSeconds: asNullableNumber(raw.durationSeconds),
    youtubeQuery: asNullableString(raw.youtubeQuery)
  };
}

function sanitizeDay(raw: unknown, index: number): WorkoutPlanDay | null {
  if (!isRecord(raw)) return null;
  const activitiesRaw = Array.isArray(raw.activities) ? raw.activities : [];
  const activities = activitiesRaw
    .map(sanitizeActivity)
    .filter((item): item is WorkoutActivity => Boolean(item));

  const title = String(raw.title ?? `Day ${index + 1}`).trim();
  if (!title || activities.length === 0) return null;

  return {
    day: typeof raw.day === "number" ? raw.day : index + 1,
    title,
    activities
  };
}

/** Validate + coerce LLM JSON into our WorkoutPlan shape. */
export function sanitizeGeneratedPlan(
  raw: unknown,
  key: WorkoutPlanCacheKey
): WorkoutPlan | null {
  const normalized = normalizeWorkoutPlan(raw);
  const base = normalized ?? (isRecord(raw) ? raw : null);
  if (!base) return null;

  const daysRaw = Array.isArray((base as WorkoutPlan).days)
    ? (base as WorkoutPlan).days
    : isRecord(base) && Array.isArray(base.days)
      ? base.days
      : null;
  if (!daysRaw) return null;

  const days = daysRaw
    .map((day, index) => sanitizeDay(day, index))
    .filter((day): day is WorkoutPlanDay => Boolean(day));

  if (days.length !== key.daysPerWeek) return null;

  const hasExercise = days.every((day) =>
    day.activities.some((activity) => activity.type === "exercise")
  );
  if (!hasExercise) return null;

  const name =
    String((base as WorkoutPlan).name ?? "").trim() ||
    `${experienceLabel(key.experience)} ${goalLabel(key.goal)}`;
  const description =
    String((base as WorkoutPlan).description ?? "").trim() ||
    `A ${key.daysPerWeek}-day plan for ${goalLabel(key.goal).toLowerCase()}.`;

  return {
    name,
    description,
    goal: humanReadableOr(
      (base as WorkoutPlan).goal,
      goalLabel(key.goal)
    ),
    experience: humanReadableOr(
      (base as WorkoutPlan).experience,
      experienceLabel(key.experience)
    ),
    workoutStyle: humanReadableOr(
      (base as WorkoutPlan).workoutStyle,
      "Strength Training"
    ),
    split: humanReadableOr((base as WorkoutPlan).split, "Full Body"),
    sessionsPerWeek: key.daysPerWeek,
    sessionDurationSeconds: key.sessionMinutes * 60,
    days: days.map((day, index) => ({ ...day, day: index + 1 })),
    source: "ai"
  };
}

function humanReadableOr(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  if (!text || text.includes("_")) return fallback;
  return text;
}

function buildPrompt(key: WorkoutPlanCacheKey): string {
  return `Create one workout plan as JSON only (no markdown).

Inputs:
- goal: ${key.goal} (${goalLabel(key.goal)})
- experience: ${key.experience}
- days per week: ${key.daysPerWeek}
- session duration minutes: ${key.sessionMinutes}

Return exactly this shape:
{
  "name": string,
  "description": string,
  "goal": string,
  "experience": string,
  "workoutStyle": string,
  "split": string,
  "sessionsPerWeek": ${key.daysPerWeek},
  "sessionDurationSeconds": ${key.sessionMinutes * 60},
  "days": [
    {
      "day": 1,
      "title": string,
      "activities": [
        {
          "type": "warmup" | "exercise" | "cooldown",
          "name": string,
          "sets": number | null,
          "reps": string | null,
          "restSeconds": 60,
          "durationSeconds": number | null,
          "youtubeQuery": string | null
        }
      ]
    }
  ]
}

Rules:
- days array length MUST be ${key.daysPerWeek}
- goal / experience / workoutStyle / split must be human-readable Title Case
  (e.g. goal "Build Muscle", experience "Beginner", not snake_case ids)
- each day needs: warmups, main exercises, optional ADD-ON exercises, and cooldowns
- NEVER include activities with type "rest". Between exercises the app always uses a fixed 60s rest.
- for every exercise set restSeconds to 60
- maximize productive work time; keep rests short (the fixed 60s only)
- for exercises: durationSeconds is the time for ONE set (seconds). UI multiplies by sets.
- for EVERY type "exercise" (including ADD-ON): sets and reps are REQUIRED
  (sets: positive integer, reps: string e.g. "8-12", "10", "30s hold")
- for warmup/cooldown: sets and reps may be null; durationSeconds is the FULL block duration
- Fill the session: sum of warmup + cooldown + (exercise durationSeconds * sets) + (60 * (exerciseCount - 1))
  should equal sessionDurationSeconds (${key.sessionMinutes * 60}) within ±60 seconds
- If time remains after the core plan, add 1–3 optional finishers named exactly:
  "ADD-ON : <Exercise Name>" (type "exercise")
- youtubeQuery should be a short search query for form demos
- tailor difficulty to ${key.experience}
- tailor exercise selection to goal ${key.goal}
- use practical gym or home-adaptable movements`;
}

export async function generateWorkoutPlanWithAi(
  key: WorkoutPlanCacheKey
): Promise<{ plan: WorkoutPlan; model: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_WORKOUT_MODEL?.trim() || DEFAULT_MODEL;

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a certified strength coach. Reply with valid JSON only matching the requested workout plan schema."
        },
        {
          role: "user",
          content: buildPrompt(key)
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(
      "[workout-plan-ai] OpenAI error",
      response.status,
      detail.slice(0, 400)
    );
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error("[workout-plan-ai] invalid JSON from model");
    return null;
  }

  const plan = sanitizeGeneratedPlan(parsed, key);
  if (!plan) {
    console.error("[workout-plan-ai] plan failed schema validation");
    return null;
  }

  return { plan: scalePlanToSessionDuration(plan), model };
}
