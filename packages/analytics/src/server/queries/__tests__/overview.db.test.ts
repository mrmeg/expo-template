import { describeDb } from "../../../__tests__/dbHarness";
import { zonedDate, zonedDayStart } from "../../../metrics";
import type { Names } from "../../schema";
import { MetricsInputError } from "../context";
import { getOverviewReport, listEvents } from "../reports";
import { deps, insertEvents, insertRevenue, insertSessions, insertUsers, installTables } from "./seed";

const RANGE = { from: "2026-11-11", to: "2026-11-20" };

describeDb("overview report and raw events", (ctx) => {
  let names: Names;

  beforeAll(async () => {
    names = await installTables(ctx.sql);
    await insertUsers(ctx.sql, names, [
      { user: "n1", firstSeen: "2026-11-05T10:00:00Z" },
      { user: "n2", firstSeen: "2026-11-12T10:00:00Z" },
      { user: "n3", firstSeen: "2026-11-15T10:00:00Z" },
      { user: "ex", firstSeen: "2026-11-12T10:00:00Z", excluded: true },
    ]);
    await insertEvents(ctx.sql, names, [
      { name: "app_open", at: "2026-11-05T10:00:00Z", user: "n1" },
      { name: "app_open", at: "2026-11-06T10:00:00Z", user: "n1" },
      { name: "app_open", at: "2026-11-10T10:00:00Z", user: "n1" },
      { name: "app_open", at: "2026-11-12T10:00:00Z", user: "n2" },
      { name: "app_open", at: "2026-11-13T10:00:00Z", user: "n2" },
      { name: "page_view", at: "2026-11-13T10:00:00Z", user: "n2" },
      { name: "app_open", at: "2026-11-15T10:00:00Z", user: "n3" },
      { name: "app_open", at: "2026-11-20T10:00:00Z", anon: "dev-z" },
      { name: "app_open", at: "2026-11-12T10:00:00Z", user: "ex", anon: "dev-ex" },
      { name: "app_open", at: "2026-11-13T10:00:00Z", anon: "dev-ex" },
    ]);
    await insertSessions(ctx.sql, names, [
      { id: "w1", anon: "v1", started: "2026-11-15T10:00:00Z", pageviews: 2 },
      { id: "w2", anon: "v2", started: "2026-11-05T10:00:00Z", pageviews: 1 },
      { id: "w3", anon: "v3", started: "2026-11-06T10:00:00Z", pageviews: 4 },
    ]);
    await insertRevenue(ctx.sql, names, [
      { type: "purchased", sub: "P", user: "n1", at: "2026-11-05T00:00:00Z", periodStart: "2026-11-05T00:00:00Z", periodEnd: "2026-12-05T00:00:00Z", amount: 999 },
      { type: "purchased", sub: "Q", user: "n3", at: "2026-11-15T00:00:00Z", periodStart: "2026-11-15T00:00:00Z", periodEnd: "2026-12-15T00:00:00Z", amount: 2000 },
    ]);
  });

  it("compares each figure with the preceding period", async () => {
    const report = await getOverviewReport(deps(ctx.sql, names, { retentionDays: [1] }), RANGE);
    expect(report.previous_range).toEqual({ from: "2026-11-01", to: "2026-11-10" });
    expect(report.active_users.all).toEqual({
      dau: { current: 1, previous: 1 },
      wau: { current: 2, previous: 1 },
      mau: { current: 4, previous: 1 },
    });
    expect(report.active_users.signed_in).toEqual({
      dau: { current: 0, previous: 1 },
      wau: { current: 1, previous: 1 },
      mau: { current: 3, previous: 1 },
    });
    expect(report.new_users).toEqual({ current: 2, previous: 1 });
    expect(report.retention).toEqual([
      { day: 1, mode: "on", pending: 0, cell: { numerator: 1, denominator: 2, rate: 0.5, status: "measured" } },
    ]);
    expect(report.web).toEqual({ visitors: { current: 1, previous: 2 }, pageviews: { current: 2, previous: 5 } });
    expect(report.revenue).toEqual({
      mrr_cents: { current: 2999, previous: 999 },
      active_subscriptions: { current: 2, previous: 1 },
      gross_cents: { current: 2000, previous: 999 },
      net_cents: { current: 2000, previous: 999 },
    });
    expect(report.notes.length).toBeGreaterThan(0);
  });

  it("lists raw events newest first with keyset pages and the population filter", async () => {
    const base = { from: "2026-11-01", to: "2026-11-20", limit: 3 };
    const seen: string[] = [];
    const times: string[] = [];
    let before: string | undefined;
    const pageSizes: number[] = [];
    do {
      const page = await listEvents(deps(ctx.sql, names), { ...base, before });
      pageSizes.push(page.events.length);
      for (const event of page.events) {
        seen.push(event.id);
        times.push(event.occurred_at);
      }
      before = page.next_before ?? undefined;
    } while (before);
    expect(pageSizes).toEqual([3, 3, 2]);
    expect(new Set(seen).size).toBe(8);
    expect([...times].sort().reverse()).toEqual(times);
    expect(times[0]).toBe("2026-11-20T10:00:00.000000Z");
  });

  it("filters raw events by name and user and validates the cursor", async () => {
    const byName = await listEvents(deps(ctx.sql, names), { from: "2026-11-01", to: "2026-11-20", name: "page_view", limit: 10 });
    expect(byName.events.map((e) => e.user_id)).toEqual(["n2"]);
    expect(byName.next_before).toBeNull();
    const byUser = await listEvents(deps(ctx.sql, names), { from: "2026-11-01", to: "2026-11-20", userId: "n1", limit: 10 });
    expect(byUser.events).toHaveLength(3);
    expect(byUser.events[0]).toMatchObject({ name: "app_open", user_id: "n1", platform: "ios", properties: null });
    const excluded = await listEvents(deps(ctx.sql, names), { from: "2026-11-01", to: "2026-11-20", userId: "ex", limit: 10 });
    expect(excluded.events).toEqual([]);
    await expect(listEvents(deps(ctx.sql, names), { from: "2026-11-01", to: "2026-11-20", limit: 10, before: "nope" })).rejects.toBeInstanceOf(MetricsInputError);
  });
});

describeDb("zone arithmetic agrees with Postgres", (ctx) => {
  const cases: [string, string][] = [
    ["2026-11-01", "America/New_York"],
    ["2026-11-02", "America/New_York"],
    ["2026-03-08", "America/New_York"],
    ["2026-03-29", "Europe/London"],
    ["2026-10-25", "Europe/London"],
    ["2026-04-05", "Australia/Lord_Howe"],
    ["2026-11-27", "Asia/Kolkata"],
    ["2026-12-31", "Pacific/Auckland"],
  ];

  it.each(cases)("start of %s in %s", async (day, zone) => {
    const [row] = await ctx.sql.query<{ start: string }>(
      `select to_char(($1::date::timestamp at time zone $2::text) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as start`,
      [day, zone],
    );
    expect(new Date(zonedDayStart(day, zone)).toISOString().replace(".000Z", "Z")).toBe(row.start);
  });

  it.each(cases)("calendar date of instants around %s in %s", async (day, zone) => {
    for (const offsetHours of [-1, 0, 1, 13]) {
      const instant = new Date(zonedDayStart(day, zone) + offsetHours * 3_600_000);
      const [row] = await ctx.sql.query<{ day: string }>(
        `select to_char(($1::timestamptz at time zone $2::text)::date, 'YYYY-MM-DD') as day`,
        [instant, zone],
      );
      expect(zonedDate(instant, zone)).toBe(row.day);
    }
  });
});
