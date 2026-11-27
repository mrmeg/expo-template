import { describeDb } from "../../../__tests__/dbHarness";
import type { Names } from "../../schema";
import { getRetentionReport } from "../reports";
import { deps, insertEvents, insertUsers, installTables } from "./seed";

const RANGE = { from: "2026-11-01", to: "2026-11-20" };
const CONFIG = { retentionDays: [1, 7] };

describeDb("retention report", (ctx) => {
  let names: Names;

  beforeAll(async () => {
    names = await installTables(ctx.sql);
    await insertUsers(ctx.sql, names, [
      { user: "r1", firstSeen: "2026-11-02T09:00:00Z" },
      { user: "r2", firstSeen: "2026-11-02T09:00:00Z" },
      { user: "r4", firstSeen: "2026-11-19T09:00:00Z" },
      { user: "r5", firstSeen: "2026-10-20T09:00:00Z" },
      { user: "excl", firstSeen: "2026-11-02T09:00:00Z", excluded: true },
    ]);
    await insertEvents(ctx.sql, names, [
      { name: "app_open", at: "2026-11-02T09:00:00Z", user: "r1" },
      { name: "app_open", at: "2026-11-03T09:00:00Z", user: "r1" },
      { name: "app_open", at: "2026-11-10T09:00:00Z", user: "r1" },
      { name: "app_open", at: "2026-11-02T09:00:00Z", user: "r2", anon: "dev-r2" },
      // r2 returns on day 1 signed out; the device is stitched to r2.
      { name: "app_open", at: "2026-11-03T12:00:00Z", anon: "dev-r2" },
      { name: "app_open", at: "2026-11-19T09:00:00Z", user: "r4" },
      { name: "app_open", at: "2026-11-21T09:00:00Z", user: "r4" },
      { name: "app_open", at: "2026-10-20T09:00:00Z", user: "r5" },
      { name: "app_open", at: "2026-10-28T09:00:00Z", user: "r5" },
      { name: "app_open", at: "2026-11-02T09:00:00Z", user: "excl" },
      { name: "app_open", at: "2026-11-03T09:00:00Z", user: "excl" },
      // A renewal the server recorded for r2 on day 7 is not activity, so r2 is not retained at day 7.
      { name: "renewal_recorded", at: "2026-11-09T09:00:00Z", user: "r2", platform: "server" },
      // A session end is not activity.
      { name: "$session_end", at: "2026-11-09T09:00:00Z", user: "r2" },
    ]);
  });

  it("computes headline retention with stitched activity and pending members", async () => {
    const report = await getRetentionReport(deps(ctx.sql, names, CONFIG), RANGE);
    expect(report.days).toEqual([1, 7]);
    expect(report.headline).toEqual([
      { day: 1, mode: "on", pending: 0, cell: { numerator: 2, denominator: 3, rate: 2 / 3, status: "measured" } },
      { day: 7, mode: "bracket", pending: 1, cell: { numerator: 1, denominator: 2, rate: 0.5, status: "measured" } },
    ]);
  });

  it("builds daily cohorts that wait for each day's window", async () => {
    const report = await getRetentionReport(deps(ctx.sql, names, CONFIG), RANGE);
    expect(report.cohorts).toHaveLength(20);
    const nov2 = report.cohorts.find((c) => c.cohort === "2026-11-02")!;
    expect(nov2.size).toBe(2);
    expect(nov2.cells.map((c) => c.cell.rate)).toEqual([1, 0.5]);
    const nov19 = report.cohorts.find((c) => c.cohort === "2026-11-19")!;
    expect(nov19.cells[0].cell).toEqual({ numerator: 0, denominator: 1, rate: 0, status: "measured" });
    expect(nov19.cells[1].cell.status).toBe("not_yet");
  });

  it("builds the weekly grid, including cohorts before the range", async () => {
    const report = await getRetentionReport(deps(ctx.sql, names, CONFIG), RANGE);
    expect(report.weekly).toHaveLength(12);
    expect(report.weekly[11]).toMatchObject({ cohort: "2026-11-16", start: "2026-11-16", end: "2026-11-20", size: 1 });
    const nov2 = report.weekly.find((w) => w.cohort === "2026-11-02")!;
    expect(nov2.size).toBe(2);
    expect(nov2.weeks.slice(0, 4).map((c) => [c.numerator, c.status])).toEqual([
      [2, "measured"],
      [1, "measured"],
      [0, "measured"],
      [0, "not_yet"],
    ]);
    const oct19 = report.weekly.find((w) => w.cohort === "2026-10-19")!;
    expect(oct19.size).toBe(1);
    expect(oct19.weeks[1]).toEqual({ numerator: 1, denominator: 1, rate: 1, status: "measured" });
  });

  it("applies an explicit mode", async () => {
    const report = await getRetentionReport(deps(ctx.sql, names, CONFIG), RANGE, { mode: "on_or_after" });
    expect(report.headline[0]).toMatchObject({ mode: "on_or_after", cell: { numerator: 3, denominator: 3 } });
    await expect(getRetentionReport(deps(ctx.sql, names), RANGE, { mode: "sideways" as never })).rejects.toThrow(/mode/);
  });
});
