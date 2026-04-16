/**
 * Server-side billing identity contract.
 *
 * See `Agent/Docs/BILLING.md` for the architecture. The resolver
 * defined here is the single server boundary that maps an
 * authenticated Cognito user to a Stripe customer and produces the
 * normalized `BillingSummary` the client consumes.
 *
 * Raw Stripe SDK types MUST NOT leak past this boundary into UI code.
 */

import type { BillingSummary, PlanDefinition } from "@/shared/billing";

/**
 * Minimal authenticated-user shape the resolver needs.
 *
 * `userId` is the canonical app identity (Cognito `sub`). Email is a
 * convenience field used for backfilling legacy Stripe customers — it
 * is never the primary lookup key.
 */
export interface AuthenticatedUser {
  userId: string;
  email: string | null;
}

/**
 * The server-side billing identity contract. Concrete implementations
 * (Stripe-backed, database-backed, in-memory for tests) satisfy this
 * shape so the rest of the server can be written without knowing which
 * persistence strategy is in use.
 */
export interface BillingAccountResolver {
  /**
   * Resolve the Stripe customer id for an authenticated app user, or
   * create one when no existing customer can be linked safely.
   *
   * Linking rules (see BILLING.md and the default resolver):
   *   1. Exact-match on `metadata.appUserId === user.userId`.
   *   2. If no metadata match, look up customers by email. If exactly
   *      one matches, backfill `metadata.appUserId` and return it.
   *   3. If multiple candidate customers match by email, throw
   *      `CustomerConflictError` rather than auto-linking.
   *   4. Otherwise create a new customer with
   *      `metadata.appUserId = user.userId` and the user's email.
   */
  resolveOrCreateCustomer(
    user: AuthenticatedUser,
  ): Promise<{ customerId: string }>;

  /**
   * Return a normalized `BillingSummary` for the authenticated user.
   *
   * Users without a Stripe customer or without an active subscription
   * must still receive a valid `free` summary (see
   * `freeBillingSummary` in `shared/billing.ts`).
   */
  getBillingSummary(user: AuthenticatedUser): Promise<BillingSummary>;
}

/**
 * Thrown by `resolveOrCreateCustomer` when a deterministic identity
 * mapping cannot be established (e.g. multiple candidate customers
 * match by email and none carry `metadata.appUserId`). Servers should
 * surface this as a 409 to the caller; the template MUST NOT
 * auto-pick one of the duplicates.
 */
export class CustomerConflictError extends Error {
  readonly candidateCustomerIds: readonly string[];

  constructor(candidateCustomerIds: readonly string[]) {
    super(
      `Multiple Stripe customers match this user; manual linking required (${candidateCustomerIds.length} candidates).`,
    );
    this.name = "CustomerConflictError";
    this.candidateCustomerIds = candidateCustomerIds;
  }
}

/**
 * Plan catalog used by the resolver. Kept as an injected dependency so
 * tests can provide fixture catalogs and production code can swap in a
 * Stripe-metadata-driven catalog without changing call sites.
 */
export type PlanCatalog = readonly PlanDefinition[];
