/**
 * Billing feature barrel.
 *
 * External consumers import from `@/client/features/billing`. See
 * `Agent/Docs/BILLING.md` for the overall architecture.
 */

export {
  useBillingSummary,
  billingSummaryQueryKey,
} from "./hooks/useBillingSummary";

export {
  useBillingActions,
  type BillingActionError,
  type BillingActionResult,
  type BillingReturnStatus,
  type BrowserHandoff,
  type StartCheckoutInput,
  type UseBillingActionsOptions,
  type UseBillingActionsValue,
} from "./hooks/useBillingActions";

export {
  fetchBillingSummary,
  createCheckoutSession,
  createPortalSession,
  type BillingProblem,
  type BillingResult,
  type CheckoutSessionInput,
  type CheckoutSessionResponse,
  type PortalSessionInput,
  type PortalSessionResponse,
} from "./api";

export {
  derivePricingPlan,
  derivePlanActionState,
  defaultActionLabel,
  type DerivedPricingPlan,
  type DerivePricingPlanOptions,
  type PlanDisplay,
} from "./lib/pricing";

export {
  FREE_PLAN_ID,
  isEntitled,
  type BillingInterval,
  type BillingStatus,
  type BillingSummary,
  type PlanDefinition,
} from "./types";
