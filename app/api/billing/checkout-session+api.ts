/**
 * POST /api/billing/checkout-session
 *
 * Create a Stripe Checkout Session for the authenticated user. The
 * client sends a normalized `{ planId, interval }` selection; this
 * route resolves the server-owned Stripe price id from the injected
 * plan catalog so the client cannot spoof billing configuration.
 */

import { requireAuthenticatedUser } from "@/app/api/_shared/auth";
import {
  getCorsHeaders,
  getPreflightHeaders,
  sanitizeErrorDetails,
} from "@/app/api/_shared/cors";
import {
  badRequestResponse,
  jsonErrorResponse,
} from "@/app/api/_shared/errors";
import { CustomerConflictError } from "./_shared/types";
import { getBillingRegistry } from "./_shared/registry";

interface CheckoutBody {
  planId?: unknown;
  interval?: unknown;
  returnPath?: unknown;
}

export async function OPTIONS(request: Request): Promise<Response> {
  return new Response(null, { status: 200, headers: getPreflightHeaders(request) });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const registry = getBillingRegistry();
  if (!registry) {
    return jsonErrorResponse(request, 503, {
      code: "billing-disabled",
      message: "Billing is not configured on this server",
    });
  }

  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return badRequestResponse(request, "bad-request", "Request body must be valid JSON");
  }

  const planId = typeof body.planId === "string" ? body.planId : null;
  const interval =
    body.interval === "month" || body.interval === "year" ? body.interval : null;
  const returnPath =
    typeof body.returnPath === "string" && body.returnPath.startsWith("/")
      ? body.returnPath
      : "/billing/return";

  if (!planId) {
    return badRequestResponse(request, "bad-request", "planId is required");
  }
  if (!interval) {
    return badRequestResponse(request, "bad-request", "interval must be 'month' or 'year'");
  }

  const plan = registry.planCatalog.find((p) => p.id === planId);
  if (!plan) {
    return badRequestResponse(request, "unknown-plan", `Unknown plan: ${planId}`, {
      availablePlans: registry.planCatalog.map((p) => p.id),
    });
  }

  const priceId =
    interval === "month" ? plan.stripePriceIdMonth : plan.stripePriceIdYear;
  if (!priceId) {
    return jsonErrorResponse(request, 422, {
      code: "configuration-missing",
      message: `Plan '${planId}' has no configured ${interval} price`,
    });
  }

  let customerId: string;
  try {
    const resolved = await registry.resolver.resolveOrCreateCustomer({
      userId: auth.user.userId,
      email: auth.user.email,
    });
    customerId = resolved.customerId;
  } catch (error) {
    if (error instanceof CustomerConflictError) {
      return jsonErrorResponse(request, 409, {
        code: "billing-conflict",
        message: "Multiple Stripe customers match this account; manual linking required",
        candidateCustomerIds: error.candidateCustomerIds,
      });
    }
    console.error("billing.checkout resolveOrCreateCustomer failed:", error);
    return jsonErrorResponse(request, 500, {
      code: "server-error",
      message: "Failed to resolve billing customer",
      ...sanitizeErrorDetails(error),
    });
  }

  try {
    const { origin } = new URL(request.url);
    const session = await registry.createCheckoutSession({
      userId: auth.user.userId,
      email: auth.user.email,
      customerId,
      planId,
      interval,
      successUrl: `${origin}${returnPath}?status=success`,
      cancelUrl: `${origin}${returnPath}?status=cancel`,
    });

    return new Response(JSON.stringify(session), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  } catch (error) {
    console.error("billing.checkout createCheckoutSession failed:", error);
    return jsonErrorResponse(request, 502, {
      code: "server-error",
      message: "Failed to create checkout session",
      ...sanitizeErrorDetails(error),
    });
  }
}

// Export the price resolution logic for tests.
export const __internal = {
  resolvePriceId(
    plan: { stripePriceIdMonth: string | null; stripePriceIdYear: string | null },
    interval: "month" | "year",
  ): string | null {
    return interval === "month" ? plan.stripePriceIdMonth : plan.stripePriceIdYear;
  },
};
