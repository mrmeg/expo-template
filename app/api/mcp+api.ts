/**
 * PROTOTYPE: remote MCP endpoint (Streamable HTTP, stateless).
 *
 * `requireMcpAuth` verifies the bearer JWT against better-auth's signing keys
 * (in-process JWKS), issuer, audience = MCP_RESOURCE and expiry, and answers
 * 401 with `WWW-Authenticate: Bearer resource_metadata="…"` otherwise.
 * Only POST is exported, so GET/DELETE get Expo's 405.
 */

import { requireMcpAuth } from "@better-auth/mcp";

import { auth } from "@/server/agents/auth";
import { MCP_RESOURCE, NOTES_READ, NOTES_WRITE } from "@/server/agents/config";
import { authInfoFromClaims, mcpHandler } from "@/server/agents/mcpServer";

const protectedMcp = requireMcpAuth(
  auth,
  (request, claims) => mcpHandler.fetch(request, { authInfo: authInfoFromClaims(request, claims) }),
  { resource: MCP_RESOURCE, challengeScopes: [NOTES_READ, NOTES_WRITE] },
);

export function POST(request: Request): Promise<Response> {
  return protectedMcp(request);
}
