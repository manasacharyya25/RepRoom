import { NextResponse } from "next/server";
import type { PremiumPlanId } from "@/lib/billing/plans";
import {
  clampHourPack,
  createDodoClient,
  dodoProductId,
  isDodoConfigured,
  planIdToProductKind
} from "@/lib/billing/dodo";
import { resolveSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isDodoConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured" },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();
  if (authError || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    planId?: PremiumPlanId;
    hours?: number;
  } | null;

  const planId = body?.planId;
  if (planId !== "hourly" && planId !== "monthly" && planId !== "yearly") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const kind = planIdToProductKind(planId);
  const productId = dodoProductId(kind);
  const hours = planId === "hourly" ? clampHourPack(Number(body?.hours ?? 10)) : null;

  const siteUrl = resolveSiteUrl();
  const dodo = createDodoClient();

  try {
    const session = await dodo.checkoutSessions.create({
      product_cart: [
        {
          product_id: productId,
          quantity: planId === "hourly" ? (hours as number) : 1
        }
      ],
      customer: {
        email: user.email,
        name:
          (user.user_metadata?.full_name as string | undefined) ||
          user.email.split("@")[0] ||
          "RhoQ member"
      },
      return_url: `${siteUrl}/billing/success`,
      metadata: {
        user_id: user.id,
        plan_id: planId,
        hours: hours !== null ? String(hours) : ""
      }
    });

    const checkoutUrl =
      (session as { checkout_url?: string }).checkout_url ??
      (session as { url?: string }).url;

    if (!checkoutUrl) {
      console.error("[billing/checkout] missing checkout_url", session);
      return NextResponse.json(
        { error: "Could not create checkout session" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      checkoutUrl,
      sessionId: (session as { session_id?: string }).session_id ?? null
    });
  } catch (error) {
    console.error("[billing/checkout]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not start checkout"
      },
      { status: 500 }
    );
  }
}
