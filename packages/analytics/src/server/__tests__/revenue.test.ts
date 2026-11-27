/**
 * @jest-environment node
 */
import type { StoreContext } from "../config";
import { REVENUE_EVENT_TYPES, recordRevenueEvents, type RevenueEventInput } from "../revenue";
import { resolveNames } from "../schema";
import type { SqlClient, SqlParam } from "../sql";

/** Records each query; the insert "returns" one id per row it was given. */
function fakeContext() {
  const calls: { text: string; params: readonly SqlParam[] }[] = [];
  const sql: SqlClient = {
    async query<T>(text: string, params: readonly SqlParam[] = []): Promise<T[]> {
      calls.push({ text, params });
      const rows = JSON.parse(String(params[1])) as unknown[];
      return rows.map((_, index) => ({ id: String(index) })) as T[];
    },
    async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      return fn(sql);
    },
  };
  const ctx: StoreContext = { sql, names: resolveNames(), appId: "app", now: () => new Date() };
  return { ctx, calls, written: () => JSON.parse(String(calls[0]?.params[1])) as Record<string, unknown>[] };
}

const row: RevenueEventInput = {
  userId: "u1",
  provider: "revenuecat",
  eventType: "purchased",
  providerEventId: "evt_1",
  amountCents: 999,
  occurredAt: Date.UTC(2026, 5, 1),
};

describe("recordRevenueEvents", () => {
  it("exports the twelve event types", () => {
    expect(REVENUE_EVENT_TYPES).toEqual([
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

  it("trims and lowercases the vocabulary columns", async () => {
    const { ctx, written } = fakeContext();
    await recordRevenueEvents(ctx, [
      {
        ...row,
        provider: " RevenueCat ",
        eventType: " Purchased ",
        environment: "PRODUCTION",
        store: "APP_STORE",
        periodType: " Normal",
        currency: "USD",
      },
      { ...row, providerEventId: "evt_2", eventType: "TRIAL_STARTED", environment: " Sandbox " },
    ]);
    expect(written()[0]).toMatchObject({
      provider: "revenuecat",
      event_type: "purchased",
      environment: "production",
      store: "app_store",
      period_type: "normal",
      currency: "usd",
    });
    expect(written()[1]).toMatchObject({ event_type: "trial_started", environment: "sandbox" });
  });

  it("defaults the environment to production", async () => {
    const { ctx, written } = fakeContext();
    await recordRevenueEvents(ctx, [{ ...row, environment: null }, { ...row, providerEventId: "evt_3", environment: "  " }]);
    expect(written().map((record) => record.environment)).toEqual(["production", "production"]);
  });

  it.each([
    ["an unknown event type", { eventType: "renewal" }, /eventType "renewal" is not one of trial_started/],
    ["a missing event type", { eventType: "" }, /eventType "" is not one of/],
    ["an unknown environment", { environment: "staging" }, /environment "staging" is not one of production, sandbox/],
    ["a fractional amount", { amountCents: 9.99 }, /amountCents must be a finite integer/],
    ["an infinite amount", { amountCents: Infinity }, /amountCents must be a finite integer/],
    ["a NaN amount", { amountCents: NaN }, /amountCents must be a finite integer/],
    ["an amount outside integer range", { amountCents: 2 ** 31 }, /amountCents must be a finite integer/],
  ] as const)("throws before writing anything on %s", async (_label, change, message) => {
    const { ctx, calls } = fakeContext();
    const bad = { ...row, providerEventId: "evt_bad", ...change } as RevenueEventInput;
    const promise = recordRevenueEvents(ctx, [row, bad]);
    await expect(promise).rejects.toThrow(message);
    await expect(promise).rejects.toThrow(/row 1 \(providerEventId "evt_bad"\)/);
    expect(calls).toHaveLength(0);
  });

  it("names the row's providerEventId when the event type is wrong", async () => {
    const { ctx } = fakeContext();
    await expect(recordRevenueEvents(ctx, [{ ...row, providerEventId: "evt_9", eventType: "Refund" }])).rejects.toThrow(
      'revenue row 0 (providerEventId "evt_9"): eventType "Refund" is not one of',
    );
  });
});
