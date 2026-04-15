/**
 * Client-side billing API wrapper.
 *
 * Folds the server's typed error responses into a compact discriminated
 * union so UI code handles recoverable conditions (billing not
 * configured, duplicate-customer conflict, missing price configuration,
 * no Stripe customer yet) without reading HTTP status codes directly.
 */

import { api } from "@/client/lib/api/authenticatedFetch";
import type { BillingSummary } from "@/shared/billing";
import { problemFromResponse, type BillingProblem } from "./lib/problem";

export type { BillingProblem };

export type BillingResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "error"; problem: BillingProblem };

export interface CheckoutSessionInput {
  planId: string;
  interval: "month" | "year";
  /** Path the return screen lives at, defaults to `/billing/return`. */
  returnPath?: string;
}

export interface CheckoutSessionResponse {
  url: string;
  expiresAt: string | null;
}

export interface PortalSessionInput {
  returnPath?: string;
}

export interface PortalSessionResponse {
  url: string;
}

async function parse<T>(response: Response): Promise<BillingResult<T>> {
  if (response.ok) {
    return { kind: "ok", data: (await response.json()) as T };
  }
  const body = await safeJson(response);
  return { kind: "error", problem: problemFromResponse(response.status, body) };
}

async function safeJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function fetchBillingSummary(): Promise<BillingResult<BillingSummary>> {
  try {
    const response = await api.get("/api/billing/summary");
    return parse<BillingSummary>(response);
  } catch {
    return { kind: "error", problem: { kind: "network-error" } };
  }
}

export async function createCheckoutSession(
  input: CheckoutSessionInput,
): Promise<BillingResult<CheckoutSessionResponse>> {
  try {
    const response = await api.post("/api/billing/checkout-session", {
      planId: input.planId,
      interval: input.interval,
      returnPath: input.returnPath ?? "/billing/return",
    });
    return parse<CheckoutSessionResponse>(response);
  } catch {
    return { kind: "error", problem: { kind: "network-error" } };
  }
}

export async function createPortalSession(
  input: PortalSessionInput = {},
): Promise<BillingResult<PortalSessionResponse>> {
  try {
    const response = await api.post("/api/billing/portal-session", {
      returnPath: input.returnPath ?? "/billing/return",
    });
    return parse<PortalSessionResponse>(response);
  } catch {
    return { kind: "error", problem: { kind: "network-error" } };
  }
}

export const __internal = { parse };
