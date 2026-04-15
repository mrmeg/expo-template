/**
 * Reusable authentication helper for Expo Router API routes.
 *
 * Verifies a Cognito bearer token on incoming requests and returns the
 * authenticated user. Actual token verification is delegated to a
 * pluggable `TokenVerifier` so routes stay framework-agnostic and
 * unit-testable without a live Cognito JWKs endpoint.
 *
 * The production verifier is registered via `setTokenVerifier()` at
 * server bootstrap time (see `add-stripe-subscriptions-bootstrap-and-config`).
 */

import { unauthorizedResponse } from "./errors";

export interface AuthenticatedUser {
  userId: string;
  email: string | null;
  username?: string | null;
  /** Full set of verified JWT claims — useful for role checks later. */
  claims?: Record<string, unknown>;
}

export interface TokenVerifier {
  verify(token: string): Promise<AuthenticatedUser>;
}

let registeredVerifier: TokenVerifier | null = null;

/**
 * Register the process-wide Cognito token verifier. Call once at
 * server startup. Tests should reset with `setTokenVerifier(null)`
 * in an afterEach.
 */
export function setTokenVerifier(verifier: TokenVerifier | null): void {
  registeredVerifier = verifier;
}

export function getTokenVerifier(): TokenVerifier | null {
  return registeredVerifier;
}

export interface AuthResultOk {
  ok: true;
  user: AuthenticatedUser;
}

export interface AuthResultErr {
  ok: false;
  response: Response;
}

export type AuthResult = AuthResultOk | AuthResultErr;

/**
 * Extract, verify, and return the authenticated user for a request.
 * Callers should early-return the `response` when `ok === false`.
 *
 *   const auth = await requireAuthenticatedUser(request);
 *   if (!auth.ok) return auth.response;
 *   // ... use auth.user
 */
export async function requireAuthenticatedUser(
  request: Request,
): Promise<AuthResult> {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return { ok: false, response: unauthorizedResponse(request, "Missing Authorization bearer token") };
  }

  const token = header.slice("bearer ".length).trim();
  if (!token) {
    return { ok: false, response: unauthorizedResponse(request, "Empty Authorization bearer token") };
  }

  const verifier = registeredVerifier;
  if (!verifier) {
    // Defensive: if a route is deployed without configuring the verifier,
    // fail closed with 401 rather than accepting the token unverified.
    return {
      ok: false,
      response: unauthorizedResponse(
        request,
        "Authentication is not configured on this server",
      ),
    };
  }

  try {
    const user = await verifier.verify(token);
    return { ok: true, user };
  } catch {
    return { ok: false, response: unauthorizedResponse(request, "Token verification failed") };
  }
}
