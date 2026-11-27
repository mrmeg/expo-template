/**
 * @jest-environment node
 */
import { createServer, request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { LIMITS } from "../../shared/wire";
import { toNodeHandler, type NodeHandlerTarget, type NodeRequestLike } from "../http";


interface Reply {
  status: number;
  headers: IncomingMessage["headers"];
  text: string;
  json(): any;
}

/**
 * A plain `node:http` client: the Jest preset swaps the global `fetch` for
 * a polyfill, which would put a second adapter between the test and the server.
 */
function call(url: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, { method: init.method ?? "GET", headers: init.headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({ status: res.statusCode ?? 0, headers: res.headers, text, json: () => JSON.parse(text) });
      });
    });
    req.on("error", reject);
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}

/** Echoes what the Fetch request looked like, so the adapter's translation is visible. */
const echo: NodeHandlerTarget = {
  basePath: "/analytics",
  async handle(request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/analytics")) return null;
    if (url.pathname === "/analytics/miss") return null;
    const headers = new Headers({ "content-type": "application/json", "x-echo": "1" });
    headers.append("set-cookie", "a=1; Path=/");
    headers.append("set-cookie", "b=2; Path=/");
    return new Response(
      JSON.stringify({
        method: request.method,
        url: request.url,
        body: request.method === "GET" || request.method === "HEAD" ? null : await request.text(),
        contentType: request.headers.get("content-type"),
      }),
      { status: 201, headers },
    );
  },
};

type Middleware = (req: NodeRequestLike, res: ServerResponse, next: (error?: unknown) => void) => void;

/** A tiny Connect-style chain: enough to show `next()` and a body parser running first. */
function listen(middleware: Middleware[]): Promise<{ server: Server; base: string }> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let index = 0;
    const next = (error?: unknown) => {
      if (error) {
        res.statusCode = 599;
        res.end(String(error));
        return;
      }
      const layer = middleware[index++];
      if (!layer) {
        res.statusCode = 418;
        res.end("fell through");
        return;
      }
      layer(req as NodeRequestLike, res, next);
    };
    next();
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

/** Stands in for `express.json()`: consumes the stream and leaves an object on `req.body`. */
const jsonParser: Middleware = (req, _res, next) => {
  if (req.headers["content-type"] !== "application/json") return next();
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    req.body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    next();
  });
};

/** Stands in for Express 4's parsers, which set `{}` on requests they skip. */
const emptyBodyParser: Middleware = (req, _res, next) => {
  req.body = req.body ?? {};
  next();
};

describe("toNodeHandler", () => {
  let server: Server;
  let base: string;

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("reads the raw stream and writes the response back", async () => {
    ({ server, base } = await listen([emptyBodyParser, toNodeHandler(echo)]));
    const response = await call(`${base}/analytics/e?x=1`, {
      method: "POST",
      body: '{"events":[]}',
      headers: { "content-type": "text/plain" },
    });
    expect(response.status).toBe(201);
    expect(response.headers["x-echo"]).toBe("1");
    expect(response.headers["set-cookie"]).toEqual(["a=1; Path=/", "b=2; Path=/"]);
    expect(response.json()).toEqual({
      method: "POST",
      url: `${base}/analytics/e?x=1`,
      body: '{"events":[]}',
      contentType: "text/plain",
    });
  });

  it("re-serializes a body a parser already consumed", async () => {
    ({ server, base } = await listen([jsonParser, toNodeHandler(echo)]));
    const response = await call(`${base}/analytics/e`, {
      method: "POST",
      body: JSON.stringify({ events: [{ name: "a" }] }),
      headers: { "content-type": "application/json" },
    });
    const echoed = response.json();
    expect(JSON.parse(echoed.body)).toEqual({ events: [{ name: "a" }] });
  });

  it("uses a string body as is", async () => {
    const stringParser: Middleware = (req, _res, next) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        req.body = Buffer.concat(chunks).toString("utf8");
        next();
      });
    };
    ({ server, base } = await listen([stringParser, toNodeHandler(echo)]));
    const response = await call(`${base}/analytics/e`, { method: "POST", body: "raw text" });
    expect(response.json().body).toBe("raw text");
  });

  it("calls next() outside the base path without reading the body", async () => {
    const after: Middleware = (req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        res.statusCode = 200;
        res.end(`host got: ${Buffer.concat(chunks).toString("utf8")}`);
      });
    };
    ({ server, base } = await listen([toNodeHandler(echo), after]));
    const response = await call(`${base}/api/other`, { method: "POST", body: "payload" });
    expect(response.text).toBe("host got: payload");
  });

  it("calls next() when handle returns null", async () => {
    ({ server, base } = await listen([toNodeHandler(echo)]));
    const response = await call(`${base}/analytics/miss`);
    expect(response.status).toBe(418);
  });

  it("keeps the full path when mounted on a prefix", async () => {
    const mounted: Middleware = (req, res, next) => {
      // What Express does for `app.use("/analytics", handler)`.
      req.originalUrl = req.url;
      req.url = req.url!.replace(/^\/analytics/, "") || "/";
      toNodeHandler(echo)(req, res, next);
    };
    ({ server, base } = await listen([mounted]));
    const response = await call(`${base}/analytics/e`);
    expect(response.json().url).toBe(`${base}/analytics/e`);
  });

  it("answers 413 past the body cap", async () => {
    ({ server, base } = await listen([toNodeHandler(echo)]));
    const response = await call(`${base}/analytics/e`, { method: "POST", body: "x".repeat(LIMITS.bodyMaxBytes + 1) });
    expect(response.status).toBe(413);
  });

  it("works without next on a bare node:http server", async () => {
    const handler = toNodeHandler(echo);
    server = createServer((req, res) => void handler(req, res));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    expect((await call(`${base}/analytics/e`)).status).toBe(201);
    expect((await call(`${base}/elsewhere`)).status).toBe(404);
  });
});
