import postgres from "postgres";

import { TEST_DATABASE_URL, describeDb } from "../../../__tests__/dbHarness";
import type { MetricsConfig } from "../../../metrics";
import type { Names } from "../../schema";
import { fromPostgresJs } from "../../sql";
import {
  getAcquisitionReport,
  getFunnelReport,
  getOverviewReport,
  getProductReport,
  getRetentionReport,
  getRevenueReport,
  getWebReport,
} from "../reports";
import { APP, insertEvents, insertRevenue, insertSessions, insertUsers, installTables } from "./seed";

// The range crosses 2026-11-01, when New York falls back: a calendar day there
// is 25 hours, so a day interval computed in the session's TimeZone would move.
const RANGE = { from: "2026-10-30", to: "2026-11-05" };
const CONFIG: MetricsConfig = {
  activation: { event: "activate", withinDays: 7 },
  funnels: [{ key: "f", name: "F", steps: ["activate", "upgrade"], windowDays: 7 }],
};
const SESSION_ZONES = ["UTC", "America/New_York", "Asia/Kolkata"];

describeDb("reports do not depend on the connection's TimeZone", (ctx) => {
  let names: Names;
  const clients: postgres.Sql[] = [];

  beforeAll(async () => {
    names = await installTables(ctx.sql);
    await insertUsers(ctx.sql, names, [
      { user: "u", firstSeen: "2026-10-30T12:00:00Z" },
      { user: "v", firstSeen: "2026-10-30T12:00:00Z" },
    ]);
    await insertEvents(ctx.sql, names, [
      { name: "app_open", at: "2026-10-30T12:00:00Z", user: "u" },
      // 7 days and 30 minutes after first seen: outside a 7-day window of elapsed time,
      // inside one of 7 New York calendar days (which includes the 25-hour day).
      { name: "activate", at: "2026-11-06T12:30:00Z", user: "u" },
      { name: "activate", at: "2026-10-30T13:00:00Z", user: "v" },
      { name: "upgrade", at: "2026-11-06T13:30:00Z", user: "v" },
      { name: "app_open", at: "2026-11-05T23:30:00Z", user: "v" },
      { name: "$pageview", at: "2026-11-01T05:30:00Z", anon: "w", session: "s1", platform: "web", path: "/" },
    ]);
    await insertSessions(ctx.sql, names, [{ id: "s1", anon: "w", started: "2026-11-01T05:30:00Z", pageviews: 1 }]);
    await insertRevenue(ctx.sql, names, [
      { type: "trial_started", sub: "T", user: "v", at: "2026-10-16T13:00:00Z", amount: 0 },
      { type: "purchased", sub: "P", user: "u", at: "2026-10-20T00:00:00Z", periodStart: "2026-10-20T00:00:00Z", periodEnd: "2026-11-20T00:00:00Z", amount: 999 },
    ]);
  });

  afterAll(async () => {
    await Promise.all(clients.map((client) => client.end()));
  });

  async function reportsOn(timeZone: string) {
    const raw = postgres(TEST_DATABASE_URL!, { max: 1, onnotice: () => {}, connection: { search_path: ctx.schema, TimeZone: timeZone } });
    clients.push(raw);
    const deps = { sql: fromPostgresJs(raw), names, appId: APP, config: CONFIG, now: new Date("2026-11-27T12:00:00Z") };
    const [shown] = await raw.unsafe("show timezone");
    return {
      session: String((shown as Record<string, unknown>).TimeZone),
      product: await getProductReport(deps, RANGE),
      retention: await getRetentionReport(deps, RANGE),
      funnels: await getFunnelReport(deps, RANGE),
      acquisition: await getAcquisitionReport(deps, RANGE),
      web: await getWebReport(deps, RANGE),
      revenue: await getRevenueReport(deps, RANGE),
      overview: await getOverviewReport(deps, RANGE),
    };
  }

  it("gives identical reports on connections in different zones", async () => {
    const results: Awaited<ReturnType<typeof reportsOn>>[] = [];
    for (const zone of SESSION_ZONES) results.push(await reportsOn(zone));
    expect(results.map((r) => r.session)).toEqual(SESSION_ZONES);
    const [first, ...rest] = results.map(({ session: _session, ...reports }) => reports);
    for (const other of rest) expect(other).toEqual(first);
    // Elapsed days: u's activation 7 days and 30 minutes in is late.
    expect(first.product.activation).toMatchObject({ signups: 2, activated: 1, pending: 0 });
    // v's upgrade is 7 days and 30 minutes after entering: outside the window.
    expect(first.funnels.funnels[0].steps.map((s) => s.actors)).toEqual([1, 0]);
    // A trial with no period end lasts 14 elapsed days: started 10-16T13:00, it is over by the range end.
    expect(first.revenue.subscriptions).toMatchObject({ active_paid: 1, active_trials: 0, paid_at_range_start: 1 });
  });
});
