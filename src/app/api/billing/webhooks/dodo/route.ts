import { NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type DodoWebhookPayload = {
  type?: string;
  data?: Record<string, unknown>;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function metadataOf(data: Record<string, unknown> | undefined) {
  const meta = data?.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    return meta as Record<string, unknown>;
  }
  return {};
}

function productKindFromPayload(data: Record<string, unknown> | undefined) {
  const meta = metadataOf(data);
  const planId = asString(meta.plan_id);
  if (planId === "monthly") return "monthly" as const;
  if (planId === "yearly" || planId === "annual") return "annual" as const;
  if (planId === "hourly") return "hours" as const;

  const productId = asString(data?.product_id);
  if (productId && productId === process.env.DODO_PRODUCT_MONTHLY?.trim()) {
    return "monthly" as const;
  }
  if (productId && productId === process.env.DODO_PRODUCT_ANNUAL?.trim()) {
    return "annual" as const;
  }
  if (productId && productId === process.env.DODO_PRODUCT_HOUR?.trim()) {
    return "hours" as const;
  }
  return null;
}

export async function POST(request: Request) {
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim();
  if (!webhookKey) {
    return NextResponse.json(
      { error: "Webhook is not configured" },
      { status: 503 }
    );
  }
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Admin client is not configured" },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const headers = {
    "webhook-id": request.headers.get("webhook-id") || "",
    "webhook-signature": request.headers.get("webhook-signature") || "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") || ""
  };

  try {
    const wh = new Webhook(webhookKey);
    await wh.verify(rawBody, headers);
  } catch (error) {
    console.error("[billing/webhooks/dodo] verify failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: DodoWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as DodoWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = asString(payload.type);
  const data = payload.data ?? {};
  const admin = createAdminClient();
  const meta = metadataOf(data);
  const userId = asString(meta.user_id);
  const now = new Date().toISOString();

  try {
    if (type === "payment.succeeded") {
      const paymentId =
        asString(data.payment_id) || asString(data.id) || `payment:${now}`;
      const kind = productKindFromPayload(data);
      const hoursMeta = asNumber(meta.hours);
      const quantity = asNumber(data.quantity) ?? hoursMeta;
      const hours =
        kind === "hours"
          ? Math.max(1, Math.floor(quantity ?? hoursMeta ?? 0))
          : null;

      const { error: insertError } = await admin.from("billing_payments").insert({
        dodo_payment_id: paymentId,
        user_id: userId || null,
        kind: kind === "hours" ? "hours" : "subscription",
        hours,
        amount_cents: asNumber(data.total_amount) ?? asNumber(data.amount),
        status: "succeeded",
        metadata: data
      });

      if (insertError) {
        if (insertError.code === "23505") {
          return NextResponse.json({ ok: true, duplicate: true });
        }
        throw insertError;
      }

      if (kind === "hours" && userId && hours) {
        const { error: creditError } = await admin.rpc("broadcast_credit_add", {
          p_user_id: userId,
          p_seconds: hours * 3600
        });
        if (creditError) throw creditError;
      }

      const customerId = asString(data.customer_id);
      if (userId && customerId) {
        await admin.from("billing_customers").upsert(
          {
            user_id: userId,
            dodo_customer_id: customerId,
            updated_at: now
          },
          { onConflict: "user_id" }
        );
      }
    }

    if (
      type === "subscription.active" ||
      type === "subscription.renewed" ||
      type === "subscription.updated"
    ) {
      const subscriptionId =
        asString(data.subscription_id) || asString(data.id);
      if (!subscriptionId) {
        return NextResponse.json({ ok: true, skipped: true });
      }

      const product =
        productKindFromPayload(data) === "annual" ? "annual" : "monthly";
      const status = asString(data.status) || "active";
      const periodEnd =
        asString(data.next_billing_date) ||
        asString(data.current_period_end) ||
        null;

      const resolvedUserId =
        userId ||
        (
          await admin
            .from("billing_subscriptions")
            .select("user_id")
            .eq("dodo_subscription_id", subscriptionId)
            .maybeSingle()
        ).data?.user_id;

      if (!resolvedUserId) {
        console.warn("[billing/webhooks/dodo] subscription without user_id", {
          subscriptionId,
          type
        });
        return NextResponse.json({ ok: true, skipped: true });
      }

      await admin.from("billing_subscriptions").upsert(
        {
          user_id: resolvedUserId,
          dodo_subscription_id: subscriptionId,
          product,
          status,
          current_period_end: periodEnd,
          metadata: data,
          updated_at: now
        },
        { onConflict: "dodo_subscription_id" }
      );

      const active =
        status === "active" ||
        status === "renewed" ||
        type === "subscription.active" ||
        type === "subscription.renewed";

      if (active) {
        await admin
          .from("profiles")
          .update({ plan: "premium", updated_at: now })
          .eq("id", resolvedUserId);

        await admin
          .from("referrals")
          .update({ converted_to_premium_at: now })
          .eq("referee_id", resolvedUserId)
          .is("converted_to_premium_at", null);
      }

      const customerId = asString(data.customer_id);
      if (customerId) {
        await admin.from("billing_customers").upsert(
          {
            user_id: resolvedUserId,
            dodo_customer_id: customerId,
            updated_at: now
          },
          { onConflict: "user_id" }
        );
      }
    }

    if (
      type === "subscription.cancelled" ||
      type === "subscription.on_hold" ||
      type === "subscription.failed"
    ) {
      const subscriptionId =
        asString(data.subscription_id) || asString(data.id);
      if (subscriptionId) {
        await admin
          .from("billing_subscriptions")
          .update({
            status: asString(data.status) || type.replace("subscription.", ""),
            metadata: data,
            updated_at: now
          })
          .eq("dodo_subscription_id", subscriptionId);
      }

      const resolvedUserId =
        userId ||
        (subscriptionId
          ? (
              await admin
                .from("billing_subscriptions")
                .select("user_id")
                .eq("dodo_subscription_id", subscriptionId)
                .maybeSingle()
            ).data?.user_id
          : null);

      if (resolvedUserId) {
        const { data: activeSubs } = await admin
          .from("billing_subscriptions")
          .select("id")
          .eq("user_id", resolvedUserId)
          .in("status", ["active", "renewed"]);

        if (!activeSubs?.length) {
          await admin
            .from("profiles")
            .update({ plan: "free", updated_at: now })
            .eq("id", resolvedUserId);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[billing/webhooks/dodo]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook failed" },
      { status: 500 }
    );
  }
}
