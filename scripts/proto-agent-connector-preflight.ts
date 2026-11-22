/**
 * PROTOTYPE preflight for a live connector test: checks, without signing in,
 * everything an MCP client (Claude) touches before the user's browser does.
 *
 *   PREFLIGHT_BASE_URL=https://<public host> bun scripts/proto-agent-connector-preflight.ts
 *
 * No fake auth: nothing here needs a user. Prints one PASS/FAIL/INFO line per
 * check and exits non-zero on any FAIL.
 */

const BASE = (process.env.PREFLIGHT_BASE_URL ?? "").replace(/\/$/, "");
if (!BASE.startsWith("https://")) {
  console.error("PREFLIGHT_BASE_URL must be the public https origin");
  process.exit(2);
}
const MCP_URL = `${BASE}/api/mcp`;
const CLAUDE_REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const CLAUDE_CODE_CIMD = "https://claude.ai/oauth/claude-code-client-metadata";
const COMMON = { "ngrok-skip-browser-warning": "1", "User-Agent": "proto-agent-connector-preflight/1" };

type Outcome = "PASS" | "FAIL" | "INFO";
const results: Outcome[] = [];
function record(outcome: Outcome, step: string, detail: string) {
  results.push(outcome);
  console.log(`${outcome.padEnd(4)}  ${step.padEnd(28)}  ${detail}`);
}
const check = (step: string, ok: boolean, detail: string) => record(ok ? "PASS" : "FAIL", step, detail);

async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error) {
    record("FAIL", name, `threw: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function http(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, redirect: "manual", headers: { ...COMMON, ...(init.headers as Record<string, string>) } });
}

async function body(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function challenge(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of (header ?? "").matchAll(/(\w+)="([^"]*)"/g)) out[match[1]!] = match[2]!;
  return out;
}

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
async function pkceChallenge() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
}

async function authorize(authEndpoint: string, clientId: string, redirectUri: string) {
  const url = new URL(authEndpoint);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "notes:read notes:write offline_access",
    state: b64url(crypto.getRandomValues(new Uint8Array(9))),
    code_challenge: await pkceChallenge(),
    code_challenge_method: "S256",
    resource: MCP_URL,
  }).toString();
  const response = await http(url.toString());
  const location = response.headers.get("location");
  return { status: response.status, location: location ? new URL(location, BASE) : null };
}

async function preloginName(login: URL): Promise<string | null> {
  const query = login.search.slice(1);
  const response = await http(`${BASE}/api/auth/oauth2/public-client-prelogin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ client_id: login.searchParams.get("client_id"), oauth_query: query }),
  });
  const data = await body(response);
  return response.ok ? (data.client_name ?? null) : `HTTP ${response.status} ${JSON.stringify(data).slice(0, 80)}`;
}

console.log(`# preflight against ${BASE}`);

