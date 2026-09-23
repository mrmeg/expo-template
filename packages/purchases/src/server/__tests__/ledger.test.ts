/**
 * Event → ledger-row normaliser and status mapping. Lifted from NeuroSpicy
 * `server/revenueCatEventProcessor.ts` (`buildRcLedgerRows`, `mapRcStatus`) and
 * the table in its `docs/subscription-billing.md`.
 */
import {
  buildLedgerRows,
  deriveSubscriptionStatus,
  isRefundCancellation,
  LEDGER_EVENT_TYPES,
  providerSubscriptionId,
  toAmountCents,
} from "../ledger";
import { parseRevenueCatWebhook, type RevenueCatWebhookEvent } from "../webhook";

const NOW = 1_700_000_000_000;
const YEAR = 365 * 24 * 3600 * 1000;

function event(overrides: Record<string, unknown> = {}): RevenueCatWebhookEvent {
  const parsed = parseRevenueCatWebhook({
    event: {
      type: "INITIAL_PURCHASE",
      id: "rcevt_1",
      app_user_id: "user_clerk_1",
      entitlement_ids: ["premium"],
      product_id: "annual_100",
      period_type: "NORMAL",
      purchased_at_ms: NOW,
      expiration_at_ms: NOW + YEAR,
      event_timestamp_ms: NOW,
      environment: "PRODUCTION",
      store: "APP_STORE",
      original_transaction_id: "txn_abc",
      price: 99,
      subscriber_attributes: { $email: { value: "x@y.z" } },
      ...overrides,
    },
  });
  if (!parsed) throw new Error("fixture did not parse");
  return parsed;
}

const types = (rows: { eventType: string }[]) => rows.map((row) => row.eventType);

