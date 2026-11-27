/**
 * The React Native tracker against a mocked AppState: sessions open on launch
 * and foreground, background flushes, and a background gap on either side of
 * `sessionIdleMs` continues or replaces the session.
 */
import { AppState, Platform } from "react-native";

import { createNativeTracker } from "../index";
import type { NativeTrackerOptions } from "../index";
import { fakeStorage, fakeTransport, sequentialIds, settle } from "../../client/__tests__/fakes";

const appState = {
  current: "active",
  listeners: [] as ((state: string) => void)[],
  remove: jest.fn(),
};

// The global Jest setup loads the UI package against the real react-native, so
// spy on its AppState instead of mocking the module.
function mockAppState() {
  Object.defineProperty(AppState, "currentState", {
    configurable: true,
    get: () => appState.current,
  });
  jest.spyOn(AppState, "addEventListener").mockImplementation(((
    _type: string,
    listener: (state: string) => void,
  ) => {
    appState.listeners.push(listener);
    return { remove: () => appState.remove(listener) };
  }) as unknown as typeof AppState.addEventListener);
}

const START = Date.UTC(2026, 10, 27, 12, 0, 0);
const IDLE = 30 * 60 * 1000;

function changeTo(state: string) {
  appState.current = state;
  for (const listener of appState.listeners) listener(state);
}

function setup(overrides: Partial<NativeTrackerOptions> = {}) {
  const fake = fakeTransport();
  const tracker = createNativeTracker({
    endpoint: "https://app.example.com/analytics/e",
    appVersion: "2.0.0",
    transport: fake.transport,
    generateId: sequentialIds(),
    flushIntervalMs: 60 * 60 * 1000,
    ...overrides,
  });
  return { tracker, fake };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(START);
  appState.current = "active";
  appState.listeners = [];
  appState.remove.mockClear();
  mockAppState();
});

afterEach(() => {
  jest.useRealTimers();
});

it("reports the platform from Platform.OS and opens a session on launch", async () => {
  const { tracker, fake } = setup();
  tracker.screen("home");
  await tracker.flush();
  const batch = fake.sent[0]!.batch;
  expect(Platform.OS).toBe("ios");
  expect(batch.context).toMatchObject({ platform: "ios", app_version: "2.0.0" });
  expect(batch.context?.anonymous_id).toBeDefined();
  expect(batch.events.map((event) => [event.name, event.session_id, event.path])).toEqual([
    ["$session_start", "id-1", undefined],
    ["$screen", "id-1", "home"],
  ]);
});

it("flushes on background and continues the session after a gap shorter than the idle time", async () => {
  const { tracker, fake } = setup();
  tracker.track("opened");
  changeTo("background");
  await settle();
  expect(fake.names()).toEqual(["$session_start", "opened"]);

  jest.advanceTimersByTime(IDLE - 1);
  changeTo("active");
  tracker.track("returned");
  await tracker.flush();
  expect(fake.names(1)).toEqual(["returned"]);
  expect(fake.sent[1]!.batch.events[0]!.session_id).toBe("id-1");
});

it("ends the session at the background time and starts a new one after a longer gap", async () => {
  const { tracker, fake } = setup();
  jest.advanceTimersByTime(90_000);
  changeTo("background");
  await settle();
  const leftAt = START + 90_000;

  jest.advanceTimersByTime(IDLE + 1);
  changeTo("active");
  tracker.track("returned");
  await tracker.flush();
  const events = fake.sent[1]!.batch.events;
  expect(events.map((event) => [event.name, event.session_id])).toEqual([
    ["$session_end", "id-1"],
    ["$session_start", expect.not.stringMatching(/^id-1$/)],
    ["returned", events[1]!.session_id],
  ]);
  expect(events[0]!.props).toEqual({ duration_ms: 90_000 });
  expect(events[0]!.ts).toBe(new Date(leftAt).toISOString());
});

it("treats iOS inactive as still in front of the user", async () => {
  const { tracker, fake } = setup();
  changeTo("inactive");
  jest.advanceTimersByTime(IDLE * 2);
  changeTo("active");
  tracker.track("still_here");
  await tracker.flush();
  expect(fake.names()).toEqual(["$session_start", "still_here"]);
});

it("waits for the foreground when launched in the background", async () => {
  appState.current = "background";
  const { tracker, fake } = setup();
  tracker.track("headless");
  changeTo("active");
  await tracker.flush();
  expect(fake.names()).toEqual(["headless", "$session_start"]);
  expect(fake.sent[0]!.batch.events[0]!.session_id).toBeUndefined();
});

it("keeps the anonymous id across launches when storage is given", async () => {
  const storage = fakeStorage();
  const first = setup({ storage });
  await first.tracker.flush();
  first.tracker.destroy();
  await settle();

  const second = setup({ storage, generateId: sequentialIds("next") });
  await second.tracker.flush();
  expect(second.fake.sent[0]!.batch.context?.anonymous_id).toBe(
    first.fake.sent[0]!.batch.context?.anonymous_id,
  );
});

it("starts a fresh session after reset while in the foreground", async () => {
  const { tracker, fake } = setup();
  await tracker.reset();
  tracker.track("next_user");
  await tracker.flush();
  const events = fake.sent.flatMap((entry) => entry.batch.events);
  expect(events.map((event) => event.name)).toEqual([
    "$session_start",
    "$session_end",
    "$session_start",
    "next_user",
  ]);
  expect(events[3]!.session_id).toBe(events[2]!.session_id);
  expect(events[2]!.session_id).not.toBe(events[0]!.session_id);
});

it("destroy removes the AppState subscription", () => {
  const { tracker } = setup();
  tracker.destroy();
  expect(appState.remove).toHaveBeenCalledTimes(1);
});
