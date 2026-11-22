/**
 * PROTOTYPE: transport for Client ID Metadata Document fetches.
 *
 * `@better-auth/cimd` needs an application-owned fetch that resolves DNS once,
 * refuses special-use addresses, pins the connection and never follows
 * redirects. better-auth ships one for Node (`@better-auth/cimd/node`); the
 * docs say other runtimes, Bun included, must bring their own.
 *
 * With `PROTO_FAKE_AUTH=1` the e2e fixture client below is served in-process
 * (no network), and every other URL is refused. Outside fake mode the Node
 * transport is used as-is (unverified on Bun).
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

const fixtureFetch: ClientMetadataResourceFetch = async (input) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url !== PROTO_CIMD_CLIENT_ID) {
    throw new TypeError(`[proto-agent] CIMD fixture transport refuses ${url}`);
  }
  return new Response(JSON.stringify(fixtureDocument), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "max-age=60" },
  });
};

export const fetchClientMetadataResource: ClientMetadataResourceFetch = (input, init) =>
  isProtoFakeAuth() ? fixtureFetch(input, init) : nodeFetchClientMetadataResource(input, init);
