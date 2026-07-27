import { NextResponse } from "next/server";
import {
  encodeRhoqAdminSessionCookie,
  getRhoqAdminPassword,
  rhoqAdminSessionCookieHeader,
  verifyRhoqAdminPassword
} from "@/lib/rhoq-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!getRhoqAdminPassword()) {
    return NextResponse.json(
      { error: "Admin panel is not configured" },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    password?: string;
  } | null;

  const password = String(body?.password ?? "");
  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  if (!verifyRhoqAdminPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = encodeRhoqAdminSessionCookie();
  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", rhoqAdminSessionCookieHeader(token));
  return response;
}
