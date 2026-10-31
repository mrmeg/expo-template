# Changelog

All notable changes to `@mrmeg/expo-media` are documented here. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0]

### Changed

- **A declared upload `size` is signed as `Content-Length`.** `getUploadUrl`
  signs the PUT with the size the client sent, so storage accepts only a body
  of exactly that many bytes and answers anything else with a signature
  mismatch. Before, `maxBytes` checked only the size the client claimed: a
  client could declare a small size and upload a large body. `upload()` already
  sends the payload's own size, so it needs no change; a caller that passes its
  own `size` must pass the real one.
- **`size` must be a whole, non-negative number of bytes.** Anything else is
  `400 invalid-size`; a non-number `size` used to be ignored.

### Added

- **`mediaTypes.*.requireSize`.** Refuses signing without a `size`
  (`400 size-required`), so `maxBytes` binds every upload of that media type.

## [0.6.0]

### Added

- **`@mrmeg/expo-media/picker`.** Headless media picking over `expo-image-picker`,
  with no `Alert` and no toast. `useMediaPicker()` returns `{ pick, picking,
  permission }` and `pickMedia(options)` is the same call without the hook.
  `pick` takes `source` (`"library"` or `"camera"`), `mediaTypes`, `multiple`,
  `selectionLimit`, and `allowsEditing`, and resolves to `{ status: "picked",
  assets }`, `{ status: "canceled" }`, or `{ status: "denied", canAskAgain }`. It
  asks for the library or camera permission when it is not granted and can still
  be asked, decides from the response (so a refusal given during the pick stops
  it), and always picks at `quality: 1` with `exif: true` and
  `orderedSelection: true`. Also exports `PickedMediaAsset` (`ProcessAssetInput`
  plus a unique `id` and `exif?: { takenAt?, lat?, lng? }`), `toPickedMediaAsset`,
  and the pure `parseExifGps`, `parseExifDate`, and `parseExifOrientation`.
- **`@mrmeg/expo-media/upload-queue`.** `useUploadQueue({ upload, allowlist,
  resolve, ... })` processes and uploads picked assets through a per-item state
  machine (`queued`, `processing`, `uploading`, `done`, `failed`) with bounded
  concurrency (default 3, shared by processing and upload because each in-flight
  asset holds a full-resolution bitmap). It returns `{ items, add, retry, remove,
  clearFinished, clear, isActive, counts }`, so a UI shows each file as soon as it
  is picked. `resolve(asset)` chooses the media type and compression per asset
  before processing; `metadata` defaults to the EXIF facts as `{ takenAt, lat,
  lng }` strings; `videoThumbnail` uploads each video's frame as a best-effort
  second file that never fails the item; `onItemSettled` and `onSettled` report
  outcomes once per item and once per drain. `retry` resumes from upload when the
  processed result survived. `remove` drops an in-flight item at once and ignores
  its result (`upload()` cannot be aborted, so the work finishes and holds its slot
  until it does). On web, `blob:` URLs the queue holds are revoked on remove and
  clear, never on failure. Unmounting does not stop the queue, so uploads outlive
  the screen that started them. The pure `uploadQueueReducer` and the
  React-free `createUploadQueueRunner` are exported for tests and non-React hosts.
  The subpath imports no picker, React Query, or UI.

