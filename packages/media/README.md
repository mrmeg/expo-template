# @mrmeg/expo-media

Reusable media contracts, API clients, React Query hooks, processing helpers,
and server handler factories for MrMeg Expo apps.

## Purpose

This package exists so Expo apps can share the same media infrastructure
instead of copying storage handlers, upload clients, signed URL hooks, image
compression utilities, HEIC conversion, thumbnail generation, and media error
handling into every app.

The package owns primitives. The consuming app still owns auth, routes,
storage credentials, app-wide defaults, upload policy, metadata, and UI.

## Ownership Boundary

Package-owned:

- media config contracts and safe key helpers
- client upload/list/read/delete API client factories
- React Query hook factories
- image compression, HEIC conversion, thumbnail, and optional web video
  conversion helpers
- Fetch-compatible server handlers for S3/R2 presigned URL workflows
- typed media error mapping

App-owned:

- auth and route mounting
- bucket credentials and environment variable names
- server policy decisions and database metadata
- app-wide media settings
- UI screens and media manager composition
- FFmpeg worker serving for web
- monitoring and analytics SDKs

## Install

```sh
bun add @mrmeg/expo-media
```

Expo native modules are peer dependencies because the consuming app must keep
them aligned with its Expo SDK: `expo-image-picker`,
`expo-image-manipulator`, `expo-file-system`, `expo-video-thumbnails`, and
`expo-crypto`. `heic2any` is also a peer dependency for browser HEIC
conversion, but it is loaded dynamically only when web HEIC conversion runs.
Server signing dependencies are package-owned.

In this monorepo, the app uses workspace resolution:

```json
{
  "dependencies": {
    "@mrmeg/expo-media": "workspace:*"
  }
}
```

## Public Imports

```ts
import { createMediaConfig } from "@mrmeg/expo-media";
import { createMediaClient } from "@mrmeg/expo-media/client";
import { createMediaQueryHooks } from "@mrmeg/expo-media/react-query";
import { createMediaHandlers } from "@mrmeg/expo-media/server";
import {
  compressImage,
  convertHeicToJpeg,
} from "@mrmeg/expo-media/processing/image-compression";
import {
  IMAGE_PRESETS,
  resolveCompressionConfig,
} from "@mrmeg/expo-media/processing/image-compression/config";
import {
  convertVideo,
  FFMPEG_WORKER_URL,
  needsConversion,
} from "@mrmeg/expo-media/processing/video-conversion";
import { extractVideoThumbnail } from "@mrmeg/expo-media/processing/video-thumbnails";
```

Root imports are shared-contract only and do not load React Native, Expo native
modules, or AWS SDK code. Use `/server` only in server route files. Prefer
granular processing subpaths; the broad `/processing` export remains for
compatibility but can expose bundlers to every processing feature.

Heavy processing dependencies are behind lazy boundaries. `heic2any` loads
inside `convertHeicToJpeg()`, native thumbnail extraction loads
`expo-video-thumbnails` only on the native path, and FFmpeg assets load only
when web `convertVideo()` runs. Bundlers that honor package side-effect
metadata also see `"sideEffects": false`.

## Configuration Model

Use two config surfaces:

1. Server storage policy through `createMediaConfig()`
2. App-wide client defaults through an app-owned settings file

The package intentionally does not own product defaults. Apps should define
their own media settings once and make screens read those values.

Recommended app-owned settings shape:

```ts
import type {
  CompressionConfig,
  ImagePreset,
} from "@mrmeg/expo-media/processing/image-compression/config";

type MediaType = "avatars" | "videos" | "thumbnails" | "uploads";

export type MediaUploadPolicy = {
  mediaType: MediaType;
  compression?: ImagePreset | Partial<CompressionConfig> | null;
};

export const MEDIA_APP_SETTINGS = {
  imageCompression: {
    enabled: true,
    defaultPreset: "gallery",
    userOverrides: null,
  },
  processing: {
    keepOriginalIfLarger: true,
  },
  uploads: {
    selectionLimit: 20,
    defaultImageMediaType: "uploads",
    defaultVideoMediaType: "videos",
    uploadVideoThumbnails: true,
    deleteVideoThumbnailWithVideo: true,
  },
  uploadPolicies: {
    avatar: { mediaType: "avatars", compression: "avatar" },
    generalImage: { mediaType: "uploads", compression: "gallery" },
    originalImage: { mediaType: "uploads", compression: "none" },
    video: { mediaType: "videos", compression: null },
  },
} as const;
```

## Server Setup

