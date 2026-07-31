import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { isValidOnboardingUsername } from "@/lib/onboarding-recorder";
import { readRhoqAdminSession } from "@/lib/rhoq-admin";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export async function GET(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Admin client is not configured" },
      { status: 503 }
    );
  }

  const auth = await readRhoqAdminSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const archived = searchParams.get("archived") === "1";
  const pageRaw = Number(searchParams.get("page") ?? 1);
  const limitRaw = Number(searchParams.get("limit") ?? DEFAULT_PAGE_SIZE);
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(
      1,
      Number.isFinite(limitRaw) ? Math.floor(limitRaw) : DEFAULT_PAGE_SIZE
    )
  );
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const admin = createAdminClient();

  let countQuery = admin
    .from("onboarding_recorders")
    .select("id", { count: "exact", head: true });
  countQuery = archived
    ? countQuery.not("promoted_at", "is", null)
    : countQuery.is("promoted_at", null);

  const { count: totalCount, error: countError } = await countQuery;
  if (countError) {
    console.error("[rhoq-admin/recorders count]", countError);
    return NextResponse.json(
      { error: "Could not load recorders" },
      { status: 500 }
    );
  }

  const total = totalCount ?? 0;

  let query = admin
    .from("onboarding_recorders")
    .select(
      "id, username, max_seconds, seconds_used, active, created_at, updated_at, promoted_at, promoted_user_id"
    )
    .order(archived ? "promoted_at" : "created_at", {
      ascending: false,
      nullsFirst: false
    })
    .range(from, to);

  query = archived
    ? query.not("promoted_at", "is", null)
    : query.is("promoted_at", null);

  const { data: recorders, error } = await query;

  if (error) {
    console.error("[rhoq-admin/recorders]", error);
    return NextResponse.json(
      { error: "Could not load recorders" },
      { status: 500 }
    );
  }

  const ids = (recorders ?? []).map((row) => row.id as string);
  const sessionCountById = new Map<string, number>();
  const imageCountById = new Map<string, number>();

  if (ids.length > 0) {
    const [{ data: sessions }, { data: images }] = await Promise.all([
      admin
        .from("onboarding_recorder_sessions")
        .select("recorder_id")
        .in("recorder_id", ids)
        .gt("last_chunk_number", 0),
      admin
        .from("onboarding_recorder_images")
        .select("recorder_id")
        .in("recorder_id", ids)
    ]);

    for (const row of sessions ?? []) {
      const id = row.recorder_id as string;
      sessionCountById.set(id, (sessionCountById.get(id) ?? 0) + 1);
    }
    for (const row of images ?? []) {
      const id = row.recorder_id as string;
      imageCountById.set(id, (imageCountById.get(id) ?? 0) + 1);
    }
  }

  const hasMore = from + (recorders?.length ?? 0) < total;

  return NextResponse.json({
    ok: true,
    archived,
    page,
    limit,
    total,
    hasMore,
    recorders: (recorders ?? []).map((row) => ({
      id: row.id as string,
      username: (row.username as string).toLowerCase(),
      maxSeconds: row.max_seconds as number,
      secondsUsed: row.seconds_used as number,
      active: Boolean(row.active),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      promotedAt: (row.promoted_at as string | null) ?? null,
      promotedUserId: (row.promoted_user_id as string | null) ?? null,
      sessionCount: sessionCountById.get(row.id as string) ?? 0,
      imageCount: imageCountById.get(row.id as string) ?? 0
    }))
  });
}

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Admin client is not configured" },
      { status: 503 }
    );
  }

  const auth = await readRhoqAdminSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    username?: string;
    password?: string;
    maxSeconds?: number;
  } | null;

  const username = String(body?.username ?? "")
    .trim()
    .toLowerCase();
  const password = String(body?.password ?? "");
  const maxSecondsRaw = Number(body?.maxSeconds ?? 3600);
  const maxSeconds =
    Number.isFinite(maxSecondsRaw) && maxSecondsRaw > 0
      ? Math.min(86_400, Math.floor(maxSecondsRaw))
      : 3600;

  if (!isValidOnboardingUsername(username)) {
    return NextResponse.json(
      {
        error:
          "Invalid username (a-z, 0-9, underscore, hyphen; 1–32 chars)."
      },
      { status: 400 }
    );
  }
  if (password.length < 4) {
    return NextResponse.json(
      { error: "Password must be at least 4 characters" },
      { status: 400 }
    );
  }

  const passwordHash = await hash(password, 10);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("onboarding_recorders")
    .insert({
      username,
      password_hash: passwordHash,
      max_seconds: maxSeconds,
      seconds_used: 0,
      active: true
    })
    .select(
      "id, username, max_seconds, seconds_used, active, created_at, promoted_at"
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `Username @${username} already exists` },
        { status: 409 }
      );
    }
    console.error("[rhoq-admin/recorders POST]", error);
    return NextResponse.json(
      { error: error.message || "Could not create recorder" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    recorder: {
      id: data.id as string,
      username: (data.username as string).toLowerCase(),
      maxSeconds: data.max_seconds as number,
      secondsUsed: data.seconds_used as number,
      active: Boolean(data.active),
      createdAt: data.created_at as string,
      promotedAt: (data.promoted_at as string | null) ?? null
    }
  });
}
