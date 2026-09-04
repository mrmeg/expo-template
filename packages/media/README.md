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
- the `processAsset` pipeline: content-type identification, the upload format
  policy, image compression, HEIC conversion, thumbnails, and optional web video
  conversion
- Fetch-compatible server handlers for S3/R2 presigned URL workflows
- typed media error mapping

App-owned:

- auth and route mounting
- bucket credentials and environment variable names
- server policy decisions and database metadata
- app-wide media settings, including the content-type allowlist both sides share
- UI screens and media manager composition
- FFmpeg worker serving for web
- monitoring and analytics SDKs

## Install

```sh
bun add @mrmeg/expo-media
```

Core contracts and server handlers require no React or Expo runtime. React
Query, React Native, Expo native modules, and `heic2any` are optional peers so
apps install only the features they use while retaining ownership of provider
singletons and native-module versions. Native compression and thumbnail
generation use `expo-file-system`, `expo-image-manipulator`, and `expo-video`;
React Query hooks use `@tanstack/react-query`; browser HEIC conversion uses
`heic2any`. Server signing dependencies are package-owned: handlers sign S3/R2
requests with `aws4fetch` over `fetch`, so consumers do not install the AWS SDK.

Install optional peers with the consuming app's package manager. Use Expo CLI
for Expo-owned modules so their versions match the app SDK:

```sh
bunx expo install expo-file-system expo-image-manipulator expo-video
bun add @tanstack/react-query heic2any
```

The package supports Expo 55–57 and React Native 0.83–0.86. A consumer only
needs the peers required by the entrypoints and features it imports.

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
  createKvTokenAuthorizer,
  createMediaWorker,
} from "@mrmeg/expo-media/worker";
import { processAsset, mapWithConcurrency } from "@mrmeg/expo-media/processing";
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
modules, or storage signing code. Use `/server` only in server route files, and
`/worker` only in a Cloudflare Worker entry.
`/processing` is the entry point for `processAsset` and the pipeline pieces it
coordinates. Screens that only read config — a settings screen, a preference
store — should import the granular subpath instead
(`/processing/image-compression/config`) so they do not pull the whole pipeline
into a light bundle.

Heavy processing dependencies are behind lazy boundaries. `heic2any` loads
inside `convertHeicToJpeg()`, native thumbnail extraction loads `expo-video`
and `expo-image-manipulator` only on the native path, `expo-file-system` loads
only when a native file URI needs to be measured, and FFmpeg assets load only
when web `convertVideo()` runs. Bundlers that honor package side-effect metadata
also see `"sideEffects": false`.

Each lazy dependency also has an injection seam so it can be replaced in tests
without a bundler: `processAsset({ adapter })`, `convertHeicToJpeg(blob,
fileName, decoder)`, and `resolveUploadSize(file, stat)`.

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
    // Each in-flight asset holds a full-resolution bitmap, so this is a memory
    // ceiling rather than a throughput knob.
    concurrency: 3,
  },
  uploads: {
    selectionLimit: 20,
    uploadVideoThumbnails: true,
    deleteVideoThumbnailWithVideo: true,
  },
  uploadPolicies: {
    avatar: { mediaType: "avatars", compression: "avatar" },
    generalImage: { mediaType: "uploads", compression: "gallery" },
    video: { mediaType: "videos", compression: null },
  },
} as const;
```

There is no `keepOriginalIfLarger` setting. The never-larger decision is
format-aware and belongs to the pipeline, not to app config — see
`chooseUploadCandidate()` under [Processing](#processing).

The app also owns the content-type allowlist, because the client's encode target
and the server's `allowedContentTypes` have to be the same list:

```ts
export const IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const VIDEO_CONTENT_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export const MEDIA_CONTENT_TYPE_ALLOWLIST = {
  image: IMAGE_CONTENT_TYPES,
  video: VIDEO_CONTENT_TYPES,
} as const;
```

Do not add `image/heic` to it. No browser renders HEIF, and accepting it would
let an undisplayable file into storage while hiding client transcode failures.

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
      // Same list the client processes toward. HEIC is never allowlisted; the
      // client transcodes it to JPEG before signing.
      allowedContentTypes: [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif",
        "video/mp4",
        "video/quicktime",
        "video/webm",
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

Expose the handlers through one consolidated Expo Router route file —
`expo export` bundles every `+api.ts` separately, so per-action files would
each duplicate the S3 + auth stack. A single `app/api/media/[action]+api.ts`
keeps the URLs (`/api/media/list`, `/api/media/getUploadUrl`, ...) while
emitting one bundle:

```ts
import { mediaHandlers } from "@/server/media/handlers";

