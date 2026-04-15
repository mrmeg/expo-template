/**
 * Real Stripe SDK adapters for the billing ports.
 *
 * Everything in this file is implementation, not contract — the rest of
 * the server reaches Stripe only through `StripeCustomersPort`, the
 * checkout/portal session factories, and `WebhookSignatureVerifier`,
 * all defined elsewhere. Keeping the adapter isolated means:
 *   - Unit tests never load the `stripe` SDK.
 *   - Adopters who want a different billing backend (PaddleBilling,
 *     LemonSqueezy, etc.) replace this one file.
 *
 * The factory is the only public surface; it lazily constructs a
 * Stripe client and returns a bundle of ports.
 */

import Stripe from "stripe";

import type {
  StripeCustomerLike,
  StripeCustomersPort,
} from "./account";
import type {
  CheckoutSessionRequest,
  CheckoutSessionResult,
  PortalSessionRequest,
  PortalSessionResult,
  WebhookSignatureVerifier,
} from "./registry";
import type { StripeSubscriptionLike } from "@/shared/billing";

export interface StripeAdapterOptions {
  secretKey: string;
  webhookSecret: string;
}

export interface StripeAdapterBundle {
  stripe: Stripe;
  customers: StripeCustomersPort;
  createCheckoutSession(input: CheckoutSessionRequest): Promise<CheckoutSessionResult>;
  createPortalSession(input: PortalSessionRequest): Promise<PortalSessionResult>;
  webhookVerifier: WebhookSignatureVerifier;
}

export function createStripeAdapter(options: StripeAdapterOptions): StripeAdapterBundle {
  // No explicit apiVersion — the SDK types pin themselves to the latest
  // version automatically. Adopters who need to hold an older version
  // can construct their own Stripe client and replace this adapter.
  const stripe = new Stripe(options.secretKey, { typescript: true });

  const customers: StripeCustomersPort = {
    async findByAppUserId(appUserId) {
      // Stripe Search is eventually consistent (~1 min lag). The resolver
      // falls back to email backfill and then create, so stale reads can
      // at worst cause a short-lived duplicate customer — acceptable for
      // the template baseline. Adopters who need strict uniqueness should
      // layer a local mapping table in front of this port.
      const result = await stripe.customers.search({
        query: `metadata['appUserId']:'${escapeSearchLiteral(appUserId)}'`,
        limit: 2,
      });
      const first = result.data[0];
      return first ? toCustomerLike(first) : null;
    },

    async findByEmail(email) {
      const result = await stripe.customers.list({ email, limit: 10 });
      return result.data.map(toCustomerLike);
    },

    async updateMetadata(customerId, metadata) {
      await stripe.customers.update(customerId, { metadata });
    },

    async create({ email, metadata }) {
      const created = await stripe.customers.create({
        email: email ?? undefined,
        metadata,
      });
      return toCustomerLike(created);
    },

    async listActiveSubscriptions(customerId) {
      const result = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
        expand: ["data.items.data.price"],
      });
      // Collapse onto a single "current" subscription: prefer the most
      // recent that is still entitled (trialing/active/past_due), else
      // the most recent overall. Keeps downstream code single-sub.
      const sorted = [...result.data].sort(
        (a, b) => (b.created ?? 0) - (a.created ?? 0),
      );
      const entitled = sorted.find((s) =>
        s.status === "trialing" || s.status === "active" || s.status === "past_due",
      );
      const chosen = entitled ?? sorted[0];
      return chosen ? [toSubscriptionLike(chosen)] : [];
    },
  };

  async function createCheckoutSession(
    input: CheckoutSessionRequest,
  ): Promise<CheckoutSessionResult> {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: input.customerId,
      line_items: [{ price: input.priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.userId,
      // Metadata flows onto the Subscription too, which makes reconciliation
      // against the app user possible from the Stripe side.
      subscription_data: {
        metadata: {
          appUserId: input.userId,
          planId: input.planId,
        },
      },
    });
    return {
      url: session.url ?? "",
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    };
  }

  async function createPortalSession(
    input: PortalSessionRequest,
  ): Promise<PortalSessionResult> {
    const session = await stripe.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    return { url: session.url };
  }

  const webhookVerifier: WebhookSignatureVerifier = {
    verify(rawBody, signature) {
      const event = stripe.webhooks.constructEvent(rawBody, signature, options.webhookSecret);
      return { id: event.id, type: event.type, data: event.data };
    },
  };

  return {
    stripe,
    customers,
    createCheckoutSession,
    createPortalSession,
    webhookVerifier,
  };
}

function escapeSearchLiteral(value: string): string {
  // Stripe Search: single-quote the value and escape embedded quotes.
  return value.replace(/'/g, "\\'");
}

function toCustomerLike(customer: Stripe.Customer | Stripe.DeletedCustomer): StripeCustomerLike {
  if ("deleted" in customer && customer.deleted) {
    return { id: customer.id, email: null, metadata: {} };
  }
  const live = customer as Stripe.Customer;
  return {
    id: live.id,
    email: live.email ?? null,
    metadata: (live.metadata ?? {}) as Record<string, string>,
  };
}

function toSubscriptionLike(sub: Stripe.Subscription): StripeSubscriptionLike {
  // In recent Stripe API versions (2025-*), `current_period_end` moved
  // from the Subscription onto each Subscription Item. We only support
  // single-item subscriptions (Checkout creates one line item), so the
  // first item's period end is the one we surface. Older API versions
  // still populate it on the subscription object; both paths are
  // handled here.
  const legacyPeriodEnd = (sub as unknown as { current_period_end?: number })
    .current_period_end;
  const itemPeriodEnd = (sub.items.data[0] as unknown as { current_period_end?: number } | undefined)
    ?.current_period_end;
  const periodEnd =
    typeof itemPeriodEnd === "number"
      ? itemPeriodEnd
      : typeof legacyPeriodEnd === "number"
        ? legacyPeriodEnd
        : null;

  return {
    status: sub.status,
    cancel_at_period_end: sub.cancel_at_period_end,
    current_period_end: periodEnd,
    items: {
      data: sub.items.data.map((item) => ({
        price: {
          id: item.price.id,
          recurring: item.price.recurring
            ? { interval: item.price.recurring.interval }
            : null,
        },
      })),
    },
    customer:
      typeof sub.customer === "string" ? sub.customer : { id: sub.customer.id },
  };
}

