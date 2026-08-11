/**
 * Mounts the provider-specific React context required by the active auth
 * provider. Clerk needs `ClerkProvider` at the root (it initializes the
 * singleton `getClerkInstance()` reads); Cognito and disabled auth need
 * nothing, so children render straight through.
 *
 * The Clerk branch is a lazy `import()` rather than a static import or
 * `require()`: Metro treats a static `require()` exactly like an import and
 * keeps the ~280 kB Clerk cluster (`@clerk/*`, `swr`, `expo-auth-session`) in
 * the web entry bundle, while `import()` makes it an async chunk that only
 * loads when Clerk is selected.
 *
 * The import target is `./clerkClient`, which re-exports the component from
 * `./ClerkProviderBoundary`, rather than the boundary module directly. That
 * indirection is load-bearing: `clerkClient` is already the async chunk holding
 * the SDK for `getAuthClient()`, and Metro hoists modules that two async chunks
 * share into the eagerly `<script>`-loaded `__common` bundle. Pointing both
 * dynamic imports at the same module keeps the cluster in one lazy chunk.
 *
 * `fallback={null}` is deliberate: auth hooks throw outside `ClerkProvider`,
 * so children must not mount until the chunk resolves, and rendering nothing
 * matches what the exported HTML shell shows. The splash screen in
 * `RootLayout` stays up on its own schedule — this gate renders inside it and
 * doesn't touch that flow.
 */

import React, { Suspense } from "react";
import { getAuthProvider } from "./index";

const ClerkProviderBoundary = React.lazy(async () => ({
  default: (await import("./clerkClient")).ClerkProviderBoundary,
}));

interface AuthProviderGateProps {
  children: React.ReactNode;
}

export function AuthProviderGate({ children }: AuthProviderGateProps) {
  if (getAuthProvider() !== "clerk") {
    return <>{children}</>;
  }

  return (
    <Suspense fallback={null}>
      <ClerkProviderBoundary>{children}</ClerkProviderBoundary>
    </Suspense>
  );
}