- **Video thumbnails.** The same-ID convention (`videos/<ID>.mov` keeps its
  thumbnail at `thumbnails/<ID>.jpg`) moves from the app into the package.
  - Root entry, pure: `mediaKeyId`, `videoThumbnailKey`, `isVideoThumbnailKey`,
    `pairVideoThumbnails` (joins listed videos to listed thumbnails by key, in
    video order, plus `orphanThumbnails`), `withVideoThumbnailKeys`, and
    `videoThumbnailDeleteCompanions` (also exported from `/server`), with the
    `VideoThumbnailPairing` and `PairedVideo` types. The upload queue's default
    thumbnail filename now comes from `mediaKeyId`; its behavior is unchanged.
  - `createMediaHandlers({ deleteCompanions })`: `deleteOne` and `deleteMany`
    also delete the extra keys it returns for each requested key, so a client that
    deletes only a video still removes its thumbnail. Companions pass the same
    safety and media type checks as requested keys (one that does not is dropped),
    are visible to `policy.canDelete`, are deleted only after the key that named
    them was, and are best effort: a missing one counts as deleted, and a failure
    never fails the request. `deleteMany`'s `deleted` and `events.onDeleted` keys
    include the deleted companions, and failures are reported in a new optional
    `companionErrors` (also on the client's `MediaDeleteResult`), present only when
    there are any. `success`, `errors`, and `key` keep their meaning. A `404` for a
    missing object (not a missing bucket) from a companion delete is treated as
    success.
  - `usePairedVideoList({ videoMediaType, thumbnailMediaType, pairing, limit?,
    enabled? })` from `createMediaQueryHooks`: `{ data, isLoading, isRefetching,
    error, thumbnailsError, refetch }` (a failed thumbnail list still shows the
    videos, paired with none) over the existing list query keys, so mutation invalidation
    refreshes it, with `data` stable while its inputs are unchanged.
  - `/upload-queue`: `backfillVideoThumbnail` (one video, never rejects) and
    `useVideoThumbnailBackfill` (`{ run, running, progress, results }`, bounded
    concurrency) read a frame from a video's signed URL and upload it under the
    video's ID. Nothing runs them automatically, because they download video data.
    On web the bucket must allow CORS for the app's origin, or the canvas is
    tainted and the result is a failure that says so.

### Fixed

- **Native video thumbnails.** Extraction now waits for the player's
  `readyToPlay` before asking for a frame, because iOS returned no frames while
  the player was idle; it falls back to the first frame for clips shorter than
  the requested time; and failures are logged instead of silently returning no
  thumbnail.

### Changed

- **New optional peer `expo-image-picker`** (`>=55.0.0 <59.0.0 ||
  >=58.0.0-0 <59.0.0`), needed only by `/picker`. **Upgrade:** nothing, unless
  you import `/picker`; then `bunx expo install expo-image-picker`.

### Behavior differences from the template's old `useMediaLibrary`

- Video `duration` from the picker is in milliseconds; it now reaches
  `durationSeconds` divided by 1000 instead of being passed through as seconds.
- A GPS coordinate that cannot be read is dropped rather than reported as `0`,
  and iOS-style unsigned decimal coordinates with a hemisphere ref are read
  instead of being flattened to `0`.
- A denial that happens during a pick stops it; the old hook read stale
  permission state after requesting and went on to launch the picker.

## [0.5.2]

### Fixed

- **Web `convertVideo()` has a worker to load.** `ffmpeg-worker.js`, which
  `convertVideo()` fetches from `FFMPEG_WORKER_URL`
  (`/_expo/static/js/web/ffmpeg-worker.js`), was never in the published package,
  so an app installing it from npm had nothing to serve at that URL and every
  web conversion failed with `FFmpegWorkerUnavailableError`. It now ships at
  `dist/processing/videoConversion/ffmpeg-worker.js` and is exported as
  `@mrmeg/expo-media/processing/video-conversion/ffmpeg-worker.js`, so a
  `metro.config.js` or server can `require.resolve()` it. **Upgrade:** serve
  that file same-origin at `FFMPEG_WORKER_URL` in development (Metro
  middleware) and production; the README's "FFmpeg worker" section has both.
  Nothing changes for an app that does not convert video on web.
- **Types under `moduleResolution: node16`/`nodenext`.** The built declarations
  imported each other extension-less (`./handlers`, `import(".")`), which
  NodeNext cannot resolve; `skipLibCheck` hid the errors and every symbol behind
  them — `createMediaHandlers`, `createMediaConfig`, the hook result types —
  became `any`. All 63 relative specifiers in the `.d.ts` files now carry `.js`
  or `/index.js`.
  Nothing to change: bundler-resolution consumers were already typed, NodeNext
  ones now are, and a call that only compiled because it was `any` may now
  report a real type error.
- **Peer ranges cover Expo SDK 58 and React Native 0.88.** 0.5.1 as published
  declared `expo`, `expo-file-system`, `expo-image-manipulator`, and
  `expo-video` as `>=55.0.0 <58.0.0` and `react-native` as `>=0.83.0 <0.87.0`,
  so an SDK 58 app got peer warnings or refused installs. They are now
  `>=55.0.0 <59.0.0 || >=58.0.0-0 <59.0.0` and
  `>=0.83.0 <0.89.0 || >=0.88.0-0 <0.89.0` (the prerelease tuple admits the SDK
  58 beta and the 0.88 RC). Lower bounds are unchanged.

### Changed

- **`useSignedMediaUrls` (and its `useSignedUrls` alias) caches signed URLs per
  object key.** The query key is still the whole key list, so an upload or a
  delete — which changes the list — used to start a new query that re-signed
  every key; a re-signed URL is a new URL, so every image downloaded again. Now
  a list fetching for the first time signs only the keys no cached list holds
  a fresh URL for, and unchanged items keep their URL. While the new keys sign,
  `data` holds the cached URLs for the rest (`isPlaceholderData` is true)
  instead of `undefined`; a list the cache can serve entirely (after a delete)
  starts with data and makes no request. `staleTime` follows the URLs' own
  lifetime — `X-Amz-Expires` / `X-Goog-Expires`, or an `Expires` timestamp —
  less 10% of it, at most five minutes; URLs that state no lifetime are never
  reused and keep the client's default `staleTime`. The hook's data type is
  `SignedMediaUrlsData`: `SignedMediaUrlsResult` plus `urlExpiresAt` (epoch ms on
  the device clock, per key). `queryKeys.signedUrls(keys, path)` and
  invalidation mean what they did: invalidating a list, or
  `[namespace, "signed-urls"]`, re-signs every key of it, and invalidated lists
  are never reused. **Upgrade:** nothing required. A screen that showed a
  loading state for a changed key list sees `isPlaceholderData` with partial
  `data` instead.
- `exports` entries list a repo-only `@mrmeg/source` condition first, pointing
  at `src`; the template enables it to build and test the sources. No consumer
  toolchain sets it and `src` is not published, so every entry resolves to the
  same `dist` file as before.

### Notes

- The template's media library hook (`client/features/media`, not part of this
  package) now creates asset ids with `globalThis.crypto.randomUUID()` on web
  through a platform file, so `expo-crypto` no longer lands in the web bundle's
  shared chunk; native still uses `expo-crypto`. The package itself never
  depended on `expo-crypto`. An app that copied that hook can make the same
  split.

