/**
 * AuthProviderGate contract tests.
 *
 * The gate decides whether Clerk's provider context is mounted, and — since
 * the Clerk branch is an async chunk on web — whether the Clerk SDK enters the
 * module graph at all. What must hold:
 *   - non-Clerk env (Cognito or auth disabled) → children render straight
 *     through, and neither `clerkClient` (the async chunk that owns the SDK)
 *     nor `ClerkProviderBoundary` is loaded. Loading either is what drags
 *     `@clerk/*` + `swr` + `expo-auth-session` (~280 kB) onto the eager
 *     download path, so the load counters below are the bundle-size regression
 *     guard: a static import or `require()` of either module trips them at
 *     import time.
 *   - Clerk env → children are wrapped, not rendered beside the provider.
 *     Auth hooks throw outside `ClerkProvider`, so the Suspense fallback must
 *     be empty (`null`) until the chunk resolves.
 *
 * Scope note: the Clerk branch is asserted on the returned element tree rather
 * than by rendering. `React.lazy(() => import(...))` needs a real dynamic
 * import, which Jest's babel transform leaves untransformed (same limitation
 * noted for `getAuthClient()` in ../../__tests__/provider.test.ts); the
 * resolved-chunk path is exercised in the running app and by the exported
 * bundle's chunk layout.
 */

import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Text, View } from "react-native";

// Stand in for the Clerk modules so this test never loads the SDK, and count
// factory invocations: a factory runs on first require, so the counts say
// whether the module entered the graph. `clerkClient` is what the gate lazily
// imports; `ClerkProviderBoundary` is the component module it re-exports.
const mockClerkLoads = { client: 0, boundary: 0 };

jest.mock("../clerkClient", () => {
  mockClerkLoads.client += 1;
  const ReactModule = require("react");
  const { Text: RNText } = require("react-native");
  return {
    ClerkProviderBoundary: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, [
        ReactModule.createElement(RNText, { key: "marker" }, "CLERK_PROVIDER"),
        children,
      ]),
    createClerkAuthClient: jest.fn(),
  };
});

jest.mock("../ClerkProviderBoundary", () => {
  mockClerkLoads.boundary += 1;
  return { __esModule: true, default: () => null };
});

import { AuthProviderGate } from "../AuthProviderGate";

// Read after the imports above have executed (Babel hoists them), so these are
// the load counts attributable to importing AuthProviderGate itself.
const loadsAfterImport = { ...mockClerkLoads };

const ENV_KEYS = [
  "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "EXPO_PUBLIC_USER_POOL_ID",
  "EXPO_PUBLIC_USER_POOL_CLIENT_ID",
  "EXPO_PUBLIC_AUTH_PROVIDER",
] as const;

describe("AuthProviderGate", () => {
  const original: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const key of ENV_KEYS) original[key] = process.env[key];
  });

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it("does not load the Clerk chunk just by importing the gate", () => {
    expect(loadsAfterImport).toEqual({ client: 0, boundary: 0 });
  });

  it("renders children straight through when auth is disabled", async () => {
    await render(
      <AuthProviderGate>
        <Text>APP</Text>
      </AuthProviderGate>,
    );

    expect(screen.getByText("APP")).toBeTruthy();
    expect(screen.queryByText("CLERK_PROVIDER")).toBeNull();
    expect(mockClerkLoads).toEqual({ client: 0, boundary: 0 });
  });

  it("renders children straight through on the Cognito path without loading the Clerk chunk", async () => {
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_abc";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client123";

    await render(
      <AuthProviderGate>
        <View>
          <Text>APP</Text>
        </View>
      </AuthProviderGate>,
    );

    expect(screen.getByText("APP")).toBeTruthy();
    expect(screen.queryByText("CLERK_PROVIDER")).toBeNull();
    expect(mockClerkLoads).toEqual({ client: 0, boundary: 0 });
  });

  it("wraps children in a lazily loaded boundary behind an empty Suspense fallback when Clerk is selected", () => {
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_abc";
    const child = <Text>APP</Text>;

    const tree = AuthProviderGate({ children: child }) as React.ReactElement<{
      fallback: React.ReactNode;
      children: React.ReactElement<{ children: React.ReactNode }>;
    }>;

    // Empty fallback: children must not mount outside ClerkProvider, and
    // nothing else may render in their place (no spinner).
    expect(tree.type).toBe(React.Suspense);
    expect(tree.props.fallback).toBeNull();

    // The wrapper is a lazy component (an async chunk on web), and the
    // caller's children live inside it.
    const boundary = tree.props.children;
    expect((boundary.type as unknown as { $$typeof: symbol }).$$typeof).toBe(
      Symbol.for("react.lazy"),
    );
    expect(boundary.props.children).toBe(child);

    // Building the element tree must not have pulled the chunk in — only
    // rendering it does.
    expect(mockClerkLoads).toEqual({ client: 0, boundary: 0 });
  });

  it("honors an explicit clerk provider selection", () => {
    process.env.EXPO_PUBLIC_AUTH_PROVIDER = "clerk";
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_abc";
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_abc";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client123";

    const tree = AuthProviderGate({ children: <Text>APP</Text> }) as React.ReactElement;

    expect(tree.type).toBe(React.Suspense);
  });
});
