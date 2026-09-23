/**
 * @jest-environment node
 */

/**
 * Unit tests for the Bun server's compression layer: `Accept-Encoding`
 * negotiation, which content types are worth compressing, streamed response
 * compression, and the bounds on the static runtime-compression fallback.
 */

import { brotliDecompressSync, constants, gunzipSync, gzipSync } from "node:zlib";

import {
  compressResponse,
  createStaticCompressor,
  isCompressibleContentType,
  negotiateEncodings,
} from "../compression";

const encoder = new TextEncoder();

function request(acceptEncoding?: string, method = "GET"): Request {
  return new Request("http://localhost/", {
    method,
    headers: acceptEncoding === undefined ? {} : { "Accept-Encoding": acceptEncoding },
  });
}

function jsonBody(bytes: number): string {
  const items: string[] = [];
  let length = 2;
  for (let i = 0; length < bytes; i += 1) {
    const item = JSON.stringify({ id: i, name: `item-${i}`, description: "a compressible repeated description" });
    items.push(item);
    length += item.length + 1;
  }
  return `[${items.join(",")}]`;
}

async function bodyBuffer(response: Response): Promise<Buffer> {
  return Buffer.from(await response.arrayBuffer());
}

describe("negotiateEncodings", () => {
  it.each([
    [null, []],
    ["", []],
    ["identity", []],
    ["gzip", ["gzip"]],
    ["br", ["br"]],
    ["gzip, deflate, br", ["br", "gzip"]],
    ["br;q=0.5, gzip;q=0.9", ["gzip", "br"]],
    ["br;q=0, gzip", ["gzip"]],
    ["gzip;q=0, br;q=0", []],
    ["*", ["br", "gzip"]],
    ["*;q=0.2, gzip", ["gzip", "br"]],
    ["x-gzip", ["gzip"]],
    [" BR ; Q=1 , GZIP;q=0.1", ["br", "gzip"]],
  ])("%p → %p", (header, expected) => {
    expect(negotiateEncodings(header)).toEqual(expected);
  });
});

describe("isCompressibleContentType", () => {
  it.each([
    "text/html",
    "text/html; charset=utf-8",
    "text/css",
    "application/json",
    "application/json;charset=utf-8",
    "application/problem+json",
    "application/manifest+json",
    "application/javascript; charset=utf-8",
    "image/svg+xml",
    "application/wasm",
    "font/ttf",
    "image/x-icon",
  ])("compresses %p", (type) => {
    expect(isCompressibleContentType(type)).toBe(true);
  });

  it.each([null, "", "image/png", "image/webp", "font/woff2", "video/mp4", "application/octet-stream", "text/event-stream"])(
    "leaves %p alone",
    (type) => {
      expect(isCompressibleContentType(type)).toBe(false);
    },
  );
});

describe("compressResponse", () => {
  it("compresses a large JSON body of unknown length for a client that accepts it", async () => {
    const body = jsonBody(8_000);
    const response = await compressResponse(request("gzip, br"), Response.json(JSON.parse(body)));

    expect(response.headers.get("Content-Encoding")).toBe("br");
    expect(response.headers.get("Content-Length")).toBeNull();
    expect(response.headers.get("Vary")).toBe("Accept-Encoding");
    const decoded = brotliDecompressSync(await bodyBuffer(response)).toString();
    expect(JSON.parse(decoded)).toEqual(JSON.parse(body));
  });

  it("sends a small body of unknown length as is, with its exact length", async () => {
    const response = await compressResponse(request("gzip, br"), Response.json({ ok: true }));

    expect(response.headers.get("Content-Encoding")).toBeNull();
    expect(response.headers.get("Content-Length")).toBe(String("{\"ok\":true}".length));
    expect(response.headers.get("Vary")).toBeNull();
    expect(await response.json()).toEqual({ ok: true });
  });

  it("skips bodies whose declared length is under the threshold", async () => {
    const original = new Response("x".repeat(100), {
      headers: { "Content-Type": "text/plain", "Content-Length": "100" },
    });
    expect(await compressResponse(request("gzip"), original)).toBe(original);
  });

  it("compresses a declared-length body at the threshold and drops the stale length", async () => {
    const text = "y".repeat(4_096);
    const response = await compressResponse(
      request("gzip"),
      new Response(text, { headers: { "Content-Type": "text/plain", "Content-Length": "4096", ETag: "\"v1\"" } }),
    );

    expect(response.headers.get("Content-Encoding")).toBe("gzip");
    expect(response.headers.get("Content-Length")).toBeNull();
    expect(response.headers.get("ETag")).toBe("W/\"v1\"");
    expect(gunzipSync(await bodyBuffer(response)).toString()).toBe(text);
  });

  it("leaves already-encoded responses untouched", async () => {
    const encoded = gzipSync(jsonBody(4_000));
    const original = new Response(encoded, {
      headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" },
    });
    const response = await compressResponse(request("br, gzip"), original);

    expect(response).toBe(original);
    expect((await bodyBuffer(response)).equals(encoded)).toBe(true);
  });

  it("respects Cache-Control: no-transform", async () => {
    const original = new Response(jsonBody(4_000), {
      headers: { "Content-Type": "application/json", "Cache-Control": "private, no-transform" },
    });
    expect(await compressResponse(request("br"), original)).toBe(original);
  });

  it("leaves incompressible types, bodiless statuses, and event streams alone", async () => {
    for (const original of [
      new Response(new Uint8Array(4_096), { headers: { "Content-Type": "image/png" } }),
      new Response(null, { status: 204 }),
      new Response("data: 1\n\n".repeat(500), { headers: { "Content-Type": "text/event-stream" } }),
    ]) {
      expect(await compressResponse(request("br"), original)).toBe(original);
    }
  });

  it("varies on Accept-Encoding without encoding when the client accepts nothing or asks for HEAD", async () => {
    for (const incoming of [request(undefined), request("identity"), request("br", "HEAD")]) {
      const response = await compressResponse(
        incoming,
        new Response(jsonBody(4_000), { headers: { "Content-Type": "application/json", Vary: "Origin" } }),
      );
      expect(response.headers.get("Content-Encoding")).toBeNull();
      expect(response.headers.get("Vary")).toBe("Origin, Accept-Encoding");
    }
  });

  it("streams a slow body: a small first chunk followed by a pause still arrives before the end", async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const upstream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });
    controller.enqueue(encoder.encode("<!DOCTYPE html><html><body><main>shell"));

    const response = await compressResponse(
      request("gzip"),
      new Response(upstream, { headers: { "Content-Type": "text/html" } }),
    );
    expect(response.headers.get("Content-Encoding")).toBe("gzip");

    const reader = response.body!.getReader();
    const received: Uint8Array[] = [];
    const decoded = () => gunzipSync(Buffer.concat(received), { finishFlush: constants.Z_SYNC_FLUSH }).toString();
    while (!decoded().includes("shell")) {
      const { value, done } = await reader.read();
      if (done) throw new Error("stream ended before the shell was flushed");
      received.push(value);
    }

    controller.enqueue(encoder.encode("</main></body></html>"));
    controller.close();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      received.push(value);
    }
    expect(gunzipSync(Buffer.concat(received)).toString()).toBe(
      "<!DOCTYPE html><html><body><main>shell</main></body></html>",
    );
  });
});

