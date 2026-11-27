/**
 * The web tracker against an injected `WebEnvironment` (jest-expo has no DOM):
 * auto pageviews, landing URL acquisition, unload delivery, cookieless and
 * persisted identity, Do Not Track, the inert server tracker, and `destroy`.
 */
import { createWebTracker } from "../index";
import type { WebEnvironment, WebTrackerOptions } from "../index";
import { LIMITS } from "../../shared/wire";
import { fakeTransport, sequentialIds, settle } from "../../client/__tests__/fakes";

const START = Date.UTC(2026, 10, 27, 12, 0, 0);
const ORIGIN = "https://site.test";
const LINK_CLICK = "0b6e3f1c-7d2a-4c8e-9f10-2a3b4c5d6e7f";

type Listener = () => void;

function fakeEnvironment(href = `${ORIGIN}/`, referrer = "") {
  let url = href;
  let visibility = "visible";
  let doNotTrack = false;
  const listeners = new Map<string, Set<Listener>>();
  const local = new Map<string, string>();
  const localStorage = {
    getItem: jest.fn((key: string) => local.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => void local.set(key, value)),
    removeItem: jest.fn((key: string) => void local.delete(key)),
  };
  const go = (_data: unknown, _unused: string, next?: string | URL | null) => {
    if (typeof next === "string") url = next.startsWith("/") ? `${ORIGIN}${next}` : next;
  };
  const history = { pushState: go, replaceState: go };
  const originals = { pushState: history.pushState, replaceState: history.replaceState };
  const sendBeacon = jest.fn((_url: string, _body: string) => true);

  const env: WebEnvironment = {
    href: () => url,
    referrer: () => referrer,
    visibilityState: () => visibility,
    history,
    listen: (type, listener) => {
      const set = listeners.get(type) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(type, set);
      return () => set.delete(listener);
    },
    sendBeacon,
    localStorage: () => localStorage,
    viewportWidth: () => 1280.4,
    doNotTrack: () => doNotTrack,
  };

  return {
    env,
    history,
    originals,
    local,
    localStorage,
    sendBeacon,
    emit: (type: string) => listeners.get(type)?.forEach((listener) => listener()),
    listenerCount: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
    popTo: (path: string) => {
      url = `${ORIGIN}${path}`;
      listeners.get("popstate")?.forEach((listener) => listener());
    },
    hide: () => {
      visibility = "hidden";
      listeners.get("visibilitychange")?.forEach((listener) => listener());
    },
    setDoNotTrack: (value: boolean) => {
      doNotTrack = value;
    },
  };
}

