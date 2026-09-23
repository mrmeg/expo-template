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
 * The root layout mounts it while the native splash is still up, and the
 * status bridge below tells `clerkClient` when the load has settled — that is
 * what the startup gate waits on (see `./clerkLoadSignal.ts`).
 *
 * Default-exported because `React.lazy` resolves a module's `default`.
 */

import React, { useEffect } from "react";
import { ClerkProvider, useClerk } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { reportClerkStatus } from "./clerkLoadSignal";

/**
 * The options every `getClerkInstance()` call shares with the provider. On
 * native the first call builds the singleton, so a call that ran before the
 * provider with different options (or none) would keep them for the process.
 */
export const CLERK_INSTANCE_OPTIONS = {
  publishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY as string,
  tokenCache,
};

interface ClerkProviderBoundaryProps {
  children: React.ReactNode;
}

export default function ClerkProviderBoundary({ children }: ClerkProviderBoundaryProps) {
  return (
    <ClerkProvider
      publishableKey={CLERK_INSTANCE_OPTIONS.publishableKey}
      tokenCache={CLERK_INSTANCE_OPTIONS.tokenCache}
    >
      <ClerkStatusBridge />
      {children}
    </ClerkProvider>
  );
}

/**
 * Forwards the provider's Clerk status to `clerkLoadSignal`. `notify` replays
 * the latest status, so a load that settled before this effect ran still
 * counts.
 */
function ClerkStatusBridge() {
  const clerk = useClerk();

  useEffect(() => {
    const onStatus = (status: unknown) => reportClerkStatus(status);
    clerk.on("status", onStatus, { notify: true });
    return () => clerk.off("status", onStatus);
  }, [clerk]);

  return null;
}
