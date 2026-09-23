/**
 * `useAppStartup` readiness.
 *
 * - With auth configured, `ready` waits for the provider's `init()` and the
 *   first session read — that is what keeps a signed-in user from flashing the
 *   signed-out shell — and resolves as soon as both are done.
 * - `ready` latches. It used to track the live auth state, so any later
 *   refresh (a sign-in completing, sign-out, a provider event) set "loading"
 *   and sent the whole native tree back behind the splash, unmounting
 *   navigation mid-flow.
 * - With auth disabled, auth never gates startup.
 */
import { act, renderHook } from "@testing-library/react-native";

const mockClient = {
  init: jest.fn(),
  getCurrentUser: jest.fn(),
  onAuthChange: jest.fn(() => () => {}),
};

jest.mock("@/client/features/auth/provider", () => ({
  ...jest.requireActual("@/client/features/auth/provider"),
  getAuthClient: async () => mockClient,
}));
jest.mock("@/client/lib/devtools", () => ({ logDev: jest.fn() }));

import { useAuthStore } from "@/client/features/auth/stores/authStore";
import { useAppStartup } from "../useAppStartup";

const ENV_KEYS = ["EXPO_PUBLIC_USER_POOL_ID", "EXPO_PUBLIC_USER_POOL_CLIENT_ID"] as const;

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("useAppStartup", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  });

  beforeEach(() => {
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_abc";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client123";
    useAuthStore.setState({ state: "loading", user: null, lastInitializeTime: 0, isInitializing: false });
    mockClient.init.mockReset();
    mockClient.getCurrentUser.mockReset();
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it("waits for the provider and the first session read, then latches", async () => {
    const providerLoad = deferred<void>();
    mockClient.init.mockReturnValue(providerLoad.promise);
    mockClient.getCurrentUser.mockResolvedValue({ userId: "u1", username: "ada" });

    const { result } = await renderHook(() =>
      useAppStartup({ fontsLoaded: true, i18nReady: true }),
    );

    // Onboarding has loaded, but the provider (Clerk's load, in real life)
    // has not finished: startup must keep waiting.
    await act(async () => {});
    expect(result.current).toEqual({ ready: false, authEnabled: true });

    await act(async () => {
      providerLoad.resolve();
    });
    expect(result.current.ready).toBe(true);
    expect(useAuthStore.getState().state).toBe("authenticated");

    // A later refresh (here: sign-out's "loading" step) must not un-ready the
    // app and pull the native tree back behind the splash.
    await act(async () => {
      useAuthStore.getState().setState("loading");
    });
    expect(result.current.ready).toBe(true);
  });

  it("does not wait on auth when no provider is configured", async () => {
    for (const key of ENV_KEYS) delete process.env[key];

    const { result } = await renderHook(() =>
      useAppStartup({ fontsLoaded: true, i18nReady: true }),
    );
    await act(async () => {});

    expect(result.current).toEqual({ ready: true, authEnabled: false });
    expect(mockClient.init).not.toHaveBeenCalled();
  });
});
