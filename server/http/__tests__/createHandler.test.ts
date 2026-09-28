/**
 * @jest-environment node
 */

/**
 * End-to-end tests for the production request handler behind `server.bun.ts`,
 * run against a fixture `dist/client` (precompressed by the real
 * `scripts/precompress.mjs`) and a fake Expo Server handler.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { brotliDecompressSync, constants, gunzipSync, gzipSync } from "node:zlib";

import { GET as templateStatus } from "@/app/api/template/status+api";
import { createHandler, type CreateHandlerOptions, type PeerInfo } from "../createHandler";
import type { RateLimitRules } from "../rateLimit";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const ALLOWED_ORIGIN = "https://app.example.com";

const ENTRY = "/_expo/static/js/web/entry-0f1e2d3c4b5a69788796a5b4c3d2e1f0.js";
const STYLES = "/_expo/static/css/app-aabbccddeeff00112233445566778899.css";
const LAZY = "/_expo/static/js/web/lazy-00112233445566778899aabbccddeeff.js";
const TINY = "/_expo/static/js/web/tiny-ffeeddccbbaa99887766554433221100.js";
const LOGO = "/assets/assets/images/logo.4e3f888fc8475f69fd5fa32f1ad5216a.png";
const ROBOTS = "/robots.txt";

const encoder = new TextEncoder();

function jsSource(label: string, bytes: number): string {
  let source = "";
  for (let i = 0; source.length < bytes; i += 1) {
    source += `function ${label}${i}(value){return value*${i}+${label.length};}\n`;
  }
  return source;
}

const LARGE_JSON = {
  items: Array.from({ length: 200 }, (_, id) => ({ id, label: `item ${id}`, tags: ["alpha", "beta"] })),
};

let clientDir: string;

function writeFixture(urlPath: string, contents: string | Uint8Array): void {
  const filePath = path.join(clientDir, urlPath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function fixtureSize(urlPath: string): number {
  return statSync(path.join(clientDir, urlPath)).size;
}

beforeAll(() => {
  clientDir = mkdtempSync(path.join(tmpdir(), "create-handler-"));
  writeFixture(ENTRY, jsSource("entry", 64 * 1024));
  writeFixture(STYLES, ".card{padding:8px;margin:0}\n".repeat(400));
  writeFixture(TINY, "console.log(1);\n");
  writeFixture(LOGO, new Uint8Array(4_096).map((_, i) => (i * 7919) % 251));
  writeFixture(ROBOTS, "User-agent: *\nDisallow: /private\n".repeat(100));
  execFileSync(process.execPath, [path.join(REPO_ROOT, "scripts/precompress.mjs"), clientDir], {
    stdio: "pipe",
  });
  // Written after the build step, so it has no siblings: the runtime fallback's case.
  writeFixture(LAZY, jsSource("lazy", 32 * 1024));
});

afterAll(() => {
  rmSync(clientDir, { recursive: true, force: true });
});

function fakeExpoHandler(request: Request): Response | Promise<Response> {
  const { pathname } = new URL(request.url);
  switch (pathname) {
  case "/_expo/loaders/server-alpha":
    return Response.json(LARGE_JSON, { headers: { "Cache-Control": "no-store" } });
  case "/api/template/status":
    return templateStatus(request);
  case "/api/template/examples":
    return Response.json(LARGE_JSON, { headers: { "Cache-Control": "no-store" } });
  case "/api/encoded":
    return new Response(gzipSync(JSON.stringify(LARGE_JSON)), {
      headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" },
    });
  case "/api/explode":
    throw new Error("route exploded");
  default:
    return new Response(`<!DOCTYPE html><title>Not found</title>${"<p>missing</p>".repeat(200)}`, {
      status: 404,
      headers: { "Content-Type": "text/html" },
    });
  }
}

const TEST_RULES: RateLimitRules = {
  GENERAL_LIMIT: { windowMs: 60_000, max: 3 },
  MEDIA_SIGNER_LIMIT: { windowMs: 60_000, max: 2 },
  MEDIA_SIGNER_LIMIT_PATHS: ["/api/media/getUploadUrl"],
  STRICT_LIMIT: { windowMs: 60_000, max: 1 },
  STRICT_LIMIT_PATHS: ["/api/billing/checkout-session"],
  MAX_BUCKETS_PER_LIMITER: 3,
};

function build(overrides: Partial<CreateHandlerOptions> = {}) {
  const expoHandler = jest.fn(fakeExpoHandler);
  const logError = jest.fn();
  const handler = createHandler({
    clientDir,
    expoHandler,
    env: { ALLOWED_ORIGINS: ALLOWED_ORIGIN },
    log: null,
    logError,
    requestId: () => "test-request-id",
    ...overrides,
  });
  return { handler, expoHandler, logError };
}

function peer(address: string): PeerInfo {
  return { requestIP: () => ({ address }) };
}

function get(urlPath: string, headers: Record<string, string> = {}, method = "GET"): Request {
  return new Request(`http://localhost${urlPath}`, { method, headers });
}

async function bodyBuffer(response: Response): Promise<Buffer> {
  return Buffer.from(await response.arrayBuffer());
}

function decode(buffer: Buffer, encoding: string | null): string {
  if (encoding === "br") return brotliDecompressSync(buffer).toString();
  if (encoding === "gzip") return gunzipSync(buffer).toString();
  return buffer.toString();
}

describe("static files", () => {
  it("caches hashed assets as immutable and everything else for an hour", async () => {
    const { handler } = build();

    const entry = await handler(get(ENTRY), peer("203.0.113.1"));
    expect(entry.status).toBe(200);
    expect(entry.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(entry.headers.get("Content-Type")).toBe("application/javascript; charset=utf-8");
    expect(entry.headers.get("Last-Modified")).toBeTruthy();

    const logo = await handler(get(LOGO), peer("203.0.113.1"));
    expect(logo.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(logo.headers.get("Content-Type")).toBe("image/png");

    const robots = await handler(get(ROBOTS), peer("203.0.113.1"));
    expect(robots.headers.get("Cache-Control")).toBe("public, max-age=3600");
  });

  it("serves the build-time brotli sibling to a brotli client", async () => {
    const { handler, expoHandler } = build();
    const response = await handler(get(ENTRY, { "Accept-Encoding": "gzip, deflate, br" }), peer("203.0.113.1"));

    expect(response.headers.get("Content-Encoding")).toBe("br");
    expect(response.headers.get("Content-Length")).toBe(String(fixtureSize(`${ENTRY}.br`)));
    expect(response.headers.get("Vary")).toBe("Accept-Encoding");
    expect(response.headers.get("Content-Type")).toBe("application/javascript; charset=utf-8");
    expect(decode(await bodyBuffer(response), "br")).toBe(jsSource("entry", 64 * 1024));
    expect(expoHandler).not.toHaveBeenCalled();
  });

  it("serves the gzip sibling when brotli is not acceptable", async () => {
    const { handler } = build();
    for (const acceptEncoding of ["gzip", "br;q=0, gzip", "gzip;q=1, br;q=0.5"]) {
      const response = await handler(get(STYLES, { "Accept-Encoding": acceptEncoding }), peer("203.0.113.1"));
      expect(response.headers.get("Content-Encoding")).toBe("gzip");
      expect(response.headers.get("Content-Length")).toBe(String(fixtureSize(`${STYLES}.gz`)));
      expect(decode(await bodyBuffer(response), "gzip")).toBe(".card{padding:8px;margin:0}\n".repeat(400));
    }
  });

  it("serves the file as is, still varying on Accept-Encoding, to a client that wants no encoding", async () => {
    const { handler } = build();
    const variants: Record<string, string>[] = [{}, { "Accept-Encoding": "identity" }, { "Accept-Encoding": "br;q=0, gzip;q=0" }];
    for (const headers of variants) {
      const response = await handler(get(ENTRY, headers), peer("203.0.113.1"));
      expect(response.headers.get("Content-Encoding")).toBeNull();
      expect(response.headers.get("Content-Length")).toBe(String(fixtureSize(ENTRY)));
      expect(response.headers.get("Vary")).toBe("Accept-Encoding");
      expect((await bodyBuffer(response)).toString()).toBe(jsSource("entry", 64 * 1024));
    }
  });

  it("answers HEAD with the encoded representation's headers and no body", async () => {
    const { handler } = build();
    const response = await handler(get(ENTRY, { "Accept-Encoding": "br" }, "HEAD"), peer("203.0.113.1"));
    expect(response.headers.get("Content-Encoding")).toBe("br");
    expect(response.headers.get("Content-Length")).toBe(String(fixtureSize(`${ENTRY}.br`)));
    expect(response.body).toBeNull();
  });

  it("leaves incompressible and tiny files unencoded and without Vary", async () => {
    const { handler } = build();
    for (const urlPath of [LOGO, TINY]) {
      const response = await handler(get(urlPath, { "Accept-Encoding": "br, gzip" }), peer("203.0.113.1"));
      expect(response.headers.get("Content-Encoding")).toBeNull();
      expect(response.headers.get("Vary")).toBeNull();
      expect(response.headers.get("Content-Length")).toBe(String(fixtureSize(urlPath)));
    }
  });

  it("compresses a file without siblings at runtime, once, with an exact length", async () => {
    const { handler } = build();
    const first = await handler(get(LAZY, { "Accept-Encoding": "br" }), peer("203.0.113.1"));
    const firstBody = await bodyBuffer(first);

    expect(first.headers.get("Content-Encoding")).toBe("br");
    expect(first.headers.get("Content-Length")).toBe(String(firstBody.byteLength));
    expect(first.headers.get("Vary")).toBe("Accept-Encoding");
    expect(decode(firstBody, "br")).toBe(jsSource("lazy", 32 * 1024));

    const second = await handler(get(LAZY, { "Accept-Encoding": "br" }), peer("203.0.113.1"));
    expect((await bodyBuffer(second)).equals(firstBody)).toBe(true);
  });

  it("ignores stray siblings outside the hashed directories", async () => {
    writeFixture(`${ROBOTS}.br`, "not brotli");
    try {
      const { handler } = build();
      const response = await handler(get(ROBOTS, { "Accept-Encoding": "br" }), peer("203.0.113.1"));
      expect(decode(await bodyBuffer(response), response.headers.get("Content-Encoding"))).toBe(
        "User-agent: *\nDisallow: /private\n".repeat(100),
      );
    } finally {
      rmSync(path.join(clientDir, `${ROBOTS}.br`));
    }
  });

  it("serves a file past the runtime bound uncompressed instead of compressing it", async () => {
    const { handler } = build({ staticCompression: { maxFileBytes: 16 * 1024 } });
    const response = await handler(get(LAZY, { "Accept-Encoding": "br" }), peer("203.0.113.1"));
    expect(response.headers.get("Content-Encoding")).toBeNull();
    expect(response.headers.get("Content-Length")).toBe(String(fixtureSize(LAZY)));
    expect(response.headers.get("Vary")).toBe("Accept-Encoding");
  });

  it("rejects undecodable paths and never escapes the client directory", async () => {
    const { handler, expoHandler } = build();
    expect((await handler(get("/%E0%A4%A"), peer("203.0.113.1"))).status).toBe(400);

    const traversal = await handler(get("/_expo/static/..%2F..%2F..%2Fetc%2Fpasswd"), peer("203.0.113.1"));
    expect(traversal.status).toBe(404);
    expect(expoHandler).toHaveBeenCalledTimes(1);
  });

  it("does not serve static files for non-GET methods", async () => {
    const { handler, expoHandler } = build();
    const response = await handler(get(ENTRY, {}, "POST"), peer("203.0.113.1"));
    expect(response.status).toBe(404);
    expect(expoHandler).toHaveBeenCalledTimes(1);
  });

  it("serves the FFmpeg worker from memory with a short cache and runtime compression", async () => {
    const contents = jsSource("worker", 8 * 1024);
    const { handler } = build({ ffmpegWorker: { url: "/_expo/static/js/web/ffmpeg-worker.js", contents } });

    const response = await handler(
      get("/_expo/static/js/web/ffmpeg-worker.js", { "Accept-Encoding": "gzip" }),
      peer("203.0.113.1"),
    );
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(response.headers.get("Content-Encoding")).toBe("gzip");
    expect(decode(await bodyBuffer(response), "gzip")).toBe(contents);
  });
});

describe("dynamic responses", () => {
  it("stream-compresses SSR HTML, delivering the shell before the render finishes", async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const upstream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });
    const shell = `<!DOCTYPE html><html><head>${"<meta name=\"x\" content=\"y\">".repeat(80)}</head><body><main>shell`;
    controller.enqueue(encoder.encode(shell));

    const { handler } = build({
      expoHandler: async () => new Response(upstream, { headers: { "Content-Type": "text/html" } }),
    });
    const response = await handler(get("/", { "Accept-Encoding": "br" }), peer("203.0.113.1"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Encoding")).toBe("br");
    expect(response.headers.get("Content-Length")).toBeNull();
    expect(response.headers.get("Vary")).toBe("Accept-Encoding");

    const reader = response.body!.getReader();
    const received: Uint8Array[] = [];
    const decoded = () =>
      brotliDecompressSync(Buffer.concat(received), {
        finishFlush: constants.BROTLI_OPERATION_FLUSH,
      }).toString();
    const readUntil = async (text: string) => {
      while (!decoded().includes(text)) {
        const { value, done } = await reader.read();
        if (done) throw new Error(`stream ended before "${text}" arrived`);
        received.push(value);
      }
    };

    // The upstream is still open here: only a flushed stream gets this far.
    await readUntil("shell");
    controller.enqueue(encoder.encode("<section>suspended content</section>"));
    await readUntil("suspended content");
    controller.enqueue(encoder.encode("</main></body></html>"));
    controller.close();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      received.push(value);
    }

    expect(brotliDecompressSync(Buffer.concat(received)).toString()).toBe(
      `${shell}<section>suspended content</section></main></body></html>`,
    );
  });

  it("compresses loader JSON and normalizes platform-suffixed loader paths", async () => {
    const { handler, expoHandler } = build();
    const response = await handler(
      get("/_expo/loaders/server-alpha.web", { "Accept-Encoding": "gzip" }),
      peer("203.0.113.1"),
    );

    expect(new URL((expoHandler.mock.calls[0][0] as Request).url).pathname).toBe("/_expo/loaders/server-alpha");
    expect(response.headers.get("Content-Encoding")).toBe("gzip");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.parse(decode(await bodyBuffer(response), "gzip"))).toEqual(LARGE_JSON);
  });

  it("compresses large API JSON but sends small API JSON as is", async () => {
    const { handler } = build();
    const large = await handler(get("/api/template/examples", { "Accept-Encoding": "br" }), peer("203.0.113.1"));
    expect(large.headers.get("Content-Encoding")).toBe("br");
    expect(JSON.parse(decode(await bodyBuffer(large), "br"))).toEqual(LARGE_JSON);

    const small = await handler(get("/api/template/status", { "Accept-Encoding": "br" }), peer("203.0.113.1"));
    const smallBody = await bodyBuffer(small);
    expect(small.headers.get("Content-Encoding")).toBeNull();
    expect(small.headers.get("Content-Length")).toBe(String(smallBody.byteLength));
    expect(JSON.parse(smallBody.toString()).ok).toBe(true);
  });

  it("leaves an already-encoded response alone", async () => {
    const { handler } = build();
    const response = await handler(get("/api/encoded", { "Accept-Encoding": "br" }), peer("203.0.113.1"));
    expect(response.headers.get("Content-Encoding")).toBe("gzip");
    expect(JSON.parse(decode(await bodyBuffer(response), "gzip"))).toEqual(LARGE_JSON);
  });

  it("serves the 404 page from the Expo handler with its status", async () => {
    const { handler } = build();
    const response = await handler(get("/missing/page", { "Accept-Encoding": "gzip" }), peer("203.0.113.1"));
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Encoding")).toBe("gzip");
    expect(decode(await bodyBuffer(response), "gzip")).toContain("<title>Not found</title>");
  });

  it("turns a handler failure into a 500 that still carries security and CORS headers", async () => {
    const { handler, logError } = build();
    const response = await handler(get("/api/explode", { Origin: ALLOWED_ORIGIN }), peer("203.0.113.1"));

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal Server Error");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
    expect(logError).toHaveBeenCalledWith("Bun server request failed:", expect.any(Error));
  });
});

describe("security headers", () => {
  it("sets the security headers and request id on every response, HSTS only in production", async () => {
    const { handler } = build();
    for (const urlPath of [ENTRY, "/api/template/status", "/missing"]) {
      const response = await handler(get(urlPath), peer("203.0.113.1"));
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
      expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
      expect(response.headers.get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");
      expect(response.headers.get("X-Request-ID")).toBe("test-request-id");
      expect(response.headers.get("Strict-Transport-Security")).toBeNull();
    }

    const production = build({ env: { NODE_ENV: "production" } }).handler;
    const response = await production(get(ENTRY), peer("203.0.113.1"));
    expect(response.headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains");
  });
});

describe("CORS", () => {
  it("answers an API preflight from an allowed origin with the shared policy", async () => {
    const { handler, expoHandler } = build();
    const response = await handler(
      get(
        "/api/media/delete",
        {
          Origin: ALLOWED_ORIGIN,
          "Access-Control-Request-Method": "DELETE",
          "Access-Control-Request-Headers": "authorization, content-type",
        },
        "OPTIONS",
      ),
      peer("203.0.113.1"),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, DELETE, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type, Authorization, sentry-trace, baggage",
    );
    expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    expect(response.headers.get("Vary")).toBe("Origin");
    expect(expoHandler).not.toHaveBeenCalled();
  });

  it("grants nothing to a preflight from another origin", async () => {
    const { handler } = build();
    const response = await handler(
      get("/api/template/echo", { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" }, "OPTIONS"),
      peer("203.0.113.1"),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Methods")).toBeNull();
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("does not answer preflights for non-API paths with CORS headers", async () => {
    const { handler } = build();
    const response = await handler(get("/", { Origin: ALLOWED_ORIGIN }, "OPTIONS"), peer("203.0.113.1"));
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("echoes an allowed origin on API responses, merging Vary with the route's own", async () => {
    const { handler } = build();
    const response = await handler(
      get("/api/template/status", { Origin: ALLOWED_ORIGIN }),
      peer("203.0.113.1"),
    );
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("varies API responses on Origin without granting a disallowed or missing origin", async () => {
    const { handler } = build();
    for (const headers of [{ Origin: "https://evil.example" }, {}] as Record<string, string>[]) {
      const response = await handler(get("/api/template/status", headers), peer("203.0.113.1"));
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(response.headers.get("Vary")).toBe("Origin");
    }
  });

  it("keeps pages and static files free of CORS headers", async () => {
    const { handler } = build();
    for (const urlPath of [ENTRY, "/missing"]) {
      const response = await handler(get(urlPath, { Origin: ALLOWED_ORIGIN }), peer("203.0.113.1"));
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(response.headers.get("Vary") ?? "").not.toContain("Origin");
    }
  });

  it("falls back to the local dev origins when ALLOWED_ORIGINS is unset", async () => {
    const { handler } = build({ env: {} });
    const response = await handler(
      get("/api/template/status", { Origin: "http://localhost:8081" }),
      peer("203.0.113.1"),
    );
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:8081");
  });
});

describe("rate limiting", () => {
  it("limits /api per client and answers 429 with rate-limit and CORS headers", async () => {
    const { handler, expoHandler } = build({ rateLimits: TEST_RULES, now: () => 0 });
    for (let i = 0; i < 3; i += 1) {
      expect((await handler(get("/api/template/status"), peer("203.0.113.1"))).status).toBe(200);
    }

    const limited = await handler(get("/api/template/status", { Origin: ALLOWED_ORIGIN }), peer("203.0.113.1"));
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "Too many requests, please try again later" });
    expect(limited.headers.get("RateLimit-Limit")).toBe("3");
    expect(limited.headers.get("RateLimit-Remaining")).toBe("0");
    expect(limited.headers.get("RateLimit-Reset")).toBe("60");
    expect(limited.headers.get("Retry-After")).toBe("60");
    expect(limited.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
    expect(limited.headers.get("X-Request-ID")).toBe("test-request-id");
    expect(expoHandler).toHaveBeenCalledTimes(3);

    // Another client has its own budget.
    expect((await handler(get("/api/template/status"), peer("203.0.113.2"))).status).toBe(200);
  });

  it("stacks the strict limiter on the billing session routes", async () => {
    const { handler } = build({ rateLimits: TEST_RULES, now: () => 0 });
    const checkout = () => handler(get("/api/billing/checkout-session", {}, "POST"), peer("203.0.113.1"));
    expect((await checkout()).status).not.toBe(429);
    expect((await checkout()).status).toBe(429);
    expect((await handler(get("/api/template/status"), peer("203.0.113.1"))).status).toBe(200);
  });

  it("never limits pages, static files, or preflights", async () => {
    const { handler } = build({ rateLimits: TEST_RULES, now: () => 0 });
    for (let i = 0; i < 10; i += 1) {
      expect((await handler(get(ENTRY), peer("203.0.113.1"))).status).toBe(200);
      expect((await handler(get("/missing"), peer("203.0.113.1"))).status).toBe(404);
      expect((await handler(get("/api/template/status", {}, "OPTIONS"), peer("203.0.113.1"))).status).toBe(204);
    }
  });

  it("restores a client's budget once its window passes", async () => {
    let now = 0;
    const { handler } = build({ rateLimits: TEST_RULES, now: () => now });
    for (let i = 0; i < 4; i += 1) await handler(get("/api/template/status"), peer("203.0.113.1"));
    expect((await handler(get("/api/template/status"), peer("203.0.113.1"))).status).toBe(429);

    now = 60_000;
    expect((await handler(get("/api/template/status"), peer("203.0.113.1"))).status).toBe(200);
  });

  it("stays bounded under many addresses by evicting the oldest bucket", async () => {
    const { handler } = build({ rateLimits: TEST_RULES, now: () => 0 });
    for (let i = 0; i < 3; i += 1) await handler(get("/api/template/status"), peer("198.51.100.1"));
    expect((await handler(get("/api/template/status"), peer("198.51.100.1"))).status).toBe(429);

    // Three newer clients fill the three-bucket cap, pushing the first one out.
    for (const address of ["198.51.100.2", "198.51.100.3", "198.51.100.4"]) {
      await handler(get("/api/template/status"), peer(address));
    }
    expect((await handler(get("/api/template/status"), peer("198.51.100.1"))).status).toBe(200);
  });

  it("ignores X-Forwarded-For unless TRUST_PROXY is set", async () => {
    const { handler } = build({ rateLimits: TEST_RULES, now: () => 0 });
    const statuses: number[] = [];
    for (const forwarded of ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4"]) {
      const response = await handler(
        get("/api/template/status", { "X-Forwarded-For": forwarded }),
        peer("10.0.0.2"),
      );
      statuses.push(response.status);
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
  });

  it("keys on the address the trusted proxy appended when TRUST_PROXY=1", async () => {
    const { handler } = build({ rateLimits: TEST_RULES, now: () => 0, env: { TRUST_PROXY: "1" } });
    const hit = (forwarded: string) =>
      handler(get("/api/template/status", { "X-Forwarded-For": forwarded }), peer("10.0.0.2"));

    // Clients behind the same proxy get separate budgets...
    for (const client of ["198.51.100.7", "198.51.100.8", "198.51.100.9"]) {
      expect((await hit(client)).status).toBe(200);
    }
    // ...and a client cannot reset its own by prepending spoofed entries.
    expect((await hit("6.6.6.6, 198.51.100.7")).status).toBe(200);
    expect((await hit("7.7.7.7, 198.51.100.7")).status).toBe(200);
    expect((await hit("8.8.8.8, 198.51.100.7")).status).toBe(429);
  });

  it("walks further left for each extra trusted hop", async () => {
    const { handler } = build({ rateLimits: TEST_RULES, now: () => 0, env: { TRUST_PROXY: "2" } });
    const hit = (forwarded: string) =>
      handler(get("/api/template/status", { "X-Forwarded-For": forwarded }), peer("10.0.0.2"));
    for (let i = 0; i < 3; i += 1) expect((await hit(`198.51.100.7, 172.16.0.${i + 1}`)).status).toBe(200);
    expect((await hit("198.51.100.7, 172.16.0.99")).status).toBe(429);
  });

  it("warns about an invalid TRUST_PROXY and keys on the peer", async () => {
    const { handler, logError } = build({ rateLimits: TEST_RULES, now: () => 0, env: { TRUST_PROXY: "yes" } });
    expect(logError).toHaveBeenCalledWith(expect.stringContaining("Ignoring TRUST_PROXY=\"yes\""));

    const statuses: number[] = [];
    for (const forwarded of ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4"]) {
      statuses.push((await handler(get("/api/template/status", { "X-Forwarded-For": forwarded }), peer("10.0.0.2"))).status);
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
  });
});

describe("access log", () => {
  it("writes one line per request with the resolved client address", async () => {
    const lines: string[] = [];
    const { handler } = build({ log: (line) => lines.push(line), env: { TRUST_PROXY: "1" } });
    await handler(get("/api/template/status?x=1", { "X-Forwarded-For": "198.51.100.7" }), peer("10.0.0.2"));

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^198\.51\.100\.7 - - \[.+\] "GET \/api\/template\/status\?x=1 HTTP\/1\.1" 200 \d+ - [\d.]+ ms$/);
  });
});
