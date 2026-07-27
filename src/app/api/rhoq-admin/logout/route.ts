import { NextResponse } from "next/server";
import { clearRhoqAdminSessionCookieHeader } from "@/lib/rhoq-admin";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", clearRhoqAdminSessionCookieHeader());
  return response;
}
