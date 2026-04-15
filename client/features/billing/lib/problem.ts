/**
 * Maps the server's billing error responses onto the client's
 * discriminated `BillingProblem` union. Lives in its own file so unit
 * tests can import it without pulling in Amplify via authenticatedFetch.
 */

export type BillingProblem =
  | { kind: "unauthorized" }
  | { kind: "billing-disabled" }
  | { kind: "billing-conflict"; candidateCustomerIds: readonly string[] }
  | { kind: "no-customer" }
  | { kind: "configuration-missing"; message: string }
  | { kind: "unknown-plan"; availablePlans: readonly string[] }
  | { kind: "bad-request"; message: string }
  | { kind: "server-error"; message: string }
  | { kind: "network-error" };

export function problemFromResponse(
  status: number,
  body: Record<string, unknown>,
): BillingProblem {
  const code = typeof body.code === "string" ? body.code : undefined;
  const message = typeof body.message === "string" ? body.message : "";

  if (status === 401) return { kind: "unauthorized" };
  if (code === "billing-disabled") return { kind: "billing-disabled" };
  if (code === "billing-conflict") {
    const ids = Array.isArray(body.candidateCustomerIds)
      ? (body.candidateCustomerIds as string[])
      : [];
    return { kind: "billing-conflict", candidateCustomerIds: ids };
  }
  if (code === "no-customer") return { kind: "no-customer" };
  if (code === "configuration-missing") return { kind: "configuration-missing", message };
  if (code === "unknown-plan") {
    const plans = Array.isArray(body.availablePlans)
      ? (body.availablePlans as string[])
      : [];
    return { kind: "unknown-plan", availablePlans: plans };
  }
  if (status === 400 || code === "bad-request") {
    return { kind: "bad-request", message };
  }
  return { kind: "server-error", message: message || `HTTP ${status}` };
}
