/**
 * Client-facing billing types.
 *
 * Re-exports the shared normalized shape so UI code imports from
 * `@/client/features/billing` — keeping raw Stripe SDK types off the
 * client side of the boundary.
 */

export type {
  BillingInterval,
  BillingStatus,
  BillingSummary,
  PlanDefinition,
} from "@/shared/billing";

export { FREE_PLAN_ID, isEntitled } from "@/shared/billing";
