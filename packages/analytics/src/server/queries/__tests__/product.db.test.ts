import { describeDb } from "../../../__tests__/dbHarness";
import type { Names } from "../../schema";
import { MetricsInputError } from "../context";
import { getProductReport } from "../reports";
import { deps, insertEvents, insertUsers, installTables } from "./seed";

const RANGE = { from: "2026-11-01", to: "2026-11-26" };
const CONFIG = { activation: { event: "project_created" } };

describeDb("product report", (ctx) => {
  let names: Names;

  beforeAll(async () => {
    names = await installTables(ctx.sql);
    await insertUsers(ctx.sql, names, [
      { user: "alice", firstSeen: "2026-11-02T10:00:00Z", channel: "tiktok", platform: "ios" },
      { user: "carol", firstSeen: "2026-11-05T10:00:00Z" },
      { user: "dave", firstSeen: "2026-11-10T10:00:00Z", channel: "tiktok" },
      { user: "bob", firstSeen: "2026-11-25T10:00:00Z", channel: "tiktok" },
      { user: "staff", firstSeen: "2026-11-03T10:00:00Z", excluded: true },
      { user: "old", firstSeen: "2026-10-01T10:00:00Z" },
    ]);
    await insertEvents(ctx.sql, names, [
      // alice: an anonymous event on her device before signing in, stitched to her.
      { name: "app_open", at: "2026-11-01T08:00:00Z", anon: "dev-a" },
      { name: "app_open", at: "2026-11-02T10:00:00Z", user: "alice", anon: "dev-a" },
      { name: "project_created", at: "2026-11-04T10:00:00Z", user: "alice", anon: "dev-a" },
      { name: "$session_end", at: "2026-11-20T10:00:00Z", user: "alice", anon: "dev-a" },
      // carol activates anonymously before signing up on the same device.
      { name: "project_created", at: "2026-11-04T09:00:00Z", anon: "dev-c" },
      { name: "app_open", at: "2026-11-05T10:00:00Z", user: "carol", anon: "dev-c" },
      // dave activates too late (10 days after first seen).
      { name: "app_open", at: "2026-11-10T10:00:00Z", user: "dave" },
      { name: "project_created", at: "2026-11-20T10:00:00Z", user: "dave" },
      // bob has not activated and his window is still open.
      { name: "app_open", at: "2026-11-25T10:00:00Z", user: "bob" },
      // staff and their stitched device are excluded.
      { name: "app_open", at: "2026-11-10T10:00:00Z", user: "staff", anon: "dev-s" },
      { name: "app_open", at: "2026-11-11T10:00:00Z", anon: "dev-s" },
      // An anonymous visitor late on the last day.
      { name: "app_open", at: "2026-11-26T23:30:00Z", anon: "dev-x" },
      // 03:00 UTC on 11-27 is still 11-26 in Los Angeles.
      { name: "app_open", at: "2026-11-27T03:00:00Z", user: "old" },
      // Another app's rows never count.
      { name: "app_open", at: "2026-11-26T10:00:00Z", user: "alice", app: "other_app" },
    ]);
  });

  it("counts active users with stitching and the population filter", async () => {
    const report = await getProductReport(deps(ctx.sql, names, CONFIG), RANGE);
    expect(report.range).toEqual({ from: "2026-11-01", to: "2026-11-26", days: 26, timezone: "UTC" });
    expect(report.active_users.all.last).toEqual({ dau: 1, wau: 3, mau: 5 });
    expect(report.active_users.signed_in.last).toEqual({ dau: 0, wau: 2, mau: 4 });
    expect(report.active_users.all.series[0]).toEqual({ date: "2026-11-01", dau: 1, wau: 1, mau: 1 });
    expect(report.active_users.signed_in.series[0]).toEqual({ date: "2026-11-01", dau: 0, wau: 0, mau: 0 });
    expect(report.active_users.all.series).toHaveLength(26);
    expect(report.notes).toContain("Days are cut in the UTC time zone.");
  });

  it("counts new users and the activation rate with pending users left out", async () => {
    const report = await getProductReport(deps(ctx.sql, names, CONFIG), RANGE);
    expect(report.new_users.total).toBe(4);
    expect(report.new_users.series.filter((d) => d.count > 0)).toEqual([
      { date: "2026-11-02", count: 1 },
      { date: "2026-11-05", count: 1 },
      { date: "2026-11-10", count: 1 },
      { date: "2026-11-25", count: 1 },
    ]);
    expect(report.activation).toEqual({
      event: "project_created",
      within_days: 7,
      signups: 4,
      activated: 2,
      pending: 1,
      rate: { numerator: 2, denominator: 3, rate: 2 / 3, status: "measured" },
    });
  });

  it("omits activation when it is not configured", async () => {
    expect((await getProductReport(deps(ctx.sql, names), RANGE)).activation).toBeNull();
  });

  it("cuts days in the configured zone", async () => {
    const report = await getProductReport(deps(ctx.sql, names, { ...CONFIG, timezone: "America/Los_Angeles" }), RANGE);
    expect(report.range.timezone).toBe("America/Los_Angeles");
    // old's 03:00 UTC event and dev-x's 23:30 UTC event both land on 11-26 there.
    expect(report.active_users.all.last.dau).toBe(2);
    expect(report.active_users.signed_in.last.dau).toBe(1);
  });

  it("counts only the configured active events", async () => {
    const report = await getProductReport(deps(ctx.sql, names, { activeEvents: ["project_created"] }), RANGE);
    expect(report.active_users.all.last).toEqual({ dau: 0, wau: 1, mau: 3 });
  });

  it("rejects ranges and zones it cannot serve", async () => {
    await expect(getProductReport(deps(ctx.sql, names), { from: "2025-01-01", to: "2026-11-26" })).rejects.toBeInstanceOf(MetricsInputError);
    await expect(getProductReport(deps(ctx.sql, names, { timezone: "Mars/Base" }), RANGE)).rejects.toThrow(/time zone/);
  });

  it("defaults to the last 30 days ending today", async () => {
    const report = await getProductReport(deps(ctx.sql, names));
    expect(report.range).toMatchObject({ from: "2026-10-29", to: "2026-11-27", days: 30 });
  });
});
