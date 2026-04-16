/**
 * POST /api/billing/portal-session
 *
 * Create a Stripe Billing Portal session for the authenticated user.
 * Users without an existing Stripe customer cannot open the portal,
 * so this route returns a typed `no-customer` error rather than
 * silently creating one.
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
import { ensureBillingBootstrapped } from "@/server/api/billing/bootstrap";

interface PortalBody {
  returnPath?: unknown;
}

export async function OPTIONS(request: Request): Promise<Response> {
  return new Response(null, { status: 200, headers: getPreflightHeaders(request) });
}

export async function POST(request: Request): Promise<Response> {
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
