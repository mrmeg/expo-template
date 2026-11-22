/**
 * PROTOTYPE e2e: a scripted MCP-style client against a running server.
 *
 *   PROTO_FAKE_AUTH=1 on the server, then:
 *   bun scripts/proto-agent-connector-e2e.ts            # E2E_BASE_URL defaults to http://localhost:8099
 *   E2E_DIAG=1 bun scripts/proto-agent-connector-e2e.ts # + idle-timeout / streaming probes (server needs PROTO_MCP_DIAGNOSTICS=1)
 *
 * Prints one PASS/FAIL/INFO line per step and exits non-zero on any FAIL.
 */

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:8099").replace(/\/$/, "");
const MCP_URL = `${BASE}/api/mcp`;
const REDIRECT_A = "http://127.0.0.1:8787/callback";
const REDIRECT_B = "http://127.0.0.1:8789/callback";
const CIMD_CLIENT_ID = "https://cimd-client.proto.test/client-metadata.json";
const CIMD_REDIRECT = "http://127.0.0.1:8788/callback";
const FAKE_USER = `fake:e2e-user-${Date.now()}:e2e-${Date.now()}@example.com`;

type Outcome = "PASS" | "FAIL" | "INFO";
const results: { outcome: Outcome; step: string; detail: string }[] = [];

function record(outcome: Outcome, step: string, detail: string) {
  results.push({ outcome, step, detail });
  console.log(`${outcome.padEnd(4)}  ${step.padEnd(26)}  ${detail}`);
}

function check(step: string, ok: boolean, detail: string) {
  record(ok ? "PASS" : "FAIL", step, detail);
  return ok;
}

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    record("FAIL", name, `threw: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

// ---------------------------------------------------------------- helpers

const jar = new Map<string, string>();
const sessionCookieFlags: string[] = [];

function storeCookies(response: Response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const index = pair!.indexOf("=");
    const name = pair!.slice(0, index).trim();
    const value = pair!.slice(index + 1).trim();
    if (/max-age=0/i.test(raw) || value === "") jar.delete(name);
    else jar.set(name, value);
    if (name.includes("session_token")) sessionCookieFlags.push(`${name}; ${attrs.map((a) => a.trim()).join("; ")}`);
  }
}

function cookieHeader(): string {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function browserFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (jar.size) headers.set("Cookie", cookieHeader());
  if (init.method && init.method !== "GET") headers.set("Origin", BASE);
  const response = await fetch(url, { ...init, headers, redirect: "manual" });
  storeCookies(response);
  return response;
}

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  return { verifier, challenge };
}

function decodeJwt(token: string) {
  const [header, payload] = token.split(".");
  const parse = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  return { header: parse(header!), payload: parse(payload!) };
}

function parseChallenge(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of (header ?? "").matchAll(/(\w+)="([^"]*)"/g)) out[match[1]!] = match[2]!;
  return out;
}

async function tokenRequest(endpoint: string, params: Record<string, string>, extraHeaders: Record<string, string> = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", ...extraHeaders },
    body: new URLSearchParams(params),
  });
  const text = await response.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {}
  return { status: response.status, body };
}

interface HttpTrace {
  method?: string;
  status: number;
  contentType: string | null;
  contentEncoding: string | null;
  wwwAuthenticate: string | null;
}

async function mcpClient(token: string, mode: "modern" | "legacy", traces: HttpTrace[]) {
  const tracingFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(input, { ...init, headers });
    let method: string | undefined;
    try {
      method = JSON.parse(String(init?.body ?? "{}")).method;
    } catch {}
    traces.push({
      method,
      status: response.status,
      contentType: response.headers.get("content-type"),
      contentEncoding: response.headers.get("content-encoding"),
      wwwAuthenticate: response.headers.get("www-authenticate"),
    });
    return response;
  };
  const client = new Client(
    { name: "proto-e2e", version: "0.0.1" },
    mode === "modern" ? { versionNegotiation: { mode: { pin: "2026-07-28" } } } : {},
  );
  await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL), { fetch: tracingFetch }));
  return client;
}

// ---------------------------------------------------------------- flow pieces

interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  revocation_endpoint: string;
  [key: string]: unknown;
}

async function register(as: Discovery, name: string, redirectUri: string) {
  const response = await fetch(as.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: name,
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  return { status: response.status, body: (await response.json()) as any };
}

async function startAuthorize(as: Discovery, clientId: string, redirectUri: string, scope: string, extra: Record<string, string> = {}) {
  const { verifier, challenge } = await pkce();
  const state = b64url(crypto.getRandomValues(new Uint8Array(12)));
  const url = new URL(as.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: MCP_URL,
    ...extra,
  }).toString();
  const response = await browserFetch(url.toString());
  const location = response.headers.get("location");
  return { status: response.status, location: location ? new URL(location, BASE) : null, verifier, state };
}

async function consent(consentUrl: URL, accept: boolean, scope?: string) {
  const response = await browserFetch(`${BASE}/api/auth/oauth2/consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ accept, oauth_query: consentUrl.search.slice(1), ...(scope ? { scope } : {}) }),
  });
  const body = (await response.json().catch(() => null)) as any;
  return { status: response.status, url: body?.url ? new URL(body.url) : null, body };
}

