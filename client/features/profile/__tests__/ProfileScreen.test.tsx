/**
 * The Profile tab is what a fork ships to its users, so it must never show the
 * template's placeholders — no `example.com` address, no "coming soon" — and
 * every row that needs a backend flow appears only when the environment can
 * run it: password reset with a signed-in email, Connected Accounts with
 * configured providers, Delete Account with a client that implements it.
 *
 * The auth provider module is mocked at its boundary (env detection, client
 * loading, social providers) so each case sets the environment directly; the
 * store holds the session.
 */

import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AuthClient, SocialAuthProviderName } from "@/client/features/auth/provider";
import { useAuthStore, type User } from "@/client/features/auth/stores/authStore";
import { useProfileStore } from "../profileStore";

const mockEnv: {
  provider: "cognito" | "clerk" | null;
  client: Partial<AuthClient> | null;
  social: SocialAuthProviderName[];
} = { provider: null, client: null, social: [] };

jest.mock("@/client/features/auth/provider", () => {
  const actual = jest.requireActual("@/client/features/auth/provider");
  return {
    ...actual,
    getAuthProvider: () => mockEnv.provider,
    getAuthClient: () => Promise.resolve(mockEnv.client),
    getSocialAuthProviders: () => mockEnv.social,
  };
});

// The gate lazily imports the auth screen only when signed out; the sheet lazily
// imports the reset form only when opened. Neither happens here.
jest.mock("@/client/features/auth/components", () => ({
  AuthScreen: () => null,
  ResetPasswordForm: () => null,
}));

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  // The tab screen retitles the parent stack header on focus.
  useNavigation: () => ({ getParent: () => ({ setOptions: jest.fn() }) }),
  useFocusEffect: () => {},
  usePathname: () => "/profile",
  useSegments: () => ["(main)", "(tabs)"],
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("expo-router/head", () => ({ __esModule: true, default: () => null }));

jest.mock("@/client/features/billing", () => ({
  useBillingActions: () => ({ startPortal: jest.fn(), isCreatingPortal: false }),
  useBillingSummary: () => ({ data: undefined }),
  isEntitled: () => false,
}));

jest.mock("@expo/ui/community/bottom-sheet", () => {
  const ReactModule = require("react");
  const { View } = require("react-native");
  return {
    BottomSheet: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(View, { testID: "native-bottom-sheet" }, children),
  };
});

import ProfileRoute from "@/app/(main)/(tabs)/profile";

const ADA: User = { userId: "user-1234567890", username: "ada", email: "ada@acme.test" };

function signedOutEnvironment() {
  mockEnv.provider = null;
  mockEnv.client = null;
  mockEnv.social = [];
  useAuthStore.setState({ state: "unauthenticated", user: null });
}

function signedInEnvironment(overrides: Partial<typeof mockEnv> = {}, user: User = ADA) {
  mockEnv.provider = "cognito";
  mockEnv.client = { deleteAccount: jest.fn() };
  mockEnv.social = [];
  Object.assign(mockEnv, overrides);
  useAuthStore.setState({ state: "authenticated", user });
}

function textOf(tree: Awaited<ReturnType<typeof render>>): string {
  return JSON.stringify(tree.toJSON());
}

describe("Profile tab", () => {
  beforeEach(async () => {
    // Persistence is shared across tests; the screen hydrates from it on mount.
    await AsyncStorage.clear();
    useProfileStore.getState().resetProfile();
    signedOutEnvironment();
  });

  it("ships no placeholders with auth off, and hides every backend-only row", async () => {
    const tree = await render(<ProfileRoute />);
    await act(async () => {});

    const json = textOf(tree);
    expect(json).not.toMatch(/example\.com/);
    expect(json).not.toMatch(/coming soon/i);
    expect(screen.getByText("Your profile")).toBeTruthy();
    expect(screen.queryByText("Change Password")).toBeNull();
    expect(screen.queryByText("Connected Accounts")).toBeNull();
    expect(screen.queryByText("Danger Zone")).toBeNull();
    expect(screen.queryByText("Delete Account")).toBeNull();
    expect(screen.queryByText("Sign Out")).toBeNull();
    // Notifications are real switches bound to the store.
    expect(screen.getAllByRole("switch")).toHaveLength(3);
  });

  it("reveals the privacy switches from the Privacy Settings row", async () => {
    await render(<ProfileRoute />);
    await act(async () => {});

    expect(screen.queryByText("Public profile")).toBeNull();
    await fireEvent.press(screen.getByText("Privacy Settings"));

    expect(screen.getByText("Public profile")).toBeTruthy();
    expect(screen.getByText("Share analytics")).toBeTruthy();
    expect(screen.getAllByRole("switch")).toHaveLength(5);

    // The privacy rows sit above Notifications, so Public profile is the first
    // switch in the tree; flipping it lands in the store.
    await fireEvent.press(screen.getAllByRole("switch")[0]);
    expect(useProfileStore.getState().publicProfile).toBe(true);
  });

  it("binds the notification switches to the profile store", async () => {
    await render(<ProfileRoute />);
    await act(async () => {});

    await fireEvent.press(screen.getAllByRole("switch")[0]);
    expect(useProfileStore.getState().emailNotifications).toBe(false);
    await fireEvent.press(screen.getAllByRole("switch")[2]);
    expect(useProfileStore.getState().marketingEmails).toBe(true);
  });

  it("shows the saved display name over the username", async () => {
    useProfileStore.getState().setDisplayName("Ada L.");
    signedInEnvironment();
    await render(<ProfileRoute />);
    await act(async () => {});

    expect(screen.getByText("Ada L.")).toBeTruthy();
    expect(screen.queryByText("ada")).toBeNull();
    expect(screen.getByText("ada@acme.test")).toBeTruthy();
  });

  it("offers password reset, deletion and the configured providers when signed in", async () => {
    signedInEnvironment({ social: ["google"] });
    await render(<ProfileRoute />);

    expect(await screen.findByText("Delete Account")).toBeTruthy();
    expect(screen.getByText("Change Password")).toBeTruthy();
    expect(screen.getByText("Sign Out")).toBeTruthy();
    expect(screen.getByText("Google")).toBeTruthy();
    expect(screen.queryByText("Apple")).toBeNull();
    expect(screen.queryByText("Not connected")).toBeNull();
  });

  it("hides deletion and password reset when the client or the email cannot support them", async () => {
    signedInEnvironment({ client: {} }, { userId: "user-2", username: "grace" });
    await render(<ProfileRoute />);
    await act(async () => {});

    await waitFor(() => expect(screen.getByText("Sign Out")).toBeTruthy());
    expect(screen.queryByText("Delete Account")).toBeNull();
    expect(screen.queryByText("Change Password")).toBeNull();
    expect(screen.queryByText("Connected Accounts")).toBeNull();
    expect(screen.getByText("grace")).toBeTruthy();
  });
});
