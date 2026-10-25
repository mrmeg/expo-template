# LLM Usage: @mrmeg/expo-media

## Imports

| Subpath | Contents |
|---|---|
| `@mrmeg/expo-media` | contracts, key helpers, video thumbnail pairing helpers, `MediaError` |
| `/client` | `createMediaClient`, `resolveUploadSize` |
| `/react-query` | `createMediaQueryHooks` (incl. `usePairedVideoList`) |
| `/processing` | `processAsset`, `mapWithConcurrency`, upload format policy, content-type sniffing, re-exports of the modules below |
| `/processing/image-compression` | ladder, encoder, HEIC decode, canvas limits |
| `/processing/image-compression/config` | `IMAGE_PRESETS`, `DEFAULT_PRESET`, `MIN_QUALITY`, `resolveCompressionConfig`, `CompressionConfig`, `ImagePreset` |
| `/processing/video-conversion` | `needsConversion`, `convertVideo`, `FFMPEG_WORKER_URL` |
| `/processing/video-thumbnails` | `extractVideoThumbnail` |
| `/picker` | `useMediaPicker`, `pickMedia`, `toPickedMediaAsset`, `parseExifGps`/`parseExifDate`/`parseExifOrientation`, `PickedMediaAsset` |
| `/upload-queue` | `useUploadQueue`, `uploadQueueReducer`, `createUploadQueueRunner`, `UploadQueueItem`, `useVideoThumbnailBackfill`, `backfillVideoThumbnail` |
| `/server` | `createMediaHandlers`, `videoThumbnailDeleteCompanions` |
| `/worker` | `createMediaWorker`, `createKvTokenAuthorizer` |

Never import `/server` or `/worker` from client code; the root must stay safe for
Node and tooling. Import `/processing` where the pipeline runs and
`/processing/image-compression/config` in config-only consumers (settings
screens, preference stores) so light bundles skip the pipeline.

Every peer is optional: native needs `expo`, `expo-file-system`,
`expo-image-manipulator`, `expo-video`; web HEIC needs `heic2any`; hooks need
`@tanstack/react-query`; `/picker` needs `expo-image-picker` (no other
entrypoint imports it). Platform-split modules ship as `foo.js` /
`foo.native.js` with extension-less specifiers, so native builds need
Metro-style platform resolution.

## Server

`createMediaConfig()` holds app-owned buckets, media type prefixes, allowed
content types, and size limits. `createMediaHandlers({ config, authorize?,
policy?, events?, cors? })` returns Fetch-compatible `getUploadUrl`,
`getSignedUrls`, `list`, `deleteOne`, `deleteMany`, `options`.

Upload signing takes `{ mediaType, contentType, size?, customFilename?,
metadata? }` and the server derives the extension from the approved content type;
do not restore extension-only signing. `allowedContentTypes` must be the list the
client processes toward. Never allowlist `image/heic`: nothing renders HEIF and it
masks client transcode failures.

## Cloudflare Worker

`export default createMediaWorker({ createOptions, basePath })`.
`createOptions(env)` returns the `createMediaHandlers` options and runs once per
`env` object, so read bindings there, not at module scope, and keep `config` in
factory form so missing secrets return `503 media-disabled`.

Routing mirrors the Expo route table under `basePath` (default `/api/media`):
`list` GET, `getUploadUrl` POST, `getSignedUrls` POST, `delete` DELETE with
`?key=` and POST with `{ keys }`. Unknown action or off-base path is
`404 not-found`; wrong method on a known action is `405 method-not-allowed`.

`createKvTokenAuthorizer(kv)` is an `authorize` for static per-app bearer tokens:
KV key `token:<token>` holding JSON with at least `{ "app": "<name>" }` yields
`MediaTokenAuth` (`{ token, app, metadata }`); anything missing or unparseable is
`401 unauthorized`. KV is typed structurally (`MediaTokenStore`); never add
`@cloudflare/workers-types` to this package.

## Client

```ts
const mediaClient = createMediaClient({ basePath: "/api/media", fetcher });
const hooks = createMediaQueryHooks({ client: mediaClient });
```

