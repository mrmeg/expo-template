import { activityWindowStart, computeActiveUsers } from "../activity";
import type { ActivityRow } from "../types";

function active(actor: string, signed_in: boolean, ...days: string[]): ActivityRow[] {
  return days.map((day) => ({ actor, day, signed_in }));
}

describe("computeActiveUsers", () => {
  const range = { from: "2026-11-01", to: "2026-11-30" };

  it("needs activity from 29 days before the range", () => {
    expect(activityWindowStart(range)).toBe("2026-10-03");
  });

  it("counts DAU, WAU and MAU on the last day for both variants", () => {
    const rows = [
      ...active("today", true, "2026-11-30"),
      ...active("this-week", true, "2026-11-24"),
      ...active("this-month", true, "2026-11-01"),
      ...active("too-old", true, "2026-10-31"),
      ...active("device-a", false, "2026-11-30"),
      ...active("device-b", false, "2026-11-29"),
      ...active("after-range", true, "2026-12-01"),
    ];
    const result = computeActiveUsers(rows, range);
    expect(result.signed_in.last).toEqual({ dau: 1, wau: 2, mau: 3 });
    expect(result.all.last).toEqual({ dau: 2, wau: 4, mau: 5 });
  });

  it("counts an actor once whether its rows are signed in or not", () => {
    const rows = [...active("u1", true, "2026-11-30"), ...active("u1", false, "2026-11-30", "2026-11-29")];
    const result = computeActiveUsers(rows, range);
    expect(result.all.last).toEqual({ dau: 1, wau: 1, mau: 1 });
    expect(result.signed_in.series[28]).toEqual({ date: "2026-11-29", dau: 0, wau: 0, mau: 0 });
    expect(result.all.series[28]).toEqual({ date: "2026-11-29", dau: 1, wau: 1, mau: 1 });
  });

  it("builds a trailing series, including activity before the range", () => {
    const rows = [
      ...active("a", true, "2026-10-05"), // 27 days before 11-01: in MAU through 11-03
      ...active("b", true, "2026-11-02", "2026-11-03", "2026-11-12"),
    ];
    const { series } = computeActiveUsers(rows, range).signed_in;
    expect(series).toHaveLength(30);
    expect(series[0]).toEqual({ date: "2026-11-01", dau: 0, wau: 0, mau: 1 });
    expect(series[1]).toEqual({ date: "2026-11-02", dau: 1, wau: 1, mau: 2 });
    expect(series[3]).toEqual({ date: "2026-11-04", dau: 0, wau: 1, mau: 1 });
    // b's 11-03 covers WAU through 11-09; 11-10 and 11-11 drop to zero until 11-12.
    expect(series[8].wau).toBe(1);
    expect(series[9].wau).toBe(0);
    expect(series[11]).toEqual({ date: "2026-11-12", dau: 1, wau: 1, mau: 1 });
  });

  it("computes stickiness as average DAU over the range over MAU on the last day", () => {
    const short = { from: "2026-11-29", to: "2026-11-30" };
    const rows = [...active("a", true, "2026-11-29", "2026-11-30"), ...active("b", true, "2026-11-30"), ...active("c", true, "2026-11-10")];
    const { stickiness } = computeActiveUsers(rows, short).signed_in;
    expect(stickiness).toEqual({ numerator: 1.5, denominator: 3, rate: 0.5, status: "measured" });
  });

  it("is empty without activity", () => {
    const result = computeActiveUsers([], range);
    expect(result.all.last).toEqual({ dau: 0, wau: 0, mau: 0 });
    expect(result.all.stickiness.status).toBe("empty");
  });

  it("crosses a year boundary", () => {
    const rows = active("a", true, "2026-12-31");
    const { series } = computeActiveUsers(rows, { from: "2026-12-31", to: "2027-01-06" }).all;
    expect(series.map((p) => p.wau)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(computeActiveUsers(rows, { from: "2027-01-07", to: "2027-01-07" }).all.last).toEqual({ dau: 0, wau: 0, mau: 1 });
  });
});
