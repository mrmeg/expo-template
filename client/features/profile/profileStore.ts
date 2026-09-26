import { useEffect } from "react";
import { Platform } from "react-native";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** One key for the whole preferences object, on both storage backends. */
export const PROFILE_STORAGE_KEY = "profile-preferences";

/**
 * What the Profile tab lets a person change without a backend: a display name
 * and the switches under Privacy and Notifications. A fork that grows a
 * profile API keeps the shape and swaps the persistence.
 */
export type ProfilePreferences = {
  displayName: string;
  publicProfile: boolean;
  analytics: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  marketingEmails: boolean;
};

export const DEFAULT_PROFILE_PREFERENCES: ProfilePreferences = {
  displayName: "",
  publicProfile: false,
  analytics: true,
  emailNotifications: true,
  pushNotifications: true,
  marketingEmails: false,
};

export type ProfileStore = ProfilePreferences & {
  /** True once `loadProfile()` has read persistence; the tab renders defaults until then. */
  hasLoadedProfile: boolean;
  setPreference: <K extends keyof ProfilePreferences>(key: K, value: ProfilePreferences[K]) => void;
  setDisplayName: (displayName: string) => void;
  loadProfile: () => Promise<void>;
  resetProfile: () => void;
};

const PREFERENCE_KEYS = Object.keys(DEFAULT_PROFILE_PREFERENCES) as (keyof ProfilePreferences)[];

function pickPreferences(state: ProfilePreferences): ProfilePreferences {
  const picked = {} as ProfilePreferences;
  for (const key of PREFERENCE_KEYS) {
    (picked as Record<string, unknown>)[key] = state[key];
  }
  return picked;
}

/**
 * Only the keys the store knows, only when their type matches the default:
 * a renamed key or a hand-edited value never reaches state.
 */
function parseStored(raw: string | null): Partial<ProfilePreferences> {
  if (raw === null) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};
  const result: Partial<ProfilePreferences> = {};
  for (const key of PREFERENCE_KEYS) {
    const value = (parsed as Record<string, unknown>)[key];
    if (typeof value === typeof DEFAULT_PROFILE_PREFERENCES[key]) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

/** The raw JSON from whichever backend this platform uses; null on any failure. */
async function readStored(): Promise<string | null> {
  try {
    if (Platform.OS !== "web") return await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
    return hasLocalStorage() ? localStorage.getItem(PROFILE_STORAGE_KEY) : null;
  } catch {
    return null;
  }
}

function persist(preferences: ProfilePreferences): void {
  const serialized = JSON.stringify(preferences);
  if (Platform.OS !== "web") {
    AsyncStorage.setItem(PROFILE_STORAGE_KEY, serialized).catch(() => {});
    return;
  }
  if (hasLocalStorage()) {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, serialized);
    } catch {
      // Quota or privacy mode: the in-memory state still holds the change.
    }
  }
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  ...DEFAULT_PROFILE_PREFERENCES,
  hasLoadedProfile: false,

  setPreference: (key, value) => {
    set({ [key]: value } as Partial<ProfileStore>);
    persist(pickPreferences(get()));
  },

  setDisplayName: (displayName) => {
    set({ displayName });
    persist(pickPreferences(get()));
  },

  loadProfile: async () => {
    set({ ...parseStored(await readStored()), hasLoadedProfile: true });
  },

  resetProfile: () => {
    set({ ...DEFAULT_PROFILE_PREFERENCES, hasLoadedProfile: false });
  },
}));

/**
 * Read persistence once the screen is on the client. On web the first render
 * has to match the server's HTML, and the server cannot see localStorage, so
 * the read is deferred to an effect (the onboarding store's split). Native has
 * already hydrated at module load below; the effect is then a no-op.
 */
export function useHydrateProfile(): void {
  useEffect(() => {
    if (!useProfileStore.getState().hasLoadedProfile) {
      void useProfileStore.getState().loadProfile();
    }
  }, []);
}

if (Platform.OS !== "web") {
  void useProfileStore.getState().loadProfile();
}
