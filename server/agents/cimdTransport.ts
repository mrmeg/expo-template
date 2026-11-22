/**
 * PROTOTYPE: transport for Client ID Metadata Document fetches.
 *
 * `@better-auth/cimd` needs an application-owned fetch that resolves DNS once,
 * refuses special-use addresses, pins the connection and never follows
 * redirects. better-auth ships one built on `node:dns` + `node:https`
 * (`@better-auth/cimd/node`); the docs only promise it for Node, but it runs
 * unchanged on Bun 1.3 (verified against
 * https://claude.ai/oauth/claude-code-client-metadata), so it is the transport
 * for every real client_id URL.
 *
 * With `PROTO_FAKE_AUTH=1` the e2e fixture client id below is served
 * in-process (no network); every other URL still goes to the real transport.
 */

import type { ClientMetadataResourceFetch } from "@better-auth/oauth-provider";
import { fetchClientMetadataResource as nodeFetchClientMetadataResource } from "@better-auth/cimd/node";

import { isProtoFakeAuth } from "./config";

export const PROTO_CIMD_CLIENT_ID = "https://cimd-client.proto.test/client-metadata.json";
export const PROTO_CIMD_REDIRECT_URI = "http://127.0.0.1:8788/callback";

const fixtureDocument = {
  client_id: PROTO_CIMD_CLIENT_ID,
  client_name: "Proto CIMD Client",
  client_uri: "https://cimd-client.proto.test/",
  redirect_uris: [PROTO_CIMD_REDIRECT_URI],
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  token_endpoint_auth_method: "none",
};

function urlOf(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
}

export const fetchClientMetadataResource: ClientMetadataResourceFetch = async (input, init) => {
  if (isProtoFakeAuth() && urlOf(input) === PROTO_CIMD_CLIENT_ID) {
    return new Response(JSON.stringify(fixtureDocument), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "max-age=60" },
    });
  }
  return nodeFetchClientMetadataResource(input, init);
};
