/**
 * Clerk cold-start ordering.
 *
 * The native startup gate awaits `AuthClient.init()`. Clerk loads only inside
 * `ClerkProvider`, which the root layout now mounts under the splash, and the
 * provider reports the load through `clerkLoadSignal`. What must hold:
 *   - `init()` resolves as soon as the provider reports Clerk settled — not
 *     after a fixed poll or the timeout;
 *   - nothing reads (and, on native, thereby builds) the Clerk singleton before
 *     the provider settles, and every read passes the provider's own options,
 *     so the persistent token cache is the one the singleton gets;
 *   - `"loading"` is not a settled state; `"error"` is, so a failed load ends
 *     the wait at once instead of after the timeout;
 *   - the timeout stays as the fallback, and a session Clerk restores after a
 *     timed-out start reaches the store as `signedIn`.
 *
 * The SDK modules are mocked so this file never loads `@clerk/*`; see
 * AuthProviderGate.test.tsx for why that matters to the web bundle.
 */

jest.mock("@clerk/clerk-expo", () => ({ getClerkInstance: jest.fn() }));
jest.mock("../ClerkProviderBoundary", () => ({
  __esModule: true,
  default: () => null,
  CLERK_INSTANCE_OPTIONS: {
    publishableKey: "pk_test_startup",
    tokenCache: { getToken: jest.fn(), saveToken: jest.fn() },
  },
}));

import { getClerkInstance } from "@clerk/clerk-expo";
import { CLERK_INSTANCE_OPTIONS } from "../ClerkProviderBoundary";
import { CLERK_LOAD_TIMEOUT_MS, createClerkAuthClient } from "../clerkClient";
import { reportClerkStatus, resetClerkLoadSignalForTests } from "../clerkLoadSignal";
import type { AuthChangeEvent } from "../types";

const mockGetClerkInstance = getClerkInstance as unknown as jest.Mock;

type Listener = (resources: { session: unknown }) => void;

/** Just enough of Clerk's instance for the client under test. */
function fakeClerk({ loaded, signedIn }: { loaded: boolean; signedIn: boolean }) {
  const listeners = new Set<Listener>();
  const clerk = {
    loaded,
    session: signedIn ? { id: "sess_1", getToken: async () => "jwt" } : null,
    user: signedIn
      ? {
        id: "user_1",
        username: null,
        primaryEmailAddress: { emailAddress: "ada@example.com" },
        emailAddresses: [{ emailAddress: "ada@example.com" }],
      }
      : null,
    // Like clerk-js: a new listener hears the current resources right away.
    addListener: jest.fn((listener: Listener) => {
      listeners.add(listener);
      listener({ session: clerk.session });
      return () => listeners.delete(listener);
    }),
    /** Test helper: change the session and notify listeners. */
    setSession(session: { id: string } | null) {
      clerk.session = session as typeof clerk.session;
      listeners.forEach((listener) => listener({ session }));
    },
  };
  return clerk;
}

/** Let resolved promises run without moving the fake clock. */
async function flushMicrotasks() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

describe("Clerk client startup", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetClerkLoadSignalForTests();
    mockGetClerkInstance.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves init() as soon as ClerkProvider reports Clerk loaded", async () => {
    const clerk = fakeClerk({ loaded: true, signedIn: true });
    mockGetClerkInstance.mockReturnValue(clerk);
    const client = createClerkAuthClient();

    let initialized = false;
    void client.init().then(() => {
      initialized = true;
    });

    // Well into the old poll window: still waiting, and nothing has touched
    // (so, on native, built) the Clerk singleton.
    jest.advanceTimersByTime(CLERK_LOAD_TIMEOUT_MS / 2);
    await flushMicrotasks();
    expect(initialized).toBe(false);
    expect(mockGetClerkInstance).not.toHaveBeenCalled();

    reportClerkStatus("ready");
    await flushMicrotasks();

    expect(initialized).toBe(true);
    await expect(client.getCurrentUser()).resolves.toEqual({
      userId: "user_1",
      username: "ada@example.com",
      email: "ada@example.com",
    });
  });

  it("reads the instance with the provider's own options", async () => {
    mockGetClerkInstance.mockReturnValue(fakeClerk({ loaded: true, signedIn: false }));
    const client = createClerkAuthClient();

    reportClerkStatus("ready");
    await client.init();
    await client.getToken();

    expect(mockGetClerkInstance).toHaveBeenCalled();
    for (const [options] of mockGetClerkInstance.mock.calls) {
      expect(options).toBe(CLERK_INSTANCE_OPTIONS);
    }
    expect(CLERK_INSTANCE_OPTIONS.tokenCache).toBeDefined();
  });

  it("does not treat loading as settled", async () => {
    mockGetClerkInstance.mockReturnValue(fakeClerk({ loaded: false, signedIn: false }));
    const client = createClerkAuthClient();

    let initialized = false;
    void client.init().then(() => {
      initialized = true;
    });
    reportClerkStatus("loading");
    await flushMicrotasks();

    expect(initialized).toBe(false);
  });

  it("ends the wait at once when Clerk fails to load", async () => {
    mockGetClerkInstance.mockReturnValue(fakeClerk({ loaded: false, signedIn: false }));
    const client = createClerkAuthClient();

    let initialized = false;
    void client.init().then(() => {
      initialized = true;
    });
    reportClerkStatus("error");
    await flushMicrotasks();

    expect(initialized).toBe(true);
    await expect(client.getCurrentUser()).resolves.toBeNull();
  });

  it("falls back to signed out after the timeout when the provider never settles", async () => {
    mockGetClerkInstance.mockReturnValue(fakeClerk({ loaded: false, signedIn: false }));
    const client = createClerkAuthClient();

    let initialized = false;
    void client.init().then(() => {
      initialized = true;
    });

    jest.advanceTimersByTime(CLERK_LOAD_TIMEOUT_MS - 1);
    await flushMicrotasks();
    expect(initialized).toBe(false);

    jest.advanceTimersByTime(1);
    await flushMicrotasks();
    expect(initialized).toBe(true);
    await expect(client.getCurrentUser()).resolves.toBeNull();
  });

  it("reports a session restored after a timed-out start as signedIn", async () => {
    const clerk = fakeClerk({ loaded: false, signedIn: false });
    mockGetClerkInstance.mockReturnValue(clerk);
    const client = createClerkAuthClient();
    const events: AuthChangeEvent["type"][] = [];

    const init = client.init();
    jest.advanceTimersByTime(CLERK_LOAD_TIMEOUT_MS);
    await init;
    client.onAuthChange((event) => events.push(event.type));
    await flushMicrotasks();
    expect(events).toEqual([]);

    // The provider finally loads and restores the persisted session.
    clerk.loaded = true;
    clerk.session = { id: "sess_1", getToken: async () => "jwt" };
    reportClerkStatus("ready");
    await flushMicrotasks();

    expect(events).toEqual(["signedIn"]);
  });

  it("reports later session changes relative to the loaded state", async () => {
    const clerk = fakeClerk({ loaded: true, signedIn: true });
    mockGetClerkInstance.mockReturnValue(clerk);
    const client = createClerkAuthClient();
    const events: AuthChangeEvent["type"][] = [];

    reportClerkStatus("ready");
    await client.init();
    client.onAuthChange((event) => events.push(event.type));
    await flushMicrotasks();

    // Signed in at load: the restored session is the baseline, not an event.
    expect(events).toEqual([]);

    clerk.setSession(null);
    clerk.setSession({ id: "sess_2" });

    expect(events).toEqual(["signedOut", "signedIn"]);
  });
});
