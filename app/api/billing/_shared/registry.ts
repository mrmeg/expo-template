/**
 * Process-wide billing dependency registry.
 *
 * Routes read their collaborators (resolver, catalog, checkout session
 * factory, portal session factory, webhook verifier / handler) from
 * this registry. Concrete wiring to Stripe and Cognito lives in a
 * later spec (`add-stripe-subscriptions-bootstrap-and-config`); this
 * file is the seam they plug into.
 *
 * Routes that find the registry unconfigured MUST fail closed with a
 * typed error — never silently fall through.
 */

import type { PlanDefinition } from "@/shared/billing";
import type { BillingAccountResolver } from "./types";

export interface CheckoutSessionRequest {
  userId: string;
  email: string | null;
  customerId: string;
  planId: string;
  interval: "month" | "year";
  /**
   * The server-resolved Stripe price id for the requested plan/interval.
   * The route maps {planId, interval} onto a price id via the catalog
   * before calling the factory, so adapters never need to know about
   * the plan catalog.
   */
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  url: string;
  expiresAt: string | null;
}

export interface PortalSessionRequest {
  customerId: string;
  returnUrl: string;
}

export interface PortalSessionResult {
  url: string;
}

export interface WebhookSignatureVerifier {
  /**
   * Verify a Stripe signature header against the raw request body.
   * Returns the parsed event on success; throws on invalid signature.
   */
  verify(rawBody: string, signature: string): { id: string; type: string; data: unknown };
}

export interface WebhookHandler {
  /**
   * Apply an authoritative billing event. Implementations MUST be
   * idempotent — the same `event.id` may be delivered multiple times.
   */
  handle(event: { id: string; type: string; data: unknown }): Promise<void>;
}

export interface BillingRegistry {
  resolver: BillingAccountResolver;
  planCatalog: readonly PlanDefinition[];
  createCheckoutSession(input: CheckoutSessionRequest): Promise<CheckoutSessionResult>;
  createPortalSession(input: PortalSessionRequest): Promise<PortalSessionResult>;
  webhookVerifier: WebhookSignatureVerifier;
  webhookHandler: WebhookHandler;
}

let registry: BillingRegistry | null = null;

export function setBillingRegistry(next: BillingRegistry | null): void {
  registry = next;
}

export function getBillingRegistry(): BillingRegistry | null {
  return registry;
}