```ts
import { createMediaConfig } from "@mrmeg/expo-media";
import { createMediaHandlers } from "@mrmeg/expo-media/server";

export const mediaConfig = createMediaConfig({
  buckets: {
    media: {
      provider: "r2",
      bucket: process.env.MEDIA_BUCKET,
      endpoint: process.env.MEDIA_ENDPOINT,
      region: "auto",
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.MEDIA_ACCESS_KEY_ID,
        secretAccessKey: process.env.MEDIA_SECRET_ACCESS_KEY,
      },
    },
  },
  mediaTypes: {
    avatars: {
      bucket: "media",
      prefix: "users/avatars",
      allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
      maxBytes: 5 * 1024 * 1024,
      uploadExpiresInSeconds: 300,
      readExpiresInSeconds: 86400,
    },
    uploads: {
      bucket: "media",
      prefix: "uploads",
      allowedContentTypes: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "video/mp4",
        "video/quicktime",
        "application/pdf",
      ],
      maxBytes: 50 * 1024 * 1024,
      uploadExpiresInSeconds: 300,
      readExpiresInSeconds: 86400,
    },
  },
});

export const mediaHandlers = createMediaHandlers({
  config: mediaConfig,
  authorize: async (request) => requireUser(request),
  policy: {
    canUpload: async ({ auth, mediaType, contentType, size }) => ({
      allowed: true,
    }),
    canRead: async ({ auth, keys }) => ({ allowed: true }),
    canList: async ({ auth, mediaType, prefix }) => ({ allowed: true }),
    canDelete: async ({ auth, keys }) => ({ allowed: true }),
  },
  events: {
    onUploadSigned: async ({ auth, key, mediaType }) => {
      // Optional: create app-owned pending metadata.
    },
    onDeleted: async ({ auth, keys }) => {
      // Optional: reconcile app-owned metadata.
    },
  },
});
```

Expo Router API route files stay thin:

```ts
import { mediaHandlers } from "@/server/media/handlers";

export const OPTIONS = mediaHandlers.options;
export const POST = mediaHandlers.getUploadUrl;
```

Missing bucket credentials or invalid media config return a typed `503`
`media-disabled` JSON response without constructing an S3 client.

## Server Config Fields

| Field | Purpose |
|---|---|
| `buckets.*.provider` | `s3` or `r2` |
| `buckets.*.bucket` | physical bucket name |
| `buckets.*.endpoint` | R2 or custom S3 endpoint |
| `buckets.*.region` | S3 region or R2 `auto` |
| `buckets.*.credentials` | storage credentials |
| `mediaTypes.*.bucket` | bucket alias used by the media type |
| `mediaTypes.*.prefix` | generated object key prefix |
| `mediaTypes.*.allowedContentTypes` | accepted MIME allowlist |
| `mediaTypes.*.maxBytes` | optional upload size limit |
| `mediaTypes.*.uploadExpiresInSeconds` | signed upload URL lifetime |
| `mediaTypes.*.readExpiresInSeconds` | signed read URL lifetime |

Clients choose `mediaType`, not a raw bucket or path. The server derives keys
inside configured prefixes and derives file extensions from approved content
types.

## Client Setup

```ts
import { createMediaClient } from "@mrmeg/expo-media/client";
import { createMediaQueryHooks } from "@mrmeg/expo-media/react-query";

export const mediaClient = createMediaClient({
  basePath: "/api/media",
  fetcher: authenticatedFetch,
});

export const {
  useMediaUpload,
  useMediaList,
  useSignedMediaUrls,
  useMediaDelete,
  useMediaDeleteBatch,
} = createMediaQueryHooks({ client: mediaClient });
```

Uploads use the content-type contract:

```ts
await upload({
  file: blobOrNativeUri,
  mediaType: "avatars",
  contentType: "image/jpeg",
  size: blob.size,
});
```

The old `{ extension, mediaType }` signing body is not the primary contract.
The server derives the extension from the approved content type and signs the
matching `Content-Type` header.

## App-Wide Defaults

Default behavior should be configured by the app, then used by screens and
hooks. Typical defaults:

| Setting | Example |
|---|---|
| compression enabled | `true` |
| default preset | `gallery` |
| user overrides | `null` |
| keep original if processed output is larger | `true` |
| picker quality | `1` |
| multi-upload selection limit | `20` |
| default image media type | `uploads` |
| default video media type | `videos` |
| upload video thumbnails | `true` |
| delete generated thumbnail with video | `true` |

Override precedence:

1. Package preset values from `IMAGE_PRESETS`
2. App-wide defaults in the app's media settings file
3. Runtime store overrides, if the app exposes user controls
4. Per-flow `pickMedia({ compression })` overrides

## Processing

```ts
import {
  compressImage,
  convertHeicToJpeg,
  shouldUseProcessedFile,
  shouldUseCompressedImage,
} from "@mrmeg/expo-media/processing/image-compression";
import {
  needsConversion,
  convertVideo,
  FFMPEG_WORKER_URL,
} from "@mrmeg/expo-media/processing/video-conversion";
import { extractVideoThumbnail } from "@mrmeg/expo-media/processing/video-thumbnails";
```

