---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Stop the Bun server crashing when a compressed response body is cancelled

## Goal

A client that drops a compressed response body must never crash the Bun server. Today a stale hashed chunk request (`/_expo/static/js/web/entry-<old hash>.js` after a deploy) gets the SSR 404 page, which is compressed. The browser drops that body, and the process dies with an uncaught `TypeError: null is not an object` at `server/http/compression.ts:198`. Fix the compressor teardown so it does not rely on `transformer.cancel`. Also answer hashed-path misses with a bare, uncompressed 404 instead of rendering the app's 404 page.

## Context

Verified on `dev` (925429a) with Bun 1.3.14 and Node 26.10.0:

- Request flow, `server/http/createHandler.ts:196-209`. For a `GET`/`HEAD`, `staticFiles.serve` returns null on a miss. The FFmpeg worker URL is checked next. Then `options.expoHandler(...)` renders Expo's `+not-found` page (404, `text/html`), and `compressResponse` pipes it through `createCompressionStream` (`server/http/compression.ts:383`).
- `createCompressionStream`, `server/http/compression.ts:171-237`, wraps a zlib compressor in a `TransformStream`.
  - `start` attaches `compressor.on("data", chunk => controller.enqueue(asBytes(chunk)))` (line 198) and `on("error", e => controller.error(e))` (line 201).
  - Only `transformer.cancel` (lines 231-234) destroys the compressor.
  - `scheduleFlush` (lines 182-191) flushes on a later turn of the event loop, so the compressor can emit `data` after the consumer is gone.
- Bun 1.3.14 never calls `transformer.cancel` when a `TransformStream`'s readable side is cancelled; Node 26 does. In a probe, Bun printed `transformer.cancel called: false` and `enqueue after cancel throws: TypeError TransformStream.readable cannot close or enqueue`. Node printed `true`.
- Crash path:
  1. Bun cancels the response body when the client goes away.
  2. The compressor survives, and its pending flush fires `data`.
  3. `controller.enqueue` throws inside an EventEmitter listener. That is an uncaught exception, and the process exits.
- Reproduced through `Bun.serve` + `createHandler` with the script in Validation. Every run exits 1 with `TypeError: null is not an object` at `server/http/compression.ts:198:20`, the vault's error.
  - Crash conditions: the client aborts right after the headers arrive while the body is a synchronous burst, as SSR is.
  - Reading one chunk and then cancelling against a slow body did not crash, because the compressor was idle at cancel.
  - gzip crashes reliably; br crashes less often.
- I built a prototype in a temp copy, outside the repo. Both halves of the fix below work on their own:
  - The enqueue guard tears down on the first failed enqueue.
  - The readable wrapper tears down on cancel.
  - With both, the repro survives and full bodies still decode.
  - With the guard alone, a br compressor that received cancel after its last output was never destroyed. The wrapper is what makes teardown deterministic.
  - Without teardown in the wrapper's `pull`, an upstream error (for example an SSR render throwing mid-stream) leaves the compressor alive in both runtimes.
  - With the prototype swapped in through `moduleNameMapper`, the existing `compression.test.ts` and `createHandler.test.ts` (85 tests) pass unchanged.
- zlib behavior, the same in Node and Bun:
  - `end()` emits `end` and then `close`.
  - `destroy()` emits only `close`, never `error`.
  - A `write()` after `destroy()` returns false and never emits `drain`. A drain wait or `end()` on a destroyed compressor therefore hangs.
  - A zlib `error` with no listener is itself an uncaught crash.
- Stream classes: the module uses the runtime's `node:stream/web` classes (`StreamReadable`, `StreamTransform`, lines 54-58), because Jest's global stream polyfill is rejected by the runtime's `pipeThrough`. Any new stream must use them too.
- Jest runs these tests in Node (`@jest-environment node`). `jest.spyOn(require("node:zlib"), "createGzip")` cannot work, because Node's zlib exports are non-writable. Tests have to own the compressor through a seam.
- `createCompressionStream` is used only at `compression.ts:383` and is not part of any package. `server/` is app code, so no package version bump is needed.
- Paths and URLs:
  - `isImmutableStaticPath` (`server/http/staticFiles.ts:86-88`) matches `/_expo/static/` and `/assets/`.
  - `FFMPEG_WORKER_URL` is `/_expo/static/js/web/ffmpeg-worker.js` (`server/ffmpegWorker.js:26`). It is served from memory after the static miss, so the bare 404 must come after that check.
- Affected tests and docs:
  - Today the traversal request in `server/http/__tests__/createHandler.test.ts:245-252` reaches the Expo handler (`expect(expoHandler).toHaveBeenCalledTimes(1)`).
  - `docs/server-guide.md` is a source of `llms-full.txt` (`scripts/build-llms-full.mjs:55`). `bun run gen --check`, which is part of `bun run verify`, fails until `bun run docs:llms` regenerates it.
