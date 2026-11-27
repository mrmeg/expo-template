/**
 * @jest-environment node
 */
import { randomUUID } from "node:crypto";

import { describeDb } from "../../__tests__/dbHarness";
import type { RevenueEventInput } from "../revenue";
import { createAnalyticsServer, type AnalyticsServer } from "../server";

/**
 * Local mirror of `@mrmeg/expo-purchases`' `LedgerRow` (that package is not a
 * dependency). If the mirror stops being assignable, the input shape drifted.
 */
interface PurchasesLedgerRow {
  userId: string;
  provider: "revenuecat";
  eventType: "trial_started" | "purchased" | "renewed" | "refunded";
  providerEventId: string;
  providerEventType: string;
  providerSubscriptionId: string;
  productId: string | null;
  store: string | null;
  periodType: string | null;
  amountCents: number | null;
  currency: "usd";
  renewalNumber: number | null;
  cancelReason: string | null;
  environment: string;
  occurredAt: number;
  payload: Record<string, unknown>;
}

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const BOT = "facebookexternalhit/1.1";
const DAY = 24 * 60 * 60 * 1000;

describeDb("server API", (ctx) => {
  let clock = new Date("2026-07-01T12:00:00.000Z");
  let server: AnalyticsServer;

  beforeAll(async () => {
    server = createAnalyticsServer({
      sql: ctx.sql,
      appId: "app_b",
      now: () => clock,
      links: {
        ios: "https://apps.apple.com/app/id1",
        web: "https://example.com/start",
        appleCampaignToken: "999",
      },
      onError: (error) => {
        throw error;
      },
    });
    await server.install();
  });

  it("tracks trusted server events idempotently", async () => {
    const id = randomUUID();
    const result = await server.track([
      { id, name: "subscription_renewed", userId: "u1", props: { plan: "pro" } },
      { name: "invoice_sent", anonymousId: "anon_1", ts: clock.getTime() - 1000 },
      { name: "Bad Name" },
    ]);
    expect(result).toEqual({ received: 3, inserted: 2, rejected: 1, duplicates: 0 });
    await expect(server.track({ id, name: "subscription_renewed", userId: "u1" })).resolves.toMatchObject({
      inserted: 0,
      duplicates: 1,
    });
    const [row] = await ctx.raw.unsafe("select * from analytics_events where id = $1", [id]);
    expect(row).toMatchObject({ app_id: "app_b", platform: "server", user_id: "u1", properties: { plan: "pro" } });
  });

  it("identifies users, backfilling an earlier sign-up date only", async () => {
    await server.identify("u2", { platform: "android", appVersion: "2.0.0", traits: { plan: "free" } });
    let [user] = await ctx.raw.unsafe("select * from analytics_users where user_id = 'u2'");
    expect(user).toMatchObject({ signup_platform: "android", channel: "play_store_organic", traits: { plan: "free" } });
    expect(new Date(user.first_seen_at).toISOString()).toBe(clock.toISOString());

    await server.identify("u2", { createdAt: new Date(clock.getTime() - 30 * DAY), traits: { team: "a" } });
    await server.identify("u2", { createdAt: clock.getTime() - DAY, excluded: true, acquisition: { utm_source: "Reddit" } });
    [user] = await ctx.raw.unsafe("select * from analytics_users where user_id = 'u2'");
    expect(new Date(user.first_seen_at).toISOString()).toBe(new Date(clock.getTime() - 30 * DAY).toISOString());
    expect(user).toMatchObject({ excluded: true, traits: { plan: "free", team: "a" }, utm_source: "reddit", channel: "reddit" });

    await expect(server.identify(" ")).rejects.toThrow(/user id/);
  });

  it("records revenue idempotently and accepts purchases ledger rows", async () => {
    const ledger: PurchasesLedgerRow = {
      userId: "u2",
      provider: "revenuecat",
      eventType: "purchased",
      providerEventId: `evt_${randomUUID()}`,
      providerEventType: "INITIAL_PURCHASE",
      providerSubscriptionId: "rc:tx1",
      productId: "pro_monthly",
      store: "app_store",
      periodType: "normal",
      amountCents: 999,
      currency: "usd",
      renewalNumber: 1,
      cancelReason: null,
      environment: "production",
      occurredAt: clock.getTime(),
      payload: { raw: true },
    };
    const refund: RevenueEventInput = {
      ...ledger,
      eventType: "refunded",
      amountCents: -999,
      periodStart: new Date(clock.getTime() - DAY),
      periodEnd: clock,
    };
    const rows: RevenueEventInput[] = [ledger, refund];

    await expect(server.recordRevenueEvents(rows)).resolves.toBe(2);
    await expect(server.recordRevenueEvents(rows)).resolves.toBe(0);
    await expect(server.recordRevenueEvents([{ ...ledger, providerEventId: "" }])).rejects.toThrow(/providerEventId/);

    const stored = await ctx.raw.unsafe(
      "select event_type, amount_cents, currency, payload from analytics_revenue_events where provider_event_id = $1 order by event_type",
      [ledger.providerEventId],
    );
    expect(stored).toEqual([
      { event_type: "purchased", amount_cents: 999, currency: "usd", payload: { raw: true } },
      { event_type: "refunded", amount_cents: -999, currency: "usd", payload: { raw: true } },
    ]);
  });

  it("normalizes hand-built revenue rows so a differently cased replay still dedupes", async () => {
    const providerEventId = `evt_${randomUUID()}`;
    const handBuilt: RevenueEventInput = {
      userId: "u3",
      provider: "Stripe",
      eventType: "Renewed",
      providerEventId,
      store: "WEB",
      periodType: "NORMAL",
      environment: "PRODUCTION",
      amountCents: 500,
      currency: "EUR",
      occurredAt: clock,
    };
    await expect(server.recordRevenueEvents([handBuilt])).resolves.toBe(1);
    await expect(
      server.recordRevenueEvents([{ ...handBuilt, provider: "stripe", eventType: "renewed", environment: "production" }]),
    ).resolves.toBe(0);
    const [stored] = await ctx.raw.unsafe(
      "select provider, event_type, store, period_type, environment, currency from analytics_revenue_events where provider_event_id = $1",
      [providerEventId],
    );
    expect(stored).toEqual({
      provider: "stripe",
      event_type: "renewed",
      store: "web",
      period_type: "normal",
      environment: "production",
      currency: "eur",
    });

    await expect(server.recordRevenueEvents([{ ...handBuilt, providerEventId: "evt_x", eventType: "renewal" }])).rejects.toThrow(
      /providerEventId "evt_x".*eventType "renewal"/,
    );
  });

  it("records a link click and redirects, but not for crawlers or HEAD", async () => {
    const go = (ua: string, method = "GET") =>
      server.handle(
        new Request("https://api.example.com/analytics/go/tiktok?c=spring", {
          method,
          headers: { "user-agent": ua, referer: "https://www.tiktok.com/@someone" },
        }),
      );
    const response = await go(IPHONE);
    expect(response?.status).toBe(302);
    const location = new URL(response!.headers.get("location")!);
    expect(location.searchParams.get("ct")).toBe("tiktok-spring");

    await go(BOT);
    await go(IPHONE, "HEAD");
    const clicks = await ctx.raw.unsafe("select * from analytics_link_clicks where app_id = 'app_b'");
    expect(clicks).toHaveLength(1);
    expect(clicks[0]).toMatchObject({
      channel: "tiktok",
      campaign: "spring",
      destination: "app_store",
      platform: "ios",
      referrer_host: "www.tiktok.com",
    });

    const id = await server.recordLinkClick({ channel: "newsletter", destination: "web" });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("prunes old events and sessions, never users or revenue", async () => {
    const old = new Date(clock.getTime() - 100 * DAY).toISOString();
    await ctx.raw.unsafe(
      `insert into analytics_events (id, app_id, name, occurred_at) values ($1, 'app_b', 'old', $2), ($3, 'other_app', 'old', $2)`,
      [randomUUID(), old, randomUUID()],
    );
    await ctx.raw.unsafe(
      `insert into analytics_sessions (id, app_id, started_at, last_seen_at) values ($1, 'app_b', $2, $2)`,
      [randomUUID(), old],
    );
    const before = await ctx.raw.unsafe(
      "select (select count(*)::int from analytics_users) as users, (select count(*)::int from analytics_revenue_events) as revenue",
    );

    await expect(server.prune({ olderThanDays: 90 })).resolves.toEqual({ events: 1, sessions: 1 });
    await expect(server.prune({ olderThanDays: 90 })).resolves.toEqual({ events: 0, sessions: 0 });
    await expect(server.prune({ olderThanDays: 0 })).rejects.toThrow(/positive/);

    const after = await ctx.raw.unsafe(
      "select (select count(*)::int from analytics_users) as users, (select count(*)::int from analytics_revenue_events) as revenue",
    );
    expect(after).toEqual(before);
    const otherApp = await ctx.raw.unsafe("select 1 from analytics_events where app_id = 'other_app'");
    expect(otherApp).toHaveLength(1);
  });

  it("reports status through the server", async () => {
    await expect(server.status()).resolves.toMatchObject({ installed: true, pending: [] });
  });
});
