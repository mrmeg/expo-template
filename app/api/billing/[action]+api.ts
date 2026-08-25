/**
 * /api/billing/[action] — consolidated billing API route.
 *
 * Expo exports every `+api.ts` file as its own self-contained server
 * bundle, so sibling routes that share heavy dependencies (here the
 * Stripe and auth stacks) duplicate them once per file. Grouping the
 * authenticated billing actions behind one dynamic segment keeps the
 * public URLs (`/api/billing/summary`, `/api/billing/checkout-session`,
 * `/api/billing/portal-session`) while emitting a single bundle.
 *
 * `/api/billing/webhook` intentionally stays in its own static file:
 * it authenticates by Stripe signature over the raw body, not by user
 * token, and Expo Router matches static routes before dynamic ones.
 */

import { billingHandlers } from "@/server/api/billing/handlers";
import { jsonErrorResponse } from "@/server/api/shared/errors";

type BillingParams = { action: string };
type Method = "GET" | "POST";
type RouteHandler = (request: Request) => Promise<Response>;

const routes: Record<string, Partial<Record<Method, RouteHandler>>> = {
  summary: { GET: billingHandlers.summary },
  "checkout-session": { POST: billingHandlers.checkoutSession },
  "portal-session": { POST: billingHandlers.portalSession },
};

function dispatch(
  method: Method,
  request: Request,
  { action }: BillingParams,
): Promise<Response> | Response {
  const route = routes[action];
  if (!route) {
    return jsonErrorResponse(request, 404, {
      code: "not-found",
      message: "Unknown billing action",
    });
  }
  const handler = route[method];
  if (!handler) {
    return jsonErrorResponse(request, 405, {
      code: "method-not-allowed",
      message: `${method} is not supported for this billing action`,
    });
  }
  return handler(request);
}

export function OPTIONS(request: Request, params: BillingParams) {
  if (!routes[params.action]) {
    return jsonErrorResponse(request, 404, {
      code: "not-found",
      message: "Unknown billing action",
    });
  }
  return billingHandlers.options(request);
}

export function GET(request: Request, params: BillingParams) {
  return dispatch("GET", request, params);
}

export function POST(request: Request, params: BillingParams) {
  return dispatch("POST", request, params);
}
