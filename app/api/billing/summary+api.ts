/**
 * GET /api/billing/summary
 *
 * Returns a normalized `BillingSummary` for the authenticated user.
 * Users without a Stripe customer record receive the canonical `free`
 * summary — the route never auto-creates a customer.
 */

import { requireAuthenticatedUser } from "@/app/api/_shared/auth";
import { ensureAuthBootstrapped } from "@/app/api/_shared/authBootstrap";
import {
  getCorsHeaders,
  getPreflightHeaders,
  sanitizeErrorDetails,
} from "@/app/api/_shared/cors";
import { jsonErrorResponse } from "@/app/api/_shared/errors";
import { ensureBillingBootstrapped } from "./_shared/bootstrap";

export async function OPTIONS(request: Request): Promise<Response> {
  return new Response(null, { status: 200, headers: getPreflightHeaders(request) });
}

export async function GET(request: Request): Promise<Response> {
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
