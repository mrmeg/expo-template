# Changelog

All notable changes to `@mrmeg/expo-media` are documented here. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