- Baseline: `bunx jest --ci server/http` passes 5 suites, 136 tests.
- Vault quirk: the checkout may carry another thread's uncommitted dependency bumps. Never reset, stash wholesale, or `bun install` over them. This work needs no install.

## Work

1. **`server/http/compression.ts`: teardown that does not depend on `transformer.cancel`.**
   - Move today's body into `export function zlibWebStream(compressor: ZlibCompressor, flushKind: number): ReadableWritablePair<Bytes, Uint8Array>`. Its doc comment should say it is exported so tests can own the compressor.
     - `createCompressionStream(encoding, options)` returns `zlibWebStream(createZlibCompressor(encoding, options), flushKind)`, where `flushKind` is computed as today (lines 176-178). Its return type changes from `TransformStream<Uint8Array, Bytes>` to `ReadableWritablePair<Bytes, Uint8Array>`; line 383 is its only caller.
     - Line 383 stays as it is: `pipeThrough` accepts the pair.
     - Export the `ZlibCompressor` type (line 144, today module-private) so the test can annotate the compressor it passes in.
   - Add a `closed` flag and an idempotent `teardown()`, which sets `closed` and `ended` and then calls `compressor.destroy()`. Teardown must not remove the `data`/`error` listeners.
   - `data` listener: return early if `closed`. Otherwise run `try { controller.enqueue(asBytes(chunk)); } catch { teardown(); }`.
   - `error` listener: return early if `closed`. Otherwise run `try { controller.error(error); } catch { /* readable already gone */ }`, then `teardown()`.
   - `transform`: throw if `closed` or `compressor.destroyed`, so the pipe stops and cancels the upstream. The drain wait settles on `drain`, `error`, or `close` (reject on `close`), and every outcome removes all three listeners.
   - `flush`: reject at once if `closed`. Otherwise settle on `end` (resolve), `error`, or `close` (reject; this is a no-op after a normal `end`).
   - Drop the `cancel` method (lines 231-234), the `& { cancel?: () => void }` intersection on line 195, and the comment on lines 193-194. Node calls that method, so Jest would pass on a teardown path Bun never takes.
   - Wrap the transform's readable side, and return `{ readable, writable: transform.writable }`:
     - `const output = transform.readable.getReader();`
     - `const readable = new StreamReadable<Bytes>({ ... }, { highWaterMark: 0 })`, with these callbacks:
       - `pull(c)`: `await output.read()`. If the read rejects, call `teardown()` and rethrow. On `done`, call `c.close()`; otherwise `c.enqueue(value)`.
       - `cancel(reason)`: `teardown(); return output.cancel(reason);`.
     - Bun calls an underlying source's `cancel` when the client disconnects (verified).
   - Update the doc comments: the module header bullet for `compressResponse` and the comment on `createCompressionStream`. State that a cancelled or failed response destroys the compressor.
2. **`server/http/createHandler.ts`: bare 404 for hashed-path misses.**
   - In `route`, inside `if (isRead)` and after the FFmpeg worker check, add: `if (isImmutableStaticPath(pathname)) return new Response(request.method === "HEAD" ? null : "Not Found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Length": "9", "Cache-Control": "no-store" } });`. Import `isImmutableStaticPath` from `./staticFiles`.
   - Never pass this response through `compressResponse`.
   - Other methods still go to Expo.
   - `no-store` stops a CDN from caching a miss during a rollover between old and new instances.
   - Update the header comment: step 3 now says a `GET`/`HEAD` miss under a hashed path gets this 404.
3. **`server/http/__tests__/compression.test.ts`: new `describe("zlibWebStream")`.**
   - Setup:
     - Build sources from `node:stream/web`'s `ReadableStream`, cast the way `compression.ts:57` does, rather than the global.
     - Pass in your own `createGzip()` and `constants.Z_SYNC_FLUSH`.
   - Test: "cancelling mid-stream destroys the compressor and later output is ignored".
     - The source pulls 20 pieces of about 4 KB of HTML, each after `setTimeout(5)`.
     - Read one chunk, then `await reader.cancel("client went away")`.
     - Expect `compressor.destroyed` to be true.
     - Expect `() => compressor.emit("data", Buffer.from("late"))` not to throw.
     - After about 100 ms, expect the source to have stopped early (fewer than 20 pulls).
   - Test: "output after a normal end is ignored".
     - Write 4000 bytes and close while reading concurrently. With `highWaterMark: 0`, a write that is not being read never resolves.
     - The body gunzips back to the input.
     - A later `compressor.emit("data", …)` does not throw.
   - Test: "an upstream error destroys the compressor".
     - The source enqueues one chunk and then calls `controller.error(new Error("render exploded"))`.
     - Reading rejects with that error, and `compressor.destroyed` is true.
   - Keep every existing test unchanged and passing.