function setup(
  options: Partial<WebTrackerOptions> = {},
  environment = fakeEnvironment(),
) {
  const fake = fakeTransport();
  const tracker = createWebTracker(
    {
      endpoint: `${ORIGIN}/analytics/e`,
      transport: fake.transport,
      generateId: sequentialIds(),
      ...options,
    },
    environment.env,
  );
  return { tracker, fake, environment };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(START);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("auto pageviews", () => {
  it("tracks creation, push, replace and pop, skipping repeats of the same path", async () => {
    const { tracker, fake, environment } = setup();
    environment.history.pushState(null, "", "/pricing");
    environment.history.replaceState(null, "", "/pricing?tab=annual");
    environment.history.pushState(null, "", "/pricing#faq");
    environment.history.replaceState(null, "", "/signup");
    environment.popTo("/pricing");
    environment.popTo("/pricing");
    await tracker.flush();
    expect(fake.sent[0]!.batch.events.map((event) => [event.name, event.path])).toEqual([
      ["$pageview", "/"],
      ["$pageview", "/pricing"],
      ["$pageview", "/signup"],
      ["$pageview", "/pricing"],
    ]);
  });

  it("can be turned off", async () => {
    const { tracker, fake, environment } = setup({ autoPageviews: false });
    environment.history.pushState(null, "", "/pricing");
    tracker.track("clicked");
    await tracker.flush();
    expect(fake.names()).toEqual(["clicked"]);
  });
});

describe("landing URL", () => {
  it("reads UTM tags, the ad click id, the link click id, referrer and landing path", async () => {
    const environment = fakeEnvironment(
      `${ORIGIN}/welcome?utm_source=news%20letter&utm_medium=email&utm_campaign=launch&utm_content=hero` +
        `&utm_term=expo+analytics&gclid=G123&fbclid=F456&link_click=${LINK_CLICK}#top`,
      "https://www.google.com/search?q=expo",
    );
    const { tracker, fake } = setup({}, environment);
    await tracker.flush();
    const batch = fake.sent[0]!.batch;
    expect(batch.acquisition).toEqual({
      utm_source: "news letter",
      utm_medium: "email",
      utm_campaign: "launch",
      utm_content: "hero",
      utm_term: "expo analytics",
      click_id: "F456",
      click_id_kind: "fbclid",
      link_click_id: LINK_CLICK,
      referrer: "https://www.google.com/search?q=expo",
      landing_path: "/welcome",
    });
    expect(batch.context).toEqual({
      platform: "web",
      referrer: "https://www.google.com/search?q=expo",
      screen_width: 1280,
    });
    expect(batch.events[0]!.path).toBe("/welcome");
  });

  it("uses the configured link click parameter and ignores same-site referrers", async () => {
    const environment = fakeEnvironment(
      `${ORIGIN}/a?ref=${LINK_CLICK}&link_click=ignored`,
      `${ORIGIN}/previous`,
    );
    const { tracker, fake } = setup({ linkClickParam: "ref" }, environment);
    await tracker.flush();
    expect(fake.sent[0]!.batch.acquisition).toEqual({
      link_click_id: LINK_CLICK,
      landing_path: "/a",
    });
  });

  it("cuts a long referrer in context", async () => {
    const long = `https://elsewhere.test/${"r".repeat(800)}`;
    const { tracker, fake } = setup({}, fakeEnvironment(`${ORIGIN}/`, long));
    await tracker.flush();
    expect(fake.sent[0]!.batch.context?.referrer).toHaveLength(LIMITS.referrerMaxLength);
  });
});

describe("unload delivery", () => {
  it("uses sendBeacon on hidden and does not post the same events again on pagehide", async () => {
    const { tracker, fake, environment } = setup();
    tracker.track("clicked");
    environment.hide();
    environment.emit("pagehide");
    await settle();
    expect(environment.sendBeacon).toHaveBeenCalledTimes(1);
    const [url, body] = environment.sendBeacon.mock.calls[0]!;
    expect(url).toBe(`${ORIGIN}/analytics/e`);
    expect(JSON.parse(body).events.map((event: { name: string }) => event.name)).toEqual([
      "$pageview",
      "clicked",
    ]);
    expect(fake.sent).toHaveLength(0);
    // Delivered, so a later regular flush has nothing to send.
    await tracker.flush();
    expect(fake.sent).toHaveLength(0);
  });

  it("uses keepalive fetch when headers are configured", async () => {
    const { fake, environment } = setup({ headers: () => ({ Authorization: "Bearer t" }) });
    environment.emit("pagehide");
    await settle();
    expect(environment.sendBeacon).not.toHaveBeenCalled();
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]!.request.keepalive).toBe(true);
    expect(fake.sent[0]!.request.headers.Authorization).toBe("Bearer t");
  });

  it("falls back to keepalive fetch when the beacon is refused", async () => {
    const environment = fakeEnvironment();
    environment.sendBeacon.mockReturnValue(false);
    const { fake } = setup({}, environment);
    environment.emit("pagehide");
    await settle();
    expect(environment.sendBeacon).toHaveBeenCalledTimes(1);
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]!.request.keepalive).toBe(true);
  });

  it("caps a keepalive send below the browser's 64 KiB budget", async () => {
    const { tracker, environment } = setup({ flushAt: 1_000 });
    for (let i = 0; i < 100; i += 1) tracker.track("big", { blob: "x".repeat(3_000) });
    environment.emit("pagehide");
    await settle();
    const body = environment.sendBeacon.mock.calls[0]![1];
    expect(body.length).toBeLessThanOrEqual(60_000);
    expect(JSON.parse(body).events.length).toBeGreaterThan(1);
  });

  it("sends nothing while disabled", async () => {
    const { tracker, fake, environment } = setup();
    tracker.setEnabled(false);
    environment.hide();
    environment.emit("pagehide");
    await settle();
    expect(environment.sendBeacon).not.toHaveBeenCalled();
    expect(fake.sent).toHaveLength(0);
  });
});

