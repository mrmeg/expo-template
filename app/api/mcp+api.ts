/**
 * PROTOTYPE: remote MCP endpoint (Streamable HTTP, stateless).
 *
 * `requireMcpAuth` verifies the bearer JWT against better-auth's signing keys
 * (in-process JWKS), issuer, audience = MCP_RESOURCE and expiry, and answers
 * 401 with `WWW-Authenticate: Bearer resource_metadata="…"` otherwise.
 * Only POST (and OPTIONS) are exported, so GET/DELETE get Expo's 405.
 */

import { requireMcpAuth } from "@better-auth/mcp";

import { auth } from "@/server/agents/auth";
import { getPreflightHeaders, MCP_CORS_PATH } from "@/server/api/shared/cors";
import { MCP_RESOURCE, NOTES_READ, NOTES_WRITE } from "@/server/agents/config";
import { authInfoFromClaims, mcpHandler } from "@/server/agents/mcpServer";

const protectedMcp = requireMcpAuth(
  auth,
  (request, claims) => mcpHandler.fetch(request, { authInfo: authInfoFromClaims(request, claims) }),
  // offline_access in the 401 hint so clients that copy it get a refresh token.
  { resource: MCP_RESOURCE, challengeScopes: [NOTES_READ, NOTES_WRITE, "offline_access"] },
);

export function POST(request: Request): Promise<Response> {
  return protectedMcp(request);
}

/** Dev-server parity; in production `createHandler` answers preflights first. */
export function OPTIONS(request: Request): Response {
  return new Response(null, { status: 204, headers: getPreflightHeaders(request, undefined, MCP_CORS_PATH) });
}
