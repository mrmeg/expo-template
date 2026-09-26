/**
 * The profile store replaces the Profile tab's `useState` mocks: the display
 * name and six preference switches persist across launches, so what matters is
 *   - defaults before anything is loaded (a fork sees sensible switches)
 *   - a write lands in state and under the one storage key, on native and web
 *   - loadProfile hydrates from that key and ignores garbage or unknown keys
 *   - storage failures never throw — the tab must render regardless
 *
 * Platform switching mutates Platform.OS on the live module, as the onboarding
 * store test does, because re-mocking react-native pulls in TurboModule shims.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import {
  DEFAULT_PROFILE_PREFERENCES,
  PROFILE_STORAGE_KEY,
  useProfileStore,
} from "../profileStore";

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
  (globalThis as unknown as { window: { localStorage: Storage } }).window = { localStorage: shim };
  (globalThis as unknown as { localStorage: Storage }).localStorage = shim;
  return stored;
}

describe("useProfileStore", () => {
  const originalOS = Platform.OS;

  beforeEach(async () => {
    await AsyncStorage.clear();
    useProfileStore.getState().resetProfile();
    (Platform as { OS: string }).OS = "ios";
  });

  afterEach(() => {
    (Platform as { OS: string }).OS = originalOS;
    delete (globalThis as unknown as { window?: unknown }).window;
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
  });

  it("starts from the documented defaults", () => {
    const state = useProfileStore.getState();
    expect(PROFILE_STORAGE_KEY).toBe("profile-preferences");
    expect(DEFAULT_PROFILE_PREFERENCES).toEqual({
      displayName: "",
      publicProfile: false,
      analytics: true,
      emailNotifications: true,
      pushNotifications: true,
      marketingEmails: false,
    });
    for (const [key, value] of Object.entries(DEFAULT_PROFILE_PREFERENCES)) {
      expect(state[key as keyof typeof DEFAULT_PROFILE_PREFERENCES]).toBe(value);
    }
    expect(state.hasLoadedProfile).toBe(false);
  });

  it("setPreference updates state and persists the whole preferences object on native", async () => {
    useProfileStore.getState().setPreference("marketingEmails", true);
    useProfileStore.getState().setPreference("pushNotifications", false);

    expect(useProfileStore.getState().marketingEmails).toBe(true);
    expect(useProfileStore.getState().pushNotifications).toBe(false);
    await Promise.resolve();
    const saved = JSON.parse((await AsyncStorage.getItem(PROFILE_STORAGE_KEY)) ?? "{}");
    expect(saved).toEqual({ ...DEFAULT_PROFILE_PREFERENCES, marketingEmails: true, pushNotifications: false });
  });

  it("setDisplayName persists on web under the same key", () => {
    (Platform as { OS: string }).OS = "web";
    const stored = installLocalStorage();

    useProfileStore.getState().setDisplayName("Ada");

    expect(useProfileStore.getState().displayName).toBe("Ada");
    expect(JSON.parse(stored[PROFILE_STORAGE_KEY])).toEqual({ ...DEFAULT_PROFILE_PREFERENCES, displayName: "Ada" });
  });

  it("loadProfile hydrates known keys from native storage and flags the load", async () => {
    await AsyncStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({ displayName: "Grace", analytics: false, bogus: 1, publicProfile: "yes" }),
    );

    await useProfileStore.getState().loadProfile();

    const state = useProfileStore.getState();
    expect(state.displayName).toBe("Grace");
    expect(state.analytics).toBe(false);
    // Wrong type and unknown keys are dropped, not applied.
    expect(state.publicProfile).toBe(false);
    expect((state as Record<string, unknown>).bogus).toBeUndefined();
    expect(state.hasLoadedProfile).toBe(true);
  });

  it("loadProfile hydrates from localStorage on web", async () => {
    (Platform as { OS: string }).OS = "web";
    installLocalStorage({ [PROFILE_STORAGE_KEY]: JSON.stringify({ emailNotifications: false }) });

    await useProfileStore.getState().loadProfile();

    expect(useProfileStore.getState().emailNotifications).toBe(false);
    expect(useProfileStore.getState().hasLoadedProfile).toBe(true);
  });

  it("ignores invalid JSON and storage failures without throwing", async () => {
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, "{not json");
    await expect(useProfileStore.getState().loadProfile()).resolves.toBeUndefined();
    expect(useProfileStore.getState().displayName).toBe("");
    expect(useProfileStore.getState().hasLoadedProfile).toBe(true);

    const getItem = jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("disk"));
    useProfileStore.getState().resetProfile();
    await expect(useProfileStore.getState().loadProfile()).resolves.toBeUndefined();
    expect(useProfileStore.getState().hasLoadedProfile).toBe(true);
    getItem.mockRestore();
  });

  it("resetProfile returns to the defaults", () => {
    useProfileStore.getState().setDisplayName("Ada");
    useProfileStore.getState().setPreference("analytics", false);
    useProfileStore.getState().resetProfile();
    expect(useProfileStore.getState().displayName).toBe("");
    expect(useProfileStore.getState().analytics).toBe(true);
  });
});
