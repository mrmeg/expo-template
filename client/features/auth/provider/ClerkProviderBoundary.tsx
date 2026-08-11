/**
 * Clerk's root context, isolated in its own module.
 *
 * Nothing in the eager graph imports this module: `clerkClient.ts` re-exports
 * the component and `AuthProviderGate` pulls it from there via
 * `React.lazy(() => import("./clerkClient"))`, so on web the Clerk SDK and its
 * dependency cluster (`@clerk/clerk-react`, `@clerk/shared`, `swr`,
 * `expo-auth-session` — ~280 kB uncompressed) ship inside the single async
 * `clerkClient` chunk and download only when Clerk is the selected provider.
 * Two things would undo that: a static import (or `require()`) from the gate,
 * which puts the cluster in the entry bundle, and being its own async chunk,
 * which makes the SDK a module shared by two chunks — Metro then hoists it into
 * the eagerly `<script>`-loaded `__common` bundle. Keep this module reachable
 * only through `clerkClient`.
 *
 * Default-exported because `React.lazy` resolves a module's `default`.
 */

import React from "react";
import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";

interface ClerkProviderBoundaryProps {
  children: React.ReactNode;
}

export default function ClerkProviderBoundary({ children }: ClerkProviderBoundaryProps) {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY as string}
      tokenCache={tokenCache}
    >
      {children}
    </ClerkProvider>
  );
}
