import { create } from "zustand";
import { getAuthClient } from "../provider";
import { logDev } from "@/client/lib/devtools";

export interface User {
  userId: string;
  username: string;
  email?: string;
}

export type AuthState = "loading" | "authenticated" | "unauthenticated";

interface AuthStore {
  state: AuthState;
  user: User | null;
  pendingVerificationEmail: string | null;
  error: string | null;

  // Internal state for preventing loops
  isInitializing: boolean;
  lastInitializeTime: number;

  // Actions
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
  setState: (state: AuthState) => void;
  setPendingVerificationEmail: (email: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  state: "loading",
  user: null,
  pendingVerificationEmail: null,
  error: null,

  // Internal state for preventing loops
  isInitializing: false,
  lastInitializeTime: 0,

  initialize: async () => {
    try {
      const currentState = get();
      const now = Date.now();

      // Prevent multiple simultaneous initializations
      if (currentState.isInitializing) {
        logDev("Auth initialization already in progress, skipping...");
        return;
      }

      // Throttle initialization calls (minimum 2 seconds between calls)
      if (now - currentState.lastInitializeTime < 2000) {
        logDev("Auth initialization throttled, skipping...");
        return;
      }

      set({
        state: "loading",
        error: null,
        isInitializing: true,
        lastInitializeTime: now,
      });

      logDev("Initializing auth store...");
      const client = await getAuthClient();
      const user = client ? await client.getCurrentUser() : null;
      logDev("Current user:", user);

      if (user) {
        set({
          user,
          state: "authenticated",
          error: null,
          isInitializing: false,
        });
      } else {
        set({
          user: null,
          state: "unauthenticated",
          error: null,
          isInitializing: false,
        });
      }
    } catch (error) {
      logDev("No authenticated user found:", error);
      set({
        user: null,
        state: "unauthenticated",
        error: null,
        isInitializing: false,
      });
    }
  },

  signOut: async () => {
    try {
      set({ state: "loading", error: null });
      const client = await getAuthClient();
      await client?.signOut();
      set({
        user: null,
        state: "unauthenticated",
        error: null,
        pendingVerificationEmail: null,
      });
    } catch (error) {
      console.error("Sign out error:", error);
      set({
        state: "unauthenticated",
        error: error instanceof Error ? error.message : "Sign out failed",
      });
    }
  },

  setUser: (user) => {
    set({
      user,
      state: user ? "authenticated" : "unauthenticated",
      error: null,
    });
  },

  setState: (state) => set({ state }),

  setPendingVerificationEmail: (email) => set({ pendingVerificationEmail: email }),

  setError: (error) => set({ error }),

  reset: () =>
    set({
      state: "unauthenticated",
      user: null,
      pendingVerificationEmail: null,
      error: null,
    }),
}));

// Lazy provider change-listener setup
let authListenerInitialized = false;

export async function initAuth() {
  if (authListenerInitialized) return;
  authListenerInitialized = true;

  const client = await getAuthClient();
  if (!client) return;
  await client.init();

  client.onAuthChange((event) => {
    const { initialize, setUser, setError } = useAuthStore.getState();
    logDev("Auth change event:", event.type);

    switch (event.type) {
    case "signedIn":
      // Defer briefly: providers can emit before the session is queryable.
      setTimeout(async () => {
        const state = useAuthStore.getState();
        if (state.state !== "authenticated" && !state.isInitializing) {
          await initialize();
        }
      }, 500);
      break;

    case "signedOut":
      setUser(null);
      break;

    case "sessionExpired":
      setError("Session expired. Please sign in again.");
      break;
    }
  });
}