## [0.5.1]

### Fixed

- Native video thumbnails no longer leak `expo-video` into the web bundle's
  eager `__common` chunk. The `import("expo-video")` /
  `import("expo-image-manipulator")` calls moved from `videoThumbnails.ts` into
  a `videoThumbnailDeps.native.ts` loader whose web sibling has no imports, so
  on web the only path to `expo-video` is the consumer that plays video.
- Built output keeps platform-split specifiers extension-less (`./compress`
  instead of `./compress.js`). Metro resolves an explicit `./compress.js` to that
  exact file and never considers `compress.native.js`, so iOS and Android were
  getting the web canvas implementation of `compressImage` from the published
  build. `scripts/fix-package-esm.mjs` now lists `native` as a platform suffix
  for this package.

## [0.5.0]

Breaking. The image pipeline is redesigned around one orchestrator and a
descending dimension ladder. Apps that called `compressImage` directly and
assembled their own content type per branch need to move to `processAsset`.

### Added

- `processAsset()` (`@mrmeg/expo-media/processing`): the single client entry
  point for a picked asset. It identifies the source, applies the upload format
  policy, decodes HEIC, runs the ladder or the passthrough fast path, converts
  video, and extracts thumbnails, then returns one frozen `ProcessedUpload`
  whose `contentType` is guaranteed to be in the allowlist it was given — or
  throws `MediaProcessingError`. There is no third outcome and no
  `application/octet-stream` fallback. Progress is reported through `onPhase`,
  so the function renders nothing.
- Upload format policy module: `resolveUploadFormatPolicy()` returns
  `passthrough` / `transcode` / `reject` for a source content type against a
  target allowlist, plus `chooseUploadCandidate()`, `normalizeContentType()`,
  `isAllowlistedContentType()`, `isHeicContentType()`, `isUnknownContentType()`,
  `contentTypeForFormat()`, and the `HEIC_CONTENT_TYPES` /
  `UNKNOWN_CONTENT_TYPES` tables. Pure, so both platforms share the answers.
- Content-type identification: `resolveSourceContentType()`,
  `sniffContentTypeFromBytes()` (byte signatures plus an ISO-BMFF `ftyp` brand
  table, so HEIF variants and `-sequence` captures are recognized), and
  `contentTypeFromFileName()`.
- `MediaProcessingError` / `isMediaProcessingError()` with codes
  `unsupported-format`, `heic-conversion-failed`, `decode-failed`,
  `encode-failed`, and `stat-failed`.
- `mapWithConcurrency(items, limit, worker)`: bounded async mapping that keeps
  input order, for multi-asset selections that previously ran an unbounded
  `Promise.all` over full-resolution decodes.
