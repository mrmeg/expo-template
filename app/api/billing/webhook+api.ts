/**
 * POST /api/billing/webhook
 *
 * Stripe webhook receiver. NOT authenticated by Cognito — authenticity
 * is established by verifying Stripe's signature header against the
 * raw request body.
 *
 * Raw-body handling: this route calls `request.text()` BEFORE any
 * JSON parsing, so the body bytes passed to the signature verifier
 * match exactly what Stripe signed. Never call `request.json()` on a
 * Stripe webhook.
 *
 * Production deployments may still need to mount a dedicated Express
 * raw-body route ahead of `createRequestHandler()` if the Expo Server
 * adapter ever inserts a body-parsing middleware; the integration test
 * covers the +api.ts path this file ships with.
 */

import {
  getCorsHeaders,
  getPreflightHeaders,
  sanitizeErrorDetails,
} from "@/server/api/shared/cors";
import { jsonErrorResponse } from "@/server/api/shared/errors";
import { ensureBillingBootstrapped } from "@/server/api/billing/bootstrap";
import {
  createMemoryIdempotencyStore,
  type IdempotencyStore,
} from "@/server/api/billing/idempotency";

const defaultIdempotency: IdempotencyStore = createMemoryIdempotencyStore();
let idempotencyOverride: IdempotencyStore | null = null;

/**
 * Swap the idempotency store (tests, or a shared store in production).
 * Call with `null` to restore the default in-memory store.
 */
export function setWebhookIdempotencyStore(store: IdempotencyStore | null): void {
  idempotencyOverride = store;
}

export async function OPTIONS(request: Request): Promise<Response> {
  return new Response(null, { status: 200, headers: getPreflightHeaders(request) });
}

export async function POST(request: Request): Promise<Response> {
  const registry = ensureBillingBootstrapped();
  if (!registry) {
    return jsonErrorResponse(request, 503, {
      code: "billing-disabled",
      message: "Billing is not configured on this server",
    });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonErrorResponse(request, 400, {
      code: "missing-signature",
      message: "Missing Stripe-Signature header",
    });
  }

  // Raw body MUST be read before any JSON parsing. Stripe signs exact
  // bytes; json-then-verify leaves room for subtle re-encoding drift.
  const rawBody = await request.text();

  let event: { id: string; type: string; data: unknown };
  try {
    event = registry.webhookVerifier.verify(rawBody, signature);
  } catch (error) {
    console.warn("billing.webhook signature rejected:", (error as Error).message);
    return jsonErrorResponse(request, 400, {
      code: "invalid-signature",
      message: "Stripe signature verification failed",
    });
  }

  const idempotency = idempotencyOverride ?? defaultIdempotency;

  if (await idempotency.wasProcessed(event.id)) {
    // Duplicate delivery — acknowledge so Stripe stops retrying.
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  }

  try {
    await registry.webhookHandler.handle(event);
    await idempotency.markProcessed(event.id);
  } catch (error) {
    // Don't mark processed on failure — Stripe will retry.
    console.error("billing.webhook handler failed:", error);
    return jsonErrorResponse(request, 500, {
      code: "webhook-handler-failed",
      message: "Webhook handler threw",
      ...sanitizeErrorDetails(error),
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
  });
}
