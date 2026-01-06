import { create } from "zustand";
import { getCurrentUser, signOut, autoSignIn } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";

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
        console.log("Auth initialization already in progress, skipping...");
        return;
      }

      // Throttle initialization calls (minimum 2 seconds between calls)
      if (now - currentState.lastInitializeTime < 2000) {
        console.log("Auth initialization throttled, skipping...");
        return;
      }

      set({
        state: "loading",
        error: null,
        isInitializing: true,
        lastInitializeTime: now,
      });

      console.log("Initializing auth store...");
      const currentUser = await getCurrentUser();
      console.log("Current user:", currentUser);

      if (currentUser) {
        const user: User = {
          userId: currentUser.userId,
          username: currentUser.username,
          email: currentUser.signInDetails?.loginId,
        };

        console.log("Setting authenticated user:", user);
        set({
          user,
          state: "authenticated",
          error: null,
          isInitializing: false,
        });
      } else {
        console.log("No current user found");
        set({
          user: null,
          state: "unauthenticated",
          error: null,
          isInitializing: false,
        });
      }
    } catch (error) {
      console.log("No authenticated user found:", error);
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
    console.log("Attempting auto sign in...");
    const signInResult = await autoSignIn();
    console.log("Auto sign in result:", signInResult);

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

// Listen for auth events
Hub.listen("auth", ({ payload }) => {
  const { event } = payload;
  const data = (payload as any).data;
  const { initialize, setUser, setError } = useAuthStore.getState();

  console.log("Hub auth event:", event, data);

  switch (event) {
  case "signInWithRedirect":
  case "signedIn":
    console.log("User signed in:", data);
    setTimeout(async () => {
      const state = useAuthStore.getState();
      if (state.state !== "authenticated" && !state.isInitializing) {
        await initialize();
      }
    }, 500);
    break;

  case "signedOut":
    console.log("User signed out");
    setUser(null);
    break;

  case "tokenRefresh":
    console.log("Token refreshed");
    break;

  case "tokenRefresh_failure":
    console.log("Token refresh failed");
    setError("Session expired. Please sign in again.");
    break;

  case "signInWithRedirect_failure":
    console.log("Sign in failed:", data);
    setError("Sign in failed. Please try again.");
    break;

  default: {
    const eventStr = String(event);
    // Handle confirmSignUp for auto sign in
    if (eventStr === "confirmSignUp" || eventStr === "signUp") {
      console.log(`Auth event: ${eventStr}`, data);
      if (data && typeof data === "object" && "nextStep" in data) {
        const nextStep = data.nextStep;
        if (nextStep?.signUpStep === "COMPLETE_AUTO_SIGN_IN") {
          console.log("Triggering auto sign in...");
          handleAutoSignIn();
        }
      }
    }
    break;
  }
  }
});
