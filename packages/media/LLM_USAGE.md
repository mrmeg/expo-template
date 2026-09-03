# LLM Usage: @mrmeg/expo-media

Use this package for reusable Expo media infrastructure.

## Import Rules

- Shared contracts: `@mrmeg/expo-media`
- Client API factory: `@mrmeg/expo-media/client`
- React Query hooks: `@mrmeg/expo-media/react-query`
- Asset pipeline (`processAsset`, `mapWithConcurrency`, upload format policy):
  `@mrmeg/expo-media/processing`
- Image compression: `@mrmeg/expo-media/processing/image-compression`
- Image compression config only:
  `@mrmeg/expo-media/processing/image-compression/config`
- Video conversion: `@mrmeg/expo-media/processing/video-conversion`
- Video thumbnails: `@mrmeg/expo-media/processing/video-thumbnails`
- Server handlers only: `@mrmeg/expo-media/server`
- Cloudflare Worker routing and KV auth: `@mrmeg/expo-media/worker`

Never import `/server` or `/worker` from client code. Root imports must stay safe
for Node and tooling. Import `/processing` where the pipeline actually runs;
config-only consumers (settings screens, preference stores) must use
`/processing/image-compression/config` so they do not pull the pipeline into a
light bundle.

## Server Pattern

Create app-owned config with `createMediaConfig()`. Apps provide bucket
credentials, media type prefixes, allowed content types, size limits, auth,
policy callbacks, metadata events, CORS helpers, and route wrappers.

Use `createMediaHandlers()` to produce Fetch-compatible handlers:
`getUploadUrl`, `getSignedUrls`, `list`, `deleteOne`, `deleteMany`, and
`options`.

Upload signing requires `{ mediaType, contentType, size?, customFilename?,
metadata? }`. Do not restore extension-only signing.

`allowedContentTypes` must be the same list the client processes toward. Never
allowlist `image/heic`: nothing renders HEIF, and allowing it hides client
transcode failures instead of surfacing them.

## Cloudflare Worker Pattern

Use `createMediaWorker({ createOptions, basePath })` for a Worker deployment;
`export default` the result. `createOptions(env)` returns the same options as
`createMediaHandlers` and is called once per `env` object, so read bindings there
instead of at module scope. Keep `config` in factory form so missing secrets
return `503 media-disabled`.

Routing matches the Expo route table under `basePath` (default `/api/media`):
`list` GET, `getUploadUrl` POST, `getSignedUrls` POST, `delete` DELETE with
`?key=` and POST with `{ keys }`. Unknown action or off-base path is
`404 not-found`; wrong method on a known action is `405 method-not-allowed`.

Use `createKvTokenAuthorizer(kv)` as `authorize` for static per-app bearer
tokens: KV key `token:<token>` holding JSON with at least `{ "app": "<name>" }`,
producing `MediaTokenAuth` (`{ token, app, metadata }`). Anything missing or
unparseable becomes `401 unauthorized`. KV is typed structurally
(`MediaTokenStore`); never add `@cloudflare/workers-types` to this package.

## Client Pattern

Create a client with an app fetcher:

```ts
const mediaClient = createMediaClient({ basePath: "/api/media", fetcher });
const hooks = createMediaQueryHooks({ client: mediaClient });
```

The app must provide a single `@tanstack/react-query` `QueryClientProvider`;
the package treats React Query as a peer so hooks share the app's query context.

Use `hooks.useMediaUpload()` for web `Blob`/`File` and native URI uploads.
Use `useMediaList`, `useSignedMediaUrls`, `useMediaDelete`, and
`useMediaDeleteBatch` for storage operations.

Always send `size`; it is what the server's `maxBytes` check reads. `upload()`
measures the payload when `size` is omitted, including native file URIs
(`resolveUploadSize`, which stats them with `expo-file-system`). Forward EXIF and
other app-owned facts as `metadata`; the package passes it through untouched.

Keep app-wide client behavior in an app-owned settings file, not inside the
package. Typical settings include default compression preset, user overrides,
processing concurrency, selection limit, thumbnail handling, and the shared
content-type allowlist. Screens should choose named upload policies instead of
hardcoding media types and quality settings inline, and must resolve the policy
before processing rather than after.

