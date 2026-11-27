/**
 * @jest-environment node
 */
import { LIMITS } from "../../shared/wire";
import { CLOCK_SKEW_TOLERANCE_MS, correctBatchTimes, validateEvent } from "../ingest";

const NOW = new Date("2026-06-01T12:00:00.000Z");
const ID = "5E0B1C2D-3E4F-4A5B-8C6D-7E8F9A0B1C2D";

function event(over: Record<string, unknown> = {}) {
  return { id: ID, name: "signed_up", ts: "2026-06-01T11:59:00.000Z", ...over };
}

describe("validateEvent", () => {
  it("accepts a valid event and lowercases its id", () => {
    const check = validateEvent(event({ path: "/a?b=c", props: { plan: "pro" }, session_id: "s-1" }), NOW);
    expect(check).toEqual({
      ok: true,
      truncated: false,
      restamped: false,
      clientTime: Date.parse("2026-06-01T11:59:00.000Z"),
      event: {
        id: ID.toLowerCase(),
        name: "signed_up",
        occurredAt: new Date("2026-06-01T11:59:00.000Z"),
        sessionId: "s-1",
        path: "/a",
        props: { plan: "pro" },
      },
    });
  });

  it.each([
    ["a non-object", "nope"],
    ["a bad id", event({ id: "not-a-uuid" })],
    ["an uppercase name", event({ name: "SignedUp" })],
    ["a long name", event({ name: `a${"b".repeat(LIMITS.eventNameMaxLength)}` })],
    ["an unknown reserved name", event({ name: "$identify" })],
    ["a bad session id", event({ session_id: "has spaces" })],
    ["a long path", event({ path: `/${"p".repeat(LIMITS.pathMaxLength)}` })],
    ["array props", event({ props: [1, 2] })],
  ])("rejects %s", (_label, raw) => {
    expect(validateEvent(raw, NOW).ok).toBe(false);
  });

  it("accepts the reserved names", () => {
    for (const name of ["$pageview", "$screen", "$session_start", "$session_end"]) {
      expect(validateEvent(event({ name }), NOW).ok).toBe(true);
    }
  });

  it("returns the client time as sent, leaving window correction to the batch", () => {
    for (const ts of ["2020-01-01T00:00:00Z", "2026-06-01T12:10:00Z"]) {
      const check = validateEvent(event({ ts }), NOW);
      expect(check).toMatchObject({ ok: true, restamped: false, clientTime: Date.parse(ts), event: { occurredAt: new Date(ts) } });
    }
  });

  it("gives an unparseable timestamp server time", () => {
    for (const ts of ["yesterday", undefined, 42]) {
      const check = validateEvent(event({ ts }), NOW);
      expect(check).toMatchObject({ ok: true, restamped: true, clientTime: null, event: { occurredAt: NOW } });
    }
  });

  it("replaces oversized props with a marker", () => {
    const many = Object.fromEntries(Array.from({ length: LIMITS.propertiesMaxKeys + 1 }, (_, i) => [`k${i}`, i]));
    expect(validateEvent(event({ props: many }), NOW)).toMatchObject({ truncated: true, event: { props: { _truncated: true } } });
    const big = { blob: "x".repeat(LIMITS.propertiesMaxBytes) };
    expect(validateEvent(event({ props: big }), NOW)).toMatchObject({ truncated: true, event: { props: { _truncated: true } } });
  });

  it("rejects an event whose props overflow the stack instead of throwing", () => {
    let nested: Record<string, unknown> = {};
    const root = nested;
    for (let i = 0; i < 200_000; i++) {
      const next: Record<string, unknown> = {};
      nested.a = next;
      nested = next;
    }
    let check: ReturnType<typeof validateEvent> | undefined;
    expect(() => {
      check = validateEvent(event({ props: root }), NOW);
    }).not.toThrow();
    // Either outcome keeps the rest of the batch: rejected, or kept with a marker.
    expect(check && (check.ok === false || check.truncated === true)).toBe(true);
  });
});

