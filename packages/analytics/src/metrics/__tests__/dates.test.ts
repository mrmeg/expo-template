import {
  MAX_RANGE_DAYS,
  addDays,
  daysInclusive,
  eachDay,
  isIsoDate,
  isTimezone,
  isoWeekLabel,
  isoWeekStart,
  monthEnd,
  monthEndsInRange,
  previousRange,
  resolveDateRange,
  zonedDate,
  zonedDayEnd,
  zonedDayStart,
} from "../dates";

describe("calendar dates", () => {
  it("validates calendar dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-2-01")).toBe(false);
    expect(isIsoDate(20260201)).toBe(false);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(daysInclusive({ from: "2026-12-30", to: "2027-01-02" })).toBe(4);
    expect(eachDay({ from: "2026-12-30", to: "2027-01-02" })).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });

  it("finds month ends inside a range", () => {
    expect(monthEnd("2026-02-10")).toBe("2026-02-28");
    expect(monthEnd("2028-02-10")).toBe("2028-02-29");
    expect(monthEndsInRange({ from: "2026-11-15", to: "2027-02-27" })).toEqual(["2026-11-30", "2026-12-31", "2027-01-31"]);
    expect(monthEndsInRange({ from: "2026-11-01", to: "2026-11-29" })).toEqual([]);
    expect(monthEndsInRange({ from: "2026-11-30", to: "2026-11-30" })).toEqual(["2026-11-30"]);
  });

  it("labels ISO weeks including year boundaries", () => {
    expect(isoWeekStart("2026-11-29")).toBe("2026-11-23");
    expect(isoWeekStart("2026-11-23")).toBe("2026-11-23");
    expect(isoWeekLabel("2026-01-01")).toBe("2026-W01");
    expect(isoWeekLabel("2027-01-01")).toBe("2026-W53");
    expect(isoWeekLabel("2027-01-04")).toBe("2027-W01");
  });

  it("computes the previous period of equal length", () => {
    expect(previousRange({ from: "2026-11-01", to: "2026-11-30" })).toEqual({ from: "2026-10-02", to: "2026-10-31" });
    expect(previousRange({ from: "2027-01-01", to: "2027-01-01" })).toEqual({ from: "2026-12-31", to: "2026-12-31" });
  });
});

describe("zones", () => {
  it("reads the calendar date of an instant in a zone", () => {
    const instant = new Date("2026-11-27T03:30:00Z");
    expect(zonedDate(instant, "UTC")).toBe("2026-11-27");
    expect(zonedDate(instant, "America/Los_Angeles")).toBe("2026-11-26");
    expect(zonedDate(instant, "Asia/Tokyo")).toBe("2026-11-27");
    expect(zonedDate(new Date("2026-12-31T23:30:00Z"), "Pacific/Auckland")).toBe("2027-01-01");
  });

  it("finds where a day starts, across DST changes", () => {
    expect(new Date(zonedDayStart("2026-11-27", "UTC")).toISOString()).toBe("2026-11-27T00:00:00.000Z");
    expect(new Date(zonedDayStart("2026-11-27", "Asia/Tokyo")).toISOString()).toBe("2026-11-26T15:00:00.000Z");
    // New York falls back on 2026-11-01 at 02:00: midnight is still EDT.
    expect(new Date(zonedDayStart("2026-11-01", "America/New_York")).toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(new Date(zonedDayStart("2026-11-02", "America/New_York")).toISOString()).toBe("2026-11-02T05:00:00.000Z");
    // Springs forward on 2026-03-08: midnight is still EST.
    expect(new Date(zonedDayStart("2026-03-08", "America/New_York")).toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(new Date(zonedDayEnd("2026-03-08", "America/New_York")).toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });

  it("recognizes zones", () => {
    expect(isTimezone("Europe/Berlin")).toBe(true);
    expect(isTimezone("Mars/Olympus")).toBe(false);
    expect(isTimezone("")).toBe(false);
  });
});

describe("resolveDateRange", () => {
  const today = "2026-11-27";

  it("defaults to the last 30 days ending today", () => {
    expect(resolveDateRange(undefined, today)).toEqual({ ok: true, range: { from: "2026-10-29", to: "2026-11-27" } });
    expect(resolveDateRange({ from: "", to: null }, today)).toEqual({ ok: true, range: { from: "2026-10-29", to: "2026-11-27" } });
    expect(resolveDateRange({ to: "2026-10-31" }, today)).toEqual({ ok: true, range: { from: "2026-10-02", to: "2026-10-31" } });
    expect(resolveDateRange({ from: "2026-11-20" }, today)).toEqual({ ok: true, range: { from: "2026-11-20", to: "2026-11-27" } });
  });

  it("rejects malformed dates, reversed ranges and spans over the cap", () => {
    expect(resolveDateRange({ from: "2026-02-30" }, today)).toMatchObject({ ok: false });
    expect(resolveDateRange({ to: "yesterday" }, today)).toMatchObject({ ok: false });
    expect(resolveDateRange({ from: "2026-11-10", to: "2026-11-09" }, today)).toEqual({ ok: false, message: "to must be on or after from" });
    expect(resolveDateRange({ from: "2026-01-01", to: "2027-02-04" }, today)).toMatchObject({ ok: true });
    expect(daysInclusive({ from: "2026-01-01", to: "2027-02-04" })).toBe(MAX_RANGE_DAYS);
    expect(resolveDateRange({ from: "2026-01-01", to: "2027-02-05" }, today)).toMatchObject({ ok: false });
  });
});
