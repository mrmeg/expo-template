/**
 * PROTOTYPE (proto/agent-connector): the better-auth instance that acts as the
 * OAuth 2.1 authorization server for the remote MCP connector.
 *
 * - `mcp()` from `@better-auth/mcp` IS `oauthProvider()` from
 *   `@better-auth/oauth-provider`, configured for MCP: tokens bound to the MCP
 *   resource (RFC 8707 `aud`), RFC 9728 protected-resource metadata, and the
 *   resource linked to every registered client. The docs say not to register
 *   both, so `oauthProvider()` is not added separately.
 * - `jwt()` signs the access tokens (JWT, RFC 9068) and serves `/jwks`.
 * - `cimd()` adds Client ID Metadata Documents.
 * - `agentSessionBridge()` turns an app-authenticated caller into a session.
 *
 * Users keep their app (Cognito) accounts: better-auth stores only a shadow
 * user per external id, the OAuth clients, consents, and tokens.
 */

import { cimd } from "@better-auth/cimd";
import { mcp } from "@better-auth/mcp";
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { Pool } from "pg";

import { fetchClientMetadataResource } from "./cimdTransport";
import {
  AGENT_BASE_URL,
  AUTH_BASE_PATH,
  CONSENT_PAGE,
  getAgentAuthSecret,
  getAgentDatabaseUrl,
  LOGIN_PAGE,
  MCP_RESOURCE,
  NOTES_READ,
  NOTES_WRITE,
} from "./config";
import { agentSessionBridge } from "./sessionBridge";

declare global {
  // One pool per bundle/process, reused across hot reloads in dev.
  var __protoAgentPool: Pool | undefined;
}

export function getAgentPool(): Pool {
  globalThis.__protoAgentPool ??= new Pool({ connectionString: getAgentDatabaseUrl(), max: 5 });
  return globalThis.__protoAgentPool;
}

export const AGENT_SCOPES = ["openid", "profile", "email", "offline_access", NOTES_READ, NOTES_WRITE];

export const auth = betterAuth({
  appName: "Template agent connector (prototype)",
  baseURL: AGENT_BASE_URL,
  basePath: AUTH_BASE_PATH,
  secret: getAgentAuthSecret(),
  database: getAgentPool(),
  trustedOrigins: [AGENT_BASE_URL],
  // The JWT plugin's session-JWT route would sign with the access-token key.
  disabledPaths: ["/token"],
  emailAndPassword: { enabled: false },
  telemetry: { enabled: false },
  plugins: [
    jwt({ disableSettingJwtHeader: true }),
    mcp({
      resource: MCP_RESOURCE,
      loginPage: LOGIN_PAGE,
      consentPage: CONSENT_PAGE,
      scopes: AGENT_SCOPES,
      // DCR is deprecated in MCP 2026-07-28 but most clients still use it.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationDefaultApplicationType: "infer",
      clientRegistrationDefaultScopes: AGENT_SCOPES,
      grantTypes: ["authorization_code", "refresh_token"],
      accessTokenExpiresIn: 3600,
    }),
    cimd({
      fetchClientMetadataResource,
      metadataProfile: "mcp-2026-07-28",
    }),
    agentSessionBridge(),
  ],
});

export type AgentAuth = typeof auth;