describe("correctBatchTimes", () => {
  const now = NOW.getTime();
  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const DAY = 24 * 60 * MINUTE;
  const iso = (ms: number) => new Date(ms).toISOString();

  it("corrects a fast clock with sent_at, keeping order and spacing", () => {
    // Device clock 10 minutes fast; /a, /b, /c over 6 minutes, sent right after /c.
    const fast = 10 * MINUTE;
    const client = [now - 6 * MINUTE + fast, now - 3 * MINUTE + fast, now + fast];
    const { times, restamped, offsetMs } = correctBatchTimes(client, iso(now + fast), now);
    expect(offsetMs).toBe(-fast);
    expect(times).toEqual([now - 6 * MINUTE, now - 3 * MINUTE, now]);
    expect(restamped).toEqual([true, true, true]);
  });

  it("corrects a fast clock without sent_at by pulling the newest event back to server time", () => {
    const fast = 10 * MINUTE;
    const client = [now - 6 * MINUTE + fast, now - 3 * MINUTE + fast, now + fast];
    const { times } = correctBatchTimes(client, undefined, now);
    expect(times).toEqual([now - 6 * MINUTE, now - 3 * MINUTE, now]);
  });

  it("corrects a slow clock", () => {
    const slow = -2 * 60 * MINUTE;
    const client = [now - 5 * MINUTE + slow, now + slow];
    const { times } = correctBatchTimes(client, iso(now + slow), now);
    expect(times).toEqual([now - 5 * MINUTE, now]);
  });

  it("keeps an old offline batch in order and a step apart", () => {
    // Queued 40 days ago (outside the window), sent now with a correct clock.
    const client = [now - 40 * DAY, now - 40 * DAY + 2 * MINUTE];
    const { times, restamped } = correctBatchTimes(client, iso(now), now);
    const start = now - LIMITS.timestampMaxAgeMs;
    expect(times).toEqual([start, start + 1]);
    expect(times[0]).toBeLessThan(times[1]);
    expect(restamped).toEqual([true, true]);
  });

  it("keeps the true age of events queued offline inside the window", () => {
    const client = [now - 3 * DAY, now - 3 * DAY + MINUTE];
    expect(correctBatchTimes(client, iso(now), now).times).toEqual(client);
  });

  it("keeps order across mixed old and recent events", () => {
    const client = [now - 45 * DAY, now - 40 * DAY, now - 2 * DAY, now - MINUTE];
    const { times } = correctBatchTimes(client, iso(now), now);
    const start = now - LIMITS.timestampMaxAgeMs;
    expect(times).toEqual([start, start + 1, now - 2 * DAY, now - MINUTE]);
    // Input order is not assumed: an unsorted batch keeps its time order too.
    const shuffled = correctBatchTimes([client[1], client[3], client[0]], iso(now), now).times;
    expect(shuffled).toEqual([start + 1, now - MINUTE, start]);
  });

  it("gives the same stored times when a retry carries a new sent_at", () => {
    const skew = 7 * MINUTE;
    const client = [now - 2 * MINUTE + skew, now - MINUTE + skew];
    const first = correctBatchTimes(client, iso(now + skew), now).times;
    // Retried 15 minutes later; same events, fresh sent_at from the same skewed clock, plus 300 ms latency.
    const later = now + 15 * MINUTE;
    const retry = correctBatchTimes(client, iso(later + skew - 300), later).times;
    retry.forEach((time, index) => expect(Math.abs(time - first[index])).toBeLessThanOrEqual(CLOCK_SKEW_TOLERANCE_MS));
  });

  it("stores in-window events untouched without sent_at", () => {
    const client = [now - 20 * DAY, now - MINUTE, now + 4 * MINUTE];
    const { times, restamped, offsetMs } = correctBatchTimes(client, undefined, now);
    expect(times).toEqual(client);
    expect(restamped).toEqual([false, false, false]);
    expect(offsetMs).toBe(0);
  });

  it("ignores skew within the tolerance", () => {
    const client = [now - MINUTE];
    expect(correctBatchTimes(client, iso(now - 3 * SECOND), now).times).toEqual(client);
  });

  it("ignores an absurd sent_at and falls back to the future check", () => {
    const client = [now - MINUTE, now];
    expect(correctBatchTimes(client, "1999-01-01T00:00:00Z", now).times).toEqual(client);
    expect(correctBatchTimes(client, "not a date", now).times).toEqual(client);
  });

  it("clamps events still in the future to server time, in order", () => {
    // sent_at says the clock is right, but two events claim to be an hour ahead.
    const client = [now - MINUTE, now + 61 * MINUTE, now + 60 * MINUTE];
    const { times } = correctBatchTimes(client, iso(now), now);
    expect(times).toEqual([now - MINUTE, now + 1, now]);
  });

  it("gives unparseable times server time", () => {
    const { times, restamped } = correctBatchTimes([null, now - MINUTE], iso(now), now);
    expect(times).toEqual([now, now - MINUTE]);
    expect(restamped).toEqual([true, false]);
  });
});
