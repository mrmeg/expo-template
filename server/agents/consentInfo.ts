/**
 * PROTOTYPE: what the consent page shows, read on the server.
 *
 * `GET /api/auth/agent-connect/consent-info?<signed query>` (session cookie):
 *   1. keeps only the signed parameters and verifies their signature with
 *      `verifyOAuthQueryParams` (public export of @better-auth/oauth-provider),
 *   2. loads the client with `auth.api.getOAuthClientPublic` (needs the
 *      session; 404 for unknown/disabled clients),
 *   3. returns the client's self-asserted name/uri, the requested scopes, the
 *      redirect URI and its host, and the requested resource.
 * Dispatched from `app/api/auth/[...auth]+api.ts` so it shares that bundle.
 */

import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";

import { auth } from "./auth";

export const CONSENT_INFO_PATH = "/api/auth/agent-connect/consent-info";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function handleConsentInfo(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const signedNames = new Set(["sig", "ba_param", ...params.getAll("ba_param")]);
  const query = new URLSearchParams([...params].filter(([key]) => signedNames.has(key)));
  const { secret } = await auth.$context;
  if (!(await verifyOAuthQueryParams(query.toString(), secret))) {
    return json({ error: "invalid_signature" }, 400);
  }

  const clientId = query.get("client_id");
  if (!clientId) return json({ error: "invalid_request" }, 400);

  let client: Record<string, unknown>;
  try {
    client = (await auth.api.getOAuthClientPublic({
      query: { client_id: clientId },
      headers: request.headers,
    })) as unknown as Record<string, unknown>;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    return json({ error: status === 401 ? "login_required" : "unknown_client" }, status);
  }

  const redirectUri = query.get("redirect_uri") ?? "";
  let redirectHost: string | null = null;
  try {
    redirectHost = new URL(redirectUri).host || null;
  } catch {
    redirectHost = null;
  }

  return json({
    client: {
      client_id: clientId,
      client_name: client.client_name ?? null,
      client_uri: client.client_uri ?? null,
      // CIMD clients: the client_id is an https URL whose host the user should see.
      client_id_host: clientId.startsWith("https://") ? new URL(clientId).host : null,
    },
    scopes: (query.get("scope") ?? "").split(" ").filter(Boolean),
    redirectUri,
    redirectHost,
    resource: query.getAll("resource"),
  });
}
