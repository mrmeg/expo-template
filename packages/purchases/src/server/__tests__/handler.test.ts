/**
 * Fetch-style webhook handler. Route semantics lifted from NeuroSpicy
 * `app/api/subscription/revenuecat-webhook+api.ts`: 500 without a secret, 401 on
 * a bad header, 400 on a malformed body, 200 once the event handler ran, 500 when
 * it throws.
 */
import { createWebhookHandler } from "../handler";
import type { RevenueCatWebhookEvent } from "../webhook";

const SECRET = "rc-shared-secret";
const NOW = 1_760_000_000_000;

function request(body: unknown, auth: string | null = SECRET): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (auth !== null) headers.set("authorization", auth);
  return new Request("https://app.example/api/revenuecat", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validBody = {
  api_version: "1.0",
  event: {
    id: "evt-1",
    type: "INITIAL_PURCHASE",
    app_user_id: "user-1",
    entitlement_ids: ["pro"],
    product_id: "app_pro_annual",
    event_timestamp_ms: NOW,
    expiration_at_ms: NOW + 1000,
  },
};

describe("createWebhookHandler", () => {
  it("returns 500 when no secret is configured and never calls onEvent", async () => {
    const onEvent = jest.fn();
    const handler = createWebhookHandler({ secret: "", onEvent });
    const response = await handler(request(validBody));
    expect(response.status).toBe(500);
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("returns 401 on a missing or mismatched Authorization header", async () => {
    const onEvent = jest.fn();
    const handler = createWebhookHandler({ secret: SECRET, onEvent });
    expect((await handler(request(validBody, null))).status).toBe(401);
    expect((await handler(request(validBody, "nope"))).status).toBe(401);
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("accepts the Bearer form of the secret", async () => {
    const onEvent = jest.fn();
    const handler = createWebhookHandler({ secret: SECRET, onEvent });
    expect((await handler(request(validBody, `Bearer ${SECRET}`))).status).toBe(200);
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it("returns 400 on a non-JSON body or a body without an event", async () => {
    const onEvent = jest.fn();
    const handler = createWebhookHandler({ secret: SECRET, onEvent });
    expect((await handler(request("{not json"))).status).toBe(400);
    expect((await handler(request({ hello: "world" }))).status).toBe(400);
    expect((await handler(request({ event: { type: "RENEWAL" } }))).status).toBe(400);
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("parses the event, hands it to onEvent, and answers 200 with the handler result", async () => {
    const onEvent = jest.fn(async (event: RevenueCatWebhookEvent) => ({ applied: event.type === "INITIAL_PURCHASE" }));
    const handler = createWebhookHandler({ secret: SECRET, onEvent });
    const response = await handler(request(validBody));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, applied: true });
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "evt-1", type: "INITIAL_PURCHASE", appUserId: "user-1", entitlementIds: ["pro"] }),
    );
  });

  it("answers 200 with ok only when onEvent returns nothing", async () => {
    const handler = createWebhookHandler({ secret: SECRET, onEvent: async () => undefined });
    const response = await handler(request(validBody));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("returns 500 and reports when onEvent throws", async () => {
    const onError = jest.fn();
    const handler = createWebhookHandler({
      secret: SECRET,
      onEvent: async () => {
        throw new Error("db down");
      },
      onError,
    });
    const response = await handler(request(validBody));
    expect(response.status).toBe(500);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "onEvent");
  });

  it("acknowledges events for other entitlements without calling onEvent when an entitlement filter is set", async () => {
    const onEvent = jest.fn();
    const handler = createWebhookHandler({ secret: SECRET, onEvent, entitlement: "pro" });
    const other = { event: { ...validBody.event, entitlement_ids: ["other"] } };
    const response = await handler(request(other));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ignored: "entitlement" });
    expect(onEvent).not.toHaveBeenCalled();

    // Events without entitlement ids (TEST, TRANSFER) still reach onEvent.
    const test = { event: { ...validBody.event, type: "TEST", entitlement_ids: undefined } };
    expect((await handler(request(test))).status).toBe(200);
    expect(onEvent).toHaveBeenCalledTimes(1);
  });
});