There is no `keepOriginalIfLarger` app setting; the never-larger decision is
format-aware and lives in `chooseUploadCandidate`.

## Processing Pattern

`processAsset({ asset, allowlist, config?, adapter?, onPhase? })` is the entry
point on both platforms. It has two outcomes and no third: an immutable
`ProcessedUpload` whose `contentType` is in `allowlist`, or a thrown
`MediaProcessingError` (`unsupported-format`, `heic-conversion-failed`,
`decode-failed`, `encode-failed`, `stat-failed`). Never reintroduce an
`application/octet-stream` fallback — that is what let HEIF photos reach the
server with a type it refuses.

`processAsset` is UI-free. Report progress through `onPhase` (`identifying`,
`decoding-heic`, `compressing`, `passthrough`, `converting-video`,
`extracting-thumbnail`, `complete`) and keep toasts in the app.

Map multi-asset selections with `mapWithConcurrency(items, limit, worker)`, not
`Promise.all`. Each in-flight asset holds a full-resolution bitmap; the template
uses a limit of 3. Catch `MediaProcessingError` per asset so one bad photo does
not fail the batch.

Compression is a descending long-edge ladder at fixed quality against a byte
budget — never a quality-decay loop. `rungs` are tried in order, the first one
inside `byteBudget` wins, the last one is used anyway and sets
`overBudget: true`. `passthroughBytes` is the source size below which an
already-allowlisted asset uploads untouched (`0` for presets with a hard
dimension target). `format: null` means "the upload format policy decides": PNG
stays PNG, everything else becomes JPEG. Do not treat `null` as JPEG.

`resolveCompressionConfig()` normalizes partial configs (rungs descending and
deduped, quality clamped to `[MIN_QUALITY, 1]`, budgets non-negative), so route
every user override through it instead of merging raw fields.

Use granular processing subpaths for config. Config-only stores should import
`IMAGE_PRESETS`, `MIN_QUALITY`, `CompressionConfig`, `ImagePreset`, and
`resolveCompressionConfig` from
`@mrmeg/expo-media/processing/image-compression/config`.

The app must mount `FFMPEG_WORKER_URL` in Metro/Express for web conversion.
Conversion helpers should fall back to original media when optional conversion
is unavailable and the source type is allowlisted; otherwise the asset is
rejected.

Heavy optional features are lazy: `heic2any` loads only during web HEIC
conversion, `expo-video` and `expo-image-manipulator` load only in the native
thumbnail path, `expo-file-system` loads only to measure a native file URI, and
FFmpeg loads only when web video conversion runs. Core and server entrypoints do
not require React or Expo peers. Each lazy dependency has an injection seam for
tests: `processAsset({ adapter })`, `convertHeicToJpeg(blob, fileName, decoder)`,
`resolveUploadSize(file, stat)`.

Default image presets are `avatar`, `thumbnail`, `product`, `gallery`,
`highQuality`, and `none`. The package exports preset values and resolver
helpers; the consuming app decides which preset is the default for its product.

## Validation

Run `packages:peer-check`, `media:typecheck`, `media:test`, `media:build`,
`media:pack`, and `media:consumer-smoke` sequentially. The consumer smoke
validates both a minimal core/server install and a fully provisioned packed
package. CI covers Expo 55, 56, and 57 consumers.

## Publishing Pattern

Use `.github/workflows/publish-media.yml` for GitHub publishing. It mirrors the
UI package trusted-publishing workflow, uses npm OIDC by default, supports
`NPM_TOKEN` fallback, and runs the media gates before `npm publish`.

If `@mrmeg/expo-media` does not exist on npm yet, push-based workflow runs skip
without failing unless `NPM_TOKEN` is configured. First publish should be a
manual workflow run with `NPM_TOKEN`; trusted publishing can be configured after
the package exists.

For a local release, use `bun run media:release -- --patch --publish`. Omit
`--publish` for the same version bump and validation gates without npm publish.