Package image presets:

| Preset | maxDimension | quality | maxSizeKB | minQuality | format |
|---|---:|---:|---:|---:|---|
| `avatar` | 512 | 0.8 | 200 | 0.6 | jpeg |
| `thumbnail` | 256 | 0.7 | 100 | 0.5 | jpeg |
| `product` | 1024 | 0.85 | 500 | 0.6 | jpeg |
| `gallery` | 2048 | 0.85 | 1000 | 0.65 | jpeg |
| `highQuality` | 3000 | 0.9 | 2000 | 0.7 | jpeg |
| `none` | original | original | none | none | original |

Behavior notes:

- Pick the original asset first, then process it.
- Use `quality: 1` with `expo-image-picker` if package compression is applied
  after picking.
- HEIC conversion runs before image compression on web.
- Image compression lowers quality by `0.05` until `maxSizeKB` is reached or
  `minQuality` is hit.
- Use `shouldUseProcessedFile(sourceSize, processed.size)` before upload so
  larger re-encodes or transcodes do not replace smaller originals.
- Videos are not image-compressed. Web can optionally transcode unsupported
  formats to MP4.
- Apps must serve `FFMPEG_WORKER_URL` from the same origin in Metro and
  production Express when using web video conversion.
- Avoid the broad `/processing` barrel in settings, stores, and light screens.
  Import the exact processing subpath needed so heavy optional features stay
  eligible for bundler pruning and lazy loading.

Per-flow compression examples:

```ts
pickMedia({ compression: "avatar" });
pickMedia({ compression: "gallery" });
pickMedia({ compression: "none" });
pickMedia({
  compression: {
    maxDimension: 1600,
    quality: 0.8,
    maxSizeKB: 750,
    minQuality: 0.6,
    format: "jpeg",
  },
});
```

## File Paths And Keys

`mediaTypes.*.prefix` defines where files are stored:

```txt
users/avatars/01KQT7....jpg
uploads/01KQT7....jpg
videos/01KQT7....mp4
thumbnails/01KQT7....jpg
```

Rules:

- clients send `mediaType`, not raw paths
- clients cannot choose arbitrary prefixes
- object keys are generated server-side unless policy allows a sanitized custom
  filename
- allowed content types and optional size limits are checked before signing
- `Content-Type` is included in the signed `PutObjectCommand`
- read/delete/list keys must stay inside configured prefixes
- batch delete accepts up to 1000 keys

## Error Handling

Media client hooks throw `MediaError` with typed problems:

- `disabled`
- `bad-request`
- `unauthorized`
- `forbidden`
- `unknown`

Server JSON error codes include `media-disabled`, `unauthorized`, `forbidden`,
`invalid-media-type`, `invalid-content-type`, `oversized-file`, `bad-key`,
and `storage-failure`.

Screens should branch on typed errors instead of parsing message text.

## Migration Checklist

Use this checklist when refactoring an app:

1. Install the package and peer dependencies.
2. Move bucket definitions into `createMediaConfig()`.
3. Replace custom route logic with `createMediaHandlers()`.
4. Keep Expo Router route files as thin handler exports.
5. Create a package-backed `mediaClient`.
6. Replace custom React Query hooks with `createMediaQueryHooks()`.
7. Add an app-wide media settings file.
8. Replace inline quality/path decisions with named upload policies.
9. Replace copied image processing helpers with `/processing` imports.
10. Reconcile app-owned metadata in handler events.
11. Add a `media-disabled` setup state.
12. Run validation.

Good deletion candidates:

- copied S3/R2 presigner code
- copied route body parsing and validation
- copied signed URL batching
- copied React Query media hooks
- copied image compression utilities
- copied HEIC conversion utilities
- copied video thumbnail extraction utilities
- copied media error mappers

## Validation

Run package checks sequentially when debugging generated artifacts:

```sh
bun run media:typecheck
bun run media:test
bun run media:build
bun run media:pack
bun run media:consumer-smoke
```

`media:consumer-smoke` installs the packed tarball into a clean fixture,
type-checks documented entrypoints, verifies export-map files, runs a root
runtime import, and checks that installed-package docs are present.

## GitHub Publishing

Use the `Publish Media Package` GitHub Actions workflow to publish
`@mrmeg/expo-media` from GitHub. Configure npm trusted publishing for:

- owner/user: `mrmeg`
- repository: `expo-template`
- workflow filename: `publish-media.yml`

The workflow also supports a repository secret named `NPM_TOKEN` as a fallback
publish credential. Pushes to `main` that change `packages/media/package.json`
publish the committed version when npm does not already have it. Manual runs
can bump `patch`, `minor`, `major`, or an exact version, then publish and commit
the version bump back to the selected branch.