describe("buildLedgerRows", () => {
  it("exposes the closed vocabulary", () => {
    expect(LEDGER_EVENT_TYPES).toEqual([
      "trial_started",
      "trial_converted",
      "purchased",
      "renewed",
      "cancel_scheduled",
      "uncanceled",
      "expired",
      "billing_issue",
      "refunded",
      "refund_reversed",
      "product_changed",
      "reactivated",
    ]);
  });

  it("maps INITIAL_PURCHASE to purchased, or trial_started with amount 0 on a trial", () => {
    expect(types(buildLedgerRows(event(), { userId: "u1" }))).toEqual(["purchased"]);
    const trial = buildLedgerRows(event({ period_type: "TRIAL", price: 0 }), { userId: "u1" });
    expect(types(trial)).toEqual(["trial_started"]);
    expect(trial[0].amountCents).toBe(0);
    const paidTrialRow = buildLedgerRows(event({ period_type: "TRIAL", price: 12 }), { userId: "u1" });
    expect(paidTrialRow[0].amountCents).toBe(0);
  });

  it("adds reactivated only when the caller says the user had lapsed", () => {
    expect(types(buildLedgerRows(event(), { userId: "u1", previouslyExpired: true }))).toEqual([
      "purchased",
      "reactivated",
    ]);
    expect(types(buildLedgerRows(event({ type: "RENEWAL" }), { userId: "u1", previouslyExpired: true }))).toEqual([
      "renewed",
    ]);
  });

  it("maps RENEWAL to trial_converted when is_trial_conversion, else renewed", () => {
    expect(types(buildLedgerRows(event({ type: "RENEWAL", is_trial_conversion: true }), { userId: "u1" }))).toEqual([
      "trial_converted",
    ]);
    expect(types(buildLedgerRows(event({ type: "RENEWAL", renewal_number: 3 }), { userId: "u1" }))).toEqual([
      "renewed",
    ]);
  });

  it("maps CANCELLATION to cancel_scheduled and adds refunded on the refund heuristic", () => {
    const plain = buildLedgerRows(event({ type: "CANCELLATION", cancel_reason: "UNSUBSCRIBE" }), { userId: "u1" });
    expect(types(plain)).toEqual(["cancel_scheduled"]);
    expect(plain[0].cancelReason).toBe("UNSUBSCRIBE");

    const refund = buildLedgerRows(
      event({ type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", expiration_at_ms: NOW - 1 }),
      { userId: "u1" },
    );
    expect(types(refund)).toEqual(["cancel_scheduled", "refunded"]);

    // CUSTOMER_SUPPORT with access continuing to the period end is not a refund.
    const support = buildLedgerRows(
      event({ type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", expiration_at_ms: NOW + YEAR }),
      { userId: "u1" },
    );
    expect(types(support)).toEqual(["cancel_scheduled"]);
  });

  it.each([
    ["UNCANCELLATION", "uncanceled"],
    ["EXPIRATION", "expired"],
    ["BILLING_ISSUE", "billing_issue"],
    ["PRODUCT_CHANGE", "product_changed"],
    ["REFUND_REVERSED", "refund_reversed"],
  ])("maps %s to %s", (type, ledgerType) => {
    expect(types(buildLedgerRows(event({ type }), { userId: "u1" }))).toEqual([ledgerType]);
  });

  it.each(["TRANSFER", "TEST", "SUBSCRIPTION_PAUSED", "NON_RENEWING_PURCHASE", "SOMETHING_NEW"])(
    "writes nothing for %s",
    (type) => {
      expect(buildLedgerRows(event({ type }), { userId: "u1" })).toEqual([]);
    },
  );

  it("fills the row from the event, lowercases enums, and strips subscriber attributes", () => {
    const [row] = buildLedgerRows(event({ type: "RENEWAL", renewal_number: 2, price: 8.295 }), { userId: "u1" });
    expect(row).toMatchObject({
      userId: "u1",
      provider: "revenuecat",
      eventType: "renewed",
      providerEventId: "rcevt_1",
      providerEventType: "RENEWAL",
      providerSubscriptionId: "rc:txn_abc",
      productId: "annual_100",
      store: "app_store",
      periodType: "normal",
      amountCents: 830,
      currency: "usd",
      renewalNumber: 2,
      cancelReason: null,
      environment: "production",
      occurredAt: NOW,
    });
    expect(row.payload).not.toHaveProperty("subscriber_attributes");
    expect(row.payload).toHaveProperty("original_transaction_id", "txn_abc");
  });

  it("leaves amount null without a price and falls back to now without a timestamp", () => {
    const [row] = buildLedgerRows(event({ type: "RENEWAL", price: undefined }), { userId: "u1" });
    expect(row.amountCents).toBeNull();
    expect(toAmountCents(null)).toBeNull();
    expect(toAmountCents(Number.NaN)).toBeNull();
    expect(toAmountCents(0.005)).toBe(1);
  });

  it("stores the cancel reason only on CANCELLATION", () => {
    const [row] = buildLedgerRows(event({ type: "EXPIRATION", cancel_reason: "UNSUBSCRIBE" }), { userId: "u1" });
    expect(row.cancelReason).toBeNull();
  });

  it("defaults the environment to production and keeps sandbox when RevenueCat says so", () => {
    expect(buildLedgerRows(event({ environment: undefined }), { userId: "u1" })[0].environment).toBe("production");
    expect(buildLedgerRows(event({ environment: "SANDBOX" }), { userId: "u1" })[0].environment).toBe("sandbox");
  });
});

describe("providerSubscriptionId", () => {
  it("prefers the original transaction id and falls back to a store+product+user composite", () => {
    expect(providerSubscriptionId(event())).toBe("rc:txn_abc");
    expect(providerSubscriptionId(event({ original_transaction_id: null }))).toBe(
      "rc:APP_STORE:annual_100:user_clerk_1",
    );
    expect(providerSubscriptionId(event({ original_transaction_id: null, store: undefined, product_id: undefined }))).toBe(
      "rc:store:product:user_clerk_1",
    );
  });
});

describe("isRefundCancellation", () => {
  it("requires CANCELLATION + CUSTOMER_SUPPORT + expiration at or before the event", () => {
    expect(isRefundCancellation(event({ type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", expiration_at_ms: NOW }))).toBe(true);
    expect(isRefundCancellation(event({ type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", expiration_at_ms: NOW + 1 }))).toBe(false);
    expect(isRefundCancellation(event({ type: "CANCELLATION", cancel_reason: "UNSUBSCRIBE", expiration_at_ms: NOW }))).toBe(false);
    expect(isRefundCancellation(event({ type: "EXPIRATION", cancel_reason: "CUSTOMER_SUPPORT", expiration_at_ms: NOW }))).toBe(false);
    expect(isRefundCancellation(event({ type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", expiration_at_ms: null }))).toBe(false);
  });
});

describe("deriveSubscriptionStatus", () => {
  it.each(["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION", "REFUND_REVERSED"])(
    "%s is active, or trialing on a TRIAL period",
    (type) => {
      expect(deriveSubscriptionStatus(event({ type }))).toBe("active");
      expect(deriveSubscriptionStatus(event({ type, period_type: "TRIAL" }))).toBe("trialing");
    },
  );

  it("maps BILLING_ISSUE to past_due, CANCELLATION and EXPIRATION to canceled, unknown fails closed", () => {
    expect(deriveSubscriptionStatus(event({ type: "BILLING_ISSUE" }))).toBe("past_due");
    expect(deriveSubscriptionStatus(event({ type: "CANCELLATION" }))).toBe("canceled");
    expect(deriveSubscriptionStatus(event({ type: "EXPIRATION" }))).toBe("canceled");
    expect(deriveSubscriptionStatus(event({ type: "SOMETHING_NEW" }))).toBe("canceled");
  });
});
