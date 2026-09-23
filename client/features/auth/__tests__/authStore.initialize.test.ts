/**
 * `initialize()` scheduling: the 2s throttle, joining a read in flight, and the
 * forced refreshes that must never be swallowed by either.
 *
 * The regression this pins: after a start that gave up on the provider, the
 * provider's `signedIn` event triggered a refresh 500 ms later — inside the
 * throttle window of the startup read — so the refresh was skipped and a
 * signed-in user stayed "unauthenticated". Provider events and completed
 * sign-in flows now force the read.
 *
 * `getAuthClient` is mocked, so no provider SDK (or dynamic import) is loaded.
 */
import type { AuthChangeEvent, AuthClient } from "../provider";

const mockGetAuthClient = jest.fn();

jest.mock("../provider", () => ({
  getAuthClient: () => mockGetAuthClient(),
}));
jest.mock("@/client/lib/devtools", () => ({ logDev: jest.fn() }));

type StoreModule = typeof import("../stores/authStore");

const ADA = { userId: "user_1", username: "ada", email: "ada@example.com" };

/** A controllable AuthClient: `getCurrentUser` resolves when told to. */
function fakeClient() {
  const pendingReads: Array<(user: typeof ADA | null) => void> = [];
  let emit: (event: AuthChangeEvent) => void = () => {};
  const client = {
    init: jest.fn(async () => {}),
    getCurrentUser: jest.fn(
      () => new Promise<typeof ADA | null>((resolve) => pendingReads.push(resolve)),
    ),
    onAuthChange: jest.fn((callback: (event: AuthChangeEvent) => void) => {
      emit = callback;
      return () => {};
    }),
  };
  return {
    client: client as unknown as AuthClient,
    getCurrentUser: client.getCurrentUser,
    /** Settle the oldest pending `getCurrentUser()` read. */
    answer(user: typeof ADA | null) {
      const next = pendingReads.shift();
      if (!next) throw new Error("no getCurrentUser() read is pending");
      next(user);
    },
    emit: (event: AuthChangeEvent) => emit(event),
  };
}

async function flushMicrotasks() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

describe("authStore.initialize", () => {
  let store: StoreModule;
  let provider: ReturnType<typeof fakeClient>;

  beforeEach(() => {
    jest.useFakeTimers();
    // Fresh module per test: the in-flight read and initAuth's one-time
    // listener registration are module state.
    jest.isolateModules(() => {
      store = require("../stores/authStore") as StoreModule;
    });
    provider = fakeClient();
    mockGetAuthClient.mockResolvedValue(provider.client);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const state = () => store.useAuthStore.getState();

  it("skips an unforced read inside the throttle window", async () => {
    const first = state().initialize();
    await flushMicrotasks();
    provider.answer(null);
    await first;

    await state().initialize();

    expect(provider.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(state().state).toBe("unauthenticated");
  });

  it("runs a forced read inside the throttle window", async () => {
    const first = state().initialize();
    await flushMicrotasks();
    provider.answer(null);
    await first;

    const forced = state().initialize({ force: true });
    await flushMicrotasks();
    provider.answer(ADA);
    await forced;

    expect(provider.getCurrentUser).toHaveBeenCalledTimes(2);
    expect(state()).toMatchObject({ state: "authenticated", user: ADA });
  });

  it("lets concurrent callers join the read in flight and wait for its result", async () => {
    const first = state().initialize();
    const second = state().initialize();
    await flushMicrotasks();

    expect(provider.getCurrentUser).toHaveBeenCalledTimes(1);

    let secondDone = false;
    void second.then(() => {
      secondDone = true;
    });
    await flushMicrotasks();
    expect(secondDone).toBe(false);

    provider.answer(ADA);
    await Promise.all([first, second]);

    expect(state().state).toBe("authenticated");
  });

  it("queues one more read when a forced call finds a read in flight", async () => {
    // The first read started before the sign-in and comes back empty; the
    // forced call must not settle for that answer.
    const first = state().initialize();
    const forced = state().initialize({ force: true });
    await flushMicrotasks();
    provider.answer(null);
    await flushMicrotasks();
    provider.answer(ADA);
    await Promise.all([first, forced]);

    expect(provider.getCurrentUser).toHaveBeenCalledTimes(2);
    expect(state()).toMatchObject({ state: "authenticated", user: ADA });
  });

  it("recovers a provider sign-in that lands inside the throttle window", async () => {
    // Startup: listener registered, first read finds no session (the provider
    // was not ready yet).
    await store.initAuth();
    const startup = state().initialize({ force: true });
    await flushMicrotasks();
    provider.answer(null);
    await startup;
    expect(state().state).toBe("unauthenticated");

    // The provider restores the session a moment later.
    provider.emit({ type: "signedIn" });
    jest.advanceTimersByTime(500);
    await flushMicrotasks();
    provider.answer(ADA);
    await flushMicrotasks();

    expect(provider.getCurrentUser).toHaveBeenCalledTimes(2);
    expect(state()).toMatchObject({ state: "authenticated", user: ADA });
  });

  it("does not re-read on signedIn when the store is already authenticated", async () => {
    await store.initAuth();
    const startup = state().initialize({ force: true });
    await flushMicrotasks();
    provider.answer(ADA);
    await startup;

    provider.emit({ type: "signedIn" });
    jest.advanceTimersByTime(500);
    await flushMicrotasks();

    expect(provider.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(state().state).toBe("authenticated");
  });
});
