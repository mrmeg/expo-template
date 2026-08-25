/**
 * Billing request handlers, dispatched by `app/api/billing/[action]+api.ts`.
 *
 * Domain logic lives here so the route file stays a thin dispatcher.
 * The Stripe webhook is NOT here — it uses a different auth model
 * (signature over the raw body) and stays in its own static route file,
 * `app/api/billing/webhook+api.ts`.
 */

import { requireAuthenticatedUser } from "@/server/api/shared/auth";
import { ensureAuthBootstrapped } from "@/server/api/shared/authBootstrap";
import {
  getCorsHeaders,
  getPreflightHeaders,
  sanitizeErrorDetails,
} from "@/server/api/shared/cors";
import {
  badRequestResponse,
  jsonErrorResponse,
} from "@/server/api/shared/errors";
import { ensureBillingBootstrapped } from "./bootstrap";
import { CustomerConflictError } from "./types";

interface CheckoutBody {
  planId?: unknown;
  interval?: unknown;
  returnPath?: unknown;
}

interface PortalBody {
  returnPath?: unknown;
}

async function options(request: Request): Promise<Response> {
  return new Response(null, { status: 200, headers: getPreflightHeaders(request) });
}

/**
 * GET /api/billing/summary
 *
 * Returns a normalized `BillingSummary` for the authenticated user.
 * Users without a Stripe customer record receive the canonical `free`
 * summary — the route never auto-creates a customer.
 */
async function summary(request: Request): Promise<Response> {
  ensureAuthBootstrapped();
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const registry = ensureBillingBootstrapped();
  if (!registry) {
    return jsonErrorResponse(request, 503, {
      code: "billing-disabled",
      message: "Billing is not configured on this server",
    });
  }

  try {
    const summary = await registry.resolver.getBillingSummary({
      userId: auth.user.userId,
      email: auth.user.email,
    });
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  } catch (error) {
    console.error("billing.summary failed:", error);
    return jsonErrorResponse(request, 500, {
      code: "server-error",
      message: "Failed to load billing summary",
      ...sanitizeErrorDetails(error),
    });
  }
}

/**
 * POST /api/billing/checkout-session
 *
 * Create a Stripe Checkout Session for the authenticated user. The
 * client sends a normalized `{ planId, interval }` selection; this
 * handler resolves the server-owned Stripe price id from the injected
 * plan catalog so the client cannot spoof billing configuration.
 */
async function checkoutSession(request: Request): Promise<Response> {
  ensureAuthBootstrapped();
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const registry = ensureBillingBootstrapped();
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
      priceId,
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

/**
 * POST /api/billing/portal-session
 *
 * Create a Stripe Billing Portal session for the authenticated user.
 * Users without an existing Stripe customer cannot open the portal,
 * so this handler returns a typed `no-customer` error rather than
 * silently creating one.
 */
async function portalSession(request: Request): Promise<Response> {
  ensureAuthBootstrapped();
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const registry = ensureBillingBootstrapped();
  if (!registry) {
    return jsonErrorResponse(request, 503, {
      code: "billing-disabled",
      message: "Billing is not configured on this server",
    });
  }

  let body: PortalBody = {};
  try {
    if (request.headers.get("content-length") !== "0") {
      body = (await request.json()) as PortalBody;
    }
  } catch {
    return badRequestResponse(request, "bad-request", "Request body must be valid JSON");
  }

  const returnPath =
    typeof body.returnPath === "string" && body.returnPath.startsWith("/")
      ? body.returnPath
      : "/billing/return";

  const summary = await registry.resolver.getBillingSummary({
    userId: auth.user.userId,
    email: auth.user.email,
  });

  if (!summary.customerId) {
    return jsonErrorResponse(request, 409, {
      code: "no-customer",
      message: "No Stripe customer exists for this user yet",
    });
  }

  try {
    const { origin } = new URL(request.url);
    const session = await registry.createPortalSession({
      customerId: summary.customerId,
      returnUrl: `${origin}${returnPath}?status=portal`,
    });

    return new Response(JSON.stringify(session), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  } catch (error) {
    console.error("billing.portal createPortalSession failed:", error);
    return jsonErrorResponse(request, 502, {
      code: "server-error",
      message: "Failed to create portal session",
      ...sanitizeErrorDetails(error),
    });
  }
}

export const billingHandlers = {
  options,
  summary,
  checkoutSession,
  portalSession,
};
