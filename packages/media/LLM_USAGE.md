# LLM Usage: @mrmeg/expo-media

Use this package for reusable Expo media infrastructure.

## Import Rules

- Shared contracts: `@mrmeg/expo-media`
- Client API factory: `@mrmeg/expo-media/client`
- React Query hooks: `@mrmeg/expo-media/react-query`
- Image compression: `@mrmeg/expo-media/processing/image-compression`
- Image compression config only:
  `@mrmeg/expo-media/processing/image-compression/config`
- Video conversion: `@mrmeg/expo-media/processing/video-conversion`
- Video thumbnails: `@mrmeg/expo-media/processing/video-thumbnails`
- Server handlers only: `@mrmeg/expo-media/server`

Never import `/server` from client code. Root imports must stay safe for Node
and tooling. Avoid the broad `/processing` barrel unless a screen genuinely
needs every processing category; it exists for compatibility.

## Server Pattern

Create app-owned config with `createMediaConfig()`. Apps provide bucket
credentials, media type prefixes, allowed content types, size limits, auth,
policy callbacks, metadata events, CORS helpers, and route wrappers.

Use `createMediaHandlers()` to produce Fetch-compatible handlers:
`getUploadUrl`, `getSignedUrls`, `list`, `deleteOne`, `deleteMany`, and
`options`.

Upload signing requires `{ mediaType, contentType, size?, customFilename?,
metadata? }`. Do not restore extension-only signing.

## Client Pattern

Create a client with an app fetcher:

```ts
const mediaClient = createMediaClient({ basePath: "/api/media", fetcher });
const hooks = createMediaQueryHooks({ client: mediaClient });
```

Use `hooks.useMediaUpload()` for web `Blob`/`File` and native URI uploads.
Use `useMediaList`, `useSignedMediaUrls`, `useMediaDelete`, and
`useMediaDeleteBatch` for storage operations.

Keep app-wide client behavior in an app-owned settings file, not inside the
package. Typical settings include default compression preset, user overrides,
whether larger processed files should fall back to the source asset, selection
limit, default image/video media types, and thumbnail handling. Screens should
choose named upload policies instead of hardcoding media types and quality
settings inline.

## Processing Pattern

Use granular processing subpaths. Config-only stores should import
`IMAGE_PRESETS`, `CompressionConfig`, `ImagePreset`, and
`resolveCompressionConfig` from
`@mrmeg/expo-media/processing/image-compression/config`.

The app must mount `FFMPEG_WORKER_URL` in Metro/Express for web conversion.
Conversion helpers should fall back to original media when optional conversion
is unavailable.

Heavy optional features are lazy: `heic2any` loads only during web HEIC
conversion, `expo-video-thumbnails` loads only in the native thumbnail path,
and FFmpeg loads only when web video conversion runs.

Default image presets are `avatar`, `thumbnail`, `product`, `gallery`,
`highQuality`, and `none`. The package exports preset values and resolver
helpers; the consuming app decides which preset is the default for its product.

## Validation

Run `media:typecheck`, `media:test`, `media:build`, `media:pack`, and
`media:consumer-smoke` sequentially. The consumer smoke validates the packed
package boundary and installed docs.

## Publishing Pattern

Use `.github/workflows/publish-media.yml` for GitHub publishing. It mirrors the
UI package trusted-publishing workflow, uses npm OIDC by default, supports
`NPM_TOKEN` fallback, and runs the media gates before `npm publish`.
