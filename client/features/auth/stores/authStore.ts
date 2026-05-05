import { create } from "zustand";
import { ensureAmplifyConfigured } from "../config";
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
      const { getCurrentUser } = await import("aws-amplify/auth");
      const currentUser = await getCurrentUser();
      logDev("Current user:", currentUser);

      if (currentUser) {
        const user: User = {
          userId: currentUser.userId,
          username: currentUser.username,
          email: currentUser.signInDetails?.loginId,
        };

        logDev("Setting authenticated user:", user);
        set({
          user,
          state: "authenticated",
          error: null,
          isInitializing: false,
        });
      } else {
        logDev("No current user found");
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
      const { signOut } = await import("aws-amplify/auth");
      await signOut();
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

// Handle auto sign in after signup completion
async function handleAutoSignIn() {
  try {
    logDev("Attempting auto sign in...");
    const { autoSignIn } = await import("aws-amplify/auth");
    const signInResult = await autoSignIn();
    logDev("Auto sign in result:", signInResult);

    if (signInResult.isSignedIn) {
      const { initialize } = useAuthStore.getState();
      await initialize();
    }
  } catch (error) {
    console.error("Auto sign in failed:", error);
    const { setError } = useAuthStore.getState();
    setError("Auto sign in failed. Please sign in manually.");
  }
}

// Lazy Hub listener setup
let hubListenerInitialized = false;

export async function initAuth() {
  await ensureAmplifyConfigured();

  if (hubListenerInitialized) return;
  hubListenerInitialized = true;

  const { Hub } = await import("aws-amplify/utils");

  Hub.listen("auth", ({ payload }) => {
    const { event } = payload;
    const data = (payload as any).data;
    const { initialize, setUser, setError } = useAuthStore.getState();

    logDev("Hub auth event:", event, data);

    switch (event) {
    case "signInWithRedirect":
    case "signedIn":
      logDev("User signed in:", data);
      setTimeout(async () => {
        const state = useAuthStore.getState();
        if (state.state !== "authenticated" && !state.isInitializing) {
          await initialize();
        }
      }, 500);
      break;

    case "signedOut":
      logDev("User signed out");
      setUser(null);
      break;

    case "tokenRefresh":
      logDev("Token refreshed");
      break;

    case "tokenRefresh_failure":
      logDev("Token refresh failed");
      setError("Session expired. Please sign in again.");
      break;

    case "signInWithRedirect_failure":
      logDev("Sign in failed:", data);
      setError("Sign in failed. Please try again.");
      break;

    default: {
      const eventStr = String(event);
      // Handle confirmSignUp for auto sign in
      if (eventStr === "confirmSignUp" || eventStr === "signUp") {
        logDev(`Auth event: ${eventStr}`, data);
        if (data && typeof data === "object" && "nextStep" in data) {
          const nextStep = data.nextStep;
          if (nextStep?.signUpStep === "COMPLETE_AUTO_SIGN_IN") {
            logDev("Triggering auto sign in...");
            handleAutoSignIn();
          }
        }
      }
      break;
    }
    }
  });
}