- `runDimensionLadder()` / `resolveLadderRungs()`: the shared ladder loop, with
  `compressImageWith()` and the `ImagePlatformAdapter` seam
  (`imagePlatformAdapter`, `EncodeImage`, `DisposeEncodedImage`) so the loop is
  testable without a platform.
- Web canvas ceilings: `canvasLongEdgeLimitFor()`,
  `clampLongEdgeToCanvasLimit()`, `currentCanvasLongEdgeLimit()`, and the
  `CANVAS_LIMIT_*` constants. Requested long edges are clamped before drawing,
  which is what stops an oversized canvas from silently producing a blank image.
- `convertHeicToJpegIfNeeded()`, `isHeicBlob()`, `hasHeicExtension()`, and an
  injectable `HeicDecoder` argument on the conversion helpers.
- `longEdgeOf()`. Ladder math takes displayed (orientation-applied)
  dimensions as input — the contract `ProcessAssetInput` documents — since
  pickers and probes already report them; `exifOrientation` is metadata only.
- `resolveUploadSize()` is exported from `@mrmeg/expo-media/client`, with an
  injectable `NativeFileSizeStat`.

### Changed

- `CompressionConfig` is now `{ rungs, quality, byteBudget, passthroughBytes,
  format }`. The old `{ maxDimension, quality, maxSizeKB, minQuality, format }`
  shape is gone: quality is fixed and the ladder drops long-edge rungs instead
  of decaying quality, which trades pixels rather than adding artifacts and can
  actually guarantee a byte budget.
- `CompressionConfig.format` semantics changed. `null` now means "the upload
  format policy decides" (PNG stays PNG, everything else encodes to JPEG)
  instead of "default to JPEG". Re-encoding a PNG as JPEG destroyed its alpha
  channel.
- `IMAGE_PRESETS` values are re-tuned for the ladder: `avatar` `[512] @ 0.8 /
  200 KB`, `thumbnail` `[256] @ 0.7 / 100 KB`, `product` `[1024, 768] @ 0.85 /
  500 KB`, `gallery` `[2048, 1600, 1024] @ 0.8 / 1000 KB`, `highQuality`
  `[4096, 3072, 2048] @ 0.8 / 3000 KB`. `passthroughBytes` is 300 KB for the two
  photo-library presets and 0 for the presets with a hard dimension target.
- `resolveCompressionConfig()` normalizes custom configs instead of trusting
  them: rungs are filtered, rounded, deduped and sorted descending; quality is
  clamped to `[MIN_QUALITY, 1]`; byte fields are non-negative; unknown preset
  names resolve to `null`. A single-field override can no longer produce a
  config the ladder is unable to run.
- `compressImage()` takes `{ source, width, height, config, format?,
  exifOrientation? }` and returns `CompressedImage` with `contentType`, `rung`,
  `attempts`, and `overBudget`. `contentType` is read back off the encoder
  output rather than assumed from the request, because Safari substitutes PNG
  for types it cannot encode.
- Encoder output is never WebP on web. Canvas WebP support is not portable, and
  a substituted type used to be reported as the requested one.
- `logMediaDebug()` writes to the console under `__DEV__` instead of an
  injectable sink no consumer ever configured (every call site was silently
  dead). `MIN_QUALITY` is exported from the config subpath.
- `@mrmeg/expo-media/processing` is now the recommended import for the pipeline;
  config-only consumers should still use
  `/processing/image-compression/config`.

### Removed

- `keepOriginalIfLarger` as a caller-supplied option, along with
  `shouldUseProcessedFile()` and `shouldUseCompressedImage()`. The never-larger
  decision is format-aware and now belongs to `chooseUploadCandidate()`:
  reverting to the source requires the source type to be allowlisted and the
  source size to be known. A conversion wins unconditionally only when the
  source is not allowlisted (HEIC) or the caller marks the conversion required
  for playback compatibility (WebM→MP4) — a smaller file the server rejects, or
  one that will not play, is not a better upload.
- `getMimeType()`. Its `null` → `image/jpeg` default is what silently converted
  PNGs and dropped their transparency.
- `reduceQuality()` and `shouldContinueCompression()`, the quality-decay
  helpers the ladder replaces.
- `cleanupCompressedImages()`, `revokeCompressedImage()`, `revokeAllTrackedUrls()`,
  and `trackBlobUrl()`. The ladder disposes every losing rung as it loses, so
  there is nothing left for a caller to sweep up afterwards.
