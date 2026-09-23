/**
 * Pure webhook helpers: request authorization, payload parsing, and the
 * entitlement reducer. Lifted from Mindmap `test/convex/revenuecatEvents.test.ts`
 * with the entitlement id made a parameter.
 */
import { LIFETIME_UNTIL } from "../../constants";
import {
  isAuthorizedWebhook,
  parseRevenueCatWebhook,
  reduceEntitlement,
  revokedByTransfer,
  timingSafeEqual,
  type EntitlementRecord,
  type RevenueCatWebhookEvent,
} from "../webhook";

const NOW = 1_760_000_000_000;
const LATER = NOW + 30 * 24 * 3600 * 1000;
const ENTITLEMENT = "pro";

function event(overrides: Partial<RevenueCatWebhookEvent> = {}): RevenueCatWebhookEvent {
  return {
    id: "evt-1",
    type: "INITIAL_PURCHASE",
    appUserId: "sub-1",
    originalAppUserId: null,
    aliases: [],
    productId: "app_pro_monthly",
    newProductId: null,
    entitlementIds: [ENTITLEMENT],
    periodType: "NORMAL",
    purchasedAtMs: NOW,
    expirationAtMs: LATER,
    gracePeriodExpirationAtMs: null,
    eventTimestampMs: NOW,
    environment: "SANDBOX",
    store: "APP_STORE",
    originalTransactionId: null,
    cancelReason: null,
    expirationReason: null,
    price: null,
    priceInPurchasedCurrency: null,
    currency: null,
    renewalNumber: null,
    isTrialConversion: null,
    countryCode: null,
    offerCode: null,
    transferredFrom: [],
    transferredTo: [],
    raw: {},
    ...overrides,
  };
}

const empty: EntitlementRecord = { until: null, productId: null, updatedAt: null };

describe("isAuthorizedWebhook", () => {
  it("accepts the bare secret and the Bearer form only", () => {
    expect(isAuthorizedWebhook("s3cret", "s3cret")).toBe(true);
    expect(isAuthorizedWebhook("Bearer s3cret", "s3cret")).toBe(true);
    expect(isAuthorizedWebhook("Bearer other", "s3cret")).toBe(false);
    expect(isAuthorizedWebhook("s3cret ", "s3cret")).toBe(false);
    expect(isAuthorizedWebhook(null, "s3cret")).toBe(false);
    expect(isAuthorizedWebhook(undefined, "s3cret")).toBe(false);
    expect(isAuthorizedWebhook("", "s3cret")).toBe(false);
    expect(isAuthorizedWebhook("anything", "")).toBe(false);
  });

  it("compares strings of different lengths without short-circuiting", () => {
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
    expect(timingSafeEqual("abcd", "abc")).toBe(false);
    expect(timingSafeEqual("abcd", "abcd")).toBe(true);
  });
});

