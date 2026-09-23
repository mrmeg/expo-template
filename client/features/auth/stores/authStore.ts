import { create } from "zustand";
import { getAuthClient } from "../provider";
import { logDev } from "@/client/lib/devtools";

export interface User {
  userId: string;
  username: string;
  email?: string;
}

export type AuthState = "loading" | "authenticated" | "unauthenticated";

export interface InitializeOptions {
  /**
   * Bypass the 2s throttle. For callers that know the session just changed — a
   * provider sign-in event, the end of a sign-in flow, startup — where a
   * throttled no-op would leave the store showing the previous state (a
   * signed-in user shown as signed out). A forced call that finds a read in
   * flight queues one more read after it, since that read may predate the
   * change.
   */
  force?: boolean;
}

interface AuthStore {
  state: AuthState;
  user: User | null;
  pendingVerificationEmail: string | null;
  error: string | null;

  // Internal state for preventing loops
  isInitializing: boolean;
  lastInitializeTime: number;

  // Actions
  /**
   * Re-read the session from the active provider. Concurrent calls join the
   * read in flight, and the returned promise settles once the store holds its
   * result. Unforced calls within 2s of the last read are skipped.
   */
  initialize: (options?: InitializeOptions) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
  setState: (state: AuthState) => void;
  setPendingVerificationEmail: (email: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

/** Passive re-checks within this window of the last read are skipped. */
const INITIALIZE_THROTTLE_MS = 2000;

/** The session read in flight; concurrent `initialize()` calls join it. */
let inflightInitialize: Promise<void> | null = null;
/** A forced read requested while another was in flight. */
let refreshQueued = false;

export const useAuthStore = create<AuthStore>((set, get) => {
  async function readSession(): Promise<void> {
    try {
      set({
        state: "loading",
        error: null,
        isInitializing: true,
        lastInitializeTime: Date.now(),
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
  }

  async function runInitialize(): Promise<void> {
    try {
      await readSession();
    } finally {
      inflightInitialize = null;
    }

    if (refreshQueued) {
      refreshQueued = false;
      await get().initialize({ force: true });
    }
  }

  return {
    state: "loading",
    user: null,
    pendingVerificationEmail: null,
    error: null,

    // Internal state for preventing loops
    isInitializing: false,
    lastInitializeTime: 0,

    initialize: (options) => {
      const force = options?.force === true;

      if (inflightInitialize) {
        if (force) refreshQueued = true;
        logDev("Auth initialization already in progress, joining it...");
        return inflightInitialize;
      }

      if (!force && Date.now() - get().lastInitializeTime < INITIALIZE_THROTTLE_MS) {
        logDev("Auth initialization throttled, skipping...");
        return Promise.resolve();
      }

      inflightInitialize = runInitialize();
      return inflightInitialize;
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
  };
});

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
      // Forced: the event is proof the session changed, so neither the
      // throttle nor a read already in flight (which may predate the
      // sign-in) may swallow this refresh. Clerk restoring a session after a
      // startup timeout arrives here within the throttle window.
      setTimeout(() => {
        if (useAuthStore.getState().state !== "authenticated") {
          void initialize({ force: true });
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