- `configureMediaDebugLogger()`.

### Fixed

- The passthrough fast path is measured against post-decode bytes. A small HEIC
  that balloons when decoded (38 KB in, 59 KB of JPEG out) no longer skips the
  ladder against a budget the uploaded bytes exceed, and the reported
  `passthrough:<size>` step names the size actually uploaded.
- An allowlisted WebP source is no longer force-transcoded to a larger JPEG:
  `chooseUploadCandidate` runs the size contest across format changes and only
  lets the conversion win unconditionally when the caller marks it required
  for compatibility (`conversionRequired`, e.g. WebM→MP4) or the source is not
  allowlisted (HEIC). WebP displays on every major platform (Safari/iOS 14+,
  Firefox 65+, Edge 18+, Chrome, Android 4+, expo-image both platforms).
- A HEIF photo from a phone no longer reaches the server with a content type the
  server refuses. Identification, transcoding, and the never-larger check all
  agree on one allowlist, and an asset that cannot be represented in it fails
  loudly against that asset instead of uploading as
  `application/octet-stream`.
- Native uploads now send a byte `size` with the signing request. `upload()`
  stats a native file URI with `expo-file-system`, so the server's per-media-type
  `maxBytes` check applies to phone uploads instead of being web-only — an
  oversized file used to be transferred in full before being rejected.
- `upload()` forwards `metadata` to the signing request, so EXIF the app parsed
  reaches `policy.canUpload` and `events.onUploadSigned` instead of being
  dropped.
- Ladder dimensions are computed in displayed orientation, so an EXIF-rotated
  portrait photo is no longer capped along the wrong axis.
- A ladder rung that fails mid-run no longer leaks the attempt that was still in
  hand; the earlier encode is disposed before the error propagates.
- Native encodes release both the manipulated handle and the source handle, and
  a file-size stat that cannot read the written file is an error rather than a
  silent `0`.

## [0.4.0]

### Added

- New `@mrmeg/expo-media/worker` subpath for Cloudflare Worker deployments.
  `createMediaWorker({ createOptions, basePath })` returns a Worker-shaped
  `{ fetch }` whose routing mirrors the template's `/api/media/*` route table
  (`list` GET, `getUploadUrl` POST, `getSignedUrls` POST, `delete` DELETE/POST,
  `OPTIONS` preflight, `404 not-found`, `405 method-not-allowed`). Handlers are
  created once per `env` object and cached, since a Worker only receives `env`
  inside `fetch()`.
- `createKvTokenAuthorizer(kv)` `authorize` helper for static per-app bearer
  tokens stored in Workers KV as `token:<token>` → JSON metadata containing at
  least `{ "app": "<name>" }`, producing `MediaTokenAuth`
  (`{ token, app, metadata }`). KV is typed structurally through
  `MediaTokenStore`, so the package still has no `@cloudflare/workers-types`
  dependency.

### Fixed

- Server handlers no longer read `process.env` unguarded. On Cloudflare Workers
  without the `nodejs_compat` flag, a storage failure threw `ReferenceError`
  instead of returning `500 storage-failure`. Node and Jest behavior is
  unchanged.

## [0.3.0]

### Changed

- Replaced `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` with
  `aws4fetch` (`^1.0.20`). Server handlers now sign presigned upload/read URLs,
  `ListObjectsV2`, and object deletes with a ~2KB SigV4 signer over `fetch`, so
  consuming apps no longer install the AWS SDK. Handler request shapes, response
  shapes, error codes, and expiry defaults are unchanged.
- Batch delete now issues one signed `DELETE` per key at bounded concurrency
  instead of a single `DeleteObjects` call. The
  `{ success, deleted, errors }` response shape, per-bucket grouping, and
  1000-key request cap are unchanged.

## [0.2.1]

### Changed

- Updated `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` to
  `^3.1094.0`.

## [0.2.0]

### Changed

- Replaced deprecated `expo-video-thumbnails` usage with
  `expo-video.generateThumbnailsAsync()` while preserving the public file URI,
  width, and height result contract.
- Made feature-specific React, React Native, Expo, React Query, and HEIC peers
  optional so core and server-only consumers do not install unused runtimes.
- Expanded verified peer declarations through Expo 57 and React Native 0.86.

### Removed

- Removed unused `expo-crypto` and `expo-image-picker` peer declarations.

## [0.1.1]

### Fixed

- Scoped media listing and batch deletion to configured buckets and prefixes.

