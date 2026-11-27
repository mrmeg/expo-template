/**
 * The platform-neutral tracker against a fake transport, fake storage and fake
 * timers: batching, single flight, retry and drop rules, persistence, the
 * consent switch, first-touch acquisition, sessions and cookieless mode.
 */
import { createTracker } from "../tracker";
import type { TrackerOptions } from "../tracker";
import { LIMITS } from "../../shared/wire";
import { fakeStorage, fakeTransport, sequentialIds, settle } from "./fakes";

const START = Date.UTC(2026, 10, 27, 12, 0, 0);

function setup(overrides: Partial<TrackerOptions> = {}) {
  const fake = fakeTransport();
  const errors: unknown[] = [];
  const tracker = createTracker({
    endpoint: "https://app.example.com/analytics/e",
    platform: "ios",
    appVersion: "1.2.3",
    transport: fake.transport,
    generateId: sequentialIds(),
    onError: (error) => errors.push(error),
    ...overrides,
  });
  return { tracker, fake, errors };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(START);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("track", () => {
  it("types props from the event map", async () => {
    type Events = {
      signup: { method: string };
      logout: undefined;
      share: { target: string } | undefined;
    };
    const fake = fakeTransport();
    const tracker = createTracker<Events>({
      endpoint: "https://x.test/e",
      platform: "web",
      transport: fake.transport,
      generateId: sequentialIds(),
    });
    tracker.track("signup", { method: "email" });
    tracker.track("logout");
    tracker.track("share");
    tracker.track("share", { target: "sms" });
    // @ts-expect-error props are required for signup
    tracker.track("signup");
    // @ts-expect-error wrong prop type
    tracker.track("signup", { method: 1 });
    // @ts-expect-error unknown event
    tracker.track("unknown_event");
    await tracker.flush();
    expect(fake.sent[0]!.batch.events.map((event) => event.props)).toEqual([
      { method: "email" },
      undefined,
      undefined,
      { target: "sms" },
      undefined,
      { method: 1 },
      undefined,
    ]);
  });

  it("drops invalid and unknown reserved names through onError", async () => {
    const { tracker, fake, errors } = setup();
    tracker.track("Bad Name");
    tracker.track("$custom");
    tracker.track("a".repeat(LIMITS.eventNameMaxLength + 1));
    tracker.track("good_name");
    await tracker.flush();
    expect(fake.names()).toEqual(["good_name"]);
    expect(errors).toHaveLength(3);
  });

  it("builds the wire batch with context and timestamps", async () => {
    const { tracker, fake } = setup();
    tracker.track("opened", { n: 1 });
    await tracker.flush();
    const { request, batch } = fake.sent[0]!;
    expect(request.url).toBe("https://app.example.com/analytics/e");
    expect(request.headers["Content-Type"]).toBe("application/json");
    expect(batch.context).toEqual({ platform: "ios", app_version: "1.2.3", anonymous_id: "id-2" });
    expect(batch.events).toEqual([
      { id: "id-1", name: "opened", ts: new Date(START).toISOString(), props: { n: 1 } },
    ]);
  });

  it("passes host headers", async () => {
    const { tracker, fake } = setup({ headers: async () => ({ Authorization: "Bearer t" }) });
    tracker.track("opened");
    await tracker.flush();
    expect(fake.sent[0]!.request.headers.Authorization).toBe("Bearer t");
  });

  it("strips query strings and fragments from paths and cuts them to the limit", async () => {
    const { tracker, fake } = setup();
    tracker.page("/pricing?token=secret#plans");
    tracker.track("clicked");
    tracker.screen(`/${"s".repeat(600)}`);
    await tracker.flush();
    const events = fake.sent[0]!.batch.events;
    expect(events[0]).toMatchObject({ name: "$pageview", path: "/pricing" });
    expect(events[1]).toMatchObject({ name: "clicked", path: "/pricing" });
    expect(events[2]!.path).toHaveLength(LIMITS.pathMaxLength);
  });

  it("replaces oversized props the way the server would", async () => {
    const { tracker, fake } = setup();
    tracker.track("big", { blob: "x".repeat(LIMITS.propertiesMaxBytes) });
    await tracker.flush();
    expect(fake.sent[0]!.batch.events[0]!.props).toEqual({ _truncated: true });
  });

  it("never throws to the caller", async () => {
    const { tracker, errors } = setup({
      transport: () => {
        throw new Error("boom");
      },
    });
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => tracker.track("circular", circular)).not.toThrow();
    await expect(tracker.flush()).resolves.toBeUndefined();
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("batching", () => {
  it("flushes when the queue reaches flushAt", async () => {
    const { tracker, fake } = setup({ flushAt: 3 });
    tracker.track("one");
    tracker.track("two");
    await settle();
    expect(fake.sent).toHaveLength(0);
    tracker.track("three");
    await settle();
    expect(fake.names()).toEqual(["one", "two", "three"]);
  });

  it("flushes on the interval", async () => {
    const { tracker, fake } = setup({ flushIntervalMs: 10_000 });
    tracker.track("one");
    await jest.advanceTimersByTimeAsync(9_999);
    expect(fake.sent).toHaveLength(0);
    await jest.advanceTimersByTimeAsync(1);
    expect(fake.names()).toEqual(["one"]);
  });

  it("splits a large queue into batches of at most batchMaxEvents", async () => {
    const { tracker, fake } = setup({ flushAt: 1_000 });
    for (let i = 0; i < 250; i += 1) tracker.track("tick");
    await tracker.flush();
    expect(fake.sent.map((entry) => entry.batch.events.length)).toEqual([100, 100, 50]);
  });

  it("keeps one flush in flight at a time", async () => {
    const { tracker, fake } = setup();
    const held = fake.hold();
    tracker.track("one");
    const first = tracker.flush();
    const second = tracker.flush();
    expect(second).toBe(first);
    await settle();
    expect(fake.sent).toHaveLength(1);
    tracker.track("two");
    void tracker.flush();
    await settle();
    expect(fake.sent).toHaveLength(1);
    fake.respond(200);
    held[0]!.release(200);
    await first;
    // The drain picks up what arrived during the first request.
    expect(fake.sent).toHaveLength(2);
    expect(fake.names(1)).toEqual(["two"]);
  });

  it("drops the oldest events beyond maxQueue", async () => {
    const { tracker, fake } = setup({ maxQueue: 3, flushAt: 100 });
    for (const name of ["a", "b", "c", "d", "e"]) tracker.track(name);
    await tracker.flush();
    expect(fake.names()).toEqual(["c", "d", "e"]);
  });
});

describe("delivery failures", () => {
  it("retries a network error with exponential backoff and resends the same batch", async () => {
    const { tracker, fake } = setup({ flushIntervalMs: 60 * 60 * 1000 });
    fake.respond(new Error("offline"));
    tracker.track("one");
    await tracker.flush();
    expect(fake.sent).toHaveLength(1);

    await jest.advanceTimersByTimeAsync(999);
    expect(fake.sent).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(fake.sent).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(2_000);
    expect(fake.sent).toHaveLength(3);
    await jest.advanceTimersByTimeAsync(4_000);
    expect(fake.sent).toHaveLength(4);

    fake.respond(200);
    await jest.advanceTimersByTimeAsync(8_000);
    expect(fake.sent).toHaveLength(5);
    const ids = fake.sent.map((entry) => entry.batch.events.map((event) => event.id).join());
    expect(new Set(ids).size).toBe(1);

    await jest.advanceTimersByTimeAsync(60_000);
    expect(fake.sent).toHaveLength(5);
  });

  it("caps the backoff at five minutes", async () => {
    const { tracker, fake } = setup({ flushIntervalMs: 60 * 60 * 1000 });
    fake.respond(503);
    tracker.track("one");
    await tracker.flush();
    // 1, 2, 4, ... 256 s, then capped at 300 s.
    await jest.advanceTimersByTimeAsync((1 + 2 + 4 + 8 + 16 + 32 + 64 + 128 + 256) * 1000);
    expect(fake.sent).toHaveLength(10);
    await jest.advanceTimersByTimeAsync(299_999);
    expect(fake.sent).toHaveLength(10);
    await jest.advanceTimersByTimeAsync(1);
    expect(fake.sent).toHaveLength(11);
    await jest.advanceTimersByTimeAsync(300_000);
    expect(fake.sent).toHaveLength(12);
  });

  it.each([503, 500, 408, 429])("keeps the batch on %i", async (status) => {
    const { tracker, fake } = setup();
    fake.respond(status);
    tracker.track("one");
    await tracker.flush();
    fake.respond(200);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(fake.sent).toHaveLength(2);
    expect(fake.names(1)).toEqual(["one"]);
  });

  it("resumes threshold flushes as soon as an explicit flush succeeds during backoff", async () => {
    const { tracker, fake } = setup({ flushAt: 2, flushIntervalMs: 60 * 60 * 1000 });
    fake.respond(503);
    tracker.track("one");
    await tracker.flush();
    await jest.advanceTimersByTimeAsync(1_000 + 2_000 + 4_000);
    expect(fake.sent).toHaveLength(4);
    fake.respond(200);
    await tracker.flush();
    expect(fake.sent).toHaveLength(5);
    tracker.track("two");
    tracker.track("three");
    await settle();
    expect(fake.names(5)).toEqual(["two", "three"]);
  });

  it("drops the batch on a 400 and reports it", async () => {
    const { tracker, fake, errors } = setup();
    fake.respond(400);
    tracker.track("one");
    await tracker.flush();
    expect(errors).toHaveLength(1);
    fake.respond(200);
    tracker.track("two");
    await tracker.flush();
    expect(fake.names(1)).toEqual(["two"]);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(fake.sent).toHaveLength(2);
  });
});

describe("persistence", () => {
  it("persists the queue and reloads it on the next launch", async () => {
    const storage = fakeStorage();
    const first = setup({ storage, flushAt: 100 });
    first.fake.respond(new Error("offline"));
    first.tracker.track("before_restart", { n: 1 });
    await settle();
    const saved = JSON.parse(storage.data.get("expo-analytics:queue")!) as { name: string }[];
    expect(saved.map((event) => event.name)).toEqual(["before_restart"]);
    await first.tracker.shutdown();

    const second = setup({ storage, generateId: sequentialIds("next") });
    second.tracker.track("after_restart");
    await second.tracker.flush();
    const batch = second.fake.sent[0]!.batch;
    expect(batch.events.map((event) => event.name)).toEqual(["before_restart", "after_restart"]);
    // The anonymous id survives the restart.
    expect(batch.context?.anonymous_id).toBe(storage.data.get("expo-analytics:anonymous_id"));
    expect(batch.context?.anonymous_id).toMatch(/^id-/);
    await settle();
    expect(storage.data.has("expo-analytics:queue")).toBe(false);
  });

  it("does not block track on a slow storage read", async () => {
    const storage = fakeStorage({ "ns:queue": JSON.stringify([{ id: "old", name: "old", ts: "x" }]) });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    storage.getItem.mockImplementation(async (key: string) => {
      await gate;
      return storage.data.get(key) ?? null;
    });
    const { tracker, fake } = setup({ storage, storageKey: "ns" });
    tracker.track("fresh");
    // Nothing written over the stored queue before it was read.
    await settle();
    expect(storage.setItem).not.toHaveBeenCalledWith("ns:queue", expect.anything());
    const flushed = tracker.flush();
    release();
    await flushed;
    expect(fake.names()).toEqual(["old", "fresh"]);
  });
});

describe("enabled", () => {
  it("queues, stores and sends nothing while disabled", async () => {
    const storage = fakeStorage();
    const { tracker, fake } = setup({ storage, enabled: false, flushAt: 1 });
    tracker.track("one");
    tracker.page("/");
    tracker.startSession();
    tracker.setAcquisition({ utm_source: "ads" });
    await tracker.flush();
    await jest.advanceTimersByTimeAsync(120_000);
    expect(fake.sent).toHaveLength(0);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();

    // Consent later: acquisition captured while disabled is still sent.
    tracker.setEnabled(true);
    tracker.track("two");
    await tracker.flush();
    expect(fake.names()).toEqual(["two"]);
    expect(fake.sent[0]!.batch.acquisition).toEqual({ utm_source: "ads" });
  });

  it("disabling clears the queue, the stored queue and the retry timer", async () => {
    const storage = fakeStorage();
    const { tracker, fake } = setup({ storage });
    fake.respond(503);
    tracker.track("one");
    await tracker.flush();
    expect(fake.sent).toHaveLength(1);
    tracker.setEnabled(false);
    await jest.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(fake.sent).toHaveLength(1);
    expect(storage.data.has("expo-analytics:queue")).toBe(false);

    fake.respond(200);
    tracker.setEnabled(true);
    await tracker.flush();
    expect(fake.sent).toHaveLength(1);
  });
});

describe("acquisition", () => {
  it("merges first touch, persists it and sends it until cleared", async () => {
    const storage = fakeStorage();
    const { tracker, fake } = setup({ storage });
    tracker.setAcquisition({ utm_source: "newsletter", click_id: "abc", click_id_kind: "gclid" });
    tracker.setAcquisition({
      utm_source: "ads",
      utm_medium: "cpc",
      click_id: "zzz",
      click_id_kind: "fbclid",
      utm_campaign: "c".repeat(200),
    });
    tracker.track("one");
    await tracker.flush();
    expect(fake.sent[0]!.batch.acquisition).toEqual({
      utm_source: "newsletter",
      utm_medium: "cpc",
      utm_campaign: "c".repeat(LIMITS.utmMaxLength),
      click_id: "abc",
      click_id_kind: "gclid",
    });
    expect(JSON.parse(storage.data.get("expo-analytics:acquisition")!)).toMatchObject({
      utm_source: "newsletter",
    });

    tracker.clearAcquisition();
    tracker.track("two");
    await tracker.flush();
    expect(fake.sent[1]!.batch.acquisition).toBeUndefined();
    await settle();
    expect(storage.data.has("expo-analytics:acquisition")).toBe(false);
  });

  it("keeps a stored first touch over a later one", async () => {
    const storage = fakeStorage({
      "expo-analytics:acquisition": JSON.stringify({ utm_source: "first" }),
    });
    const { tracker, fake } = setup({ storage });
    tracker.setAcquisition({ utm_source: "second", self_reported_source: "friend" });
    tracker.track("one");
    await tracker.flush();
    expect(fake.sent[0]!.batch.acquisition).toEqual({
      utm_source: "first",
      self_reported_source: "friend",
    });
  });

  it("drops a link click id that is not a UUID", async () => {
    const { tracker, fake, errors } = setup();
    tracker.setAcquisition({ link_click_id: "not-a-uuid", landing_path: "/a?b=c" });
    tracker.track("one");
    await tracker.flush();
    expect(fake.sent[0]!.batch.acquisition).toEqual({ landing_path: "/a" });
    expect(errors).toHaveLength(1);
  });
});

describe("sessions", () => {
  it("attaches the session id while one is open and reports durations", async () => {
    const { tracker, fake } = setup();
    tracker.track("before");
    tracker.startSession();
    jest.advanceTimersByTime(5_000);
    tracker.track("during");
    jest.advanceTimersByTime(7_000);
    tracker.endSession();
    tracker.track("after");
    await tracker.flush();
    const events = fake.sent[0]!.batch.events;
    expect(events.map((event) => [event.name, event.session_id])).toEqual([
      ["before", undefined],
      ["$session_start", "id-2"],
      ["during", "id-2"],
      ["$session_end", "id-2"],
      ["after", undefined],
    ]);
    expect(events[3]!.props).toEqual({ duration_ms: 12_000 });
  });

  it("ends an open session when a new one starts", async () => {
    const { tracker, fake } = setup();
    tracker.startSession();
    jest.advanceTimersByTime(1_000);
    tracker.startSession();
    await tracker.flush();
    expect(fake.names()).toEqual(["$session_start", "$session_end", "$session_start"]);
  });

  it("reset ends the session and clears acquisition but keeps the anonymous id", async () => {
    const { tracker, fake } = setup();
    tracker.setAcquisition({ utm_source: "ads" });
    tracker.startSession();
    tracker.track("one");
    await tracker.flush();
    const anonymousId = fake.sent[0]!.batch.context?.anonymous_id;
    await tracker.reset();
    tracker.track("two");
    await tracker.flush();
    expect(fake.names()).toEqual(["$session_start", "one", "$session_end", "two"]);
    const last = fake.sent[fake.sent.length - 1]!.batch;
    expect(last.acquisition).toBeUndefined();
    expect(last.context?.anonymous_id).toBe(anonymousId);
    expect(last.events[0]!.session_id).toBeUndefined();
  });
});

describe("cookieless mode", () => {
  it("sends no anonymous id or session ids and ignores sessions", async () => {
    const { tracker, fake } = setup({ identify: false, platform: "web" });
    tracker.startSession();
    tracker.page("/");
    tracker.endSession();
    await tracker.flush();
    const batch = fake.sent[0]!.batch;
    expect(batch.context).toEqual({ platform: "web", app_version: "1.2.3" });
    expect(batch.events.map((event) => event.name)).toEqual(["$pageview"]);
    expect(batch.events[0]!.session_id).toBeUndefined();
  });
});

describe("shutdown", () => {
  it("flushes, stops timers and ignores later calls", async () => {
    const { tracker, fake } = setup({ flushIntervalMs: 1_000 });
    tracker.track("one");
    await tracker.shutdown();
    expect(fake.names()).toEqual(["one"]);
    tracker.track("two");
    await jest.advanceTimersByTimeAsync(10_000);
    expect(fake.sent).toHaveLength(1);
  });
});
