/**
 * @jest-environment node
 */
import { LIMITS } from "../../shared/wire";
import { validateEvent } from "../ingest";

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

  it("restamps timestamps outside the window with server time", () => {
    for (const ts of ["2020-01-01T00:00:00Z", "2026-06-01T12:10:00Z", "yesterday", undefined]) {
      const check = validateEvent(event({ ts }), NOW);
      expect(check).toMatchObject({ ok: true, restamped: true, event: { occurredAt: NOW } });
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
