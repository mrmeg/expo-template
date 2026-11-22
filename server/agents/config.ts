/**
 * PROTOTYPE (proto/agent-connector): constants for the agent-connector
 * authorization layer. Every URL is fixed at module load so better-auth's
 * `baseURL` stays static — `requireMcpAuth` refuses a dynamic base URL.
 */

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Public origin the OAuth issuer, MCP resource, and pages are served from. */
export const AGENT_BASE_URL = trimTrailingSlash(
  process.env.PROTO_AGENT_BASE_URL?.trim() || "http://localhost:8099",
);

/** Where `app/api/auth/[...auth]+api.ts` mounts better-auth. */
export const AUTH_BASE_PATH = "/api/auth";

/** better-auth issuer: `baseURL` + `basePath`, as the JWT plugin computes it. */
export const AUTH_ISSUER = `${AGENT_BASE_URL}${AUTH_BASE_PATH}`;

/** RFC 8707 resource identifier and JWT `aud` for the MCP endpoint. */
export const MCP_RESOURCE = `${AGENT_BASE_URL}/api/mcp`;

export const NOTES_READ = "notes:read";
export const NOTES_WRITE = "notes:write";

/** Login and consent pages the authorize endpoint redirects to (app routes). */
export const LOGIN_PAGE = "/agent-connect/login";
export const CONSENT_PAGE = "/agent-connect/consent";

/** Account `providerId` the session bridge files the app's user ids under. */
export const BRIDGE_PROVIDER_ID = "app-auth";

export function getAgentDatabaseUrl(): string {
  return process.env.PROTO_AGENT_DATABASE_URL?.trim() || "postgres://proto@localhost:54331/proto_agent";
}

export function getAgentAuthSecret(): string {
  const secret = process.env.PROTO_AGENT_AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    // Fail closed: never sign tokens with a default secret.
    throw new Error("PROTO_AGENT_AUTH_SECRET must be set (32+ chars) to run the agent connector");
  }
  return secret;
}

export function isProtoFakeAuth(): boolean {
  return process.env.PROTO_FAKE_AUTH === "1";
}
