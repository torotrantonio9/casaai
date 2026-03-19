import Stripe from "stripe";

let _stripe: Stripe | null = null;
export function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-02-25.clover",
    });
  }
  return _stripe;
}

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    priceId: null,
    limits: {
      listings: 3,
      leads_per_month: 10,
      ai_descriptions: 3,
      lead_scoring: false,
      advanced_analytics: false,
      api_access: false,
      import_csv: true,
      import_url: false,
      import_auto_sync: false,
      max_import_listings: 10,
    },
  },
  starter: {
    name: "Starter",
    price: 99,
    priceId: process.env.STRIPE_PRICE_STARTER,
    limits: {
      listings: 25,
      leads_per_month: 100,
      ai_descriptions: 50,
      lead_scoring: true,
      advanced_analytics: false,
      api_access: false,
      import_csv: true,
      import_url: true,
      import_auto_sync: false,
      max_import_listings: 25,
    },
  },
  pro: {
    name: "Pro",
    price: 249,
    priceId: process.env.STRIPE_PRICE_PRO,
    limits: {
      listings: 100,
      leads_per_month: Infinity,
      ai_descriptions: Infinity,
      lead_scoring: true,
      advanced_analytics: true,
      api_access: false,
      import_csv: true,
      import_url: true,
      import_auto_sync: true,
      max_import_listings: Infinity,
    },
  },
  enterprise: {
    name: "Enterprise",
    price: 499,
    priceId: process.env.STRIPE_PRICE_ENTERPRISE,
    limits: {
      listings: Infinity,
      leads_per_month: Infinity,
      ai_descriptions: Infinity,
      lead_scoring: true,
      advanced_analytics: true,
      api_access: true,
      import_csv: true,
      import_url: true,
      import_auto_sync: true,
      max_import_listings: Infinity,
    },
  },
} as const;

export type PlanTier = keyof typeof PLANS;

export function getPlanLimits(tier: string) {
  return PLANS[tier as PlanTier]?.limits ?? PLANS.free.limits;
}

export async function createCheckoutSession(params: {
  priceId: string;
  customerId?: string;
  customerEmail?: string;
  agencyId: string;
}) {
  const stripe = getStripe();
  return stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: params.priceId, quantity: 1 }],
    customer: params.customerId || undefined,
    customer_email: params.customerId ? undefined : params.customerEmail,
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/abbonamento?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/abbonamento?canceled=true`,
    metadata: { agency_id: params.agencyId },
  });
}

export async function createPortalSession(customerId: string) {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/abbonamento`,
  });
}
