/**
 * `useBillingSummary` — React Query hook over `GET /api/billing/summary`.
 *
 * This is the single entry point for subscription state into the client.
 * It returns the normalized `BillingSummary` from the server, or the
 * canonical `free` summary when the user has no Stripe customer record.
 * UI code must never read raw Stripe fields or extend `authStore` with
 * billing-specific properties.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { api } from "@/client/lib/api/authenticatedFetch";
import { useAuthStore } from "@/client/features/auth/stores/authStore";
import { freeBillingSummary, type BillingSummary } from "@/shared/billing";

const SUMMARY_ENDPOINT = "/api/billing/summary";

export const billingSummaryQueryKey = (userId: string | null) =>
  ["billing", "summary", userId ?? "anonymous"] as const;

async function fetchBillingSummary(): Promise<BillingSummary> {
  const response = await api.get(SUMMARY_ENDPOINT);
  if (!response.ok) {
    throw new Error(`Billing summary request failed: ${response.status}`);
  }
  return (await response.json()) as BillingSummary;
}

/**
 * Returns the authenticated user's normalized billing summary.
 *
 * Unauthenticated users resolve to the `free` summary without a network
 * request, so pricing UI can render a consistent baseline regardless of
 * auth state.
 */
export function useBillingSummary(): UseQueryResult<BillingSummary, Error> {
  const userId = useAuthStore((s) => s.user?.userId ?? null);
  const authState = useAuthStore((s) => s.state);
  const enabled = authState === "authenticated";

  return useQuery({
    queryKey: billingSummaryQueryKey(userId),
    queryFn: fetchBillingSummary,
    enabled,
    staleTime: 60_000,
    placeholderData: () => freeBillingSummary(),
  });
}
