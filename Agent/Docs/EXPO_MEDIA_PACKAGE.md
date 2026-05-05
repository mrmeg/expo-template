# Expo Media Package

> Consumer integration reference for `@mrmeg/expo-media`.

## Purpose

`@mrmeg/expo-media` is the reusable media package for MrMeg Expo apps. It
standardizes storage contracts, presigned upload/read/list/delete workflows,
React Query hooks, media processing helpers, and Fetch-compatible server
handlers without owning app auth, app routes, UI screens, database metadata,
or product-specific media policy.

The goal is to let consuming apps delete their copied media infrastructure and
keep only the app-specific configuration:

- where files live
- which file types and sizes are allowed
- which auth and authorization rules apply
- which upload defaults the app uses
- which UI screens expose uploads, listing, preview, and deletion

## Ownership Boundary

Package-owned:

- `createMediaConfig()` contracts for buckets, media types, prefixes, MIME
  policy, URL expiry, and size limits
- safe key helpers and server-side extension derivation from approved content
  types
- `createMediaClient()` for upload/list/read/delete API calls
- `createMediaQueryHooks()` for upload/list/signed-url/delete hooks
- image compression, HEIC conversion, thumbnail extraction, and optional web
  video conversion helpers
- `createMediaHandlers()` Fetch-compatible S3/R2 handler factories
- typed media errors and problem mapping

App-owned:

- env var names, bucket credentials, and deployment config
- authentication and authorization callbacks
- policy callbacks and metadata persistence
- Expo Router API route files
- app-wide media defaults and upload policies
- media manager screens and domain UI
- FFmpeg worker serving in Metro and production Express
- monitoring SDKs and app logging

Do not move auth, billing, user-specific database metadata, or app navigation
into this package. The package should remain reusable by apps with different
auth systems and product models.

## Install

After publishing, consumer apps install the package:

```sh
bun add @mrmeg/expo-media
```

Expo native modules are peer dependencies because the consuming app must keep
them aligned with its Expo SDK: `expo-image-picker`,
`expo-image-manipulator`, `expo-file-system`, `expo-video-thumbnails`, and
`expo-crypto`. `heic2any` is also a peer because browser HEIC conversion is
app-bundled, but package code loads it dynamically only when web HEIC
conversion runs.

In this monorepo, the app uses workspace resolution:

```json
{
  "dependencies": {
    "@mrmeg/expo-media": "workspace:*"
  }
}
```

## Public Imports

The package export map supports these stable import paths:

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

Root imports are shared-contract only and must not load React Native, Expo
native modules, or AWS SDK code. Use `/server` only in server route files.

Prefer the granular processing subpaths above. The broad `/processing` export
remains available for compatibility, but consumers that import it may expose
their bundler to every processing feature at once. Normal upload/list/delete
code should use `/client` or `/react-query` and remain processing-free.

The package declares `"sideEffects": false` and keeps heavyweight optional
features behind lazy boundaries:

- `heic2any` is loaded inside `convertHeicToJpeg()` only when web HEIC input
  needs conversion.
- `expo-video-thumbnails` is loaded only by the native thumbnail path.
- FFmpeg web conversion loads its script, core, wasm, and worker at runtime
  only when `convertVideo()` is called.

## Build Output

The package ships ESM from `packages/media/dist`. TypeScript emits the package
with bundler-style source imports, then
`scripts/fix-media-package-esm.mjs` rewrites emitted relative JavaScript
specifiers to explicit `.js` or `/index.js` paths so Node ESM, package
inspectors, and non-Metro tooling can resolve published files.

`media:consumer-smoke` packs the package into a clean fixture, validates the
export-map files, type-checks root/client/react-query/processing/server
imports, runs a root runtime import, and verifies package docs are installed
under `node_modules/@mrmeg/expo-media`.

## Configuration Model

There are two app configuration surfaces. Keep them separate.

1. Server storage policy:
   configured with `createMediaConfig()` in server code. This controls buckets,
   prefixes, accepted content types, max bytes, and URL expiry.

2. Client upload defaults:
   configured in an app-owned settings module. This controls default
   compression, per-flow upload policies, selection limits, and client fallback
   behavior.

The package owns primitives, not product defaults. Consuming apps should create
one app-wide settings file so media behavior does not get scattered across
screens.

This template uses:

```ts
// client/features/media/mediaSettings.ts
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
};
```

Other apps should copy this shape, change the values, and keep their screens
reading defaults from that file.

## Server Setup

Create a server-owned media config:

```ts
import { createMediaConfig } from "@mrmeg/expo-media";

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
```

Config fields:

