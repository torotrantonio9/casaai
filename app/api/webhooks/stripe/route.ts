import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const stripe = getStripe();

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const agencyId = session.metadata?.agency_id;
      const customerId =
        typeof session.customer === "string" ? session.customer : null;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;

      if (agencyId && customerId) {
        // Save Stripe customer ID
        await supabase
          .from("agencies")
          .update({ stripe_customer_id: customerId })
          .eq("id", agencyId);

        // Determine tier from subscription
        if (subscriptionId) {
          const subResponse =
            await stripe.subscriptions.retrieve(subscriptionId);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sub = subResponse as any;
          const priceId = sub.items?.data?.[0]?.price?.id;

          let tier = "free";
          if (priceId === process.env.STRIPE_PRICE_STARTER) tier = "starter";
          if (priceId === process.env.STRIPE_PRICE_PRO) tier = "pro";
          if (priceId === process.env.STRIPE_PRICE_ENTERPRISE)
            tier = "enterprise";

          const expiresAt = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null;

          await supabase
            .from("agencies")
            .update({
              subscription_tier: tier,
              subscription_expires_at: expiresAt,
            })
            .eq("id", agencyId);
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subUpdated = event.data.object as any;
      const customerIdUpdated =
        typeof subUpdated.customer === "string"
          ? subUpdated.customer
          : null;

      if (customerIdUpdated) {
        const priceId = subUpdated.items?.data?.[0]?.price?.id;

        let tier = "free";
        if (priceId === process.env.STRIPE_PRICE_STARTER) tier = "starter";
        if (priceId === process.env.STRIPE_PRICE_PRO) tier = "pro";
        if (priceId === process.env.STRIPE_PRICE_ENTERPRISE)
          tier = "enterprise";

        const expiresAt = subUpdated.current_period_end
          ? new Date(subUpdated.current_period_end * 1000).toISOString()
          : null;

        await supabase
          .from("agencies")
          .update({
            subscription_tier: tier,
            subscription_expires_at: expiresAt,
          })
          .eq("stripe_customer_id", customerIdUpdated);
      }
      break;
    }

    case "customer.subscription.deleted": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subDeleted = event.data.object as any;
      const customerId =
        typeof subDeleted.customer === "string"
          ? subDeleted.customer
          : null;

      if (customerId) {
        await supabase
          .from("agencies")
          .update({
            subscription_tier: "free",
            subscription_expires_at: null,
          })
          .eq("stripe_customer_id", customerId);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