4. **`server/http/__tests__/createHandler.test.ts`.**
   - Traversal test (lines 245-252): change to `expect(expoHandler).not.toHaveBeenCalled()`.
   - Add: a `GET` with `Accept-Encoding: gzip` for a missing `/_expo/static/js/web/entry-<32 hex>.js`, and for `/assets/missing.png`. Each gets 404, no `Content-Encoding`, `Cache-Control: no-store`, body `Not Found`, and `X-Request-ID` present, and the Expo handler is not called.
   - Add: the same missing chunk with `HEAD` gets 404 and an empty body.
   - These existing tests must stay unchanged and green:
     - "serves the 404 page from the Expo handler" (`/missing/page`, gzip);
     - the `POST` test (still goes to Expo);
     - the FFmpeg worker test.
5. **Docs.**
   - `docs/server-guide.md`, request-flow step 3 (about line 115): add the bare `no-store` 404 for `GET`/`HEAD` misses under `/_expo/static/` and `/assets/`.
   - Same file, the "Dynamic responses" bullet (about line 155): say a response the client abandons, or whose upstream fails, destroys its compressor.
   - Run `bun run docs:llms` and commit the regenerated `llms-full.txt` (and `llms-examples.txt` if it changes).

## Validation

- `bunx jest --ci server/http`: all suites pass, including the new tests.
- Real-runtime repro. Save this as `/tmp/compression-cancel-repro.ts`, outside the repo:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { createHandler } = await import(`${process.env.REPO}/server/http/createHandler.ts`);
process.on("uncaughtException", (error) => {
  console.log("UNCAUGHT:", error);
  process.exit(1);
});
const piece = new TextEncoder().encode(`<p>${"not found ".repeat(200)}</p>`);
const handler = createHandler({
  clientDir: mkdtempSync(join(tmpdir(), "client-")),
  log: null,
  // A synchronous burst, like an SSR 404 page.
  expoHandler: async () => {
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (++sent > 40) controller.close();
        else controller.enqueue(piece);
      },
    });
    return new Response(body, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
  },
});
const server = Bun.serve({ port: 0, fetch: handler });
for (const encoding of ["gzip", "br"]) {
  for (let i = 0; i < 50; i += 1) {
    const abort = new AbortController();
    await fetch(`http://localhost:${server.port}/missing/page`, {
      headers: { "Accept-Encoding": encoding },
      signal: abort.signal,
      decompress: false,
    } as RequestInit);
    abort.abort(); // right after the headers, as a browser drops a failed script load
  }
}
await Bun.sleep(1000);
console.log("server survived 100 aborted compressed 404s");
server.stop(true);
```

  - Run it three times from the checkout: `REPO=$(git rev-parse --show-toplevel) bun /tmp/compression-cancel-repro.ts; echo "exit $?"`.
  - Before the fix, it exits 1 with `TypeError: null is not an object` at `compression.ts:198:20`. After the fix, it exits 0 and prints `server survived 100 aborted compressed 404s`.
  - Read `$?` directly. Piping to `head` hides the exit code.
  - Keep the `/missing/page` path: after Work step 2, a `/_expo/static/` path never reaches compression.
- `bun run typecheck`, `bun run lint`, and `bun run gen --check`, then `bun run verify`.
- Live check: run `bun run build` (writes the gitignored `dist/`), then `bun run start` in the background (`PORT=<free port> bun run start` if 3000 is taken; substitute that port below). Stop the server when done.
  - `curl -si -H 'Accept-Encoding: gzip' http://localhost:3000/_expo/static/js/web/entry-00000000000000000000000000000000.js`: 404, `Cache-Control: no-store`, no `Content-Encoding`, body `Not Found`.
  - `curl -s -o /dev/null -w '%{http_code} %header{content-encoding}\n' -H 'Accept-Encoding: br' http://localhost:3000/does-not-exist`: `404 br`, the app's own not-found page.
  - `curl -sI -H 'Accept-Encoding: br' "http://localhost:3000/_expo/static/js/web/$(ls dist/client/_expo/static/js/web | grep -m1 '^entry-.*\.js$')"`: `200` with `Content-Encoding: br`. The short-circuit must not swallow a real hashed file.
  - Load `http://localhost:3000/` in a browser, or the agent's browser tool. The page renders, and the network log shows no 404 for any `/_expo/static/` or `/assets/` request.
  - The server stays up throughout.

## Exclusions

- No Bun upgrade, no change to `compressResponse`'s read-ahead, and no change to `staticFiles.ts` or `scripts/precompress.mjs`.
- No package version bump. No other checkout under `~/Development` has `server/http/compression.ts`.

## Merge plan

One PR from an `agent/*` branch into `dev`. It releases with the next `dev` → `main` PR, and needs no package publish.