| Field | Owner | Purpose |
|---|---|---|
| `buckets.*.provider` | app | `s3` or `r2` |
| `buckets.*.bucket` | app/env | physical bucket name |
| `buckets.*.endpoint` | app/env | required for R2 |
| `buckets.*.region` | app/env | S3 region or R2 `auto` |
| `buckets.*.credentials` | app/env | storage credentials |
| `mediaTypes.*.bucket` | app | bucket alias used by this media type |
| `mediaTypes.*.prefix` | app | storage key prefix for generated objects |
| `mediaTypes.*.allowedContentTypes` | app | accepted MIME allowlist |
| `mediaTypes.*.maxBytes` | app | optional per-media-type upload size limit |
| `mediaTypes.*.uploadExpiresInSeconds` | app | signed upload URL lifetime |
| `mediaTypes.*.readExpiresInSeconds` | app | signed read URL lifetime |

`prefix` is the app's path contract. Clients choose `mediaType`; they never
send arbitrary bucket names or raw prefixes. The server derives the final
object key under the configured prefix.

Listing follows the same contract. A list request must include a configured
`mediaType` or a narrower prefix that resolves inside a configured media type.
The package rejects bucket-root listing, unknown prefixes, absolute paths,
traversal, and prefixes that cross media-type boundaries. If an app needs an
"all media" view, query each configured media type separately and merge the
visible results client-side. Keep pagination per media type; the template's
All view merges the current visible page from each configured type rather than
creating a cross-type cursor.

## Server Handlers

Wrap the config with package handlers:

```ts
import { createMediaHandlers } from "@mrmeg/expo-media/server";
import { mediaConfig } from "./config";

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
      // Optional: create an app-owned pending media metadata row.
    },
    onDeleted: async ({ auth, keys }) => {
      // Optional: reconcile app-owned metadata.
    },
  },
});
```

Policy callbacks are where product rules live. Examples:

- only let a user upload avatars to their own account
- block videos unless the account is on a paid plan
- prevent deletion of media attached to finalized records
- write metadata rows when an upload URL is signed

Expo Router API route files should remain thin:

```ts
import { mediaHandlers } from "@/server/media/handlers";

export const OPTIONS = mediaHandlers.options;
export const POST = mediaHandlers.getUploadUrl;
```

This template keeps these public routes:

- `/api/media/getUploadUrl`
- `/api/media/getSignedUrls`
- `/api/media/list`
- `/api/media/delete`

Missing bucket credentials or invalid media config return a typed `503`
`media-disabled` JSON response without constructing an S3 client.

Batch delete resolves every key to its configured media type before storage
mutation. When a request spans multiple physical buckets, the handler sends one
delete command per bucket, merges confirmed deletions, and returns per-key
errors for any bucket group that fails. `events.onDeleted` runs once with the
confirmed deleted keys only.

## Client Setup

Create the package client once:

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

Keep app-local hook files as compatibility adapters while refactoring:

```ts
// client/features/media/hooks/useMediaUpload.ts
import { mediaQueryHooks } from "../mediaClient";

export const useMediaUpload = mediaQueryHooks.useMediaUpload;
```

That lets screens keep old import paths while the implementation moves into
the package.

## Upload Contract

Upload signing requires content-type based input:

```ts
await upload({
  file: blobOrNativeUri,
  mediaType: "avatars",
  contentType: "image/jpeg",
  size: blob.size,
});
```

Request body:

```ts
{
  mediaType: string;
  contentType: string;
  size?: number;
  customFilename?: string;
  metadata?: unknown;
}
```

The server validates `mediaType`, validates `contentType` against the media
type config, checks optional size limits, derives the extension server-side,
and signs the matching `Content-Type` header. Do not restore
`{ extension, mediaType }` as the primary path.

Custom filenames are sanitized and require policy approval. This template only
allows custom filenames for video thumbnails so thumbnail names can match video
ids.

## App-Wide Client Defaults

This template's compression store reads from
`client/features/media/mediaSettings.ts`:

```ts
const initialState = {
  defaultPreset: MEDIA_APP_SETTINGS.imageCompression.defaultPreset,
  userOverrides: MEDIA_APP_SETTINGS.imageCompression.userOverrides,
  enabled: MEDIA_APP_SETTINGS.imageCompression.enabled,
};
```

Default behavior in this template:

| Setting | Value |
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

Package preset defaults:

| Preset | maxDimension | quality | maxSizeKB | minQuality | format |
|---|---:|---:|---:|---:|---|
| `avatar` | 512 | 0.8 | 200 | 0.6 | jpeg |
| `thumbnail` | 256 | 0.7 | 100 | 0.5 | jpeg |
| `product` | 1024 | 0.85 | 500 | 0.6 | jpeg |
| `gallery` | 2048 | 0.85 | 1000 | 0.65 | jpeg |
| `highQuality` | 3000 | 0.9 | 2000 | 0.7 | jpeg |
| `none` | original | original | none | none | original |

