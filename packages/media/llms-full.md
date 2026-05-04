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

Use `createMediaClient()` from `/client` with the consuming app's fetcher.
Use `createMediaQueryHooks()` from `/react-query` to get upload, list, signed
URL, single delete, and batch delete hooks.

Client defaults are app-owned. A consuming app should keep one media settings
module with default compression preset, optional compression overrides,
selection limit, default image/video media types, thumbnail handling, and
named upload policies such as avatar, general image, original image, and
video. The package provides presets and processing helpers; the app decides
which defaults apply to its product.

Use granular processing entrypoints:
`/processing/image-compression`, `/processing/image-compression/config`,
`/processing/video-conversion`, and `/processing/video-thumbnails`. The broad
`/processing` barrel remains for compatibility but can expose bundlers to all
processing categories at once. Apps must serve the FFmpeg worker same-origin
when using web video conversion.

Heavy optional features are lazy. `heic2any` loads only during web HEIC
conversion, native thumbnail extraction loads `expo-video-thumbnails` only on
the native path, and FFmpeg loads only when web `convertVideo()` runs.

Image presets are `avatar`, `thumbnail`, `product`, `gallery`, `highQuality`,
and `none`. Apps commonly pick original quality from `expo-image-picker`, then
apply package compression, then keep the source asset when the processed output
is larger.

Validation commands:

```sh
bun run media:typecheck
bun run media:test
bun run media:build
bun run media:pack
bun run media:consumer-smoke
```
