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
 * Web is server-rendered on this branch, so the web writes are a DUAL write —
 * localStorage plus a `has-seen-onboarding` cookie the server reads to skip
 * the gate for returning visitors (server/lib/ssrOnboarding.ts). A missing
 * cookie write silently reverts every returning visitor to a server-rendered
 * gate, so the cookie assertions below are load-bearing.
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

// `document.cookie` is a setter that appends in a real browser; jsdom is not
// guaranteed to be the environment here (jest-expo defaults to a native-ish
// one), so we install a minimal recorder and read back what was written.
function installDocumentCookie(initial = "") {
  const writes: string[] = [];
  let value = initial;
  const doc = {
    get cookie() {
      return value;
    },
    set cookie(next: string) {
      writes.push(next);
      const [pair] = next.split(";");
      const [name, raw = ""] = pair.split("=");
      const maxAgeMatch = next.match(/max-age=(-?\d+)/i);
      const expired = maxAgeMatch ? Number(maxAgeMatch[1]) <= 0 : false;
      const others = value
        .split(";")
        .map((c) => c.trim())
        .filter((c) => c && c.split("=")[0] !== name);
      value = expired ? others.join("; ") : [...others, `${name}=${raw}`].join("; ");
    },
  };
  (globalThis as unknown as { document: typeof doc }).document = doc;
  return {
    writes,
    current: () => value,
  };
}

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
  const originalDocument = (globalThis as unknown as { document?: unknown }).document;

  beforeEach(async () => {
    await AsyncStorage.clear();
    useOnboardingStore.setState({ hasSeenOnboarding: false, hasLoadedOnboarding: false });
    (Platform as { OS: string }).OS = "ios";
  });

  afterEach(() => {
    (Platform as { OS: string }).OS = originalOS;
    delete (globalThis as unknown as { window?: unknown }).window;
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    if (originalDocument === undefined) {
      delete (globalThis as unknown as { document?: unknown }).document;
    } else {
      (globalThis as unknown as { document: unknown }).document = originalDocument;
    }
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

  it("dual-writes the SSR cookie on web so the server can skip the gate", () => {
    (Platform as { OS: string }).OS = "web";
    installLocalStorage();
    const cookies = installDocumentCookie();

    useOnboardingStore.getState().setHasSeenOnboarding(true);

    expect(cookies.writes).toHaveLength(1);
    expect(cookies.writes[0]).toContain(`${ONBOARDING_KEY}=1`);
    expect(cookies.writes[0]).toContain("path=/");
    expect(cookies.writes[0]).toContain("SameSite=Lax");
    expect(cookies.writes[0]).toMatch(/max-age=31536000/);
    expect(cookies.current()).toContain(`${ONBOARDING_KEY}=1`);
  });

  it("expires the SSR cookie when the flag is set back to false", () => {
    (Platform as { OS: string }).OS = "web";
    installLocalStorage();
    const cookies = installDocumentCookie(`${ONBOARDING_KEY}=1`);

    useOnboardingStore.getState().setHasSeenOnboarding(false);

    expect(cookies.writes[0]).toContain("max-age=0");
    expect(cookies.current()).not.toContain(`${ONBOARDING_KEY}=1`);
  });

  it("does not write a cookie on native", async () => {
    const cookies = installDocumentCookie();

    useOnboardingStore.getState().setHasSeenOnboarding(true);
    await Promise.resolve();

    expect(cookies.writes).toHaveLength(0);
  });

  it("leaves the flag false on web when localStorage is empty", () => {
    (Platform as { OS: string }).OS = "web";
    installLocalStorage();

    useOnboardingStore.getState().loadOnboarding();

    expect(useOnboardingStore.getState().hasSeenOnboarding).toBe(false);
  });

  it("marks onboarding loaded once loadOnboarding resolves on web", () => {
    (Platform as { OS: string }).OS = "web";
    installLocalStorage();
    installDocumentCookie();

    expect(useOnboardingStore.getState().hasLoadedOnboarding).toBe(false);
    useOnboardingStore.getState().loadOnboarding();
    expect(useOnboardingStore.getState().hasLoadedOnboarding).toBe(true);
  });

  it("marks onboarding loaded once loadOnboarding resolves on native", async () => {
    await useOnboardingStore.getState().loadOnboarding();
    expect(useOnboardingStore.getState().hasLoadedOnboarding).toBe(true);
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