describe("parseRevenueCatWebhook", () => {
  const body = {
    api_version: "1.0",
    event: {
      id: "evt-1",
      type: "RENEWAL",
      event_timestamp_ms: NOW,
      app_user_id: "sub-1",
      original_app_user_id: "sub-1",
      aliases: ["sub-1", "$RCAnonymousID:abc"],
      product_id: "app_pro_annual",
      entitlement_ids: ["pro"],
      period_type: "NORMAL",
      purchased_at_ms: NOW - 10,
      expiration_at_ms: LATER,
      store: "PLAY_STORE",
      environment: "PRODUCTION",
      new_product_id: "app_pro_annual_v2",
      grace_period_expiration_at_ms: LATER + 5,
      original_transaction_id: "GPA.123",
      price: 49.99,
      price_in_purchased_currency: 44.99,
      currency: "EUR",
      renewal_number: 2,
      is_trial_conversion: true,
      country_code: "DE",
      offer_code: null,
      subscriber_attributes: { $email: { value: "x@y.z", updated_at_ms: NOW } },
    },
  };

  it("parses a subscription event into camelCase and strips subscriber attributes from raw", () => {
    const parsed = parseRevenueCatWebhook(body);
    expect(parsed).toMatchObject({
      id: "evt-1",
      type: "RENEWAL",
      appUserId: "sub-1",
      originalAppUserId: "sub-1",
      aliases: ["sub-1", "$RCAnonymousID:abc"],
      productId: "app_pro_annual",
      newProductId: "app_pro_annual_v2",
      entitlementIds: ["pro"],
      periodType: "NORMAL",
      purchasedAtMs: NOW - 10,
      expirationAtMs: LATER,
      gracePeriodExpirationAtMs: LATER + 5,
      eventTimestampMs: NOW,
      store: "PLAY_STORE",
      environment: "PRODUCTION",
      originalTransactionId: "GPA.123",
      price: 49.99,
      priceInPurchasedCurrency: 44.99,
      currency: "EUR",
      renewalNumber: 2,
      isTrialConversion: true,
      countryCode: "DE",
      offerCode: null,
      transferredFrom: [],
      transferredTo: [],
    });
    expect(parsed?.raw).not.toHaveProperty("subscriber_attributes");
    expect(parsed?.raw).toHaveProperty("product_id", "app_pro_annual");
  });

  it("folds the legacy entitlement_id into entitlement_ids", () => {
    const parsed = parseRevenueCatWebhook({
      event: { ...body.event, entitlement_ids: undefined, entitlement_id: "pro" },
    });
    expect(parsed?.entitlementIds).toEqual(["pro"]);
  });

  it("parses TRANSFER events without an app_user_id", () => {
    const parsed = parseRevenueCatWebhook({
      event: {
        id: "evt-t",
        type: "TRANSFER",
        event_timestamp_ms: NOW,
        transferred_from: ["sub-old"],
        transferred_to: ["sub-new"],
        store: "APP_STORE",
      },
    });
    expect(parsed).toMatchObject({
      type: "TRANSFER",
      appUserId: "",
      transferredFrom: ["sub-old"],
      transferredTo: ["sub-new"],
    });
  });

  it("rejects payloads that are not events", () => {
    expect(parseRevenueCatWebhook(null)).toBeNull();
    expect(parseRevenueCatWebhook("nope")).toBeNull();
    expect(parseRevenueCatWebhook({})).toBeNull();
    expect(parseRevenueCatWebhook({ event: { type: "RENEWAL" } })).toBeNull();
    expect(parseRevenueCatWebhook({ event: { id: "x", type: "RENEWAL", event_timestamp_ms: NOW } })).toBeNull();
    expect(parseRevenueCatWebhook({ event: { id: "x", type: "RENEWAL", app_user_id: "u" } })).toBeNull();
  });
});