Hooks: `useMediaUpload` (web `Blob`/`File` and native URI uploads),
`useMediaList`, `useSignedMediaUrls`, `usePairedVideoList`, `useMediaDelete`,
`useMediaDeleteBatch`.
The app provides the single `QueryClientProvider` so hooks share its query
context. `useSignedMediaUrls` caches URLs per object key: a changed key list
signs only keys without a fresh cached URL (unchanged items keep theirs and are
not re-downloaded), shows the cached ones as placeholder data meanwhile, and
stays fresh for the URLs' own lifetime less a margin. Invalidating
`queryKeys.signedUrls(keys, path)` still re-signs every key.

Always send `size`; it is what the server's `maxBytes` check reads. Omitted,
`upload()` measures the payload, native file URIs included (`resolveUploadSize`
stats them with `expo-file-system`). Pass EXIF and other app-owned facts as
`metadata`; the package forwards it untouched.

Keep app-wide behavior in one app-owned settings file: default preset, user
overrides, processing concurrency, selection limit, thumbnail handling, the
shared content-type allowlist, and named upload policies that screens pick and
resolve per asset instead of hardcoding media types and quality inline. There is
no `keepOriginalIfLarger` setting; the format-aware never-larger decision lives
in `chooseUploadCandidate`.

## Video Thumbnails

`videos/<ID>.mov` keeps its thumbnail at `thumbnails/<ID>.jpg`: the same ID under
another prefix. The pure root helpers own that mapping (`mediaKeyId`,
`videoThumbnailKey`, `isVideoThumbnailKey`, `pairVideoThumbnails`,
`withVideoThumbnailKeys`, all taking `pairing: { thumbnailPrefix, extension? }`
with `extension` defaulting to `"jpg"`); do not rebuild the mapping in the app.

- Delete both with `createMediaHandlers({ deleteCompanions:
  videoThumbnailDeleteCompanions({ pairing, isVideoKey }) })`. Companions must
  resolve to a configured media type or are dropped, `canDelete` sees them, they
  are deleted only after the key that named them, and a missing or failing one
  never fails the request. `deleteOne` is still `{ success, key }` and
  `deleteMany` still `{ success, deleted, errors }` (`deleted` includes deleted
  companions); companion failures go only in the optional `companionErrors`,
  never `errors` or `success`.
