/**
 * Tests for useOnboardingStore.
 *
 * The onboarding flag decides whether the root layout renders OnboardingFlow
 * or the main Stack on first launch, so the regressions that matter are:
 *   - default state (false) before loadOnboarding has resolved
 *   - setHasSeenOnboarding flips the flag and persists under the shared key
 *   - loadOnboarding hydrates from the native vs web storage backend
 *   - null reads (nothing persisted) leave state alone instead of crashing
 *   - storage failures don't throw — onboarding must not block startup
 *
 * Platform switching: we mutate Platform.OS on the live react-native module
 * instead of re-mocking it, because re-mocking pulls in TurboModule shims
 * (DevMenu, VirtualizedList) that jest-expo has not wired up. window and
 * globalThis.localStorage are both shimmed because the source uses
 * window.localStorage only for the typeof check but reads/writes via the
 * bare global.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { useOnboardingStore } from "../onboardingStore";

const ONBOARDING_KEY = "has-seen-onboarding";

type WindowShim = { localStorage: typeof localStorage };

function installLocalStorage(stored: Record<string, string> = {}) {
  const shim = {
    setItem: (k: string, v: string) => {
      stored[k] = v;
    },
    getItem: (k: string) => stored[k] ?? null,
    removeItem: (k: string) => {
      delete stored[k];
    },
    clear: () => {
      for (const k of Object.keys(stored)) delete stored[k];
    },
    length: 0,
    key: () => null,
  } as unknown as Storage;

  (globalThis as unknown as { window: WindowShim }).window = { localStorage: shim };
  (globalThis as unknown as { localStorage: Storage }).localStorage = shim;
  return shim;
}

describe("useOnboardingStore", () => {
  const originalOS = Platform.OS;

  beforeEach(async () => {
    await AsyncStorage.clear();
    useOnboardingStore.setState({ hasSeenOnboarding: false });
    (Platform as { OS: string }).OS = "ios";
  });

  afterEach(() => {
    (Platform as { OS: string }).OS = originalOS;
    delete (globalThis as unknown as { window?: unknown }).window;
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
  });

  it("starts with hasSeenOnboarding = false", () => {
    expect(useOnboardingStore.getState().hasSeenOnboarding).toBe(false);
  });

  it("exposes setHasSeenOnboarding and loadOnboarding as functions", () => {
    const state = useOnboardingStore.getState();
    expect(typeof state.setHasSeenOnboarding).toBe("function");
    expect(typeof state.loadOnboarding).toBe("function");
  });

  it("setHasSeenOnboarding flips the flag in state", () => {
    useOnboardingStore.getState().setHasSeenOnboarding(true);
    expect(useOnboardingStore.getState().hasSeenOnboarding).toBe(true);
  });

  it("persists to AsyncStorage under the shared key on native", async () => {
    useOnboardingStore.getState().setHasSeenOnboarding(true);

    // setItem is fire-and-forget; flush the microtask queue before reading back.
    await Promise.resolve();
    const stored = await AsyncStorage.getItem(ONBOARDING_KEY);
    expect(stored).toBe("true");
  });

  it("persists to localStorage under the shared key on web", () => {
    (Platform as { OS: string }).OS = "web";
    installLocalStorage();
    const setItemSpy = jest.spyOn(globalThis.localStorage, "setItem");

    useOnboardingStore.getState().setHasSeenOnboarding(true);

    expect(setItemSpy).toHaveBeenCalledWith(ONBOARDING_KEY, "true");
  });

  it("loadOnboarding hydrates from AsyncStorage on native", async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");

    useOnboardingStore.getState().loadOnboarding();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useOnboardingStore.getState().hasSeenOnboarding).toBe(true);
  });

  it("loadOnboarding hydrates from localStorage on web", () => {
    (Platform as { OS: string }).OS = "web";
    installLocalStorage({ [ONBOARDING_KEY]: "true" });

    useOnboardingStore.getState().loadOnboarding();

    expect(useOnboardingStore.getState().hasSeenOnboarding).toBe(true);
  });

  it("loadOnboarding leaves state at false when nothing is persisted (native)", async () => {
    useOnboardingStore.getState().loadOnboarding();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useOnboardingStore.getState().hasSeenOnboarding).toBe(false);
  });

  it("swallows AsyncStorage read errors without throwing", async () => {
    const getItemSpy = jest
      .spyOn(AsyncStorage, "getItem")
      .mockRejectedValueOnce(new Error("storage offline"));

    expect(() => useOnboardingStore.getState().loadOnboarding()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useOnboardingStore.getState().hasSeenOnboarding).toBe(false);
    getItemSpy.mockRestore();
  });
});
