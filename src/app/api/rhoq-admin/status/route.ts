import { NextResponse } from "next/server";
import {
  getRhoqAdminPassword,
  readRhoqAdminSession
} from "@/lib/rhoq-admin";

export const runtime = "nodejs";

export async function GET() {
  if (!getRhoqAdminPassword()) {
    return NextResponse.json(
      { error: "Admin panel is not configured", authenticated: false },
      { status: 503 }
    );
  }

  const session = await readRhoqAdminSession();
  return NextResponse.json({
    ok: true,
    authenticated: Boolean(session)
  });
}
