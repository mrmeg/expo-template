/**
 * Hands the API client (`client/lib/api/authenticatedFetch.ts`) its bearer
 * token source, through the registry in `client/lib/api/authToken.ts`.
 *
 * The client never imports auth: this is the client-side counterpart of the
 * server registering its `TokenVerifier` at startup (`setTokenVerifier()` in
 * `server/api/shared/auth.ts`). The root layout calls it at module scope, so
 * the getter is in place before any screen can issue a request.
 *
 * Auth disabled clears the getter, so requests carry no `Authorization`
 * header — exactly what they sent before the split.
 */
import { setAuthTokenGetter } from "@/client/lib/api/authToken";
import { getAuthClient, getAuthProvider } from "./index";

export function registerApiTokenGetter(): void {
  if (getAuthProvider() === null) {
    setAuthTokenGetter(null);
    return;
  }

  setAuthTokenGetter(async () => {
    const client = await getAuthClient();
    return (await client?.getToken()) ?? null;
  });
}
