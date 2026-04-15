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
  FREE_PLAN_ID,
  isEntitled,
  type BillingInterval,
  type BillingStatus,
  type BillingSummary,
  type PlanDefinition,
} from "./types";