- `usePairedVideoList({ videoMediaType, thumbnailMediaType, pairing, limit?,
  enabled? })` returns `{ data: { videos: { video, thumbnailKey, thumbnail? }[],
  orphanThumbnails }, isLoading, isRefetching, error, thumbnailsError, refetch }`
  (a failed thumbnail list pairs videos with none and sets `thumbnailsError`;
  `error` is the video list's) over the
  `useMediaList` query keys, so mutations refresh it. It reads one page per list:
  never delete `orphanThumbnails` unless both lists were read in full.
- `/upload-queue` `backfillVideoThumbnail({ videoKey, videoUrl }, { upload,
  thumbnailMediaType, filename?, timeMs?, extract? })` (never rejects) and
  `useVideoThumbnailBackfill({ ...same, concurrency?, onSettled? })` (`{ run,
  running, progress, results }`) add missing thumbnails from signed video URLs.
  They download video data, so never run them automatically: the app triggers
  them. On web the bucket needs CORS for the app origin or the canvas is tainted
  and the result is a failed result saying so. Thumbnail uploads need
  `allowCustomFilename` from `canUpload` for the thumbnail media type.

## Processing

`processAsset({ asset, allowlist, config?, adapter?, onPhase? })` is the entry
point on both platforms, with two outcomes and no third: an immutable
`ProcessedUpload` whose `contentType` is in `allowlist`, or a thrown
`MediaProcessingError` (`unsupported-format`, `heic-conversion-failed`,
`decode-failed`, `encode-failed`, `stat-failed`). Never reintroduce an
`application/octet-stream` fallback.

It is UI-free: report progress through `onPhase` (`identifying`,
`decoding-heic`, `compressing`, `passthrough`, `converting-video`,
`extracting-thumbnail`, `complete`) and keep toasts in the app. Map selections
with `mapWithConcurrency(items, limit, worker)` (template uses 3), not
`Promise.all` — each in-flight asset holds a full-resolution bitmap. Catch
`MediaProcessingError` per asset so one bad photo does not fail the batch.

Compression is a descending long-edge ladder at fixed quality against a byte
budget, never a quality-decay loop: `rungs` in order, first inside `byteBudget`
wins, last used anyway with `overBudget: true`. `passthroughBytes` is the source
size below which an already-allowlisted asset uploads untouched (`0` for presets
with a hard dimension target). `format: null` means the upload format policy
decides — PNG stays PNG, everything else becomes JPEG; `null` is not JPEG. Route
overrides through `resolveCompressionConfig()`, which normalizes partial configs
(rungs descending and deduped, quality clamped to `[MIN_QUALITY, 1]`, budgets
non-negative). Presets: `avatar`, `thumbnail`, `product`, `gallery` (package
default), `highQuality`, `none`; the app picks its own product default.

Web video conversion needs `FFMPEG_WORKER_URL`
(`/_expo/static/js/web/ffmpeg-worker.js`) served same-origin by Metro and
production; the script ships as
`@mrmeg/expo-media/processing/video-conversion/ffmpeg-worker.js`
(`require.resolve` it, serve its text). It falls back to the original when
unavailable and the source type is allowlisted, otherwise rejects the asset.
`convertVideo()` throws on native.

Heavy features load lazily: `heic2any` only in web HEIC conversion; `expo-video`
and `expo-image-manipulator` only from the native-only thumbnail dependency
loader, so nothing here reaches `expo-video` on web; `expo-file-system` only to
measure or upload a native file URI; FFmpeg only in web conversion. Core and
server entrypoints need no React or Expo peer. Test seams:
`processAsset({ adapter })`, `convertHeicToJpeg(blob, fileName, decoder)`,
`resolveUploadSize(file, stat)`.

## Picking And The Upload Queue

`useMediaPicker()` (or `pickMedia(options)`) from `/picker` wraps
`expo-image-picker` and resolves to `{ status: "picked", assets }`,
`{ status: "canceled" }`, or `{ status: "denied", canAskAgain }`: no `Alert`, no
toast, the app maps the result. Options: `source` (`"library"` | `"camera"`),
`mediaTypes`, `multiple`, `selectionLimit`, `allowsEditing`; it always picks at
`quality: 1` with EXIF. Assets are `PickedMediaAsset` (`ProcessAssetInput` + `id`
+ `exif?`).

`useUploadQueue({ upload, allowlist, resolve, concurrency?, metadata?,
videoThumbnail?, onItemSettled?, onSettled? })` from `/upload-queue` processes
then uploads each asset through `queued -> processing -> uploading -> done |
failed` and returns `{ items, add, retry, remove, clearFinished, clear, isActive,
counts }`. Pass `useMediaUpload().mutateAsync` (invalidates the lists) or
`client.upload` as `upload`; `resolve(asset)` runs once per asset when it is added
(the policy current at pick time, kept through retries) and returns
`{ mediaType, compression? }`. Concurrency (default 3) bounds processing
and upload together. `videoThumbnail` is off unless set (`{ mediaType, filename? }`)
and its failure never fails the item. `retry` resumes from upload when the
processed result exists; `remove` of an in-flight item drops it and ignores its
result but the slot frees only when the work settles (`upload()` has no abort);
`clearFinished` drops `done` only. `onSettled` fires once per drain. Keep toasts,
alerts, and settings stores in the app. `/upload-queue` must not import the
picker, React Query, or UI. `UploadQueueItem` field names are consumed
structurally by `@mrmeg/expo-ui/components/UploadQueue`; do not rename them.

## Repo Validation And Publishing

Run `bun run packages:peer-check`, then `bun run pkg media <gate>` for
`typecheck`, `test`, `build`, `pack`, `consumer-smoke` in order; the smoke covers
a minimal core/server/worker install plus a fully provisioned packed package, and
CI covers Expo 55, 56, 57, and 58 consumers. Release with
`bun run pkg media release -- --patch [--publish]`, which packs one tarball,
smokes it, and publishes that file. `.github/workflows/publish-packages.yml` runs
the same release on pushes to `main` that change the media version, or on a
manual run with `package=media`, then publishes the tarball with provenance
through trusted publishing (workflow filename `publish-packages.yml`) with an
`NPM_TOKEN` fallback. Changing the manifest's dependencies, peers, exports, or
files needs a version bump: `packages:drift-check` fails otherwise.
