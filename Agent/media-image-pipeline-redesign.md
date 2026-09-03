---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/81
---

# Rebuild the client image pipeline: format-aware policy, dimension ladder, one orchestrator

## Goal

Replace the accumulated per-platform image processing in `packages/media` and
`client/features/media` with one pipeline whose output **always satisfies the
server content-type allowlist**, and that optimizes size the way production
messengers do: a descending dimension ladder at fixed quality against a byte
budget, with a passthrough fast path. Fixes the live bug where a phone's HEIF
photo is uploaded with a rejected content type, plus the defects that share its
root cause.

Design follows the pattern Signal (iOS and Android independently) converged on.
**Signal is AGPL-3.0 — use its constants and algorithm shape as a design
reference only; copy no code.** Copying from browser-image-compression,
compressorjs, react-native-compressor (MIT) or jSquash (Apache-2.0) is fine.

## Context

Verified against dev (audit 2026-09-03; line refs current at `7e21d13`):

### The live bug, precisely

- **Native** (`client/features/media/hooks/useMediaLibrary.ts:465-489`):
  `compressImage` converts HEIC→JPEG (`packages/media/src/processing/imageCompression/compress.native.ts`,
  save format defaults JPEG), but when the JPEG is **not smaller** than the
  HEIF source — the common case when no downscale applies, since HEVC-in-HEIF
  beats JPEG ~2× — `keepOriginalIfLarger: true` +
  `shouldUseCompressedImage(originalSize, compressed.size)` discards the JPEG
  and keeps `finalUri = asset.uri` with `finalMimeType` seeded from
  `asset.mimeType || "application/octet-stream"` (line 442). Upload then sends
  `image/heif` or `application/octet-stream` → server 400
  `invalid-content-type`. (`image/heic` would pass — see allowlist below — and
  store an un-transcoded HEIC web clients can't display.)
- **Web** (`useMediaLibrary.ts:333-365`): the size guard there compares
  JPEG-vs-JPEG (the blob is reassigned by `convertHeicToJpeg` at line 193), so
  the revert restores the *converted* blob. The HEIF leak on web is the silent
  fallbacks instead: `heicConvert.ts:61-64` returns the un-converted HEIF on
  any `heic2any` failure, and detection (`heicConvert.ts:31-37`) misses HEIC
  arriving as `image/heic-sequence` or blank-mime-without-filename. Then
  canvas decode throws (non-Safari can't draw HEIF), the catch at `:370-382`
  keeps the original, and upload sends `image/heif` → 400.

### Root cause (what the redesign must eliminate)

- `shouldUseProcessedFile` (`packages/media/src/processing/imageCompression/utils.ts:99-114`)
  compares bytes only — it cannot express "larger but the only allowlisted
  representation".
- The result is tracked in four mutable locals (`finalUri`/`finalBlob`/
  `finalMimeType`/`finalSize`) updated across four branches, duplicated in
  `processAssetWeb` (`useMediaLibrary.ts:170-419`) and `processAssetNative`
  (`:421-531`). Six call sites derive or fall back a MIME, two to
  `application/octet-stream`, which the allowlist rejects by construction.

### Adjacent defects fixed by the same redesign

- `CompressionConfig.format: null` is documented "keep original" but
  `getMimeType(null)` → `image/jpeg` (`utils.ts:47-57`): **every PNG loses its
  alpha channel** in all five presets.
- Avatar preset is unreachable: `app/(main)/(tabs)/media.tsx:453-461` resolves
  compression from `generalImage` before `resolveMediaUploadPolicy` runs per
  asset, so avatars upload gallery-sized.
- Native uploads never send `size` (`packages/media/src/client/index.ts:186-189`
  returns `undefined` for string URIs), so the server's `maxBytes` check
  (`packages/media/src/server/handlers.ts:179-184`) is web-only.
- EXIF is parsed (`useMediaLibrary.ts:72-127`) into
  `exifTakenAt/exifLat/exifLng` and never sent; re-encoding strips it from the
  bytes, so capture time/GPS are lost with no replacement — while both client
  (`client/index.ts:20`) and server (`handlers.ts:191-200`) already support an
  upload `metadata` map.
- Dead code: the entire cleanup subsystem (`cleanup.ts`/`cleanup.native.ts`,
  zero callers, false doc contract), `logMediaDebug`
  (`processing/logger.ts` — `configureMediaDebugLogger` is never called, so
  ~25 diagnostic sites no-op), and `MEDIA_APP_SETTINGS.uploads.default*MediaType`
  + `uploadPolicies.originalImage` (nothing reads them).
- Unbounded `Promise.all` over up to 20 assets (`useMediaLibrary.ts:671-682`).
- The same size guard discards FFmpeg WebM→MP4 conversions when the MP4 is
  larger (`useMediaLibrary.ts:243-259`) — a playable file thrown away for an
  unplayable/rejected one.
- `compressionStore.ts:87-96`: a `{quality}` override alone can leave
  `minQuality > quality`, so the quality loop never runs.
- Native quality loop leaks a cache file per iteration and never `release()`s
  manipulator handles (`compress.native.ts:107-154`).

### Server contract (the fixed target)

`server/media/config.ts:19-32`: images `jpeg/jpg/png/webp/gif/heic`, videos
`mp4/quicktime/webm`; per-type caps at `:59-92` (avatars 5 MB, thumbnails 2 MB,
uploads 50 MB, videos 500 MB). `packages/media/src/config.ts:52-63`
`DEFAULT_CONTENT_TYPE_EXTENSIONS` has no `image/heif` or octet-stream entry.
Validation order in `handlers.ts:164-216`.

### Research conclusions to build on (survey of browser-image-compression,
compressorjs, Squoosh/jSquash, react-native-compressor, Immich, Signal)

- **Strategy**: descending long-edge ladder at fixed quality until the encode
  fits a byte budget; bounded attempts; re-decode from source per rung (that is
  the memory-safe pattern, not overhead). Signal's rungs
  512/768/1024/1600/2048/3072/4096, budgets 1/1.5/3 MB, passthrough thresholds
  200–400 KB. Multiplicative-decay loops (browser-image-compression's
  `quality *= 0.95` ×10) cannot guarantee a budget; perceptual targeting
  (Squoosh butteraugli) has no maintained client library — don't chase either.
- **Consensus quality 0.7–0.85 with platform encoders**; prefer tightening the
  dimension cap over dropping quality below ~0.7.
- **Never-larger guard is mandatory but must be format-aware**: every surveyed
  library reverts to the original when output is bigger — the redesign's rule
  is *revert only when the original's content type is itself allowlisted;
  format conversions always win regardless of size*.
- **Web platform facts**: `canvas.toBlob("image/webp")` is unsupported in all
  Safari (silently returns PNG) — never emit WebP on web; read the real type
  off the returned Blob rather than trusting the requested one. Per-browser
  canvas ceilings are real (iOS Safari 4096, Firefox 11180, Chrome/Safari
  desktop 16384) and overflow yields a blank canvas, not an error — clamp
  before drawing.
- **HEIC on web**: stay on `heic2any` (MIT, already an optional peer,
  lazy-imported). `libheif-js` is LGPL-3.0 — do not add it. Extend detection
  with an ISO-BMFF `ftyp` magic-byte sniff (first 12 bytes) for blank /
  octet-stream types; `image/heic-sequence`/`image/heif-sequence` count as
  HEIC. Conversion failure must surface as an asset error — never fall back to
  the HEIF bytes.
- **expo-image-manipulator is sufficient on native** (jpeg/png/webp save
  formats, decode handles HEIC on both platforms); do not use
  expo-image-picker's `quality` as a compressor.
- Keep: the pure math in `utils.ts:17-127` (unit-tested), the preset
  vocabulary, `resolveCompressionConfig`, the `compress.ts`/`compress.native.ts`
  platform-split convention, `extractVideoThumbnailNative` (model citizen:
  DI + releases every handle), and the whole transport/server contract.

## Work

1. **Upload format policy** — new `packages/media/src/processing/uploadPolicy.ts`
   (platform-agnostic, pure):
   - Input: source content type + the target allowlist; output: the decision
     `{ action: "passthrough" | "transcode" | "reject", outputFormat?: "jpeg" | "png" }`.
   - Rules: JPEG/WebP sources → JPEG output; PNG stays PNG (lossless resize
     only — no "PNG quality"); GIF (and any animated source) → passthrough,
     never re-encoded, size-capped only; HEIC/HEIF (any brand, incl.
     `-sequence`) → always transcode to JPEG; unknown type after sniffing →
     reject with a typed error.
   - Format-aware keep-original: `chooseUploadCandidate(original, processed, allowlist)`
     returns the processed result whenever the original's content type is not
     allowlisted, else the smaller of the two. This replaces
     `shouldUseProcessedFile`/`shouldUseCompressedImage` semantics at every
     call site (images and the FFmpeg video-conversion site at
     `useMediaLibrary.ts:243-259`); keep the old util exported but delegate to
     the new policy or delete if nothing external imports it.
   - The allowlist is passed in from the app: export the template's
     `IMAGE_CONTENT_TYPES`/`VIDEO_CONTENT_TYPES` from a shared module the
     client can import (today they live server-only in
     `server/media/config.ts:19-32`; `shared/media.ts` is the natural home —
     dedupe `TEMPLATE_MEDIA_PATHS` while there, it's a copy of `MEDIA_PATHS`).
2. **Ladder engine** — rework `imageCompression/config.ts` presets to
   `{ rungs: number[], quality, byteBudget, passthroughBytes }` and implement
   one shared ladder loop that calls a platform `encode(uri|blob, longEdge, quality, format)`
   primitive (`compress.ts` web / `compress.native.ts` native keep the split
   but shrink to that primitive):
   - Preset values: `avatar { rungs:[512], q:0.8, budget:200KB }`,
     `thumbnail { [256], 0.7, 100KB }`, `product { [1024,768], 0.85, 500KB }`,
     `gallery { [2048,1600,1024], 0.8, 1MB }`,
     `highQuality { [4096,3072,2048], 0.8, 3MB }`; passthrough threshold
     300KB for gallery/highQuality, 0 for avatar/thumbnail (always process —
     they must hit their dimension).
   - Descend rungs until the encode fits the budget; if the last rung still
     misses, return it anyway flagged `overBudget` (server cap is the
     backstop). Re-encode from the source per rung; delete the losing rung's
     temp file (native) / revoke its object URL (web) immediately.
   - Web primitive: clamp target dims to the per-browser canvas ceiling
     (adopt browser-image-compression's table; iOS Safari 4096), draw with
     `imageSmoothingQuality: "high"`, and take the output type from
     `blob.type`, not the request.
   - Native primitive: `ImageManipulator.manipulate` → `renderAsync` →
     `saveAsync({format, compress})`, `release()` both handles, stat with
     `expo-file-system` `File.size`; a stat failure is an error, not `0`
     (`compress.native.ts:38-45` currently returns 0 and corrupts the
     comparison).
3. **One orchestrator** — replace `processAssetWeb`/`processAssetNative`
   (`useMediaLibrary.ts:170-531`) with a single `processAsset` in
   `packages/media/src/processing/` returning one immutable
   `ProcessedUpload { uri, blob?, contentType, width, height, size, applied: string[] }`:
   - `contentType` has exactly one owner: the policy decision + encode result.
     `application/octet-stream` is never produced; an asset that can't reach an
     allowlisted type rejects with a typed `MediaProcessingError` the UI shows
     per-asset.
   - The package orchestrator is UI-free: progress/notification hooks are
     callback options (`onPhase(asset, phase)`), and the app hook
     (`useMediaLibrary`) keeps owning `notify.*` toasts by wiring them to
     those callbacks. The existing video branch (FFmpeg conversion +
     thumbnail extraction at its current 1000 ms mark) moves across
     behaviorally unchanged except the keep-original guard — video redesign
     stays out of scope.
   - Platform differences live behind a small adapter (dims probe, HEIC
     convert, encode, stat, temp cleanup). HEIC on web: extend
     `heicConvert.ts` detection (mime set + extension + `ftyp` sniff when type
     is blank/octet-stream), throw on conversion failure instead of returning
     the source blob (`heicConvert.ts:61-64`).
   - EXIF: keep the parse, and forward `{ takenAt, lat, lng }` as the upload
     `metadata` (supported end-to-end already); the re-encode stripping EXIF
     from bytes becomes the deliberate privacy default. Orientation: compute
     ladder dims from *displayed* orientation (swap W/H for EXIF orientations
     5-8) — expo-image-manipulator and canvas both bake rotation into pixels.
4. **Consumption fixes** (`client/features/media`, `app/(main)/(tabs)/media.tsx`):
   - Resolve the upload policy per asset **before** processing so avatars get
     the avatar preset (`media.tsx:453-461` + `mediaSettings.ts:99-121`).
   - Replace `processing.keepOriginalIfLarger` with the policy (delete the
     flag); delete dead settings (`uploadPolicies.originalImage`,
     `uploads.defaultImageMediaType`, `defaultVideoMediaType`).
   - Bound processing concurrency (limit 3) instead of `Promise.all` over 20
     (`useMediaLibrary.ts:671-682`).
   - Fix the `compressionStore` minQuality clamp (`compressionStore.ts:87-96`)
     so a lone `{quality}` override clamps `minQuality ≤ quality`.
5. **Transport + server contract**:
   - `packages/media/src/client/index.ts:186-189`: derive `size` for string
     URIs via `expo-file-system` `File.size` so native uploads hit the server
     `maxBytes` check.
   - Remove `image/heic` from `IMAGE_CONTENT_TYPES`
     (`server/media/config.ts:25`) — the client now always transcodes, and an
     allowlisted-but-undisplayable type is how the current bug half-hides.
   - Send upload `metadata` from the media screen (currently omitted,
     `media.tsx:413-422`).
6. **Delete dead weight**: `cleanup.ts`/`cleanup.native.ts` and their barrel
   exports (zero callers); either wire `configureMediaDebugLogger` from the
   app's dev bootstrap or fold `logMediaDebug` into a plain `__DEV__` console
   logger — pick one, no unconfigured-silence mode.
7. **Package release chores**: `packages/media` → 0.5.0, update README +
   `LLM_USAGE.md` (new policy/ladder API, breaking changes:
   `keepOriginalIfLarger` removed, `CompressionConfig.format` semantics),
   CHANGELOG entry, `bun run docs:llms` if the LLM bundle sources changed.
8. **Tests** (the pipeline is currently near-zero-covered; the mocks for
   `expo-image-manipulator`/`expo-file-system` already exist in
   `test/setup.ts:296-328`):
   - Policy matrix: every (source type × allowlist) → action; HEIF-larger-
     than-JPEG keeps the JPEG; JPEG-recompress-larger keeps the original;
     GIF passthrough; unknown → reject.
   - HEIC detection matrix incl. `ftyp` sniff and `-sequence` types;
     conversion failure throws (no HEIF fallback).
   - Ladder: rung descent, budget met/`overBudget`, per-rung temp cleanup,
     stat-failure is an error.
   - Orchestrator property test: for every fixture, the returned
     `contentType` ∈ allowlist or the asset rejected — this is the test that
     pins the original bug shut.
   - Preset value pinning; concurrency bound; native `size` sent
     (client transport test); `compressionStore` clamp.

## Validation

- `bun run media:typecheck && bun run media:test && bun run media:build && bun run media:pack && bun run media:consumer-smoke`
- `bun run typecheck && bun run lint && bun run test:ci && bun run check:features`
- `bun run build && node scripts/check-bundle-size.js` — `heic2any` and the
  pipeline must stay out of the eager web bundle (it is lazy-imported today;
  keep it that way).
- `bun run docs:llms:check`
- Manual (HITL, dev build on a physical phone + web): HEIF camera photo
  uploads successfully as JPEG and renders in the Media tab; a PNG screenshot
  with transparency survives as PNG; a 20-photo batch completes without
  jank/OOM; an oversized video thumbnail no longer exceeds the 2 MB cap if
  touched by these changes; native upload of a >50 MB file to `uploads` is
  rejected by the server (size now sent).

## Out of scope

- Video conversion redesign (FFmpeg presets, worker hosting) — only its
  keep-original guard call site changes here.
- WebP/AVIF as *output* formats (web can't emit WebP portably; AVIF encode is
  server-side territory), wasm codecs (jSquash/mozjpeg), perceptual-metric
  quality targeting, web-worker offload — all possible follow-ups, none
  blocking reliability.
- Server-side transcoding/derivatives (Immich-style), upload resumability.
- Video thumbnail resizing fix beyond what the ladder gives for free.

## Open questions

None. Format policy, ladder constants, license constraints (no Signal code,
no libheif-js), and the HEIC failure mode (reject, don't fall back) are
settled above.
