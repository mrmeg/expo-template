import {
  computeDailyCohorts,
  computeRetention,
  computeRetentionHeadline,
  computeWeeklyGrid,
  indexUserActivity,
  isRetained,
  retentionReach,
  retentionWindow,
  weeklyGridStart,
  windowClosed,
} from "../retention";
import type { CohortMember, UserActivityRow } from "../types";

function member(user_id: string, first_day: string): CohortMember {
  return { user_id, first_day };
}

function active(user_id: string, ...days: string[]): UserActivityRow[] {
  return days.map((day) => ({ user_id, day }));
}

const FAR_FUTURE = "2027-12-31";

describe("retention windows", () => {
  const index = indexUserActivity([
    ...active("d1", "2026-11-02"),
    ...active("d2", "2026-11-03"),
    ...active("d9", "2026-11-10"),
    ...active("d40", "2026-12-11"),
  ]);
  const signedUp = (id: string) => member(id, "2026-11-01");

  it("on: active on exactly day N", () => {
    const window = retentionWindow("on", 1);
    expect(isRetained(index, signedUp("d1"), window)).toBe(true);
    expect(isRetained(index, signedUp("d2"), window)).toBe(false);
  });

  it("bracket: active on any day in [N, N + 6]", () => {
    const window = retentionWindow("bracket", 7);
    expect(window).toEqual({ first: 7, last: 13 });
    expect(isRetained(index, signedUp("d9"), window)).toBe(true);
    expect(isRetained(index, signedUp("d2"), window)).toBe(false);
    expect(isRetained(index, signedUp("d40"), window)).toBe(false);
  });

  it("on_or_after: active on day N or later", () => {
    const window = retentionWindow("on_or_after", 30);
    expect(isRetained(index, signedUp("d40"), window)).toBe(true);
    expect(isRetained(index, signedUp("d9"), window)).toBe(false);
    expect(isRetained(index, signedUp("nobody"), window)).toBe(false);
  });

  it("closes a window once its last day is over", () => {
    expect(windowClosed("2026-11-01", retentionWindow("on", 1), "2026-11-02")).toBe(false);
    expect(windowClosed("2026-11-01", retentionWindow("on", 1), "2026-11-03")).toBe(true);
    expect(windowClosed("2026-11-01", retentionWindow("bracket", 7), "2026-11-14")).toBe(false);
    expect(windowClosed("2026-11-01", retentionWindow("bracket", 7), "2026-11-15")).toBe(true);
    expect(windowClosed("2026-11-01", retentionWindow("on_or_after", 30), "2026-12-02")).toBe(true);
  });

  it("closes across month and year boundaries", () => {
    expect(windowClosed("2026-12-31", retentionWindow("on", 1), "2027-01-01")).toBe(false);
    expect(windowClosed("2026-12-31", retentionWindow("on", 1), "2027-01-02")).toBe(true);
    expect(windowClosed("2026-01-31", retentionWindow("bracket", 30), "2026-03-09")).toBe(true);
    expect(windowClosed("2026-01-31", retentionWindow("bracket", 30), "2026-03-08")).toBe(false);
  });

  it("bounds the activity a report must load", () => {
    expect(retentionReach([1, 7, 30, 90])).toEqual({ offset: 96, openEnded: false });
    expect(retentionReach([1])).toEqual({ offset: 90, openEnded: false });
    expect(retentionReach([1], "on_or_after")).toEqual({ offset: 90, openEnded: true });
  });
});

describe("computeRetentionHeadline", () => {
  const range = { from: "2026-11-01", to: "2026-11-30" };
  const members = [
    member("a", "2026-11-01"),
    member("b", "2026-11-01"),
    member("c", "2026-11-20"),
    member("young", "2026-11-26"),
    member("outside", "2026-10-15"),
  ];
  const activity = [
    ...active("a", "2026-11-02", "2026-11-09"),
    ...active("c", "2026-11-21"),
    ...active("young", "2026-11-27"),
    ...active("outside", "2026-10-16"),
  ];

  it("uses on for day 1 and bracket from day 7, leaving open windows pending", () => {
    const headline = computeRetentionHeadline({ members, activity, range, today: "2026-11-27", days: [1, 7, 30] });
    // Day 1: a, b, c settled (young's day 1 is today); a and c retained.
    expect(headline[0]).toEqual({ day: 1, mode: "on", pending: 1, cell: { numerator: 2, denominator: 3, rate: 2 / 3, status: "measured" } });
    // Day 7 bracket [7, 13]: a and b settled; c and young pending.
    expect(headline[1]).toEqual({ day: 7, mode: "bracket", pending: 2, cell: { numerator: 1, denominator: 2, rate: 0.5, status: "measured" } });
    // Day 30 bracket: nobody settled.
    expect(headline[2]).toEqual({ day: 30, mode: "bracket", pending: 4, cell: { numerator: 0, denominator: 0, rate: null, status: "not_yet" } });
  });

  it("applies an explicit mode to every N", () => {
    const headline = computeRetentionHeadline({ members, activity, range, today: FAR_FUTURE, days: [7], mode: "on" });
    expect(headline[0].mode).toBe("on");
    expect(headline[0].cell.numerator).toBe(0); // a was active on day 8, not day 7
  });

  it("is empty for an empty cohort", () => {
    const headline = computeRetentionHeadline({ members: [], activity: [], range, today: FAR_FUTURE, days: [1] });
    expect(headline[0]).toEqual({ day: 1, mode: "on", pending: 0, cell: { numerator: 0, denominator: 0, rate: null, status: "empty" } });
  });
});

