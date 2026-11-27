import { describeDb } from "../../../__tests__/dbHarness";
import type { Names } from "../../schema";
import { getAcquisitionReport } from "../reports";
import { deps, insertEvents, insertLinkClicks, insertRevenue, insertUsers, installTables } from "./seed";

const RANGE = { from: "2026-11-01", to: "2026-11-20" };

describeDb("acquisition report", (ctx) => {
  let names: Names;

  beforeAll(async () => {
    names = await installTables(ctx.sql);
    await insertUsers(ctx.sql, names, [
      { user: "a1", firstSeen: "2026-11-02T10:00:00Z", channel: "tiktok", platform: "ios" },
      { user: "a2", firstSeen: "2026-11-03T10:00:00Z", channel: "tiktok", platform: "android" },
      { user: "a3", firstSeen: "2026-11-04T10:00:00Z", channel: "instagram", platform: "web" },
      { user: "a4", firstSeen: "2026-11-06T10:00:00Z" },
      { user: "ex", firstSeen: "2026-11-02T10:00:00Z", channel: "tiktok", platform: "ios", excluded: true },
      { user: "older", firstSeen: "2026-10-01T10:00:00Z", channel: "tiktok", platform: "ios" },
    ]);
    await insertEvents(ctx.sql, names, [
      { name: "first_post", at: "2026-11-04T10:00:00Z", user: "a1" },
      { name: "first_post", at: "2026-11-04T10:00:00Z", user: "ex" },
    ]);
    await insertRevenue(ctx.sql, names, [
      { type: "trial_started", at: "2026-11-02T11:00:00Z", user: "a1", sub: "s1", amount: 0, periodEnd: "2026-11-09T11:00:00Z" },
      { type: "trial_converted", at: "2026-11-09T11:00:00Z", user: "a1", sub: "s1", amount: 999, periodStart: "2026-11-09T11:00:00Z", periodEnd: "2026-12-09T11:00:00Z" },
      { type: "trial_started", at: "2026-11-03T11:00:00Z", user: "a2", sub: "s2", amount: 0, environment: "sandbox" },
      { type: "purchased", at: "2026-11-05T11:00:00Z", user: "a3", amount: 4999 },
      { type: "purchased", at: "2026-11-05T11:00:00Z", user: "ex", amount: 4999 },
      { type: "purchased", at: "2026-11-10T11:00:00Z", user: "older", amount: 4999 },
    ]);
    await insertLinkClicks(ctx.sql, names, [
      { channel: "tiktok", at: "2026-11-01T00:00:00Z" },
      { channel: "tiktok", at: "2026-11-10T00:00:00Z" },
      { channel: "tiktok", at: "2026-11-20T23:59:00Z" },
      { channel: "tiktok", at: "2026-10-30T00:00:00Z" },
      { channel: "podcast", at: "2026-11-12T00:00:00Z" },
    ]);
  });

  it("breaks sign-ups and clicks down by channel and platform", async () => {
    const report = await getAcquisitionReport(deps(ctx.sql, names, { activation: { event: "first_post" } }), RANGE);
    expect(report.signups_by_channel).toEqual([
      { key: "tiktok", count: 2 },
      { key: "instagram", count: 1 },
      { key: "unknown", count: 1 },
    ]);
    expect(report.signups_by_platform).toEqual([
      { key: "android", count: 1 },
      { key: "ios", count: 1 },
      { key: "unknown", count: 1 },
      { key: "web", count: 1 },
    ]);
    expect(report.link_clicks_by_channel).toEqual([{ key: "tiktok", count: 3 }, { key: "podcast", count: 1 }]);
  });

  it("builds the per-channel funnel from the sign-up cohort and the production ledger", async () => {
    const report = await getAcquisitionReport(deps(ctx.sql, names, { activation: { event: "first_post" } }), RANGE);
    expect(report.channels).toEqual([
      { channel: "tiktok", link_clicks: 3, signups: 2, activated: 1, trial_started: 1, paid: 1 },
      { channel: "instagram", link_clicks: 0, signups: 1, activated: 0, trial_started: 0, paid: 1 },
      { channel: "unknown", link_clicks: 0, signups: 1, activated: 0, trial_started: 0, paid: 0 },
      { channel: "podcast", link_clicks: 1, signups: 0, activated: 0, trial_started: 0, paid: 0 },
    ]);
    const plain = await getAcquisitionReport(deps(ctx.sql, names), RANGE);
    expect(plain.channels[0].activated).toBeNull();
  });
});
