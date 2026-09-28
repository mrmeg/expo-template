/**
 * Process-wide bearer-token source for API requests.
 *
 * Kept apart from `authenticatedFetch.ts` so the root layout can register the
 * getter at startup without pulling the fetch helper into the web entry bundle.
 * Nothing here imports auth: the auth feature registers its getter
 * (`registerApiTokenGetter()` in `client/features/auth/provider/apiTokenGetter.ts`)
 * the way the server registers its verifier with `setTokenVerifier()`.
 */

/** Resolves the current bearer token, or nothing when there is no session. */
export type AuthTokenGetter = () => Promise<string | null | undefined>;

let tokenGetter: AuthTokenGetter | null = null;

/**
 * Register the bearer-token source (pass `null` to clear it). The last
 * registration wins; tests reset with `setAuthTokenGetter(null)`.
 */
export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  tokenGetter = getter;
}

/**
 * The current bearer token, or `undefined` when no getter is registered (auth
 * disabled), there is no session, or the getter fails.
 */
export async function getAuthToken(): Promise<string | undefined> {
  const getter = tokenGetter;
  if (!getter) return undefined;

  try {
    return (await getter()) ?? undefined;
  } catch {
    return undefined;
  }
}
