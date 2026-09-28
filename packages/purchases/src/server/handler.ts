/**
 * Fetch-compatible webhook receiver for Expo API routes, Convex `httpAction`,
 * Cloudflare Workers, or any `(Request) => Response` host. Route semantics from
 * NeuroSpicy `app/api/subscription/revenuecat-webhook+api.ts`: always 200 for a
 * handled or intentionally ignored event so RevenueCat does not retry; 401 on a
 * bad secret; 400 on a malformed body; 500 when the secret is unset or the
 * consumer's handler throws (RevenueCat retries those).
 */
import { isAuthorizedWebhook, parseRevenueCatWebhook, type RevenueCatWebhookEvent } from "./webhook";

export interface WebhookHandlerOptions {
  /** Shared secret set as the Authorization header value on the RevenueCat dashboard webhook. */
  secret: string | undefined;
  /**
   * Consumer logic: idempotency, user lookup, ledger writes. A returned object
   * is merged into the 200 body (`{ ok: true, ...result }`).
   */
  onEvent: (
    event: RevenueCatWebhookEvent,
  ) => Promise<Record<string, unknown> | void> | Record<string, unknown> | void;
  /**
   * When set, events whose `entitlement_ids` are non-empty and exclude this id
   * are acknowledged with `{ ok: true, ignored: "entitlement" }` and never reach
   * `onEvent`. Events without entitlement ids (TEST, TRANSFER) still do.
   */
  entitlement?: string;
  onError?: (error: unknown, context: string) => void;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function createWebhookHandler(options: WebhookHandlerOptions): (request: Request) => Promise<Response> {
  return async (request) => {
    if (!options.secret) {
      options.onError?.(new Error("RevenueCat webhook secret is not configured"), "config");
      return json(500, { ok: false, error: "webhook_secret_not_configured" });
    }

    const header = request.headers.get("authorization");
    if (!isAuthorizedWebhook(header, options.secret)) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      options.onError?.(error, "parse");
      return json(400, { ok: false, error: "invalid_body" });
    }

    const event = parseRevenueCatWebhook(body);
    if (!event) return json(400, { ok: false, error: "missing_event" });

    if (
      options.entitlement &&
      event.entitlementIds.length > 0 &&
      !event.entitlementIds.includes(options.entitlement)
    ) {
      return json(200, { ok: true, ignored: "entitlement" });
    }

    try {
      const result = await options.onEvent(event);
      return json(200, { ok: true, ...(result ?? {}) });
    } catch (error) {
      options.onError?.(error, "onEvent");
      return json(500, { ok: false, error: "handler_failed" });
    }
  };
}
