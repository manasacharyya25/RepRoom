import { NextResponse } from "next/server";
import { readRhoqAdminSession } from "@/lib/rhoq-admin";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
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

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("waitlist_emails")
    .select("id, email, source, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[rhoq-admin/waitlist]", error);
    return NextResponse.json(
      { error: error.message || "Could not load waitlist" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    entries: (data ?? []).map((row) => ({
      id: row.id as string,
      email: row.email as string,
      source: (row.source as string | null) ?? null,
      createdAt: row.created_at as string
    }))
  });
}
