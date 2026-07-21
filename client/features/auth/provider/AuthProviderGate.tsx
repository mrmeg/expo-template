/**
 * Mounts the provider-specific React context required by the active auth
 * provider. Clerk needs `ClerkProvider` at the root (it initializes the
 * singleton `getClerkInstance()` reads); Cognito and disabled auth need
 * nothing, so children render straight through.
 *
 * `require` is used instead of a static import so the Clerk SDK only enters
 * the module graph when Clerk is actually selected.
 */

import React from "react";
import { getAuthProvider } from "./index";

interface AuthProviderGateProps {
  children: React.ReactNode;
}

interface ClerkModuleShape {
  ClerkProvider: React.ComponentType<{
    publishableKey: string;
    tokenCache?: unknown;
    children: React.ReactNode;
  }>;
}

let clerkModule: ClerkModuleShape | null = null;
let clerkTokenCache: unknown;

function loadClerkModule(): ClerkModuleShape {
  if (!clerkModule) {
    clerkModule = require("@clerk/clerk-expo") as ClerkModuleShape;
    clerkTokenCache = (
      require("@clerk/clerk-expo/token-cache") as { tokenCache: unknown }
    ).tokenCache;
  }
  return clerkModule;
}

export function AuthProviderGate({ children }: AuthProviderGateProps) {
  if (getAuthProvider() !== "clerk") {
    return <>{children}</>;
  }

  const { ClerkProvider } = loadClerkModule();
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY as string}
      tokenCache={clerkTokenCache}
    >
      {children}
    </ClerkProvider>
  );
}