const routes = {
  list: { GET: mediaHandlers.list },
  getUploadUrl: { POST: mediaHandlers.getUploadUrl },
  getSignedUrls: { POST: mediaHandlers.getSignedUrls },
  delete: { DELETE: mediaHandlers.deleteOne, POST: mediaHandlers.deleteMany },
};

export function POST(request: Request, { action }: { action: string }) {
  const handler = routes[action]?.POST;
  return handler ? handler(request) : notFoundResponse(request);
}
// GET / DELETE / OPTIONS dispatch the same way — see the template's
// app/api/media/[action]+api.ts for the full file.
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

Listing also stays scoped. Use `mediaType` for normal list requests:

```ts
await client.list({ mediaType: "uploads" });
```

Optional `prefix` values must be narrower paths inside a configured media type
prefix. Requests without `mediaType` or a valid configured prefix return
`400 bad-request`; unknown, absolute, traversal, or cross-media-type prefixes
return `400 bad-key`. Apps that need an "all media" view should list each
configured media type separately and merge the visible results client-side
instead of listing the storage bucket root. Keep pagination per media type;
the template's All view merges the current visible page from each configured
type rather than creating a cross-type cursor.

## Cloudflare Worker

`@mrmeg/expo-media/worker` deploys the same handlers as a standalone Cloudflare
Worker, so several apps can share one media endpoint instead of each mounting
their own API routes. The runtime is `fetch` + Web Crypto only — no
`nodejs_compat` flag required — and the subpath declares KV structurally, so the
package never depends on `@cloudflare/workers-types`.

```ts
import { createMediaConfig } from "@mrmeg/expo-media";
import {
  createKvTokenAuthorizer,
  createMediaWorker,
  type MediaTokenAuth,
} from "@mrmeg/expo-media/worker";

interface Env {
  MEDIA_AUTH: KVNamespace;
  R2_BUCKET?: string;
  R2_ENDPOINT?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
}

export default createMediaWorker<Env, MediaTokenAuth>({
  basePath: "/api/media",
  createOptions: (env) => ({
    config: () => createMediaConfig({ /* buckets + mediaTypes from env */ }),
    authorize: createKvTokenAuthorizer(env.MEDIA_AUTH),
    cors: { getHeaders, getPreflightHeaders },
    policy: {
      canUpload: ({ auth }) => ({ allowed: Boolean(auth) }),
    },
  }),
});
```

`createOptions` runs once per `env` object and its handlers are cached in a
`WeakMap`, because a Worker only sees `env` inside `fetch()` while
`createMediaHandlers` captures its options at creation time. Build config with
the factory form (`config: () => ...`) so missing secrets still return
`503 media-disabled`.

Routing mirrors the Expo route table exactly, under `basePath` (default
`/api/media`):

| Route | Methods |
|---|---|
| `list` | `GET` |
| `getUploadUrl` | `POST` |
| `getSignedUrls` | `POST` |
| `delete` | `DELETE` (`?key=`), `POST` (`{ keys }`) |

`OPTIONS` on a known action returns the `cors.getPreflightHeaders` response.
Unknown actions and paths outside `basePath` return `404 not-found`; a known
action with an unsupported method returns `405 method-not-allowed`. Both carry
`cors.getHeaders`.

`createKvTokenAuthorizer(kv)` is a ready-made `authorize` for static per-app
bearer tokens. It reads `Authorization: Bearer <token>`, looks up
`token:<token>` in KV, and expects JSON metadata containing at least
`{ "app": "<name>" }`:

```sh
wrangler kv key put --binding MEDIA_AUTH "token:$(openssl rand -hex 32)" '{"app":"my-app"}'
```

