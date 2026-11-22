/**
 * PROTOTYPE: root `/.well-known/*` discovery documents for the MCP connector.
 *
 * Expo Router routes a dot-directory under `app/` like any other in both the
 * dev server and the exported server, so this catch-all receives the request
 * with its original pathname. better-auth's plugins already serve these paths
 * from `onRequest` (matched on the pathname, not the basePath), so the request
 * is forwarded as-is:
 *   - /.well-known/oauth-protected-resource[/api/mcp]   RFC 9728 (mcp plugin)
 *   - /.well-known/oauth-authorization-server/api/auth  RFC 8414 (oauth-provider)
 * plus the OIDC path-insertion form, which better-auth does not serve itself.
 * The documents are public, so any origin may read them (no credentials).
 */

import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";

import { auth } from "@/server/agents/auth";
import { AUTH_BASE_PATH, MCP_RESOURCE } from "@/server/agents/config";

const PUBLIC_CORS = { "Access-Control-Allow-Origin": "*" };

const mcpPath = new URL(MCP_RESOURCE).pathname;
const FORWARDED = new Set([
  "/.well-known/oauth-protected-resource",
  `/.well-known/oauth-protected-resource${mcpPath}`,
  `/.well-known/oauth-authorization-server${AUTH_BASE_PATH}`,
]);
const OPENID_PATH_INSERTED = `/.well-known/openid-configuration${AUTH_BASE_PATH}`;

const openIdConfig = oauthProviderOpenIdConfigMetadata(auth, { headers: PUBLIC_CORS });

export async function GET(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === OPENID_PATH_INSERTED) {
    return openIdConfig(request);
  }

  if (FORWARDED.has(pathname)) {
    const response = await auth.handler(request);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(PUBLIC_CORS)) headers.set(name, value);
    return new Response(response.body, { status: response.status, headers });
  }

  return Response.json({ error: "not_found" }, { status: 404 });
}

export function OPTIONS(): Response {
  return new Response(null, {
    status: 204,
    headers: { ...PUBLIC_CORS, "Access-Control-Allow-Methods": "GET, OPTIONS" },
  });
}