describe("identity", () => {
  it("is cookieless by default: no ids and nothing written to the browser", async () => {
    const { tracker, fake, environment } = setup();
    tracker.startSession();
    tracker.track("clicked");
    await tracker.flush();
    const batch = fake.sent[0]!.batch;
    expect(batch.context?.anonymous_id).toBeUndefined();
    expect(batch.events.every((event) => event.session_id === undefined)).toBe(true);
    expect(fake.names()).toEqual(["$pageview", "clicked"]);
    expect(environment.localStorage.setItem).not.toHaveBeenCalled();
    expect(environment.localStorage.getItem).not.toHaveBeenCalled();
  });

  it("persists an anonymous id and 30-minute idle sessions when asked", async () => {
    const environment = fakeEnvironment();
    const { tracker, fake } = setup({ persist: true }, environment);
    jest.advanceTimersByTime(60_000);
    tracker.track("clicked");
    await tracker.flush();
    const first = fake.sent[0]!.batch;
    const sessionId = first.events[0]!.session_id;
    expect(first.events.map((event) => event.name)).toEqual(["$session_start", "$pageview", "clicked"]);
    expect(first.events.every((event) => event.session_id === sessionId)).toBe(true);
    const anonymousId = first.context?.anonymous_id;
    expect(anonymousId).toBeDefined();
    await settle();
    expect(environment.local.get("expo-analytics:anonymous_id")).toBe(anonymousId);

    // Just inside the idle window: same session.
    jest.advanceTimersByTime(LIMITS.sessionIdleMs);
    tracker.track("still_here");
    // Past it: the old session ends at its last activity and a new one starts.
    jest.advanceTimersByTime(LIMITS.sessionIdleMs + 1);
    tracker.track("came_back");
    await tracker.flush();
    const events = fake.sent[1]!.batch.events;
    expect(events.map((event) => event.name)).toEqual([
      "still_here",
      "$session_end",
      "$session_start",
      "came_back",
    ]);
    expect(events[0]!.session_id).toBe(sessionId);
    expect(events[1]!.session_id).toBe(sessionId);
    expect(events[1]!.props).toEqual({ duration_ms: 60_000 + LIMITS.sessionIdleMs });
    expect(events[1]!.ts).toBe(new Date(START + 60_000 + LIMITS.sessionIdleMs).toISOString());
    expect(events[3]!.session_id).not.toBe(sessionId);
  });

  it("resumes a stored session after a reload without a new $session_start", async () => {
    const environment = fakeEnvironment();
    const first = setup({ persist: true }, environment);
    await first.tracker.flush();
    const sessionId = first.fake.sent[0]!.batch.events[0]!.session_id;
    first.tracker.destroy();
    // Let the delivered queue's removal reach storage before the "reload".
    await settle();

    jest.advanceTimersByTime(5 * 60 * 1000);
    const second = setup({ persist: true, generateId: sequentialIds("reload") }, environment);
    await second.tracker.flush();
    const batch = second.fake.sent[0]!.batch;
    expect(batch.events.map((event) => [event.name, event.session_id])).toEqual([
      ["$pageview", sessionId],
    ]);
    expect(batch.context?.anonymous_id).toBe(first.fake.sent[0]!.batch.context?.anonymous_id);
  });

  it("stays inert when Do Not Track is on and respected", async () => {
    const environment = fakeEnvironment();
    environment.setDoNotTrack(true);
    const { tracker, fake } = setup({ respectDoNotTrack: true }, environment);
    tracker.track("clicked");
    environment.emit("pagehide");
    await tracker.flush();
    expect(fake.sent).toHaveLength(0);
    expect(environment.history.pushState).toBe(environment.originals.pushState);
  });
});

describe("outside a browser", () => {
  it("returns an inert tracker with the same interface when there is no window", async () => {
    // jest-expo has no `document`, which is what the default environment requires.
    const fake = fakeTransport();
    const tracker = createWebTracker({ endpoint: "https://x.test/e", transport: fake.transport });
    tracker.track("clicked");
    tracker.page("/");
    tracker.setAcquisition({ utm_source: "x" });
    await expect(tracker.flush({ keepalive: true })).resolves.toBeUndefined();
    await expect(tracker.reset()).resolves.toBeUndefined();
    await expect(tracker.shutdown()).resolves.toBeUndefined();
    expect(() => tracker.destroy()).not.toThrow();
    expect(fake.sent).toHaveLength(0);
  });
});

describe("destroy", () => {
  it("restores History and removes listeners", async () => {
    const { tracker, fake, environment } = setup();
    expect(environment.history.pushState).not.toBe(environment.originals.pushState);
    expect(environment.listenerCount()).toBe(3);
    tracker.destroy();
    expect(environment.history.pushState).toBe(environment.originals.pushState);
    expect(environment.history.replaceState).toBe(environment.originals.replaceState);
    expect(environment.listenerCount()).toBe(0);
    environment.history.pushState(null, "", "/later");
    await tracker.flush();
    expect(fake.names()).toEqual(["$pageview"]);
  });

  it("leaves a wrapper installed after its own in place", () => {
    const { tracker, environment } = setup();
    const later = jest.fn();
    environment.history.pushState = later;
    tracker.destroy();
    expect(environment.history.pushState).toBe(later);
    expect(environment.history.replaceState).toBe(environment.originals.replaceState);
  });
});