let resourceMetadataUrl = "";
await step("mcp_unauth_401", async () => {
  const response = await http(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  const header = response.headers.get("www-authenticate");
  resourceMetadataUrl = challenge(header).resource_metadata ?? "";
  check("mcp_unauth_401", response.status === 401 && resourceMetadataUrl.startsWith(`${BASE}/`), `${response.status} WWW-Authenticate: ${header}`);
});

let issuer = "";
await step("protected_resource_meta", async () => {
  for (const url of [resourceMetadataUrl, `${BASE}/.well-known/oauth-protected-resource`]) {
    const response = await http(url);
    const data = await body(response);
    issuer ||= data.authorization_servers?.[0] ?? "";
    check(
      "protected_resource_meta",
      response.status === 200 && data.resource === MCP_URL && String(data.authorization_servers?.[0]).startsWith("https://"),
      `${new URL(url).pathname} → ${response.status} resource=${data.resource} as=${JSON.stringify(data.authorization_servers)} scopes=${JSON.stringify(data.scopes_supported)}`,
    );
  }
});

let as: any = null;
await step("auth_server_meta", async () => {
  const iss = new URL(issuer);
  const path = iss.pathname.replace(/\/$/, "");
  const response = await http(`${iss.origin}/.well-known/oauth-authorization-server${path}`);
  as = await body(response);
  const endpoints = ["authorization_endpoint", "token_endpoint", "registration_endpoint", "revocation_endpoint", "jwks_uri"];
  const httpsEndpoints = endpoints.every((key) => String(as[key]).startsWith(`${BASE}/`));
  check(
    "auth_server_meta",
    response.status === 200 && as.issuer === issuer && issuer.startsWith("https://") && httpsEndpoints &&
      as.code_challenge_methods_supported?.includes("S256") && !!as.registration_endpoint && as.client_id_metadata_document_supported === true,
    `${response.status} issuer=${as.issuer} https_endpoints=${httpsEndpoints} S256=${as.code_challenge_methods_supported?.includes("S256")} registration=${!!as.registration_endpoint} cimd=${as.client_id_metadata_document_supported} iss_param=${as.authorization_response_iss_parameter_supported}`,
  );
  for (const alt of [`${iss.origin}/.well-known/openid-configuration${path}`, `${issuer}/.well-known/openid-configuration`]) {
    const r = await http(alt);
    const d = await body(r);
    check("openid_config_probe", r.status === 200 && d.issuer === issuer, `${new URL(alt).pathname} → ${r.status} issuer_ok=${d.issuer === issuer}`);
  }
});
if (!as) process.exit(1);

let clientId = "";
await step("dcr_claude_redirect", async () => {
  const response = await http(as.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://claude.ai" },
    body: JSON.stringify({
      client_name: "Preflight (Claude-style DCR)",
      redirect_uris: [CLAUDE_REDIRECT],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  const data = await body(response);
  clientId = data.client_id ?? "";
  check("dcr_claude_redirect", response.status === 201 && !!clientId, `${response.status} client_id=${clientId ? "issued" : "none"} redirect=${JSON.stringify(data.redirect_uris)} auth=${data.token_endpoint_auth_method}`);
});

let loginUrl: URL | null = null;
await step("authorize_to_login", async () => {
  const result = await authorize(as.authorization_endpoint, clientId, CLAUDE_REDIRECT);
  loginUrl = result.location;
  check("authorize_to_login", result.status === 302 && result.location?.pathname === "/agent-connect/login", `${result.status} → ${result.location?.origin}${result.location?.pathname}`);
});

await step("login_page_ssr", async () => {
  if (!loginUrl) throw new Error("no login URL");
  const response = await http(loginUrl.toString());
  const html = await response.text();
  check(
    "login_page_ssr",
    response.status === 200 && html.includes(">Connect an assistant<") && !html.includes('data-testid="onboarding-gate"') && !html.includes("PROTO_FAKE_AUTH"),
    `${response.status} login markup=${html.includes(">Connect an assistant<")} onboarding_gate=${html.includes('data-testid="onboarding-gate"')} fake_token_box=${html.includes("PROTO_FAKE_AUTH")}`,
  );
  check("login_prelogin_name", (await preloginName(loginUrl)) === "Preflight (Claude-style DCR)", `client name before sign-in: "${await preloginName(loginUrl)}"`);
});

await step("bridge_rejects_fake_token", async () => {
  // Live config must run the real app verifier: a `fake:` token is not a JWT,
  // so it is refused before any key fetch.
  if (!loginUrl) throw new Error("no login URL");
  const response = await http(`${BASE}/api/auth/agent-bridge/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE, Authorization: "Bearer fake:preflight:preflight@example.com" },
    body: JSON.stringify({ oauth_query: loginUrl.search.slice(1) }),
  });
  const data = await body(response);
  check(
    "bridge_rejects_fake_token",
    response.status === 401 && !response.headers.getSetCookie().some((c) => c.includes("session_token")),
    `${response.status} ${JSON.stringify(data).slice(0, 80)} session_cookie=${response.headers.getSetCookie().some((c) => c.includes("session_token"))}`,
  );
});

await step("cimd_claude_code", async () => {
  const result = await authorize(as.authorization_endpoint, CLAUDE_CODE_CIMD, "http://localhost:33418/callback");
  const name = result.location?.pathname === "/agent-connect/login" ? await preloginName(result.location) : null;
  const err = result.location?.searchParams.get("error_description") ?? result.location?.searchParams.get("error");
  check(
    "cimd_claude_code",
    result.status === 302 && result.location?.pathname === "/agent-connect/login" && name === "Claude Code",
    `${result.status} → ${result.location?.pathname}${err ? ` (${err})` : ""}; client name="${name}"`,
  );
});

await step("cross_origin_posts", async () => {
  const form = { "Content-Type": "application/x-www-form-urlencoded", Origin: "https://claude.ai" };
  const cases: [string, string, Record<string, string>, string][] = [
    ["token", as.token_endpoint, form, new URLSearchParams({ grant_type: "authorization_code", code: "bogus", client_id: clientId, redirect_uri: CLAUDE_REDIRECT, code_verifier: "x".repeat(43) }).toString()],
    ["token+sec-fetch", as.token_endpoint, { ...form, "Sec-Fetch-Site": "cross-site" }, new URLSearchParams({ grant_type: "refresh_token", refresh_token: "bogus", client_id: clientId }).toString()],
    ["revoke", as.revocation_endpoint, { ...form, "Sec-Fetch-Site": "cross-site" }, new URLSearchParams({ token: "bogus", client_id: clientId }).toString()],
  ];
  for (const [label, url, headers, payload] of cases) {
    const response = await http(url, { method: "POST", headers, body: payload });
    const data = await body(response);
    const originBlocked = response.status === 403 && /different origin/i.test(String(data));
    check(`cross_origin_${label}`, !originBlocked && response.status < 500, `${response.status} ${JSON.stringify(data).slice(0, 90)}`);
  }
});

await step("mcp_shapes_401", async () => {
  const shapes: [string, Record<string, string>, unknown][] = [
    [
      "2026-07-28",
      { "Mcp-Protocol-Version": "2026-07-28", "Mcp-Method": "server/discover" },
      { jsonrpc: "2.0", id: 1, method: "server/discover", params: { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" } } },
    ],
    [
      "2025-11-25 initialize",
      {},
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "preflight", version: "0" } } },
    ],
  ];
  for (const [label, headers, payload] of shapes) {
    const response = await http(MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Origin: "https://claude.ai", ...headers },
      body: JSON.stringify(payload),
    });
    check(`mcp_${label.split(" ")[0]}_401`, response.status === 401, `${label} → ${response.status} ${response.headers.get("content-type")}`);
  }
});

await step("cors_preflight_mcp", async () => {
  const response = await http(MCP_URL, {
    method: "OPTIONS",
    headers: {
      Origin: "https://claude.ai",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization, content-type, mcp-protocol-version, mcp-method, mcp-name",
    },
  });
  const allowed = (response.headers.get("access-control-allow-headers") ?? "").toLowerCase();
  const ok = ["authorization", "mcp-protocol-version", "mcp-method", "mcp-name"].every((h) => allowed.includes(h));
  check("cors_preflight_mcp", response.status === 204 && ok, `${response.status} ACAO=${response.headers.get("access-control-allow-origin")} allow-headers=${response.headers.get("access-control-allow-headers")}`);
});

const failed = results.filter((r) => r === "FAIL").length;
console.log(`# ${results.filter((r) => r === "PASS").length} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