async function exchangeCode(as: Discovery, clientId: string, redirectUri: string, code: string, verifier: string) {
  return tokenRequest(as.token_endpoint, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
    resource: MCP_URL,
  });
}

// ---------------------------------------------------------------- main

async function main() {
  console.log(`# proto-agent-connector e2e against ${BASE}`);

  // 1. Unauthenticated MCP call → 401 + RFC 9728 challenge.
  const challenge = await step("unauthenticated_401", async () => {
    const response = await fetch(MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    const header = response.headers.get("www-authenticate");
    const params = parseChallenge(header);
    check("unauthenticated_401", response.status === 401 && !!params.resource_metadata, `${response.status} WWW-Authenticate: ${header}`);
    return params;
  });
  if (!challenge?.resource_metadata) return;

  // 2. Protected resource metadata (from the challenge, not a hardcoded path).
  const prm = await step("protected_resource_meta", async () => {
    const response = await fetch(challenge.resource_metadata!);
    const body = (await response.json()) as any;
    check(
      "protected_resource_meta",
      response.status === 200 && body.resource === MCP_URL && Array.isArray(body.authorization_servers),
      `${response.status} resource=${body.resource} as=${JSON.stringify(body.authorization_servers)} scopes=${JSON.stringify(body.scopes_supported)}`,
    );
    return body as { authorization_servers: string[] };
  });
  if (!prm) return;

  // 3. Authorization server metadata, RFC 8414 path insertion, issuer check.
  const issuer = prm.authorization_servers[0]!;
  const as = await step("auth_server_meta", async () => {
    const issuerUrl = new URL(issuer);
    const metaUrl = `${issuerUrl.origin}/.well-known/oauth-authorization-server${issuerUrl.pathname.replace(/\/$/, "")}`;
    const response = await fetch(metaUrl);
    const body = (await response.json()) as Discovery;
    check(
      "auth_server_meta",
      response.status === 200 &&
        body.issuer === issuer &&
        (body.code_challenge_methods_supported as string[])?.includes("S256") &&
        body.authorization_response_iss_parameter_supported === true,
      `${response.status} ${metaUrl} issuer=${body.issuer} iss_param=${body.authorization_response_iss_parameter_supported} cimd=${body.client_id_metadata_document_supported} reg=${!!body.registration_endpoint}`,
    );
    return body;
  });
  if (!as) return;

  // 4. Dynamic client registration.
  const clientA = await step("dcr_register", async () => {
    const { status, body } = await register(as, "E2E Client A", REDIRECT_A);
    check("dcr_register", (status === 201 || status === 200) && !!body.client_id, `${status} client_id=${body.client_id} auth=${body.token_endpoint_auth_method} app_type=${body.application_type}`);
    return body.client_id as string;
  });
  if (!clientA) return;

  // 5. Authorize with PKCE S256 + resource → redirected to the login page.
  const authA = await step("authorize_to_login", async () => {
    const result = await startAuthorize(as, clientA, REDIRECT_A, "notes:read notes:write offline_access");
    check(
      "authorize_to_login",
      result.status === 302 && result.location?.pathname === "/agent-connect/login" && !!result.location.searchParams.get("sig"),
      `${result.status} → ${result.location?.pathname} (signed=${!!result.location?.searchParams.get("sig")})`,
    );
    return result;
  });
  if (!authA?.location) return;

  await step("login_page_ssr", async () => {
    // A browser that never finished the app's onboarding gets the root
    // layout's onboarding gate instead of the page.
    const fresh = await (await fetch(authA.location!.toString())).text();
    record("INFO", "login_page_fresh_browser", `no onboarding cookie: onboarding gate rendered=${fresh.includes("onboarding-gate")} page text=${fresh.includes(">Connect an assistant<")}`);
    const response = await fetch(authA.location!.toString(), { headers: { Cookie: "has-seen-onboarding=1" } });
    const html = await response.text();
    const devFallback = html.includes(">Bundling...<");
    check("login_page_ssr", response.status === 200 && html.includes(">Connect an assistant<"), `${response.status} ${html.length}B html (has-seen-onboarding=1)${devFallback ? " — SSR fell back to the dev 'Bundling...' shell" : ""}`);
  });

  // 6. Session bridge (fake app auth) → better-auth session + resume to consent.
  await step("bridge_requires_app_auth", async () => {
    const response = await fetch(`${BASE}/api/auth/agent-bridge/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: BASE },
      body: JSON.stringify({ oauth_query: authA.location!.search.slice(1) }),
    });
    check("bridge_requires_app_auth", response.status === 401, `${response.status} without Authorization`);
  });

  const consentUrlA = await step("bridge_login", async () => {
    const response = await browserFetch(`${BASE}/api/auth/agent-bridge/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${FAKE_USER}` },
      body: JSON.stringify({ oauth_query: authA.location!.search.slice(1) }),
    });
    const body = (await response.json()) as any;
    const url = body?.url ? new URL(body.url, BASE) : null;
    check(
      "bridge_login",
      response.status === 200 && url?.pathname === "/agent-connect/consent" && [...jar.keys()].some((k) => k.includes("session_token")),
      `${response.status} → ${url?.pathname} cookies=[${[...jar.keys()].join(",")}]`,
    );
    record("INFO", "session_cookie_flags", sessionCookieFlags.at(-1) ?? "none");
    return url;
  });
  if (!consentUrlA) return;

  // 7. What the consent page receives.
  await step("consent_info", async () => {
    const response = await browserFetch(`${BASE}/api/auth/agent-connect/consent-info${consentUrlA.search}`);
    const body = (await response.json()) as any;
    check(
      "consent_info",
      response.status === 200 && body.client?.client_name === "E2E Client A" && body.scopes?.includes("notes:write") && body.redirectUri === REDIRECT_A,
      `${response.status} name=${body.client?.client_name} scopes=${JSON.stringify(body.scopes)} redirect=${body.redirectUri} resource=${JSON.stringify(body.resource)}`,
    );
  });

  await step("consent_page_ssr", async () => {
    const response = await fetch(consentUrlA.toString(), { headers: { Cookie: `${cookieHeader()}; has-seen-onboarding=1` } });
    const html = await response.text();
    check("consent_page_ssr", response.status === 200 && html.includes(">Loading…<"), `${response.status} ${html.length}B html (client fetches consent-info after hydration)${html.includes(">Bundling...<") ? " — SSR fell back to the dev 'Bundling...' shell" : ""}`);
  });

  // 8. Approve → code + state + iss on the redirect URI.
  const codeA = await step("consent_approve", async () => {
    const result = await consent(consentUrlA, true);
    const url = result.url;
    check(
      "consent_approve",
      result.status === 200 && url?.origin + url!.pathname === REDIRECT_A && !!url?.searchParams.get("code") &&
        url?.searchParams.get("state") === authA.state && url?.searchParams.get("iss") === issuer,
      `${result.status} → ${url?.origin}${url?.pathname} code=${!!url?.searchParams.get("code")} state_ok=${url?.searchParams.get("state") === authA.state} iss=${url?.searchParams.get("iss")}`,
    );
    return url?.searchParams.get("code") ?? undefined;
  });
  if (!codeA) return;

  // 9. Code exchange → JWT access token bound to the MCP resource.
  const tokensA = await step("token_exchange", async () => {
    const { status, body } = await exchangeCode(as, clientA, REDIRECT_A, codeA, authA.verifier);
    const jwt = body.access_token ? decodeJwt(body.access_token) : null;
    check(
      "token_exchange",
      status === 200 && !!body.refresh_token && jwt?.payload.aud === MCP_URL && jwt?.payload.iss === issuer,
      `${status} typ=${jwt?.header.typ} alg=${jwt?.header.alg} aud=${JSON.stringify(jwt?.payload.aud)} iss=${jwt?.payload.iss} scope="${jwt?.payload.scope}" exp_in=${jwt ? jwt.payload.exp - Math.floor(Date.now() / 1000) : "?"}s refresh=${!!body.refresh_token}`,
    );
    return body as { access_token: string; refresh_token: string };
  });
  if (!tokensA) return;

  await step("bad_signature_401", async () => {
    const [h, p, sig] = tokensA.access_token.split(".");
    const payload = JSON.parse(Buffer.from(p!, "base64url").toString("utf8"));
    const tamperedAud = [h, Buffer.from(JSON.stringify({ ...payload, aud: `${BASE}/api/other` })).toString("base64url"), sig].join(".");
    const outcomes: string[] = [];
    for (const [label, token] of [["garbage", "not-a-jwt"], ["tampered_payload_sig", tamperedAud]] as const) {
      const response = await fetch(MCP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      outcomes.push(`${label}→${response.status} ${parseChallenge(response.headers.get("www-authenticate")).error ?? "-"}`);
    }
    check("bad_signature_401", outcomes.every((o) => o.includes("→401 invalid_token")), outcomes.join(", "));
  });

  // 10–11. MCP over the modern (2026-07-28) protocol.
  const traces: HttpTrace[] = [];
  const clientMcp = await step("mcp_connect_modern", async () => {
    const client = await mcpClient(tokensA.access_token, "modern", traces);
    check("mcp_connect_modern", true, `instructions="${(client.getInstructions() ?? "").slice(0, 60)}…"`);
    return client;
  });
  if (clientMcp) {
    await step("tools_list", async () => {
      const { tools } = await clientMcp.listTools();
      const summary = tools.map((t) => `${t.name}{title=${t.title},ro=${t.annotations?.readOnlyHint},destr=${t.annotations?.destructiveHint},idem=${t.annotations?.idempotentHint},open=${t.annotations?.openWorldHint},out=${!!t.outputSchema}}`);
      check("tools_list", tools.some((t) => t.name === "list_notes") && tools.some((t) => t.name === "add_note"), summary.join(" "));
    });
    await step("tools_call_add_note", async () => {
      const result: any = await clientMcp.callTool({ name: "add_note", arguments: { text: "e2e note one" } });
      check("tools_call_add_note", !result.isError && result.structuredContent?.note?.text === "e2e note one", JSON.stringify(result.structuredContent));
    });
    await step("tools_call_list_notes", async () => {
      const result: any = await clientMcp.callTool({ name: "list_notes", arguments: {} });
      const notes = result.structuredContent?.notes ?? [];
      check("tools_call_list_notes", !result.isError && notes.some((n: any) => n.text === "e2e note one"), `${notes.length} note(s)`);
    });
    const shapes = [...new Set(traces.map((t) => `${t.method}:${t.status}:${t.contentType}:${t.contentEncoding ?? "identity"}`))];
    record("INFO", "mcp_response_shapes", shapes.join(" | "));
    await clientMcp.close();
  }

  // Legacy (2025-era initialize) client against the same endpoint.
  await step("mcp_legacy_client", async () => {
    const legacyTraces: HttpTrace[] = [];
    const client = await mcpClient(tokensA.access_token, "legacy", legacyTraces);
    const { tools } = await client.listTools();
    check("mcp_legacy_client", tools.length >= 2, `${tools.length} tools; ${[...new Set(legacyTraces.map((t) => `${t.method}:${t.status}:${t.contentType}`))].join(" | ")}`);
    await client.close();
  });

  // 12. Refresh: rotation.
  const refreshedA = await step("refresh_rotation", async () => {
    const { status, body } = await tokenRequest(as.token_endpoint, {
      grant_type: "refresh_token",
      refresh_token: tokensA.refresh_token,
      client_id: clientA,
      resource: MCP_URL,
    });
    const rotated = !!body.refresh_token && body.refresh_token !== tokensA.refresh_token;
    check("refresh_rotation", status === 200 && rotated && !!body.access_token, `${status} new_refresh=${rotated} new_access=${body.access_token !== tokensA.access_token}`);
    return body as { access_token: string; refresh_token: string };
  });
  if (refreshedA) {
    await step("refresh_old_token_replay", async () => {
      const { status, body } = await tokenRequest(as.token_endpoint, {
        grant_type: "refresh_token",
        refresh_token: tokensA.refresh_token,
        client_id: clientA,
        resource: MCP_URL,
      });
      record("INFO", "refresh_old_token_replay", `${status} ${status === 200 ? `same_rotated_token=${body.refresh_token === refreshedA.refresh_token} (30 s reuse window)` : JSON.stringify(body)}`);
    });
  }

  // 13. Second client granted only notes:read → add_note refused.
  const grantB = await step("read_only_client", async () => {
    const reg = await register(as, "E2E Client B (read only)", REDIRECT_B);
    const clientB = reg.body.client_id as string;
    const auth = await startAuthorize(as, clientB, REDIRECT_B, "notes:read notes:write offline_access");
    if (auth.location?.pathname !== "/agent-connect/consent") {
      record("FAIL", "read_only_client", `authorize with session went to ${auth.status} ${auth.location}`);
      return;
    }
    // The user approves only part of the request on the consent page.
    const approved = await consent(auth.location, true, "notes:read offline_access");
    const code = approved.url?.searchParams.get("code");
    const { status, body } = await exchangeCode(as, clientB, REDIRECT_B, code ?? "", auth.verifier);
    const scope = body.access_token ? decodeJwt(body.access_token).payload.scope : undefined;
    const bTraces: HttpTrace[] = [];
    const client = await mcpClient(body.access_token, "modern", bTraces);
    const listed: any = await client.callTool({ name: "list_notes", arguments: {} });
    let addError = "";
    try {
      const added: any = await client.callTool({ name: "add_note", arguments: { text: "should not save" } });
      addError = added.isError ? `isError: ${JSON.stringify(added.content)}` : "SUCCEEDED (unexpected)";
    } catch (error) {
      addError = error instanceof Error ? error.message : String(error);
    }
    const last = bTraces.at(-1);
    await client.close().catch(() => {});
    check(
      "read_only_client",
      status === 200 && scope === "notes:read offline_access" && !listed.isError && last?.status === 403 && /insufficient_scope/.test(last.wwwAuthenticate ?? ""),
      `token scope="${scope}" list_notes ok=${!listed.isError}; add_note → HTTP ${last?.status} WWW-Authenticate: ${last?.wwwAuthenticate} (${addError.slice(0, 80)})`,
    );
    return { clientId: clientB, refreshToken: body.refresh_token as string, accessToken: body.access_token as string };
  });

  // 14. Deny → OAuth error at the redirect URI.
  await step("consent_deny", async () => {
    const auth = await startAuthorize(as, clientA, REDIRECT_A, "notes:read", { prompt: "consent" });
    if (auth.location?.pathname !== "/agent-connect/consent") {
      record("FAIL", "consent_deny", `prompt=consent went to ${auth.status} ${auth.location}`);
      return;
    }
    const denied = await consent(auth.location, false);
    const url = denied.url;
    check(
      "consent_deny",
      url?.origin + url!.pathname === REDIRECT_A && url?.searchParams.get("error") === "access_denied" && url?.searchParams.get("state") === auth.state && url?.searchParams.get("iss") === issuer,
      `→ ${url?.origin}${url?.pathname}?error=${url?.searchParams.get("error")} state_ok=${url?.searchParams.get("state") === auth.state} iss=${url?.searchParams.get("iss")}`,
    );
  });

  // 15. List the user's connections (consents) and revoke client A's.
  const consents = await step("list_consents", async () => {
    const response = await browserFetch(`${BASE}/api/auth/oauth2/get-consents`, { headers: { Accept: "application/json" } });
    const body = (await response.json()) as any[];
    check(
      "list_consents",
      response.status === 200 && Array.isArray(body) && body.some((c) => c.clientId === clientA),
      `${response.status} ${body.length} consent(s): ${body.map((c) => `${c.clientId.slice(0, 8)}…[${(c.scopes ?? []).join(" ")}]`).join(", ")} keys=${Object.keys(body[0] ?? {}).join(",")}`,
    );
    return body;
  });
  const consentA = consents?.find((c) => c.clientId === clientA);
  if (consentA && refreshedA) {
    await step("revoke_consent", async () => {
      const response = await browserFetch(`${BASE}/api/auth/oauth2/delete-consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id: consentA.id }),
      });
      check("revoke_consent", response.status === 200, `${response.status} ${await response.text()}`);
    });

    await step("refresh_after_delete_consent", async () => {
      const { status, body } = await tokenRequest(as.token_endpoint, {
        grant_type: "refresh_token",
        refresh_token: refreshedA.refresh_token,
        client_id: clientA,
        resource: MCP_URL,
      });
      const ok = status === 400 && body.error === "invalid_grant";
      check("refresh_after_delete_consent", ok, `expected invalid_grant, got ${status} ${ok ? body.error : `(new refresh_token=${!!body.refresh_token})`}`);
      if (!ok && body.refresh_token) {
        // delete-consent did not end the grant; RFC 7009 revocation by the client itself.
        const newest = body.refresh_token as string;
        const revoke = await tokenRequest(as.revocation_endpoint, { token: newest, token_type_hint: "refresh_token", client_id: clientA });
        const after = await tokenRequest(as.token_endpoint, { grant_type: "refresh_token", refresh_token: newest, client_id: clientA, resource: MCP_URL });
        check(
          "rfc7009_revoke_refresh",
          after.status === 400 && after.body.error === "invalid_grant",
          `client calls /oauth2/revoke → ${revoke.status}; refresh after → ${after.status} ${after.body.error}`,
        );
      }
    });

    await step("revoked_access_token", async () => {
      const t: HttpTrace[] = [];
      try {
        const client = await mcpClient(refreshedA.access_token, "modern", t);
        const result: any = await client.callTool({ name: "list_notes", arguments: {} });
        record("INFO", "revoked_access_token", `already-issued JWT still works after revocation: list_notes isError=${!!result.isError} (exp in ${decodeJwt(refreshedA.access_token).payload.exp - Math.floor(Date.now() / 1000)} s)`);
        await client.close();
      } catch (error) {
        record("INFO", "revoked_access_token", `already-issued JWT refused after revocation: HTTP ${t.at(-1)?.status} ${error instanceof Error ? error.message.slice(0, 80) : ""}`);
      }
    });
  }

  // User-initiated disconnect (app-owned endpoint; see sessionBridge.ts) for client B.
  if (grantB?.refreshToken) {
    await step("user_disconnect", async () => {
      // Rotate once first, so both the current and the just-rotated token are checked.
      const rotated = await tokenRequest(as.token_endpoint, {
        grant_type: "refresh_token",
        refresh_token: grantB.refreshToken,
        client_id: grantB.clientId,
        resource: MCP_URL,
      });
      const current = rotated.body.refresh_token as string;
      const response = await browserFetch(`${BASE}/api/auth/agent-bridge/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ clientId: grantB.clientId }),
      });
      const counts = await response.text();
      const refreshWith = (token: string) =>
        tokenRequest(as.token_endpoint, { grant_type: "refresh_token", refresh_token: token, client_id: grantB.clientId, resource: MCP_URL });
      const after = await refreshWith(current);
      const replay = await refreshWith(grantB.refreshToken);
      const consentsAfter = (await (await browserFetch(`${BASE}/api/auth/oauth2/get-consents`, { headers: { Accept: "application/json" } })).json()) as any[];
      check(
        "user_disconnect",
        response.status === 200 && after.status === 400 && after.body.error === "invalid_grant" &&
          replay.status === 400 && replay.body.error === "invalid_grant" && !consentsAfter.some((c) => c.clientId === grantB.clientId),
        `${response.status} ${counts}; refresh(current) → ${after.status} ${after.body.error}; refresh(just-rotated, inside 30 s window) → ${replay.status} ${replay.body.error ?? "(tokens issued)"}; consent gone=${!consentsAfter.some((c) => c.clientId === grantB.clientId)}`,
      );
      const t: HttpTrace[] = [];
      try {
        const client = await mcpClient(grantB.accessToken, "modern", t);
        const result: any = await client.callTool({ name: "list_notes", arguments: {} });
        record("INFO", "disconnected_access_token", `JWT issued before disconnect: list_notes isError=${!!result.isError} (verified locally until exp)`);
        await client.close();
      } catch (error) {
        record("INFO", "disconnected_access_token", `JWT issued before disconnect refused: HTTP ${t.at(-1)?.status}`);
      }
    });
  }

  // 16. Client ID Metadata Document client (fixture served in-process by the server).
  await step("cimd_client", async () => {
    const auth = await startAuthorize(as, CIMD_CLIENT_ID, CIMD_REDIRECT, "openid notes:read offline_access");
    if (auth.location?.pathname !== "/agent-connect/consent") {
      record("FAIL", "cimd_client", `authorize went to ${auth.status} ${auth.location}`);
      return;
    }
    const info = await browserFetch(`${BASE}/api/auth/agent-connect/consent-info${auth.location.search}`);
    const infoBody = (await info.json()) as any;
    const approved = await consent(auth.location, true);
    const code = approved.url?.searchParams.get("code") ?? "";
    const { status, body } = await exchangeCode(as, CIMD_CLIENT_ID, CIMD_REDIRECT, code, auth.verifier);
    let tools = 0;
    if (body.access_token) {
      const client = await mcpClient(body.access_token, "modern", []);
      tools = (await client.listTools()).tools.length;
      await client.close();
    }
    check(
      "cimd_client",
      status === 200 && tools >= 2,
      `consent shows name="${infoBody.client?.client_name}" id_host=${infoBody.client?.client_id_host}; token ${status}; tools=${tools}`,
    );

    // Live audience check: the ID token is signed by the same key, iss is the
    // same, but aud is the client_id — the MCP endpoint must refuse it.
    if (body.id_token) {
      const response = await fetch(MCP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${body.id_token}` },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      const err = parseChallenge(response.headers.get("www-authenticate"));
      check(
        "id_token_as_bearer_401",
        response.status === 401 && err.error === "invalid_token",
        `id_token (aud=${JSON.stringify(decodeJwt(body.id_token).payload.aud).slice(0, 60)}, same key/iss) → ${response.status} ${err.error} "${err.error_description ?? ""}"`,
      );
    } else {
      record("FAIL", "id_token_as_bearer_401", "no id_token returned for scope openid");
    }
  });

  await step("cimd_local_urls", async () => {
    const outcomes: string[] = [];
    for (const clientId of ["http://localhost:8099/cimd.json", "https://localhost:8443/cimd.json", "https://127.0.0.1/cimd.json"]) {
      const { challenge } = await pkce();
      const url = new URL(as.authorization_endpoint);
      url.search = new URLSearchParams({
        response_type: "code", client_id: clientId, redirect_uri: CIMD_REDIRECT, scope: "notes:read", state: "s",
        code_challenge: challenge, code_challenge_method: "S256", resource: MCP_URL,
      }).toString();
      const response = await browserFetch(url.toString());
      const location = response.headers.get("location");
      const detail = location
        ? new URL(location, BASE).searchParams.get("error_description") ?? location
        : (await response.text()).slice(0, 140);
      outcomes.push(`${clientId} → ${response.status} ${detail}`);
    }
    record("INFO", "cimd_local_urls", outcomes.join(" | "));
  });

  // 17. Wrapper interference probes.
  await step("cross_origin_token_post", async () => {
    const result = await tokenRequest(
      as.token_endpoint,
      { grant_type: "authorization_code", code: "bogus", redirect_uri: REDIRECT_A, client_id: clientA, code_verifier: "x".repeat(43) },
      { Origin: "https://evil.example" },
    );
    record("INFO", "cross_origin_token_post", `Origin: https://evil.example, form body → ${result.status} ${JSON.stringify(result.body).slice(0, 100)}`);
  });

  await step("well_known_headers", async () => {
    const response = await fetch(`${BASE}/.well-known/oauth-protected-resource/api/mcp`, { headers: { Origin: "https://claude.ai" } });
    record("INFO", "well_known_headers", `ACAO=${response.headers.get("access-control-allow-origin")} XFO=${response.headers.get("x-frame-options")} cache=${response.headers.get("cache-control")}`);
  });

  // 18. Optional: idle timeout and streaming.
  if (process.env.E2E_DIAG === "1" && refreshedA) {
    const fresh = await step("diag_token", async () => {
      const reg = await register(as, "E2E Diag", REDIRECT_A);
      const auth = await startAuthorize(as, reg.body.client_id, REDIRECT_A, "notes:read");
      const approved = await consent(auth.location!, true);
      const { body } = await exchangeCode(as, reg.body.client_id, REDIRECT_A, approved.url!.searchParams.get("code")!, auth.verifier);
      return body.access_token as string;
    });
    if (fresh) {
      for (const progress of [false, true]) {
        const seconds = Number(process.env.E2E_DIAG_SECONDS ?? 12);
        const name = `diag_wait_${seconds}s_${progress ? "sse" : "json"}`;
        await step(name, async () => {
          const t: HttpTrace[] = [];
          const client = await mcpClient(fresh, "modern", t);
          const started = Date.now();
          const events: number[] = [];
          const result: any = await client.callTool(
            { name: "proto_wait", arguments: { seconds, progress } },
            progress ? { onprogress: () => events.push(Date.now() - started), resetTimeoutOnProgress: true, timeout: 90_000 } : { timeout: 90_000 },
          );
          const last = t.at(-1);
          check(
            name,
            !result.isError && result.structuredContent?.waitedMs >= seconds * 1000 - 100,
            `${Date.now() - started} ms, ${last?.contentType}, encoding=${last?.contentEncoding ?? "identity"}, progress at [${events.map((ms) => (ms / 1000).toFixed(1)).join(",")}] s`,
          );
          await client.close();
        });
      }
    }
  }
}

await main().catch((error) => record("FAIL", "e2e", `uncaught: ${error instanceof Error ? error.stack : String(error)}`));
const failed = results.filter((r) => r.outcome === "FAIL").length;
console.log(`# ${results.filter((r) => r.outcome === "PASS").length} passed, ${failed} failed, ${results.filter((r) => r.outcome === "INFO").length} info`);
process.exit(failed ? 1 : 0);
