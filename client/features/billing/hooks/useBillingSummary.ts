/**
 * `useBillingSummary` — React Query hook over `GET /api/billing/summary`.
 *
 * The single entry point for subscription state into the client. UI
 * code must never extend `authStore` with Stripe-specific fields.
 *
 * Unauthenticated users and servers with billing disabled resolve to
 * the `free` summary without surfacing an error, so pricing UI renders
 * a consistent baseline.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { useAuthStore } from "@/client/features/auth/stores/authStore";
import { freeBillingSummary, type BillingSummary } from "@/shared/billing";
import { fetchBillingSummary } from "../api";

export const billingSummaryQueryKey = (userId: string | null) =>
  ["billing", "summary", userId ?? "anonymous"] as const;

async function queryFn(): Promise<BillingSummary> {
  const result = await fetchBillingSummary();
  if (result.kind === "ok") return result.data;
  if (result.problem.kind === "billing-disabled") {
    return freeBillingSummary();
  }
  throw new Error(`billing-summary:${result.problem.kind}`);
}

export function useBillingSummary(): UseQueryResult<BillingSummary, Error> {
  const userId = useAuthStore((s) => s.user?.userId ?? null);
  const authState = useAuthStore((s) => s.state);
  const enabled = authState === "authenticated";

  return useQuery({
    queryKey: billingSummaryQueryKey(userId),
    queryFn,
    enabled,
    staleTime: 60_000,
    placeholderData: () => freeBillingSummary(),
  });
}
