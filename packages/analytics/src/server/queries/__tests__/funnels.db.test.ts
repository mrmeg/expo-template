import { describeDb } from "../../../__tests__/dbHarness";
import type { Names } from "../../schema";
import { getFunnelReport } from "../reports";
import { deps, insertEvents, insertUsers, installTables } from "./seed";

const RANGE = { from: "2026-11-01", to: "2026-11-20" };
const CONFIG = {
  funnels: [
    { key: "onboard", name: "Onboarding", steps: ["signup_started", "signup_done", "first_post"] },
    { key: "short", name: "Short window", steps: ["signup_started", "signup_done"], windowDays: 1 },
  ],
};

describeDb("funnel report", (ctx) => {
  let names: Names;

  beforeAll(async () => {
    names = await installTables(ctx.sql);
    await insertUsers(ctx.sql, names, [{ user: "staff", firstSeen: "2026-11-01T00:00:00Z", excluded: true }]);
    await insertEvents(ctx.sql, names, [
      // u1 starts signed out; stitching joins the device's first step to u1's later steps.
      { name: "signup_started", at: "2026-11-02T10:00:00Z", anon: "dev1" },
      { name: "signup_done", at: "2026-11-02T10:05:00Z", user: "u1", anon: "dev1" },
      { name: "page", at: "2026-11-02T10:06:00Z", user: "u1", anon: "dev1" },
      { name: "first_post", at: "2026-11-03T10:00:00Z", user: "u1", anon: "dev1" },
      { name: "signup_started", at: "2026-11-05T10:00:00Z", anon: "dev2" },
      { name: "signup_started", at: "2026-11-06T10:00:00Z", user: "staff" },
      { name: "signup_done", at: "2026-11-06T10:01:00Z", user: "staff" },
      // u3 enters on the last day and finishes step 2 after the range end, inside the window.
      { name: "signup_started", at: "2026-11-20T23:00:00Z", user: "u3" },
      { name: "signup_done", at: "2026-11-22T00:00:00Z", user: "u3" },
      // u4's first step is before the range.
      { name: "signup_started", at: "2026-10-31T10:00:00Z", user: "u4" },
      { name: "signup_done", at: "2026-11-01T10:00:00Z", user: "u4" },
    ]);
  });

  it("counts ordered steps per actor with stitching, exclusion and windows", async () => {
    const report = await getFunnelReport(deps(ctx.sql, names, CONFIG), RANGE);
    expect(report.funnels.map((f) => f.key)).toEqual(["onboard", "short"]);
    const [onboard, short] = report.funnels;
    expect(onboard.steps.map((s) => s.actors)).toEqual([3, 2, 1]);
    expect(onboard.steps[1].from_previous.rate).toBeCloseTo(2 / 3);
    expect(onboard.steps[2].from_first.rate).toBeCloseTo(1 / 3);
    expect(onboard.steps[1].median_seconds_from_previous).toBe((300 + 25 * 3600) / 2);
    expect(onboard.steps[2].median_seconds_from_previous).toBe(23 * 3600 + 55 * 60);
    expect(onboard.open).toBe(1);
    // u3's second step is 25 hours after the first: outside a one-day window.
    expect(short.steps.map((s) => s.actors)).toEqual([3, 1]);
    expect(short.open).toBe(0);
  });

  it("selects one funnel by key and rejects an unknown key", async () => {
    const report = await getFunnelReport(deps(ctx.sql, names, CONFIG), RANGE, { key: "short" });
    expect(report.funnels.map((f) => f.key)).toEqual(["short"]);
    await expect(getFunnelReport(deps(ctx.sql, names, CONFIG), RANGE, { key: "nope" })).rejects.toThrow(/no funnel/);
    expect((await getFunnelReport(deps(ctx.sql, names), RANGE)).funnels).toEqual([]);
  });
});
