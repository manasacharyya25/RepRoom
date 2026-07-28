import { NextResponse } from "next/server";
import {
  getDisplayPricing,
  resolveBillingMarket
} from "@/lib/billing/pricing";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timezone = searchParams.get("tz");
  const market = resolveBillingMarket(timezone);
  const pricing = getDisplayPricing(market);

  return NextResponse.json({
    ok: true,
    timezone: timezone?.trim() || null,
    ...pricing
  });
}