describe("createStaticCompressor", () => {
  const text = encoder.encode("const value = 'compressible';\n".repeat(200));

  it("compresses once and serves the cached result afterwards", async () => {
    const compressor = createStaticCompressor();
    const load = jest.fn(async () => text);

    const first = await compressor.compress("file:1", text.byteLength, "br", load);
    const second = await compressor.compress("file:1", text.byteLength, "br", load);

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
    expect(Buffer.from(brotliDecompressSync(first!)).equals(Buffer.from(text))).toBe(true);
  });

  it("dedupes concurrent requests for the same file", async () => {
    const compressor = createStaticCompressor();
    const load = jest.fn(async () => text);

    const [a, b] = await Promise.all([
      compressor.compress("file:2", text.byteLength, "gzip", load),
      compressor.compress("file:2", text.byteLength, "gzip", load),
    ]);
    expect(a).toBe(b);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("declines files outside its size bounds without reading them", async () => {
    const compressor = createStaticCompressor({ maxFileBytes: 4_096 });
    const load = jest.fn(async () => text);

    expect(await compressor.compress("big", 4_097, "br", load)).toBeNull();
    expect(await compressor.compress("tiny", 100, "br", load)).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("declines new work at the concurrency cap instead of queueing it", async () => {
    const compressor = createStaticCompressor({ maxConcurrent: 1 });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow = compressor.compress("slow", text.byteLength, "br", async () => {
      await gate;
      return text;
    });

    expect(await compressor.compress("other", text.byteLength, "br", async () => text)).toBeNull();
    release();
    expect(await slow).not.toBeNull();
    expect(compressor.stats.inFlight).toBe(0);
  });

  it("keeps its cache within the byte budget, evicting least recently used entries", async () => {
    const probe = createStaticCompressor();
    const size = (await probe.compress("probe", text.byteLength, "gzip", async () => text))!.byteLength;
    const compressor = createStaticCompressor({ maxCacheBytes: size * 2 });

    for (const key of ["a", "b", "c", "d"]) {
      await compressor.compress(key, text.byteLength, "gzip", async () => text);
      expect(compressor.stats.cachedBytes).toBeLessThanOrEqual(size * 2);
    }
    expect(compressor.stats.cachedEntries).toBe(2);

    const reload = jest.fn(async () => text);
    await compressor.compress("a", text.byteLength, "gzip", reload);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("remembers when compression does not pay off and never serves a larger body", async () => {
    const random = new Uint8Array(4_096).map(() => Math.floor(Math.random() * 256));
    const compressor = createStaticCompressor();
    const load = jest.fn(async () => random);

    expect(await compressor.compress("noise", random.byteLength, "gzip", load)).toBeNull();
    expect(await compressor.compress("noise", random.byteLength, "gzip", load)).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("returns null when the load fails, and frees its slot either way", async () => {
    const compressor = createStaticCompressor({ maxConcurrent: 1 });
    await expect(
      compressor.compress("gone", 2_048, "br", async () => {
        throw new Error("ENOENT");
      }),
    ).resolves.toBeNull();
    await expect(
      compressor.compress("broken", 2_048, "br", () => {
        throw new Error("thrown before any await");
      }),
    ).resolves.toBeNull();

    expect(compressor.stats.inFlight).toBe(0);
    expect(await compressor.compress("fine", text.byteLength, "br", async () => text)).not.toBeNull();
  });
});
