/**
 * Startup handshake between `ClerkProvider` and the Clerk `AuthClient`.
 *
 * Clerk loads only inside `ClerkProvider`, and the app's startup gate waits on
 * `createClerkAuthClient().init()`. So `init()` has to wait for the provider's
 * load, and it must not build the Clerk instance first: on native,
 * `getClerkInstance()` creates the singleton on its first call with whatever
 * options that call passes, and a bare call picks the in-memory token cache
 * (every cold start signed out) or, in a release build — where `node_modules`
 * cannot read `EXPO_PUBLIC_*` env — throws for a missing publishable key. On
 * web it returns `window.Clerk`, which exists only once the provider has
 * hot-loaded clerk-js.
 *
 * `ClerkProviderBoundary` reports the provider's status here as it changes;
 * `clerkClient` awaits the first settled one ("ready", "degraded" or "error").
 *
 * Only the lazy `clerkClient` chunk imports this module (through `clerkClient`
 * and `ClerkProviderBoundary`), so it adds nothing to the web entry bundle.
 */

export type ClerkSettledStatus = "ready" | "degraded" | "error";

let settledStatus: ClerkSettledStatus | null = null;
let resolveSettled: (status: ClerkSettledStatus) => void = () => {};
let settledPromise = createSettledPromise();

function createSettledPromise(): Promise<ClerkSettledStatus> {
  return new Promise<ClerkSettledStatus>((resolve) => {
    resolveSettled = resolve;
  });
}

function isSettledStatus(status: unknown): status is ClerkSettledStatus {
  return status === "ready" || status === "degraded" || status === "error";
}

/**
 * Record a status reported by the provider. `"loading"` is ignored, and the
 * first settled status wins: startup only needs to know the load finished.
 */
export function reportClerkStatus(status: unknown): void {
  if (settledStatus || !isSettledStatus(status)) return;
  settledStatus = status;
  resolveSettled(status);
}

/** Resolves once the provider has finished loading Clerk, however it went. */
export function clerkSettled(): Promise<ClerkSettledStatus> {
  return settledPromise;
}

/** The first settled status, or `null` while the provider is still loading. */
export function getClerkSettledStatus(): ClerkSettledStatus | null {
  return settledStatus;
}

/** Test-only: forget any reported status. */
export function resetClerkLoadSignalForTests(): void {
  settledStatus = null;
  settledPromise = createSettledPromise();
}