describe("reduceEntitlement", () => {
  const options = { entitlement: ENTITLEMENT };

  it.each([
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "PRODUCT_CHANGE",
    "NON_RENEWING_PURCHASE",
    "SUBSCRIPTION_EXTENDED",
    "TEMPORARY_ENTITLEMENT_GRANT",
    "REFUND_REVERSED",
  ])("grants access until the expiration on %s", (type) => {
    expect(reduceEntitlement(empty, event({ type }), options)).toEqual({
      action: "set",
      next: { until: LATER, productId: "app_pro_monthly", updatedAt: NOW },
    });
  });

  it("revokes on EXPIRATION using the expiration, falling back to the event time", () => {
    expect(reduceEntitlement(empty, event({ type: "EXPIRATION", expirationAtMs: NOW - 5 }), options)).toEqual({
      action: "set",
      next: { until: NOW - 5, productId: "app_pro_monthly", updatedAt: NOW },
    });
    expect(
      reduceEntitlement(empty, event({ type: "EXPIRATION", expirationAtMs: null, productId: null }), options),
    ).toEqual({
      action: "set",
      next: { until: NOW, productId: null, updatedAt: NOW },
    });
  });

  it.each(["CANCELLATION", "BILLING_ISSUE", "SUBSCRIPTION_PAUSED", "TEST", "SOMETHING_NEW"])(
    "leaves access untouched on %s",
    (type) => {
      expect(reduceEntitlement(empty, event({ type }), options)).toEqual({ action: "skip", reason: "no-op" });
    },
  );

  it("stores a one-time purchase without expiration as LIFETIME_UNTIL, never as null", () => {
    expect(reduceEntitlement(empty, event({ type: "NON_RENEWING_PURCHASE", expirationAtMs: null }), options)).toEqual({
      action: "set",
      next: { until: LIFETIME_UNTIL, productId: "app_pro_monthly", updatedAt: NOW },
    });
  });

  it.each(["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "SUBSCRIPTION_EXTENDED", "TEMPORARY_ENTITLEMENT_GRANT"])(
    "skips a malformed %s without expiration instead of granting forever",
    (type) => {
      expect(reduceEntitlement(empty, event({ type, expirationAtMs: null }), options)).toEqual({
        action: "skip",
        reason: "no-op",
      });
    },
  );

  it("records the new product on PRODUCT_CHANGE", () => {
    expect(
      reduceEntitlement(empty, event({ type: "PRODUCT_CHANGE", productId: "app_pro_monthly", newProductId: "app_pro_annual" }), options),
    ).toEqual({ action: "set", next: { until: LATER, productId: "app_pro_annual", updatedAt: NOW } });
  });

  it("never lets one product's event shorten access another product granted", () => {
    const lifetime: EntitlementRecord = { until: LIFETIME_UNTIL, productId: "app_pro_lifetime", updatedAt: NOW - 10 };
    // A trial on the same entitlement starts and expires: the lifetime term stays.
    expect(reduceEntitlement(lifetime, event({ type: "INITIAL_PURCHASE", expirationAtMs: LATER }), options)).toEqual({
      action: "set",
      next: { until: LIFETIME_UNTIL, productId: "app_pro_monthly", updatedAt: NOW },
    });
    expect(reduceEntitlement(lifetime, event({ type: "EXPIRATION", expirationAtMs: NOW - 1 }), options)).toEqual({
      action: "set",
      next: { until: LIFETIME_UNTIL, productId: "app_pro_monthly", updatedAt: NOW },
    });
    // A longer annual term survives the monthly one expiring.
    const annual: EntitlementRecord = { until: LATER + 1000, productId: "app_pro_annual", updatedAt: NOW - 10 };
    expect(reduceEntitlement(annual, event({ type: "EXPIRATION", expirationAtMs: NOW }), options)).toMatchObject({
      action: "set",
      next: { until: LATER + 1000 },
    });
    // But an expiration at or past the current term ends access.
    const monthly: EntitlementRecord = { until: NOW - 5, productId: "app_pro_monthly", updatedAt: NOW - 10 };
    expect(reduceEntitlement(monthly, event({ type: "EXPIRATION", expirationAtMs: NOW }), options)).toMatchObject({
      action: "set",
      next: { until: NOW },
    });
  });

  it("revokes immediately on a refund CANCELLATION (CUSTOMER_SUPPORT with the expiration moved back)", () => {
    const current: EntitlementRecord = { until: LATER, productId: "app_pro_annual", updatedAt: NOW - 10 };
    expect(
      reduceEntitlement(
        current,
        event({ type: "CANCELLATION", cancelReason: "CUSTOMER_SUPPORT", expirationAtMs: NOW - 1 }),
        options,
      ),
    ).toEqual({ action: "set", next: { until: NOW - 1, productId: "app_pro_monthly", updatedAt: NOW } });
    // A refunded one-time purchase carries no expiration: revoke at the event time.
    const lifetime: EntitlementRecord = { until: LIFETIME_UNTIL, productId: "app_pro_lifetime", updatedAt: NOW - 10 };
    expect(
      reduceEntitlement(
        lifetime,
        event({ type: "CANCELLATION", cancelReason: "CUSTOMER_SUPPORT", expirationAtMs: null, productId: "app_pro_lifetime" }),
        options,
      ),
    ).toEqual({ action: "set", next: { until: NOW, productId: "app_pro_lifetime", updatedAt: NOW } });
    // A support cancellation that keeps access to the period end is an ordinary cancellation.
    expect(
      reduceEntitlement(
        current,
        event({ type: "CANCELLATION", cancelReason: "CUSTOMER_SUPPORT", expirationAtMs: LATER }),
        options,
      ),
    ).toEqual({ action: "skip", reason: "no-op" });
  });

  it("ignores events for other entitlements", () => {
    expect(reduceEntitlement(empty, event({ entitlementIds: ["other"] }), options)).toEqual({
      action: "skip",
      reason: "not-entitlement",
    });
    expect(reduceEntitlement(empty, event({ entitlementIds: [] }), options)).toEqual({
      action: "skip",
      reason: "not-entitlement",
    });
  });

  it("ignores revocations older than the last applied event and applies same-timestamp retries", () => {
    const current: EntitlementRecord = { until: LATER, productId: "app_pro_annual", updatedAt: NOW };
    expect(reduceEntitlement(current, event({ type: "EXPIRATION", eventTimestampMs: NOW - 1 }), options)).toEqual({
      action: "skip",
      reason: "stale",
    });
    expect(
      reduceEntitlement(
        current,
        event({ type: "CANCELLATION", cancelReason: "CUSTOMER_SUPPORT", expirationAtMs: NOW - 2, eventTimestampMs: NOW - 1 }),
        options,
      ),
    ).toEqual({ action: "skip", reason: "stale" });
    expect(reduceEntitlement(current, event({ type: "RENEWAL", eventTimestampMs: NOW }), options).action).toBe("set");
  });

  it("applies a late-delivered grant (monotonic) without rewinding updatedAt or the newer product", () => {
    const current: EntitlementRecord = { until: LATER, productId: "app_pro_monthly", updatedAt: NOW };
    expect(
      reduceEntitlement(
        current,
        event({ type: "INITIAL_PURCHASE", productId: "app_pro_annual", expirationAtMs: LATER + 5000, eventTimestampMs: NOW - 10 }),
        options,
      ),
    ).toEqual({ action: "set", next: { until: LATER + 5000, productId: "app_pro_monthly", updatedAt: NOW } });
    // A late grant that is shorter changes nothing but is still reported as applied.
    expect(
      reduceEntitlement(current, event({ type: "RENEWAL", expirationAtMs: LATER - 5, eventTimestampMs: NOW - 10 }), options),
    ).toEqual({ action: "set", next: { until: LATER, productId: "app_pro_monthly", updatedAt: NOW } });
  });

  it("lets a customer-support or developer-initiated EXPIRATION cut a longer record", () => {
    const current: EntitlementRecord = { until: LATER, productId: "app_pro_annual", updatedAt: NOW - 10 };
    for (const expirationReason of ["CUSTOMER_SUPPORT", "DEVELOPER_INITIATED"]) {
      expect(
        reduceEntitlement(current, event({ type: "EXPIRATION", expirationAtMs: NOW - 1, expirationReason }), options),
      ).toEqual({ action: "set", next: { until: NOW - 1, productId: "app_pro_monthly", updatedAt: NOW } });
    }
    expect(
      reduceEntitlement(current, event({ type: "EXPIRATION", expirationAtMs: NOW - 1, expirationReason: "UNSUBSCRIBE" }), options),
    ).toEqual({ action: "set", next: { until: LATER, productId: "app_pro_monthly", updatedAt: NOW } });
  });

  it("keeps the previous product id when the event carries none", () => {
    const current: EntitlementRecord = { until: NOW, productId: "app_pro_annual", updatedAt: NOW - 10 };
    expect(reduceEntitlement(current, event({ type: "RENEWAL", productId: null }), options)).toEqual({
      action: "set",
      next: { until: LATER, productId: "app_pro_annual", updatedAt: NOW },
    });
  });

  it("skips TRANSFER (no entitlement ids); revokedByTransfer is the TRANSFER path", () => {
    expect(reduceEntitlement(empty, event({ type: "TRANSFER", entitlementIds: [], transferredFrom: ["sub-1"] }), options)).toEqual({
      action: "skip",
      reason: "not-entitlement",
    });
  });

  it("builds the revoked record for the losing side of a transfer", () => {
    expect(revokedByTransfer(event({ type: "TRANSFER", transferredFrom: ["sub-1"] }))).toEqual({
      until: NOW,
      productId: null,
      updatedAt: NOW,
    });
  });
});