A missing header, malformed header, unknown token, or unusable metadata yields
`null`, which the handlers turn into `401 unauthorized`. A successful lookup
gives policy and event callbacks
`auth: { token, app, metadata }` (`MediaTokenAuth`) — use `auth.app` for
per-app scoping. `MediaTokenStore` is the KV shape the authorizer needs
(`{ get(key: string): Promise<string | null> }`), which a real `KVNamespace`
satisfies.

This repo ships a deployable example at `workers/media/` with a wrangler
config and deploy runbook.

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
  contentType: processed.contentType,
  size: processed.size,
  metadata: { takenAt, lat, lng },
});
```

The old `{ extension, mediaType }` signing body is not the primary contract.
The server derives the extension from the approved content type and signs the
matching `Content-Type` header.

`size` is optional but should always be sent: it is what the server's
per-media-type `maxBytes` check reads, and a rejected signing request costs
nothing while a rejected upload costs the whole transfer. When it is omitted,
`upload()` measures the payload itself — including native file URIs, via
`resolveUploadSize()`, which stats them with `expo-file-system`.

`metadata` is forwarded to the signing request untouched and reaches
`policy.canUpload` and `events.onUploadSigned`. Use it for app-owned facts about
the asset (EXIF capture time, coordinates); the package never interprets it.

## App-Wide Defaults

Default behavior should be configured by the app, then used by screens and
hooks. Typical defaults:

| Setting | Example |
|---|---|
| compression enabled | `true` |
| default preset | `gallery` |
| user overrides | `null` |
| processing concurrency | `3` |
| picker quality | `1` |
| multi-upload selection limit | `20` |
| upload video thumbnails | `true` |
| delete generated thumbnail with video | `true` |

Override precedence:

1. Package preset values from `IMAGE_PRESETS`
2. App-wide defaults in the app's media settings file
3. Runtime store overrides, if the app exposes user controls
4. Per-asset upload policy (`compression`) resolved before processing

## Processing

`processAsset()` is the entry point. One orchestrator runs every picked asset on
both platforms and has exactly two outcomes: an immutable `ProcessedUpload`
whose `contentType` is in the allowlist that was passed in, or a thrown
`MediaProcessingError` reported against that asset. There is no
`application/octet-stream` fallback — that fallback is what let a phone's HEIF
photo reach the server with a content type the server refuses.

```ts
import {
  processAsset,
  mapWithConcurrency,
  isMediaProcessingError,
} from "@mrmeg/expo-media/processing";
import { resolveCompressionConfig } from "@mrmeg/expo-media/processing/image-compression/config";

