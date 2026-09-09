# @mrmeg/expo-media Full Contract

Package-owned: contracts, key safety, content-type validation, client API calls,
React Query hook factories, processing helpers, S3/R2 handler factories.
App-owned: auth, env names, credentials, route mounting, metadata persistence,
UI, monitoring, FFmpeg worker serving, and the content-type allowlist the client
encodes toward and the server allows. Every peer is optional; `.`, `/server`, and
`/worker` run without React or Expo, signing S3/R2 with `aws4fetch` over `fetch`
(no AWS SDK). Platform-split modules ship as `foo.js` / `foo.native.js` with
extension-less specifiers, so Metro picks the native build on iOS/Android.

Entrypoints: `.` (contracts, keys, `MediaError`), `/client`, `/react-query`,
`/processing`, `/processing/image-compression`,
`/processing/image-compression/config`, `/processing/video-conversion`,
`/processing/video-thumbnails`, `/server`, `/worker`. Never import `/server` or
`/worker` from client code; config-only consumers use the config subpath.

## Server

`createMediaConfig({ buckets, mediaTypes })`. Bucket:
`{ provider: "s3" | "r2", bucket, endpoint?, region, forcePathStyle?, credentials }`.
Media type:
`{ bucket, prefix, allowedContentTypes, maxBytes?, uploadExpiresInSeconds?, readExpiresInSeconds? }`
(expiry defaults 300 / 86400). Missing values make the config invalid and every
handler answer `503 media-disabled` without building an S3 client.

`createMediaHandlers({ config, authorize?, policy?, events?, cors?, idFactory? })`
→ Fetch-compatible `{ getUploadUrl, getSignedUrls, list, deleteOne, deleteMany,
options }` for Expo Router route exports. `config` may be a factory; a falsy
`authorize` result is `401 unauthorized`. `policy.canUpload` / `canRead` /
`canList` / `canDelete` return a boolean or
`{ allowed, reason?, code?, allowCustomFilename? }`; `events.onUploadSigned` and
`events.onDeleted` persist app-owned metadata.

Upload signing body `{ mediaType, contentType, size?, customFilename?, metadata? }`
→ `{ uploadUrl, key, expiresAt, headers: { "Content-Type" } }`. ULID keys are
generated inside the configured prefix with the extension derived server-side from
the approved content type, and that type is signed into the PUT. Custom filenames
are sanitized and require `allowCustomFilename`, else
`403 custom-filename-forbidden`. `metadata` reaches `policy.canUpload` and
`events.onUploadSigned` untouched.

`list` needs `mediaType` or a narrower path inside a configured prefix (`limit`
default 100, capped 1000, plus `cursor`); neither is `400 bad-request`, and
unknown, absolute, traversal, or cross-media-type prefixes are `400 bad-key`.
`deleteOne` takes `?key=`, `deleteMany` up to 1000 keys grouped by each resolved
media type's bucket, returning merged `deleted` plus per-key `errors`. All read,
delete, and list keys must stay inside configured prefixes.

Error codes: `media-disabled`, `bad-request`, `unauthorized`, `forbidden`,
`custom-filename-forbidden`, `invalid-media-type`, `invalid-content-type`,
`oversized-file`, `bad-key`, `storage-failure`, plus any policy `code`.

## Worker

`export default createMediaWorker({ createOptions, basePath })`.
`createOptions(env)` returns the `createMediaHandlers` options and runs once per
`env` object (handlers cached in a `WeakMap`), so read bindings there and keep
`config` in factory form. Routing mirrors the Expo table under `basePath`
(default `/api/media`): `list` GET, `getUploadUrl` POST, `getSignedUrls` POST,
`delete` DELETE `?key=` / POST `{ keys }`. `OPTIONS` on a known action returns the
preflight response; unknown action or off-base path is `404 not-found`, wrong
method `405 method-not-allowed`, both with `cors.getHeaders`. Runtime is `fetch` +
Web Crypto, no `nodejs_compat`.

`createKvTokenAuthorizer(kv)` authorizes `Authorization: Bearer <token>` against
KV `token:<token>` → JSON with at least `{ "app": "<name>" }`, yielding
`MediaTokenAuth` (`{ token, app, metadata }`); anything else is
`401 unauthorized`. KV is typed structurally (`MediaTokenStore`:
`{ get(key): Promise<string | null> }`), so the package never depends on
`@cloudflare/workers-types`.

## Client

`createMediaClient({ basePath = "/api/media", fetcher = fetch })` →
`{ getUploadUrl, upload, list, getSignedUrls, deleteOne, deleteMany }`. `upload()`
sends `size` and `metadata` with the signing request; when `size` is omitted it
measures the payload, native file URIs included (`resolveUploadSize()` stats them
with `expo-file-system`), so the `maxBytes` check is not web-only. Native PUTs use
`expo/fetch` with an `expo-file-system` `File` body.

