import { computeFunnel, median } from "../funnels";
import type { FunnelEventRow } from "../types";

const definition = { key: "onboarding", name: "Onboarding", steps: ["signup", "create", "share"] };
const bounds = {
  startMs: Date.parse("2026-11-01T00:00:00Z"),
  endMs: Date.parse("2026-12-01T00:00:00Z"),
  nowMs: Date.parse("2027-01-01T00:00:00Z"),
};

function ev(actor: string, name: string, occurred_at: string): FunnelEventRow {
  return { actor, name, occurred_at };
}

describe("median", () => {
  it("takes the middle value or the mean of the middle two", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("computeFunnel", () => {
  it("counts ordered completions with other events in between", () => {
    const rows = [
      ev("a", "signup", "2026-11-02T00:00:00Z"),
      ev("a", "browse", "2026-11-02T00:00:30Z"),
      ev("a", "create", "2026-11-02T00:01:00Z"),
      ev("a", "share", "2026-11-02T00:03:00Z"),
      ev("b", "signup", "2026-11-03T00:00:00Z"),
      ev("b", "create", "2026-11-03T00:05:00Z"),
      ev("c", "signup", "2026-11-04T00:00:00Z"),
    ];
    const result = computeFunnel(definition, rows, bounds);
    expect(result).toMatchObject({ key: "onboarding", name: "Onboarding", window_days: 7, open: 0 });
    expect(result.steps.map((s) => s.actors)).toEqual([3, 2, 1]);
    expect(result.steps[0]).toMatchObject({ from_first: { rate: 1 }, from_previous: { rate: 1 }, median_seconds_from_previous: null });
    expect(result.steps[1]).toMatchObject({ from_first: { rate: 2 / 3 }, from_previous: { rate: 2 / 3 }, median_seconds_from_previous: 180 });
    expect(result.steps[2]).toMatchObject({ from_first: { rate: 1 / 3 }, from_previous: { rate: 0.5 }, median_seconds_from_previous: 120 });
  });

  it("requires steps in order", () => {
    const rows = [
      ev("a", "create", "2026-11-02T00:00:00Z"),
      ev("a", "signup", "2026-11-02T00:01:00Z"),
      ev("a", "share", "2026-11-02T00:02:00Z"),
    ];
    expect(computeFunnel(definition, rows, bounds).steps.map((s) => s.actors)).toEqual([1, 0, 0]);
  });

  it("starts the window at the first step-1 event in range and expires it", () => {
    const rows = [
      ev("early", "signup", "2026-10-31T23:59:00Z"), // before the range: not an entry
      ev("early", "create", "2026-11-01T00:10:00Z"),
      ev("slow", "signup", "2026-11-02T00:00:00Z"),
      ev("slow", "signup", "2026-11-09T00:00:00Z"), // a later step 1 does not restart the window
      ev("slow", "create", "2026-11-09T00:00:01Z"), // 7 days and 1 second after entry
      ev("edge", "signup", "2026-11-02T00:00:00Z"),
      ev("edge", "create", "2026-11-09T00:00:00Z"), // exactly 7 days: inside
    ];
    const result = computeFunnel(definition, rows, bounds);
    expect(result.steps.map((s) => s.actors)).toEqual([2, 1, 0]);
    expect(result.steps[1].median_seconds_from_previous).toBe(7 * 86_400);
  });

  it("lets later steps land after the range end inside the window", () => {
    const rows = [ev("a", "signup", "2026-11-30T23:00:00Z"), ev("a", "create", "2026-12-02T00:00:00Z")];
    expect(computeFunnel(definition, rows, bounds).steps[1].actors).toBe(1);
  });

  it("honors a custom window and reports open windows", () => {
    const rows = [
      ev("a", "signup", "2026-11-29T00:00:00Z"),
      ev("a", "create", "2026-11-29T12:00:00Z"),
      ev("done", "signup", "2026-11-29T00:00:00Z"),
      ev("done", "create", "2026-11-29T00:01:00Z"),
      ev("done", "share", "2026-11-29T00:02:00Z"),
    ];
    const now = Date.parse("2026-11-29T18:00:00Z");
    const result = computeFunnel({ ...definition, windowDays: 1 }, rows, { ...bounds, nowMs: now });
    expect(result.window_days).toBe(1);
    expect(result.open).toBe(1);
    expect(computeFunnel({ ...definition, windowDays: 1 }, rows, { ...bounds, nowMs: Date.parse("2026-12-05T00:00:00Z") }).open).toBe(0);
  });

  it("handles a repeated step name and an empty funnel", () => {
    const repeated = { key: "twice", name: "Twice", steps: ["view", "view"] };
    expect(computeFunnel(repeated, [ev("a", "view", "2026-11-02T00:00:00Z")], bounds).steps.map((s) => s.actors)).toEqual([1, 0]);
    expect(
      computeFunnel(repeated, [ev("a", "view", "2026-11-02T00:00:00Z"), ev("a", "view", "2026-11-02T00:00:05Z")], bounds).steps.map((s) => s.actors),
    ).toEqual([1, 1]);
    const empty = computeFunnel(definition, [], bounds);
    expect(empty.steps[0].from_first.status).toBe("empty");
    expect(empty.steps[1].median_seconds_from_previous).toBeNull();
  });
});
