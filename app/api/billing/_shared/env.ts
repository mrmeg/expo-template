/**
 * Server-side billing environment surface.
 *
 * Reads Stripe + app-level env vars and produces a typed view of what
 * is configured. Consumers call `readBillingEnv()` at bootstrap; the
 * returned object tells them whether a real Stripe registry can be
 * wired up, or whether routes should fall through to the
 * `billing-disabled` 503 path.
 *
 * Nothing in this module imports the Stripe SDK — that happens lazily
 * in `bootstrap.ts` so unit tests and billing-off deployments never
 * pay the cost of loading `stripe`.
 */

import {
  DEFAULT_PLAN_CATALOG,
  FREE_PLAN_ID,
  type PlanDefinition,
} from "@/shared/billing";

export interface BillingServerEnv {
  /**
   * True when the minimum set of Stripe secrets is present. Other
   * sanity checks (price IDs, app URL) are surfaced separately so the
   * bootstrap can still partially wire things up.
   */
  readonly hasStripeSecrets: boolean;
  readonly stripeSecretKey: string | null;
  readonly stripeWebhookSecret: string | null;
  readonly appUrl: string | null;
  readonly planCatalog: readonly PlanDefinition[];
  /**
   * Plan/interval combinations that advertise a price id in env but
   * whose id is empty. Logged at startup so partial configs are
   * visible without blocking boot.
   */
  readonly missingPriceIds: readonly string[];
}

function nonEmpty(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Map the env-var price ids onto the default plan catalog. Adopters
 * who ship additional plans should build their own catalog rather
 * than relying on this helper.
 */
function buildPlanCatalogFromEnv(
  env: NodeJS.ProcessEnv,
): { catalog: readonly PlanDefinition[]; missing: readonly string[] } {
  const missing: string[] = [];
  const catalog = DEFAULT_PLAN_CATALOG.map((plan): PlanDefinition => {
    if (plan.id === FREE_PLAN_ID) return plan;

    const monthKey = `STRIPE_PRICE_ID_${plan.id.toUpperCase()}_MONTH`;
    const yearKey = `STRIPE_PRICE_ID_${plan.id.toUpperCase()}_YEAR`;
    const month = nonEmpty(env[monthKey]);
    const year = nonEmpty(env[yearKey]);

    if (month === null) missing.push(`${plan.id}:${monthKey}`);
    if (year === null) missing.push(`${plan.id}:${yearKey}`);

    return {
      ...plan,
      stripePriceIdMonth: month,
      stripePriceIdYear: year,
    };
  });
  return { catalog, missing };
}

export function readBillingEnv(
  env: NodeJS.ProcessEnv = process.env,
): BillingServerEnv {
  const stripeSecretKey = nonEmpty(env.STRIPE_SECRET_KEY);
  const stripeWebhookSecret = nonEmpty(env.STRIPE_WEBHOOK_SECRET);
  const appUrl = nonEmpty(env.EXPO_PUBLIC_APP_URL);
  const { catalog, missing } = buildPlanCatalogFromEnv(env);

  return {
    hasStripeSecrets: stripeSecretKey !== null && stripeWebhookSecret !== null,
    stripeSecretKey,
    stripeWebhookSecret,
    appUrl,
    planCatalog: catalog,
    missingPriceIds: missing,
  };
}
