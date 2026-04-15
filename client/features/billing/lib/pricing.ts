/**
 * View-model helpers that map the normalized `BillingSummary` + plan
 * catalog onto the props the shared `PricingScreen` expects.
 *
 * Living here (rather than inside the screen) lets unit tests assert
 * the billing → UI derivation without mounting React.
 */

import type {
  BillingInterval,
  BillingSummary,
  PlanDefinition,
} from "@/shared/billing";
import { FREE_PLAN_ID } from "@/shared/billing";
import type { PricingPlanActionState } from "@/client/screens/PricingScreen";

export interface PlanDisplay {
  /** Display price like "$19" or "—" (for free-tier / missing price). */
  price: string;
  /** Opt-in marketing copy. */
  badge?: string;
  /** Highlight the card visually. */
  highlighted?: boolean;
}

export interface DerivePricingPlanOptions {
  plan: PlanDefinition;
  summary: BillingSummary | undefined;
  interval: BillingInterval;
  /** Required per-plan display metadata (copy, badges, price strings). */
  display: PlanDisplay;
  /** True while the checkout/portal session is being created. */
  loading?: boolean;
  /** "Billing is disabled" / other env-level guard to surface on the CTA. */
  disabledReason?: string;
  /** True when the signed-in user has an authenticated session. */
  isAuthenticated: boolean;
  /** Called when the user taps the CTA (bound by the caller). */
  onSelect: () => void;
}

export interface DerivedPricingPlan {
  planId: string;
  name: string;
  price: string;
  period: "month" | "year";
  features: { label: string; included: true }[];
  highlighted?: boolean;
  badge?: string;
  isCurrent: boolean;
  actionState: PricingPlanActionState;
  actionLabel: string;
  disabledReason?: string;
  loading: boolean;
  onSelect: () => void;
}

/**
 * Derive the action state for a single plan card given the user's
 * live subscription summary. Order matters:
 *
 * 1. `free` plan while the user is already entitled → `downgrade-disabled`
 *    (managing cancellation happens through the Billing Portal).
 * 2. Plan id matches the summary → `current`.
 * 3. User is already subscribed to a paid plan → `manage`.
 * 4. Otherwise → `upgrade`.
 */
export function derivePlanActionState({
  planId,
  summary,
}: {
  planId: string;
  summary: BillingSummary | undefined;
}): PricingPlanActionState {
  if (!summary) return "upgrade";

  const userIsEntitled =
    summary.status === "active" ||
    summary.status === "trialing" ||
    summary.status === "past_due";

  if (planId === FREE_PLAN_ID && userIsEntitled && summary.planId !== FREE_PLAN_ID) {
    return "downgrade-disabled";
  }

  if (summary.planId === planId && summary.status !== "free") {
    return "current";
  }

  if (userIsEntitled && planId !== FREE_PLAN_ID) {
    return "manage";
  }

  return "upgrade";
}

/**
 * Pick human-readable CTA copy for a plan's derived action state.
 * Unauthenticated users always see "Sign in to continue" so the CTA
 * doesn't silently create a session their identity can't redeem.
 */
export function defaultActionLabel(
  state: PricingPlanActionState,
  { isAuthenticated }: { isAuthenticated: boolean },
): string {
  if (!isAuthenticated) {
    return state === "current" ? "Current plan" : "Sign in to continue";
  }
  switch (state) {
    case "current":
      return "Current plan";
    case "manage":
      return "Manage subscription";
    case "downgrade-disabled":
      return "Manage subscription";
    case "upgrade":
    default:
      return "Choose plan";
  }
}

/**
 * Build a fully-populated `DerivedPricingPlan` for the shared
 * `PricingScreen`. Callers still spread this into the `PricingPlan`
 * shape; keeping our return type narrower lets tests assert on the
 * billing-derived fields without caring about screen-internal ones.
 */
export function derivePricingPlan({
  plan,
  summary,
  interval,
  display,
  loading = false,
  disabledReason,
  isAuthenticated,
  onSelect,
}: DerivePricingPlanOptions): DerivedPricingPlan {
  const actionState = derivePlanActionState({ planId: plan.id, summary });
  const isCurrent = actionState === "current";
  const actionLabel = defaultActionLabel(actionState, { isAuthenticated });
  const downgradeDisabled =
    actionState === "downgrade-disabled"
      ? "Cancel through Manage subscription."
      : undefined;

  return {
    planId: plan.id,
    name: plan.label,
    price: display.price,
    period: interval,
    features: plan.features.map((label) => ({ label, included: true })),
    highlighted: display.highlighted,
    badge: display.badge,
    isCurrent,
    actionState,
    actionLabel,
    disabledReason: disabledReason ?? downgradeDisabled,
    loading,
    onSelect,
  };
}
