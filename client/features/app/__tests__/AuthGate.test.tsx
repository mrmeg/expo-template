/**
 * AuthGate contract tests.
 *
 * The gate has three observable states:
 *   - auth disabled in env → render children (template stays explorable)
 *   - auth enabled + loading → render a spinner placeholder
 *   - auth enabled + unauthenticated → render the shared AuthScreen
 *   - auth enabled + authenticated → render children
 */

import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

jest.mock("@mrmeg/expo-ui/hooks", () => ({
  useTheme: () => ({
    theme: {
      dark: false,
      colors: {
        primary: "#000",
        background: "#fff",
        accent: "#14B8A6",
        border: "#E2E8F0",
        foreground: "#0F172A",
        text: "#0F172A",
        textDim: "#64748B",
        mutedForeground: "#64748B",
        muted: "#F1F5F9",
        card: "#fff",
        destructive: "#EF4444",
      },
    },
    getShadowStyle: () => ({}),
    getContrastingColor: () => "#fff",
    withAlpha: (c: string) => c,
    setTheme: jest.fn(),
    toggleTheme: jest.fn(),
    scheme: "light",
  }),
}));

// Stub the AuthScreen so we don't drag Amplify / forms into this test
jest.mock("@/client/features/auth/components/AuthScreen", () => ({
  AuthScreen: () => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, "MOCK_AUTH_SCREEN");
  },
}));

import { useAuthStore } from "@/client/features/auth/stores/authStore";
import { AuthGate } from "../AuthGate";

const setAuth = (state: "loading" | "authenticated" | "unauthenticated") => {
  useAuthStore.setState({ state } as any);
};

describe("AuthGate", () => {
  const originalPool = process.env.EXPO_PUBLIC_USER_POOL_ID;
  const originalClient = process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;

  afterEach(() => {
    if (originalPool === undefined) delete process.env.EXPO_PUBLIC_USER_POOL_ID;
    else process.env.EXPO_PUBLIC_USER_POOL_ID = originalPool;
    if (originalClient === undefined) delete process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;
    else process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = originalClient;
    useAuthStore.setState({ state: "loading", user: null } as any);
  });

  it("renders children when auth is not configured in env", () => {
    delete process.env.EXPO_PUBLIC_USER_POOL_ID;
    delete process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;
    setAuth("unauthenticated");

    render(
      <AuthGate>
        <Text>PROTECTED</Text>
      </AuthGate>,
    );

    expect(screen.getByText("PROTECTED")).toBeTruthy();
    expect(screen.queryByText("MOCK_AUTH_SCREEN")).toBeNull();
  });

  it("renders AuthScreen when unauthenticated and auth is configured", () => {
    process.env.EXPO_PUBLIC_USER_POOL_ID = "pool";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client";
    setAuth("unauthenticated");

    render(
      <AuthGate>
        <Text>PROTECTED</Text>
      </AuthGate>,
    );

    expect(screen.getByText("MOCK_AUTH_SCREEN")).toBeTruthy();
    expect(screen.queryByText("PROTECTED")).toBeNull();
  });

  it("renders children when authenticated", () => {
    process.env.EXPO_PUBLIC_USER_POOL_ID = "pool";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client";
    setAuth("authenticated");

    render(
      <AuthGate>
        <Text>PROTECTED</Text>
      </AuthGate>,
    );

    expect(screen.getByText("PROTECTED")).toBeTruthy();
    expect(screen.queryByText("MOCK_AUTH_SCREEN")).toBeNull();
  });

  it("does not render children or AuthScreen while auth is loading", () => {
    process.env.EXPO_PUBLIC_USER_POOL_ID = "pool";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client";
    setAuth("loading");

    render(
      <AuthGate>
        <Text>PROTECTED</Text>
      </AuthGate>,
    );

    expect(screen.queryByText("PROTECTED")).toBeNull();
    expect(screen.queryByText("MOCK_AUTH_SCREEN")).toBeNull();
  });
});