const processed = await mapWithConcurrency(assets, 3, async (asset) => {
  try {
    return await processAsset({
      asset,
      allowlist: MEDIA_CONTENT_TYPE_ALLOWLIST,
      config: resolveCompressionConfig("gallery"),
      onPhase: (a, phase) => setStatus(a.uri, phase.type),
    });
  } catch (error) {
    if (isMediaProcessingError(error)) return markFailed(asset, error.code);
    throw error;
  }
});
```

`ProcessedUpload` carries `{ kind, uri, blob?, contentType, width, height, size,
originalSize, overBudget, applied, durationSeconds?, thumbnail? }`. It is frozen,
including `applied` — the ordered, human-readable trace of what the pipeline did
(`["passthrough:176KB"]`, `["heic-decode", "resize:2048", "encode:image/jpeg"]`,
`["resize:1024", "encode:image/jpeg", "over-budget"]`), which is the thing to log
or show in a debug row.

`onPhase` receives `identifying`, `decoding-heic`, `compressing`,
`passthrough`, `converting-video`, `extracting-thumbnail`, and `complete`. The
orchestrator itself renders nothing, so the app keeps owning its toasts and
progress UI.

Failures are typed. `MediaProcessingError.code` is one of
`unsupported-format`, `heic-conversion-failed`, `decode-failed`,
`encode-failed`, or `stat-failed`, with `contentType` set when the offending
source was identified.

### Image Presets

Compression is a descending long-edge ladder at fixed quality against a byte
budget: encode at the first rung, and if the result misses `byteBudget`, drop to
the next rung and re-encode from the source. Quality never decays — dropping
pixels beats adding artifacts, which is the model production messengers
converged on.

| Preset | rungs (long edge px) | quality | byteBudget | passthroughBytes |
|---|---|---:|---:|---:|
| `avatar` | 512 | 0.8 | 200 KB | 0 |
| `thumbnail` | 256 | 0.7 | 100 KB | 0 |
| `product` | 1024, 768 | 0.85 | 500 KB | 0 |
| `gallery` | 2048, 1600, 1024 | 0.8 | 1000 KB | 300 KB |
| `highQuality` | 4096, 3072, 2048 | 0.8 | 3000 KB | 300 KB |
| `none` | `null` (no ladder) | — | — | — |

- `passthroughBytes` is the source size at or below which an already-allowlisted
  asset is uploaded untouched. It is `0` for the presets that exist to hit a
  specific display size, so those always resize.
- `format` is `null` on every preset, which means "the upload format policy
  decides": PNG stays PNG, everything else encodes to JPEG. It no longer means
  "silently JPEG", which is what used to flatten alpha channels.
- The last rung is used even if it misses the budget; the result sets
  `overBudget: true` so the app can warn instead of silently uploading a large
  file.
- `resolveCompressionConfig()` normalizes custom configs rather than trusting
  them: rungs come back positive, deduped and descending, quality inside
  `[MIN_QUALITY, 1]`, budgets non-negative. A caller that overrides one field
  cannot produce a config the ladder is unable to run.

```ts
resolveCompressionConfig("avatar");
resolveCompressionConfig("none"); // → null
resolveCompressionConfig({ rungs: [1600, 1200], quality: 0.8, byteBudget: 750 * 1024 });
```

### Format Policy

`resolveUploadFormatPolicy(sourceContentType, allowlist)` returns
`passthrough`, `transcode` (with an `outputFormat`), or `reject`, plus the flags
the pipeline needs (`requiresHeicDecode`, `flattensAnimation`,
`sourceAllowlisted`). It is pure, so both platforms get the same answers from
the same tests.

`chooseUploadCandidate()` decides whether to keep the processed output or revert
to the source. Reverting requires all of: the source type is allowlisted, the
processed output is the *same* format, the source size is known, and the
processed file is not smaller. A format conversion therefore always wins even
when it is larger — a smaller HEIC the server rejects is not a better upload
than a larger JPEG it accepts.

### Behavior Notes

- Pick the original asset first, then process it. Use `quality: 1` with
  `expo-image-picker` so the picker does not pre-compress what the ladder is
  about to encode.
- Resolve the per-asset upload policy (and therefore its compression config)
  *before* processing, not after. Processing to the wrong target and fixing it
  later is what the single-orchestrator shape removes.
- HEIC has no passthrough path. On web it is decoded with `heic2any` (lazy,
  optional peer) before the ladder runs; on native the encoder decodes HEIF
  directly. A failed decode fails the asset.
- Web never emits WebP (canvas support is not portable) and clamps the requested
  long edge to the browser's canvas ceiling before drawing (`canvasLimits.ts`:
  4096 on iOS, 11180 on Firefox, 16384 on Chromium and desktop Safari).
- Ladder dimensions are computed in *displayed* orientation, so an EXIF-rotated
  portrait photo is not capped along the wrong axis.
- Every losing rung is disposed as soon as it loses, including when a later rung
  throws, so a multi-asset selection does not accumulate temp files.
- Videos are not image-compressed. Web can optionally transcode unsupported
  formats to MP4; a video whose content type is not in the video allowlist and
  cannot be converted is rejected.
- Native thumbnails use `expo-video.generateThumbnailsAsync()` and save the
  resulting native image reference to a cache-file URI through
  `expo-image-manipulator`. A thumbnail failure never fails the video.
- Apps must serve `FFMPEG_WORKER_URL` from the same origin in Metro and the
  production server when using web video conversion.
- Use `mapWithConcurrency(items, limit, worker)` instead of `Promise.all` for
  multi-asset selections. Each in-flight asset holds a full-resolution bitmap,
  so an unbounded map over 20 photos janks the web tab and gets the native app
  killed. Results stay in input order.
- Import `/processing` where the pipeline actually runs. Settings screens,
  stores, and other light consumers should import
  `/processing/image-compression/config` instead, so reading a preset does not
  pull the whole pipeline into their bundle.

### Lower-Level Entry Points

`processAsset` is the supported path. The pieces below it are exported for apps
that need one step in isolation:

```ts
import {
  compressImage,
  convertHeicToJpegIfNeeded,
  runDimensionLadder,
} from "@mrmeg/expo-media/processing/image-compression";
import {
  needsConversion,
  convertVideo,
  FFMPEG_WORKER_URL,
} from "@mrmeg/expo-media/processing/video-conversion";
import { extractVideoThumbnail } from "@mrmeg/expo-media/processing/video-thumbnails";
```

`compressImage()` runs the ladder for the current platform and returns
`{ uri, blob?, contentType, width, height, size, rung, attempts, overBudget }`.
It does not consult the allowlist — that is what `processAsset` adds.

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
- list requests must include `mediaType` or a valid narrower configured prefix
- batch delete accepts up to 1000 keys
- batch delete groups keys by the bucket configured for each resolved media
  type, merges confirmed deletions, and reports per-key errors for partial
  bucket failures

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

Client processing throws `MediaProcessingError` with a `code` of
`unsupported-format`, `heic-conversion-failed`, `decode-failed`,
`encode-failed`, or `stat-failed`. Use `isMediaProcessingError()` to narrow, and
report it against the asset that caused it — a per-asset failure should not fail
the rest of a multi-asset selection.

Screens should branch on typed errors instead of parsing message text.

## Migration Checklist

Use this checklist when refactoring an app:

1. Install the package and peer dependencies.
2. Move bucket definitions into `createMediaConfig()`.
3. Replace custom route logic with `createMediaHandlers()`.
4. Keep Expo Router route files as thin handler exports.
5. Create a package-backed `mediaClient`.
6. Replace custom React Query hooks with `createMediaQueryHooks()`.
7. Add an app-wide media settings file, including one shared content-type
   allowlist used by both `createMediaConfig()` and `processAsset()`.
8. Replace inline quality/path decisions with named upload policies, resolved
   per asset before processing.
9. Replace copied image processing helpers with one `processAsset()` call, and
   the multi-asset `Promise.all` with `mapWithConcurrency()`.
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
- per-branch content-type juggling and `application/octet-stream` fallbacks
- app-level "keep the original if it is smaller" checks
- temp-file cleanup passes over compression output
- copied media error mappers

## Validation

Run package checks sequentially when debugging generated artifacts:

```sh
bun run packages:peer-check
bun run media:typecheck
bun run media:test
bun run media:build
bun run media:pack
bun run media:consumer-smoke
```

`media:consumer-smoke` installs the packed tarball into a clean fixture,
verifies that core/server entrypoints install without optional peers,
type-checks documented entrypoints with all features installed, verifies
export-map files, runs root runtime imports, and checks that installed-package
docs are present. CI also installs packed media consumers against Expo 55, 56,
and 57.

## Package Release

For a one-command local release from the repo root, use:

```sh
bun run media:release -- --patch --publish
```

Replace `--patch` with `--minor`, `--major`, or an exact version. Without
`--publish`, the command performs the version bump and all release gates but
does not publish. It requires a clean working tree unless `--allow-dirty` is
passed intentionally.

## GitHub Publishing

Use the `Publish Media Package` GitHub Actions workflow to publish
`@mrmeg/expo-media` from GitHub. Configure npm trusted publishing for:

- owner/user: `mrmeg`
- repository: `expo-template`
- workflow filename: `publish-media.yml`

If the package does not exist on npm yet, first publish needs a repository
secret named `NPM_TOKEN` with publish access to the `@mrmeg` scope. Run the
workflow manually once with that token, then configure trusted publishing from
the new package settings page. Push-based runs skip cleanly when the package is
missing and no token is configured so CI does not fail before the first publish.

After bootstrap, the workflow uses npm trusted publishing by default and still
supports `NPM_TOKEN` as a fallback publish credential. Pushes to `main` that
change `packages/media/package.json` publish the committed version when npm does
not already have it. Manual runs can bump `patch`, `minor`, `major`, or an exact
version, then publish and commit the version bump back to the selected branch.
