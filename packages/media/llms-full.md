# @mrmeg/expo-media Full Contract

`@mrmeg/expo-media` packages reusable media infrastructure for Expo apps while
leaving product policy in the app.

The package owns contracts, key safety, content-type validation, client API
calls, React Query hook factories, processing helpers, and S3/R2 handler
factories. The app owns auth, environment names, credentials, route mounting,
metadata persistence, UI composition, monitoring, and FFmpeg worker serving.

Use `createMediaConfig()` to define buckets and media types. Media types point
at bucket ids, prefixes, allowed MIME types, upload/read expiry, and optional
max byte limits. Missing values produce `media-disabled`.

Use `createMediaHandlers()` from `/server` only in route/server code. It
accepts `authorize`, `policy`, `events`, and optional CORS helpers. Returned
handlers are Fetch-compatible and map to Expo Router route exports.

Upload signing body:

```ts
{
  mediaType: string;
  contentType: string;
  size?: number;
  customFilename?: string;
  metadata?: unknown;
}
```

The package derives extensions server-side, signs the approved content type,
and rejects keys outside configured prefixes. Custom filenames require policy
approval and are sanitized.

Use `createMediaWorker()` from `/worker` to deploy the same handlers as a
Cloudflare Worker. `createOptions(env)` runs once per `env` object (handlers are
cached in a `WeakMap`) and returns the `createMediaHandlers` options; routing
mirrors the Expo route table under `basePath` (default `/api/media`), with
`404 not-found` for unknown actions and `405 method-not-allowed` for wrong
methods. `createKvTokenAuthorizer(kv)` authorizes static per-app bearer tokens
stored in KV as `token:<token>` → JSON with at least `{ "app": "<name>" }` and
yields `MediaTokenAuth`. KV is typed structurally, so the package never depends
on `@cloudflare/workers-types`.

Use `createMediaClient()` from `/client` with the consuming app's fetcher.
Use `createMediaQueryHooks()` from `/react-query` to get upload, list, signed
URL, single delete, and batch delete hooks.

`upload()` sends `size` and `metadata` with the signing request. When `size` is
omitted it measures the payload, including native file URIs
(`resolveUploadSize()` stats them with `expo-file-system`), so the server's
`maxBytes` check is not web-only. `metadata` passes through untouched to
`policy.canUpload` and `events.onUploadSigned`.

Client defaults are app-owned. A consuming app should keep one media settings
module with default compression preset, optional compression overrides,
processing concurrency, selection limit, thumbnail handling, the shared
content-type allowlist, and named upload policies such as avatar, general image,
and video. The package provides presets and processing helpers; the app decides
which defaults apply to its product.

`processAsset({ asset, allowlist, config?, adapter?, onPhase? })` from
`/processing` is the client pipeline. It identifies the source content type,
applies the upload format policy, decodes HEIC, runs the ladder or the
passthrough fast path, converts video, extracts thumbnails, and returns one
frozen `ProcessedUpload` whose `contentType` is in `allowlist` — or throws
`MediaProcessingError` (`unsupported-format`, `heic-conversion-failed`,
`decode-failed`, `encode-failed`, `stat-failed`). There is no
`application/octet-stream` fallback. It is UI-free; progress reaches the app
through `onPhase`. Map multi-asset selections with
`mapWithConcurrency(items, limit, worker)`, not `Promise.all`, because each
in-flight asset holds a full-resolution bitmap.

Compression is a descending long-edge ladder at fixed quality against a byte
budget, not a quality-decay loop: the first rung inside `byteBudget` wins, the
last rung is used anyway and reports `overBudget`. `CompressionConfig` is
`{ rungs, quality, byteBudget, passthroughBytes, format }`. `format: null` means
the upload format policy decides — PNG stays PNG, everything else becomes JPEG.
Route user overrides through `resolveCompressionConfig()`, which normalizes them
so a single-field override cannot produce an unrunnable ladder.

The never-larger decision belongs to `chooseUploadCandidate()`, not to app
config: reverting to the source requires the source type to be allowlisted, the
format to match, and the source size to be known, so a format conversion always
wins. Never allowlist `image/heic`; the client transcodes it.

Use `/processing` where the pipeline runs, and the granular entrypoints
otherwise: `/processing/image-compression`,
`/processing/image-compression/config`, `/processing/video-conversion`, and
`/processing/video-thumbnails`. A settings screen or preference store should
import the config subpath only. Apps must serve the FFmpeg worker same-origin
when using web video conversion.

Heavy optional features are lazy. `heic2any` loads only during web HEIC
conversion, native thumbnail extraction loads `expo-video` and
`expo-image-manipulator` only on the native path, `expo-file-system` loads only
to measure a native file URI, and FFmpeg loads only when web `convertVideo()`
runs. Core and server entrypoints require no React or Expo peers. Each lazy
dependency has an injection seam for tests: `processAsset({ adapter })`,
`convertHeicToJpeg(blob, fileName, decoder)`, `resolveUploadSize(file, stat)`.

Image presets are `avatar` (`[512] @ 0.8 / 200 KB`), `thumbnail`
(`[256] @ 0.7 / 100 KB`), `product` (`[1024, 768] @ 0.85 / 500 KB`), `gallery`
(`[2048, 1600, 1024] @ 0.8 / 1000 KB`), `highQuality`
(`[4096, 3072, 2048] @ 0.8 / 3000 KB`), and `none` (no ladder). Apps should pick
at original quality from `expo-image-picker` and let the ladder do the encoding.

Validation commands:

```sh
bun run packages:peer-check
bun run media:typecheck
bun run media:test
bun run media:build
bun run media:pack
bun run media:consumer-smoke
```
