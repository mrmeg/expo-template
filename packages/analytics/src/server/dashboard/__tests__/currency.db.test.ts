/**
 * @jest-environment node
 *
 * Money in the dashboard follows each report's currency: formatted in it when
 * there is one, shown per currency (and the combined figures marked mixed)
 * when the ledger holds several.
 */
import { describeDb } from "../../../__tests__/dbHarness";
import { APP, insertRevenue, type RevenueSeed } from "../../queries/__tests__/seed";
import { resolveNames } from "../../schema";
import { createAnalyticsServer } from "../../server";
import { openDashboard, textOf } from "./runDashboard";

const NOW = new Date("2026-11-27T12:00:00.000Z");
const BROKEN = /NaN|undefined|\[object Object\]|Infinity|null/;

function annual(sub: string, currency: string, amount: number): RevenueSeed {
  return {
    type: "purchased",
    sub,
    user: sub,
    at: "2026-03-01T00:00:00Z",
    periodStart: "2026-03-01T00:00:00Z",
    periodEnd: "2027-03-01T00:00:00Z",
    amount,
    currency,
  };
}

async function dashboardFor(ctx: { sql: Parameters<typeof createAnalyticsServer>[0]["sql"] }, rows: RevenueSeed[]) {
  const server = createAnalyticsServer({
    sql: ctx.sql,
    appId: APP,
    now: () => NOW,
    isAdmin: (request) => request.headers.get("x-admin") === "1",
    onError: (error) => {
      throw error;
    },
  });
  await server.install();
  await insertRevenue(ctx.sql, resolveNames(), rows);
  return openDashboard(server);
}

describeDb("dashboard money: mixed currencies", (ctx) => {
  it("shows MRR per currency and marks combined figures as mixed", async () => {
    const page = await dashboardFor(ctx, [
      annual("us", "usd", 12000),
      annual("eu", "eur", 24000),
      { type: "purchased", user: "one", at: "2026-11-10T00:00:00Z", amount: 500, currency: "eur" },
    ]);
    await page.goTo("overview");
    const overview = textOf(page.section("overview"));
    expect(overview).toContain("€20.00 · $10.00");
    expect(overview).toContain("5.00 (mixed)");
    expect(overview).not.toContain("$30.00");
    expect(overview).not.toMatch(BROKEN);

    await page.goTo("revenue");
    const revenue = textOf(page.section("revenue"));
    expect(revenue).toContain("€20.00 · $10.00");
    expect(revenue).toContain("(mixed)");
    expect(revenue).not.toContain("$30.00");
    expect(revenue).not.toMatch(BROKEN);
    expect(page.errors).toEqual([]);
    page.window.close();
  });
});

describeDb("dashboard money: one non-dollar currency", (ctx) => {
  it("formats every figure in the report's currency", async () => {
    const page = await dashboardFor(ctx, [annual("eu", "eur", 24000)]);
    await page.goTo("revenue");
    const revenue = textOf(page.section("revenue"));
    expect(revenue).toContain("€20.00");
    expect(revenue).not.toContain("$");
    expect(revenue).not.toContain("(mixed)");
    expect(page.errors).toEqual([]);
    page.window.close();
  });
});