describe("computeDailyCohorts", () => {
  const range = { from: "2026-11-01", to: "2026-11-03" };
  const members = [member("a", "2026-11-01"), member("b", "2026-11-01"), member("c", "2026-11-03")];
  const activity = [...active("a", "2026-11-02"), ...active("c", "2026-11-04")];

  it("emits one row per day with not_yet until that day's window has closed", () => {
    const rows = computeDailyCohorts({ members, activity, range, today: "2026-11-04", days: [1] });
    expect(rows.map((r) => [r.cohort, r.size])).toEqual([["2026-11-01", 2], ["2026-11-02", 0], ["2026-11-03", 1]]);
    expect(rows[0].cells[0].cell).toEqual({ numerator: 1, denominator: 2, rate: 0.5, status: "measured" });
    expect(rows[1].cells[0].cell.status).toBe("empty");
    expect(rows[2].cells[0].cell).toEqual({ numerator: 1, denominator: 1, rate: null, status: "not_yet" });
    const later = computeDailyCohorts({ members, activity, range, today: "2026-11-05", days: [1] });
    expect(later[2].cells[0].cell.status).toBe("measured");
  });
});

describe("computeWeeklyGrid", () => {
  const range = { from: "2026-11-01", to: "2026-11-25" }; // a Wednesday

  it("covers the last 12 ISO weeks ending with the week of the range end", () => {
    expect(weeklyGridStart(range)).toBe("2026-09-07");
    const grid = computeWeeklyGrid({ members: [], activity: [], range, today: FAR_FUTURE });
    expect(grid).toHaveLength(12);
    expect(grid[0]).toMatchObject({ cohort: "2026-09-07", label: "2026-W37", start: "2026-09-07", end: "2026-09-13", size: 0 });
    expect(grid[11]).toMatchObject({ cohort: "2026-11-23", start: "2026-11-23", end: "2026-11-25" });
    expect(grid[0].weeks).toHaveLength(13);
    expect(grid[0].weeks.every((cell) => cell.status === "empty")).toBe(true);
  });

  it("measures week N relative to each member's first day and waits for the youngest member", () => {
    const members = [member("mon", "2026-11-16"), member("wed", "2026-11-18")];
    const activity = [...active("mon", "2026-11-16", "2026-11-23"), ...active("wed", "2026-11-18", "2026-12-02")];
    // Week 1 window closes for wed (youngest) after 11-18 + 13 = 12-01.
    const early = computeWeeklyGrid({ members, activity, range, today: "2026-12-01" });
    const cohort = early.find((c) => c.cohort === "2026-11-16")!;
    expect(cohort.size).toBe(2);
    expect(cohort.weeks[0]).toEqual({ numerator: 2, denominator: 2, rate: 1, status: "measured" });
    expect(cohort.weeks[1]).toEqual({ numerator: 1, denominator: 2, rate: null, status: "not_yet" });
    const later = computeWeeklyGrid({ members, activity, range, today: "2026-12-02" });
    // wed's day 14 (12-02) is week 2, not week 1.
    expect(later.find((c) => c.cohort === "2026-11-16")!.weeks[1]).toEqual({ numerator: 1, denominator: 2, rate: 0.5, status: "measured" });
    expect(later.find((c) => c.cohort === "2026-11-16")!.weeks[2].status).toBe("not_yet");
  });

  it("leaves members after the range end out of the last cohort", () => {
    const grid = computeWeeklyGrid({ members: [member("late", "2026-11-27")], activity: [], range, today: FAR_FUTURE });
    expect(grid[11].size).toBe(0);
  });
});

describe("computeRetention", () => {
  it("assembles headline, cohorts and the weekly grid from one index", () => {
    const result = computeRetention({
      members: [member("a", "2026-11-01")],
      activity: active("a", "2026-11-02"),
      range: { from: "2026-11-01", to: "2026-11-02" },
      today: FAR_FUTURE,
      days: [1, 7],
    });
    expect(result.headline.map((h) => h.cell.rate)).toEqual([1, 0]);
    expect(result.cohorts).toHaveLength(2);
    expect(result.weekly).toHaveLength(12);
  });
});