`createMediaQueryHooks({ client, queryKeyNamespace = "media" })` → `useMediaList`,
`useSignedMediaUrls` (alias `useSignedUrls`), `useMediaUpload`, `useMediaDelete`,
`useMediaDeleteBatch`, `queryKeys`; mutations invalidate the list queries and
queries retry via `shouldRetryMediaError`. Hooks throw `MediaError` with
`problem.kind` `disabled`, `bad-request`, `unauthorized`, `forbidden`, or
`unknown`. The app supplies the single `QueryClientProvider`.

Client defaults are app-owned: one settings module holding default preset,
overrides, concurrency, selection limit, thumbnail handling, the shared allowlist,
and named upload policies resolved per asset before processing. Never allowlist
`image/heic`; the client transcodes it. There is no `keepOriginalIfLarger`
setting — `chooseUploadCandidate()` owns that decision.

## Processing

`processAsset({ asset, allowlist, config?, adapter?, onPhase? })` identifies the
source content type, applies the upload format policy, decodes HEIC, runs the
ladder or the passthrough fast path, converts video, extracts a thumbnail at
1000 ms, and returns one frozen `ProcessedUpload` `{ kind, uri, blob?,
contentType, width, height, size, originalSize, overBudget, applied,
durationSeconds?, thumbnail? }` whose `contentType` is in `allowlist` — or throws
`MediaProcessingError` (`unsupported-format`, `heic-conversion-failed`,
`decode-failed`, `encode-failed`, `stat-failed`). No
`application/octet-stream` fallback. It is UI-free; `onPhase` reports
`identifying`, `decoding-heic`, `compressing`, `passthrough`,
`converting-video`, `extracting-thumbnail`, `complete`. Map selections with
`mapWithConcurrency(items, limit, worker)`, not `Promise.all`, because each
in-flight asset holds a full-resolution bitmap.

`CompressionConfig` is `{ rungs, quality, byteBudget, passthroughBytes, format }`:
a descending long-edge ladder at fixed quality against a byte budget, not a
quality-decay loop — the first rung inside `byteBudget` wins, the last is used
anyway and reports `overBudget`. `format: null` means the upload format policy
decides: PNG stays PNG, everything else JPEG. `resolveCompressionConfig()`
normalizes overrides (deduped descending rungs, quality in `[MIN_QUALITY, 1]`,
non-negative budgets; unknown names → `null`). Presets: `avatar`
`[512] @ 0.8 / 200 KB`, `thumbnail` `[256] @ 0.7 / 100 KB`, `product`
`[1024, 768] @ 0.85 / 500 KB`, `gallery` `[2048, 1600, 1024] @ 0.8 / 1000 KB`,
`highQuality` `[4096, 3072, 2048] @ 0.8 / 3000 KB`, `none` (no ladder);
`passthroughBytes` is 300 KB for `gallery` and `highQuality`, 0 elsewhere. Pick at
`quality: 1` from `expo-image-picker` and let the ladder encode.

`resolveUploadFormatPolicy()` returns `passthrough`, `transcode` (with
`outputFormat`), or `reject`, plus `requiresHeicDecode`, `flattensAnimation`,
`sourceAllowlisted`. Reverting to the source in `chooseUploadCandidate()` needs the
source type allowlisted, the same format, and a known source size, so a format
conversion always wins.

Platform behavior: web clamps the long edge to the canvas ceiling (4096 iOS and
unknown UA, 11180 Firefox, 16384 Chromium/desktop Safari) and never emits WebP;
web decodes HEIC with `heic2any` while the native encoder decodes HEIF itself; web
transcodes `webm`, `avi`, `mkv`, `ogv`, `wmv`, `flv`, `3gp` to MP4 up to 500 MB
(`MAX_CLIENT_CONVERSION_SIZE`) and needs `FFMPEG_WORKER_URL`
(`/_expo/static/js/web/ffmpeg-worker.js`) served same-origin, while
`convertVideo()` throws on native; a failed conversion falls back to an
allowlisted source and otherwise rejects the asset; thumbnails use `<video>` +
canvas on web and `createVideoPlayer().generateThumbnailsAsync()` +
`expo-image-manipulator` on native, and a thumbnail failure never fails the video.

Lazy loading: `heic2any` only in web HEIC conversion; `expo-video` and
`expo-image-manipulator` only from the native-only thumbnail dependency loader, so
nothing here reaches `expo-video` on web; `expo-file-system` only to measure or
upload a native file URI; FFmpeg only in web `convertVideo()`. Test seams:
`processAsset({ adapter })`, `convertHeicToJpeg(blob, fileName, decoder)`,
`resolveUploadSize(file, stat)`.

## Validation

```sh
bun run packages:peer-check
bun run media:typecheck
bun run media:test
bun run media:build
bun run media:pack
bun run media:consumer-smoke
```
