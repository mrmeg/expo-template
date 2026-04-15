/**
 * Default Stripe-backed `BillingAccountResolver`.
 *
 * This resolver implements the identity contract documented in
 * `Agent/Docs/BILLING.md`. It depends on a minimal `StripeCustomersPort`
 * interface rather than the Stripe SDK directly, so it can be unit-tested
 * without network access and so a later spec can swap in a real Stripe
 * client (or a database-backed alternative) without changing call sites.
 */

import {
  DEFAULT_PLAN_CATALOG,
  freeBillingSummary,
  normalizeStripeSubscription,
  type BillingSummary,
  type StripeSubscriptionLike,
} from "@/shared/billing";

import {
  CustomerConflictError,
  type AuthenticatedUser,
  type BillingAccountResolver,
  type PlanCatalog,
} from "./types";

/**
 * Minimal Stripe customer shape the resolver reads.
 */
export interface StripeCustomerLike {
  id: string;
  email: string | null;
  metadata?: Record<string, string | undefined> | null;
}

/**
 * Port the resolver depends on. The production implementation will
 * adapt this interface onto `stripe.customers` and `stripe.subscriptions`
 * in a later spec (`add-stripe-subscriptions-bootstrap-and-config`).
 */
export interface StripeCustomersPort {
  findByAppUserId(appUserId: string): Promise<StripeCustomerLike | null>;
  findByEmail(email: string): Promise<StripeCustomerLike[]>;
  updateMetadata(
    customerId: string,
    metadata: Record<string, string>,
  ): Promise<void>;
  create(params: {
    email: string | null;
    metadata: Record<string, string>;
  }): Promise<StripeCustomerLike>;
  listActiveSubscriptions(
    customerId: string,
  ): Promise<readonly StripeSubscriptionLike[]>;
}

export interface StripeBillingAccountResolverOptions {
  stripe: StripeCustomersPort;
  planCatalog?: PlanCatalog;
  now?: () => Date;
}

/**
 * Factory for the default Stripe-backed resolver. The returned object
 * satisfies `BillingAccountResolver`.
 */
export function createStripeBillingAccountResolver(
  options: StripeBillingAccountResolverOptions,
): BillingAccountResolver {
  const { stripe, planCatalog = DEFAULT_PLAN_CATALOG, now = () => new Date() } =
    options;

  async function resolveOrCreateCustomer(
    user: AuthenticatedUser,
  ): Promise<{ customerId: string }> {
    // 1. Metadata-keyed lookup: the deterministic happy path.
    const byMetadata = await stripe.findByAppUserId(user.userId);
    if (byMetadata) {
      return { customerId: byMetadata.id };
    }

    // 2. Email backfill: only applies when email is present AND exactly
    //    one customer matches AND that customer is not already claimed
    //    by a different appUserId.
    if (user.email) {
      const byEmail = await stripe.findByEmail(user.email);
      const unclaimed = byEmail.filter((c) => {
        const owner = c.metadata?.appUserId;
        return !owner || owner === user.userId;
      });

      if (unclaimed.length === 1) {
        const candidate = unclaimed[0]!;
        await stripe.updateMetadata(candidate.id, {
          appUserId: user.userId,
        });
        return { customerId: candidate.id };
      }

      if (unclaimed.length > 1) {
        throw new CustomerConflictError(unclaimed.map((c) => c.id));
      }
    }

    // 3. No linkable customer — create a fresh one.
    const created = await stripe.create({
      email: user.email,
      metadata: { appUserId: user.userId },
    });
    return { customerId: created.id };
  }

  async function getBillingSummary(
    user: AuthenticatedUser,
  ): Promise<BillingSummary> {
    // Never auto-create a customer when reading the summary; users who
    // have never opened billing must receive a valid `free` summary.
    const customer = await stripe.findByAppUserId(user.userId);
    if (!customer) {
      return freeBillingSummary({ sourceUpdatedAt: now().toISOString() });
    }

    const subscriptions = await stripe.listActiveSubscriptions(customer.id);
    const subscription = subscriptions[0] ?? null;

    if (!subscription) {
      return freeBillingSummary({
        customerId: customer.id,
        sourceUpdatedAt: now().toISOString(),
      });
    }

    return normalizeStripeSubscription(subscription, planCatalog, now);
  }

  return { resolveOrCreateCustomer, getBillingSummary };
}
