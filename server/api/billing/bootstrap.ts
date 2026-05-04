/**
 * Server bootstrap for the default Stripe billing registry.
 *
 * Reads env vars via `readBillingEnv()` and — when Stripe secrets are
 * present — constructs the real adapter bundle (customers port,
 * session factories, webhook verifier) and installs it via
 * `setBillingRegistry`. When secrets are absent, leaves the registry
 * unset so routes return the typed `503 billing-disabled`.
 *
 * The bootstrap is idempotent and lazy: each billing route calls
 * `ensureBillingBootstrapped()` before reading the registry, so the
 * Stripe SDK is loaded exactly once (or never, for billing-off
 * deployments).
 */

import {
  createStripeBillingAccountResolver,
  type StripeCustomersPort,
} from "./account";
import { readBillingEnv, type BillingServerEnv } from "./env";
import { createMemoryIdempotencyStore } from "./idempotency";
import {
  getBillingRegistry,
  setBillingRegistry,
  type BillingRegistry,
  type WebhookHandler,
} from "./registry";
import { createStripeAdapter } from "./stripeAdapter";

export interface BootstrapOptions {
  env?: Record<string, string | undefined>;
  /**
   * Optional handler override. Defaults to a no-op handler that logs the
   * event type — adopters wire their own persistence / side effects here.
   */
  webhookHandler?: WebhookHandler;
  /** Optional override of the customers port for integration tests. */
  customersPortOverride?: StripeCustomersPort;
}

let bootstrapped = false;
let lastBootstrapped: "registered" | "skipped" | "skipped-partial" | null = null;

/**
 * Reset the bootstrap flag. Tests use this to re-run bootstrap with
 * different env vars in the same process.
 */
export function resetBillingBootstrap(): void {
  bootstrapped = false;
  lastBootstrapped = null;
  setBillingRegistry(null);
}

export function billingBootstrapState(): {
  bootstrapped: boolean;
  outcome: typeof lastBootstrapped;
  } {
  return { bootstrapped, outcome: lastBootstrapped };
}

/**
 * Idempotent, lazy bootstrap. Safe to call from every request handler.
 * Returns the registry (or null when billing is disabled).
 */
export function ensureBillingBootstrapped(
  options: BootstrapOptions = {},
): BillingRegistry | null {
  if (bootstrapped) return getBillingRegistry();

  // Don't overwrite a registry that something else already installed
  // (tests, or a deployment hook that wires a custom registry before
  // the first request lands).
  const preinstalled = getBillingRegistry();
  if (preinstalled) {
    bootstrapped = true;
    lastBootstrapped = "skipped";
    return preinstalled;
  }

  bootstrapped = true;

  const env = readBillingEnv(options.env);

  if (!env.hasStripeSecrets) {
    lastBootstrapped = "skipped";
    return null;
  }

  logPartialConfig(env);

  const adapter = createStripeAdapter({
    secretKey: env.stripeSecretKey!,
    webhookSecret: env.stripeWebhookSecret!,
  });

  const customers = options.customersPortOverride ?? adapter.customers;

  const resolver = createStripeBillingAccountResolver({
    stripe: customers,
    planCatalog: env.planCatalog,
  });

  const registry: BillingRegistry = {
    resolver,
    planCatalog: env.planCatalog,
    createCheckoutSession: adapter.createCheckoutSession,
    createPortalSession: adapter.createPortalSession,
    webhookVerifier: adapter.webhookVerifier,
    webhookHandler: options.webhookHandler ?? defaultWebhookHandler(),
  };

  setBillingRegistry(registry);
  lastBootstrapped = "registered";
  return registry;
}

function logPartialConfig(env: BillingServerEnv): void {
  if (env.missingPriceIds.length > 0) {
    console.warn(
      `⚠️ Stripe plan catalog has missing price ids: ${env.missingPriceIds.join(", ")}. Checkout for those plans will return 422 configuration-missing.`,
    );
  }
  if (!env.appUrl) {
    console.warn(
      "⚠️ EXPO_PUBLIC_APP_URL is empty — Checkout and Portal return URLs will use the request origin, which may be incorrect for native clients behind a proxy.",
    );
  }
}

/**
 * Default webhook handler: acknowledges the event and logs it. The
 * template has no built-in persistence store, so the default
 * implementation is a deliberate no-op — Stripe remains the source of
 * truth for subscription state (via `listActiveSubscriptions`), and
 * adopters who add their own storage (analytics, feature flags,
 * onboarding emails) override this handler at bootstrap time.
 *
 * The handler MUST NOT throw on unknown event types; any error causes
 * Stripe to mark the delivery as failed and retry.
 */
function defaultWebhookHandler(): WebhookHandler {
  return {
    async handle(event) {
      if (process.env.NODE_ENV !== "production") {
        console.info(`[billing] webhook event ${event.type} (${event.id})`);
      }
    },
  };
}

/**
 * Convenience re-export so a server-level startup hook can preseed the
 * idempotency store alongside the registry. Kept here to keep all
 * billing wiring in one module.
 */
export { createMemoryIdempotencyStore };