Override precedence:

1. Package preset values from `IMAGE_PRESETS`
2. App-wide defaults in `MEDIA_APP_SETTINGS`
3. Runtime store overrides, if the app exposes user controls
4. Per-flow `pickMedia({ compression })` overrides

Use per-flow overrides for specific screens:

```ts
pickMedia({ compression: "avatar" });
pickMedia({ compression: "highQuality" });
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

## Upload Policy Recipes

Recommended app policy shape:

```ts
export const MEDIA_APP_SETTINGS = {
  uploadPolicies: {
    avatar: {
      mediaType: "avatars",
      compression: "avatar",
    },
    generalImage: {
      mediaType: "uploads",
      compression: "gallery",
    },
    originalImage: {
      mediaType: "uploads",
      compression: "none",
    },
    video: {
      mediaType: "videos",
      compression: null,
    },
  },
};
```

Screens should choose named policies instead of hardcoding media types,
quality values, and target paths inline.

Recipe guidance:

| Flow | mediaType | compression | Notes |
|---|---|---|---|
| Profile avatar | `avatars` | `avatar` | Small square, low max byte target |
| General photo upload | `uploads` | `gallery` | Good default for user media |
| Product/item image | `uploads` or custom | `product` | Lower dimension and byte target |
| Original archive | `uploads` | `none` | Preserve original exactly |
| Video | `videos` | `null` | No image compression; optional web MP4 conversion |
| Video thumbnail | `thumbnails` | generated JPEG | App-owned custom filename policy |

## Processing Behavior

Prefer granular processing imports:

```ts
import {
  compressImage,
  convertHeicToJpeg,
  shouldUseProcessedFile,
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

Use processing helpers for:

- compression presets and `compressImage()`
- `shouldUseProcessedFile()` for rejecting larger processed media results
- `shouldUseCompressedImage()` as the image-specific guard alias
- HEIC to JPEG conversion on web
- `extractVideoThumbnail()`
- `needsConversion()` and optional `convertVideo()`
- `FFMPEG_WORKER_URL`

Important behavior:

- `expo-image-picker` is called with `quality: 1`; compression happens after
  picking.
- HEIC conversion happens before image compression on web.
- Image compression progressively lowers quality by `0.05` until the target
  size is reached or `minQuality` is hit.
- If `keepOriginalIfLarger` is true and the processed output is not smaller
  than the source, the app uploads the source asset instead.
- Native pickers may omit source size; unknown source size allows processed
  output because there is no reliable comparison.
- Videos are not image-compressed. Web can optionally transcode unsupported
  formats to MP4, subject to the app's size limit and worker availability.
- The broad `@mrmeg/expo-media/processing` barrel re-exports all processing
  helpers and should be avoided in light screens, stores, or config modules.

The FFmpeg worker remains an app deployment responsibility. This template keeps
`server/ffmpegWorker.js`, `metro.config.js`, and `server/index.ts` responsible
for same-origin worker serving.

## File Paths And Keys

The package treats configured media type prefixes as the path contract. For
example:

```ts
mediaTypes: {
  videos: { prefix: "videos", ... },
  thumbnails: { prefix: "thumbnails", ... },
}
```

Generated keys look like:

```txt
videos/01KQT7....mp4
thumbnails/01KQT7....jpg
uploads/01KQT7....jpg
users/avatars/01KQT7....jpg
```

Rules:

- clients send `mediaType`, not a raw prefix
- clients do not choose bucket names
- server derives extensions from approved content types
- keys must resolve inside configured media type prefixes
- batch delete accepts up to 1000 keys
- this template deletes generated video thumbnails with selected videos

## Error Handling

Media client hooks throw `MediaError` with typed problems:

- `disabled`
- `bad-request`
- `unauthorized`
- `forbidden`
- `unknown`

Server JSON error codes include:

- `media-disabled`
- `unauthorized`
- `forbidden`
- `invalid-media-type`
- `invalid-content-type`
- `oversized-file`
- `bad-key`
- `storage-failure`

Screens should branch on typed errors instead of parsing message text. This
template renders a setup state for `media-disabled` and does not retry that
state through React Query.

## Migration Guide

Use this checklist when refactoring an app to consume the package:

1. Install `@mrmeg/expo-media` and required Expo peer dependencies.
2. Move bucket definitions into `server/media/config.ts` using
   `createMediaConfig()`.
3. Replace custom presigner/list/delete route logic with
   `createMediaHandlers()`.
4. Keep Expo Router route files as thin exports from `mediaHandlers`.
5. Create `client/features/media/mediaClient.ts` with `createMediaClient()`
   and `createMediaQueryHooks()`.
6. Keep old app hook paths as adapters while deleting copied implementation.
7. Create `client/features/media/mediaSettings.ts` for app-wide defaults.
8. Replace inline compression/path decisions with named upload policies.
9. Replace copied compression, HEIC, thumbnail, and video conversion helpers
   with granular `@mrmeg/expo-media/processing/*` imports.
10. Reconcile app-owned metadata in handler events if the app has media rows.
11. Add a media-disabled UI state for missing storage config.
12. Run package and app validation.

Good deletion candidates in consuming apps:

- copied S3/R2 presigner code
- copied media route body parsing
- copied allowed-content-type validation
- copied signed URL batching
- copied React Query media hooks
- copied image compression utilities
- copied HEIC conversion utilities
- copied video thumbnail extraction utilities
- copied media error mappers

Keep app-owned:

- media settings
- auth policy
- database metadata
- screen UI
- feature-specific media types
- production deployment wiring

## Validation

Use these checks sequentially when debugging package artifacts:

```sh
bun run media:typecheck
bun run media:test
bun run media:build
bun run media:pack
bun run media:consumer-smoke
```

For the template app after integration changes:

```sh
bun run typecheck
bun run lint
git diff --check
```

Run route tests when touching server handlers or app route adapters:

```sh
bun x jest app/api/media/__tests__ --runInBand --watchman=false
```

Run package processing tests when touching compression, HEIC, thumbnail, or
video conversion helpers:

```sh
bun run media:test
```

## GitHub Trusted Publishing

Use the `Publish Media Package` GitHub Actions workflow to publish
`@mrmeg/expo-media` from GitHub. It mirrors the UI package release workflow:
version selection, package gates, packed consumer smoke validation, npm OIDC
trusted publishing, and optional `NPM_TOKEN` fallback.

First publish bootstrap:

1. If `@mrmeg/expo-media` does not exist on npm yet, create an npm automation
   or granular access token with publish access to the `@mrmeg` scope.
2. Add it to GitHub repository secrets as `NPM_TOKEN`.
3. Run the `Publish Media Package` workflow manually once.
4. After the package exists, configure npm trusted publishing for
   `publish-media.yml`.
5. Remove `NPM_TOKEN` if you want future publishes to rely only on OIDC.

Push-based runs skip cleanly when the package does not exist and `NPM_TOKEN` is
absent, so the initial missing package does not make CI fail. Manual runs fail
with setup instructions in that same state.

One-time npm package setup:

1. Open npm package settings for `@mrmeg/expo-media` after the first publish.
2. Add a trusted publisher.
3. Select GitHub Actions.
4. Set owner/user to `mrmeg`.
5. Set repository to `expo-template`.
6. Set workflow filename to `publish-media.yml`.

Push-based publish:

1. Bump `packages/media/package.json` to a version not yet published on npm.
2. Commit and push to `main`.

The workflow runs automatically when `packages/media/package.json` changes on
`main`. It reads the committed version, skips cleanly if npm already has it,
otherwise runs the media package gates and packed consumer smoke check, then
runs `npm publish --access public` from `packages/media`.

Manual publish:

1. Open GitHub Actions.
2. Run the `Publish Media Package` workflow.
3. Set `version` to `patch`, `minor`, `major`, or an exact version.
4. Set `ref` to the release branch, normally `main`.

Manual workflow runs bump `packages/media/package.json`, update `bun.lock`, run
the media package gates and packed consumer smoke check, publish from
`packages/media`, then commit the version bump back to the selected branch
after publish succeeds.

Fallback token setup:

1. Create an npm automation or granular access token with publish access to
   `@mrmeg/expo-media`, or to the `@mrmeg` scope before the package exists.
2. Add it to GitHub repository secrets as `NPM_TOKEN`.
3. Rerun the same `Publish Media Package` workflow.

When `NPM_TOKEN` is absent, the workflow clears setup-node's placeholder npm
token config and lets npm CLI use the GitHub Actions OIDC environment for
trusted publishing. When `NPM_TOKEN` is present, it writes that token to a
temporary npm config for the publish step.

If a manual publish fails after the workflow has already bumped the package
version, rerun the workflow with the exact current version, for example
`version=0.1.0`. Exact-version reruns do not bump the package again.

For trusted publishing, npm requires `packages/media/package.json`
`repository.url` to match the GitHub repository exactly. Keep it in npm's
canonical git URL form:
`git+https://github.com/mrmeg/expo-template.git`.
