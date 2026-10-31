# @mrmeg/expo-media

Reusable media contracts, API clients, React Query hooks, processing helpers,
and S3/R2 server handler factories for Expo apps.

## Ownership Boundary

Package-owned: media config contracts and safe key helpers, client
upload/list/read/delete API factories, React Query hook factories, the
`processAsset` pipeline (content-type identification, upload format policy, image
compression, HEIC conversion, thumbnails, optional web video conversion),
headless picking (`/picker`) and the process-and-upload queue (`/upload-queue`),
Fetch-compatible S3/R2 presigned-URL handlers, typed media error mapping.

App-owned: auth and route mounting, bucket credentials and env var names, server
policy decisions and database metadata, app-wide media settings including the
content-type allowlist both sides share, UI screens (and the toasts, alerts, and
settings stores around picking and uploading), FFmpeg worker serving for web,
monitoring and analytics SDKs.

## Install

```sh
bun add @mrmeg/expo-media
```

Every peer is optional; install only what the entrypoints you import need.

| Peer | Range | Needed for |
|---|---|---|
| `@tanstack/react-query` | `>=5.101.0 <6` | `/react-query` hooks |
| `expo` | `>=55 <58` | native uploads (`expo/fetch`) |
| `expo-file-system` | `>=55 <58` | native uploads, native size stat |
| `expo-image-manipulator` | `>=55 <58` | native image encode, native video thumbnails |
| `expo-image-picker` | `>=55 <59` | `/picker` only |
| `expo-video` | `>=55 <58` | native video thumbnails |
| `heic2any` | `^0.0.4` | web HEIC → JPEG |
| `react` | `>=19.2 <20` | client, hooks, processing |
| `react-native` | `>=0.83 <0.87` | client, hooks, processing |

```sh
bunx expo install expo-file-system expo-image-manipulator expo-video
bunx expo install expo-image-picker # only if you import /picker
bun add @tanstack/react-query heic2any
```

Core contracts, `/server`, and `/worker` need no React or Expo runtime: handlers
sign S3/R2 requests with the package-owned `aws4fetch` over `fetch`, so consumers
never install the AWS SDK.

The package is platform-split: `compressImage` and the native thumbnail
dependency loader ship as `foo.js` beside `foo.native.js` with extension-less
specifiers, so Metro resolves the native file on iOS/Android and the web file on
web. A native bundler without platform-extension resolution gets the web
implementation.

Monorepo consumers use workspace resolution:

```json
{ "dependencies": { "@mrmeg/expo-media": "workspace:*" } }
```

Each `exports` entry lists a `@mrmeg/source` condition first, pointing at `src`.
Only this repo enables it — tsconfig `customConditions`, Metro
`resolver.unstable_conditionNames`, and the Jest resolver — so the template
builds and tests the sources without a package build. `src` is not published
and no other toolchain sets the condition, so an installed release resolves
`dist` exactly as before; a workspace that does not enable it needs
`bun run pkg media build` first. `dist` is build output and is not committed.

## Public Imports

```ts
import { createMediaConfig } from "@mrmeg/expo-media";
import { createMediaClient } from "@mrmeg/expo-media/client";
import { createMediaQueryHooks } from "@mrmeg/expo-media/react-query";
import { pickMedia, useMediaPicker } from "@mrmeg/expo-media/picker";
import {
  backfillVideoThumbnail,
  useUploadQueue,
  useVideoThumbnailBackfill,
} from "@mrmeg/expo-media/upload-queue";
import {
  isVideoThumbnailKey,
  pairVideoThumbnails,
  videoThumbnailDeleteCompanions,
  videoThumbnailKey,
} from "@mrmeg/expo-media";
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

Root (`@mrmeg/expo-media`) is shared-contract only — no React Native, Expo native
modules, or storage signing code. It exports `createMediaConfig`,
`validateMediaConfig`, `getBucketConfig`, `getMediaTypeConfig`,
`getMediaTypeNames`, `isAllowedContentType`, `normalizeMediaPrefix`,
`resolveContentTypeExtension`, `DEFAULT_CONTENT_TYPE_EXTENSIONS`, key helpers
(`buildMediaKey`, `joinMediaKey`, `isSafeObjectKey`, `mediaTypeForKey`,
`resolveRequestedKey`, `sanitizeFilenameBase`), the video thumbnail pairing
helpers (`mediaKeyId`, `videoThumbnailKey`, `isVideoThumbnailKey`,
`pairVideoThumbnails`, `withVideoThumbnailKeys`,
`videoThumbnailDeleteCompanions`; see [Video Thumbnails](#video-thumbnails)), and error helpers (`MediaError`,
`isMediaError`, `toMediaError`, `shouldRetryMediaError`).

Use `/server` only in server route files and `/worker` only in a Cloudflare
Worker entry. `/picker` is the only entrypoint that imports `expo-image-picker`;
`/upload-queue` imports no picker, React Query, or UI, so it works with any
`upload` function and any `PickedMediaAsset` source. Use `/processing` where the pipeline actually runs; consumers that
only read config (settings screens, preference stores) import
`/processing/image-compression/config` so they do not pull the pipeline into a
light bundle.

Heavy dependencies stay lazy: `heic2any` loads inside `convertHeicToJpeg()`;
`expo-video` and `expo-image-manipulator` load only from the native-only
thumbnail dependency loader, so nothing in this package reaches `expo-video` on
web; `expo-file-system` loads only to measure or upload a native file URI; FFmpeg
loads only when web `convertVideo()` runs. The package declares
`"sideEffects": false`. Each lazy dependency has a test injection seam:
`processAsset({ adapter })`, `convertHeicToJpeg(blob, fileName, decoder)`,
`resolveUploadSize(file, stat)`.

## Configuration Model

Two surfaces: server storage policy through `createMediaConfig()`, and app-wide
client defaults in an app-owned settings file. The package ships presets and
helpers, not product defaults.

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
  imageCompression: { enabled: true, defaultPreset: "gallery", userOverrides: null },
  // Each in-flight asset holds a full-resolution bitmap, so concurrency is a
  // memory ceiling rather than a throughput knob.
  processing: { concurrency: 3 },
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

There is no `keepOriginalIfLarger` setting; the never-larger decision is
format-aware and belongs to `chooseUploadCandidate()` (see
[Format Policy](#format-policy)).

Override precedence:

1. Preset values from `IMAGE_PRESETS`
2. App-wide defaults in the app's media settings file
3. Runtime store overrides, if the app exposes user controls
4. Per-asset upload policy (`compression`), resolved *before* processing

The app also owns the content-type allowlist, because the client's encode target
and the server's `allowedContentTypes` have to be the same list:

```ts
export const IMAGE_CONTENT_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
] as const;

export const VIDEO_CONTENT_TYPES = [
  "video/mp4", "video/quicktime", "video/webm",
] as const;

export const MEDIA_CONTENT_TYPE_ALLOWLIST = {
  image: IMAGE_CONTENT_TYPES,
  video: VIDEO_CONTENT_TYPES,
} as const;
```

Never add `image/heic`: no browser renders HEIF, and allowing it stores an
undisplayable file while hiding client transcode failures.

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
      // The same list the client processes toward, image + video. HEIC is never
      // allowlisted; the client transcodes it to JPEG before signing.
      allowedContentTypes: [...IMAGE_CONTENT_TYPES, ...VIDEO_CONTENT_TYPES],
      maxBytes: 50 * 1024 * 1024,
    },
  },
});

export const mediaHandlers = createMediaHandlers({
  config: mediaConfig,
  authorize: async (request) => requireUser(request),
  policy: {
    canUpload: async ({ auth, mediaType, contentType, size, metadata }) => ({ allowed: true }),
    canRead: async ({ auth, keys, mediaTypes }) => ({ allowed: true }),
    canList: async ({ auth, mediaType, prefix }) => ({ allowed: true }),
    canDelete: async ({ auth, keys, mediaTypes }) => ({ allowed: true }),
  },
  events: {
    // Optional: create and reconcile app-owned metadata.
    onUploadSigned: async ({ auth, key, mediaType, contentType, metadata }) => {},
    onDeleted: async ({ auth, keys }) => {},
  },
});
```

Handlers are Fetch-compatible: `getUploadUrl`, `getSignedUrls`, `list`,
`deleteOne`, `deleteMany`, `options`. `config` also accepts a factory
(`config: () => ...`). Policy callbacks may return a boolean or
`{ allowed, reason?, code?, allowCustomFilename? }`; a falsy `authorize` result
produces `401 unauthorized`. Missing credentials or invalid config return
`503 media-disabled` JSON without constructing an S3 client.

Mount one consolidated Expo Router route: `expo export` bundles every `+api.ts`
separately, so per-action files each duplicate the S3 + auth stack.
`app/api/media/[action]+api.ts` keeps the URLs (`/api/media/list`,
`/api/media/getUploadUrl`, …) in one bundle:

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
// GET / DELETE / OPTIONS dispatch the same way.
```

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
| `mediaTypes.*.requireSize` | refuse signing without `size` (`400 size-required`), so `maxBytes` binds |
| `mediaTypes.*.uploadExpiresInSeconds` | signed upload URL lifetime (default 300) |
| `mediaTypes.*.readExpiresInSeconds` | signed read URL lifetime (default 86400) |

## Keys, Listing, And Deletes

Clients choose `mediaType`, never a raw bucket or path. Keys are generated inside
the configured prefix, with the extension derived from the approved content type:

```txt
users/avatars/01KQT7....jpg
uploads/01KQT7....jpg
videos/01KQT7....mp4
thumbnails/01KQT7....jpg
```

- Keys are generated server-side unless policy sets `allowCustomFilename`;
  custom filenames are sanitized, and an unapproved one returns
  `403 custom-filename-forbidden`.
- Allowed content types and `maxBytes` are checked before signing. A declared
  `size` is signed into the PUT as `Content-Length`, so storage accepts only a
  body of exactly that length; `requireSize` makes `size` mandatory, which is
  what makes `maxBytes` binding rather than advisory.
- `Content-Type` is part of the signed PUT and comes back in the signing
  response `headers`.
- Read, delete, and list keys must stay inside configured prefixes.
- Batch delete accepts up to 1000 keys, groups them by the bucket configured for
  each resolved media type, merges confirmed deletions, and reports per-key
  errors on partial failure. `deleteOne` answers `{ success: true, key }` and
  `deleteMany` answers `{ success, deleted, errors }`; `deleteCompanions` can add
  a `companionErrors` field to either (see [Video Thumbnails](#video-thumbnails)).

Listing stays scoped:

```ts
await client.list({ mediaType: "uploads" });
```

`limit` defaults to 100 and is capped at 1000. Optional `prefix` values must be
narrower paths inside a configured media type prefix. Requests with neither
`mediaType` nor a valid configured prefix return `400 bad-request`; unknown,
absolute, traversal, or cross-media-type prefixes return `400 bad-key`. For an
"all media" view, list each media type separately and merge the visible pages
client-side rather than listing the bucket root, and keep pagination per media
type instead of inventing a cross-type cursor.

## Video Thumbnails

A video stored as `videos/<ID>.mov` keeps its thumbnail at `thumbnails/<ID>.jpg`:
the **same ID** under another prefix. Nothing in storage links the two, so the
upload, the list, and the delete all lean on that one convention, and the package
owns it as pure functions on the root entry (no React Native, no storage):

| Helper | Does |
|---|---|
| `mediaKeyId(key)` | basename without extension: `videos/01ABC.mov` -> `01ABC` |
| `videoThumbnailKey(videoKey, pairing)` | `videos/01ABC.mov` -> `thumbnails/01ABC.jpg` |
| `isVideoThumbnailKey(key, pairing)` | `key` sits directly under `thumbnailPrefix` with the extension |
| `pairVideoThumbnails(videos, thumbnails, pairing)` | `{ videos: { video, thumbnailKey, thumbnail? }[], orphanThumbnails }`, in video order |
| `withVideoThumbnailKeys(keys, { pairing, isVideoKey })` | a delete payload: `keys` plus each video's thumbnail key, deduped |
| `videoThumbnailDeleteCompanions({ pairing, isVideoKey })` | a `deleteCompanions` value (also exported from `/server`) |

`pairing` is `{ thumbnailPrefix, extension? }` (`extension` defaults to `"jpg"`;
the prefix is normalized like every other prefix). Pairing is by exact key, so a
`thumbnails/<ID>.png` beside a `jpg` pairing is an orphan. Keep IDs to
`[A-Za-z0-9_-]` (the ULIDs the server mints are): the thumbnail is uploaded with
`customFilename`, which the server sanitizes, and an ID it changes no longer pairs.
The upload queue's `videoThumbnail` option and the backfill below both name the
file with `mediaKeyId`, so they agree with these helpers. Both need the server to
return `allowCustomFilename` from `canUpload` for the thumbnail media type.

### Deleting both

Have the server delete the thumbnail with its video, so a client that sends only
the video key leaves no orphan:

```ts
import { videoThumbnailDeleteCompanions } from "@mrmeg/expo-media/server";

const thumbnailPairing = { thumbnailPrefix: "thumbnails" };
const isVideoKey = (key: string) => key.startsWith("videos/");

export const mediaHandlers = createMediaHandlers({
  config: mediaConfig,
  deleteCompanions: videoThumbnailDeleteCompanions({ pairing: thumbnailPairing, isVideoKey }),
  policy: {
    // `keys` and `mediaTypes` include the thumbnails.
    canDelete: async ({ auth, keys, mediaTypes }) => ({ allowed: true }),
  },
  events: {
    // `keys` are the requested keys plus the companions that were deleted.
    onDeleted: async ({ auth, keys }) => {},
  },
});
```

`deleteCompanions(key)` is called for each requested key and returns more keys to
delete with it. Companions are held to the rules a requested key is:

- Each must be a safe object key resolving to a configured media type, or it is
  dropped silently; a callback that throws adds none.
- `policy.canDelete` sees the full expanded `keys` and `mediaTypes`, so policy
  governs the thumbnails too.
- They are best effort. A companion is deleted only once the key that named it was
  deleted; a missing one counts as deleted (S3 and R2 answer `204` for an absent
  key, and a `404` for a missing object from other S3-compatible stores is treated
  the same, though a missing bucket is still a failure); a failing one never fails
  the request.
- Requested keys are unchanged: `deleteOne` still answers `{ success: true, key }`
  and `deleteMany` still answers `{ success, deleted, errors }`, where `success`
  and `errors` speak only for the requested keys. `deleteMany`'s `deleted` also
  lists the companions that were deleted, and companion failures appear in a new
  optional `companionErrors: { key?, message? }[]`, present only when non-empty
  (`MediaDeleteResult.companionErrors` on the client).
- The 1000-key cap counts requested keys; companions come on top.

To build the payload on the client instead, `withVideoThumbnailKeys` expands a
list of keys the same way.

### Listing videos with their thumbnails

`usePairedVideoList` pairs the two lists:

```ts
const { data, isLoading, error, thumbnailsError, refetch } = usePairedVideoList({
  videoMediaType: "videos",
  thumbnailMediaType: "thumbnails",
  pairing: { thumbnailPrefix: "thumbnails" },
  limit: 200,
});
// data: { videos: { video, thumbnailKey, thumbnail? }[]; orphanThumbnails: MediaItem[] }
```

It reads the same query keys as `useMediaList` (`queryKeys.list`), so the
invalidation every mutation does refreshes it, and a list another screen already
fetched is shared. `data` is `undefined` until the videos load and the
thumbnails load or fail. A failed thumbnail list pairs every video with none
instead of hiding them, and is reported in `thumbnailsError` (`error` is the
video list's); while it is set, don't offer a backfill. `data` stays the same
object until a list or the pairing's `thumbnailPrefix`/`extension` changes, so an
inline `pairing` is fine. Only the first page of each list is read (`limit`, at
most 1000): with more objects than that, a video can look thumbnail-less and a
thumbnail can look orphaned. Do not delete orphans unless you know both lists
were read in full.

### Backfilling missing thumbnails

For videos uploaded without a thumbnail, `/upload-queue` reads a frame from each
video's signed URL and uploads it under the video's ID. **It downloads video
data, so nothing runs it for you**: the app starts it, from a button or a setting.

```tsx
import { useVideoThumbnailBackfill } from "@mrmeg/expo-media/upload-queue";

function BackfillButton({ missing }: { missing: PairedVideo<MediaItem>[] }) {
  const { mutateAsync: upload } = useMediaUpload();
  const { data: signed } = useSignedMediaUrls({ mediaKeys: missing.map((entry) => entry.video.key) });
  const backfill = useVideoThumbnailBackfill({
    upload,
    thumbnailMediaType: "thumbnails",
    concurrency: 1,
    onSettled: (results) => notifyBackfill(results.filter((r) => r.status === "failed").length),
  });

  const run = () =>
    backfill.run(
      missing.flatMap(({ video }) => {
        const videoUrl = signed?.urls[video.key];
        return videoUrl ? [{ videoKey: video.key, videoUrl }] : [];
      }),
    );

  // backfill.running, backfill.progress ({ done, failed, total }), backfill.results
}
```

- `backfillVideoThumbnail({ videoKey, videoUrl }, { upload, thumbnailMediaType,
  filename?, timeMs?, extract? })` does one video and **never rejects**: it
  resolves `{ status: "uploaded", videoKey, key }` or `{ status: "failed",
  videoKey, errorMessage, error? }`. The frame is at `timeMs` (default 1000) and is
  uploaded as `image/jpeg`, with `size` when the extraction produced a blob.
  `filename` defaults to the video key's ID, and a video whose key has no ID fails
  rather than upload a thumbnail that pairs with nothing. A `blob:` URL the
  extraction created is revoked before it resolves.
- **On web the bucket must allow CORS for the app's origin** on the video URL. The
  frame is drawn to a canvas, and a cross-origin video served without CORS headers
  taints it, so the browser refuses to read it and the result is a failure whose
  `errorMessage` says the frame could not be read and names CORS. Native has no
  such restriction.
- `useVideoThumbnailBackfill({ ...backfillOptions, concurrency?, onSettled? })`
  returns `{ run, running, progress, results }`. `concurrency` (default 1) bounds
  videos read at once across the whole hook. `run(inputs)` ignores a `videoKey`
  that is already queued or running, and a `run` while others are running queues
  behind them (`progress.total` grows at once). `progress` is `{ done, failed,
  total }` since the hook was last idle, with `done + failed === total` when
  settled, and `results` are the outcomes in completion order. `onSettled(results)`
  fires once per `run` batch, with that batch's results in input order.
- Options may be inline: the latest are read as each video starts. Unmounting is
  safe and quiet: videos not yet started are skipped, those in flight finish, and
  no state is set and `onSettled` does not fire.
- The backfill uploads through the `upload` you pass, so with
  `useMediaUpload().mutateAsync` the list queries refresh as thumbnails land and
  `usePairedVideoList` fills in.

## Cloudflare Worker

`@mrmeg/expo-media/worker` deploys the same handlers as a standalone Cloudflare
Worker. The runtime is `fetch` + Web Crypto only — no `nodejs_compat` flag — and
KV is declared structurally, so the package never depends on
`@cloudflare/workers-types`.

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
    policy: { canUpload: ({ auth }) => ({ allowed: Boolean(auth) }) },
  }),
});
```

`createOptions(env)` returns the `createMediaHandlers` options and runs once per
`env` object, its handlers cached in a `WeakMap`. Read bindings there, not at
module scope, and keep `config` in factory form so missing secrets still return
`503 media-disabled`.

Routing mirrors the Expo route table under `basePath` (default `/api/media`):

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
bearer tokens. It reads `Authorization: Bearer <token>`, looks up `token:<token>`
in KV, and expects JSON metadata containing at least `{ "app": "<name>" }`:

```sh
wrangler kv key put --binding MEDIA_AUTH "token:$(openssl rand -hex 32)" '{"app":"my-app"}'
```

A missing, malformed, unknown, or unparseable token yields `null`, which the
handlers turn into `401 unauthorized`. A successful lookup gives policy and event
callbacks `auth: { token, app, metadata }` (`MediaTokenAuth`) — use `auth.app` for
per-app scoping. `MediaTokenStore` is the KV shape the authorizer needs
(`{ get(key: string): Promise<string | null> }`), which a real `KVNamespace`
satisfies.

This repo ships a deployable example at `workers/media/` with a wrangler config
and deploy runbook.

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
  usePairedVideoList,
  useMediaDelete,
  useMediaDeleteBatch,
  queryKeys,
} = createMediaQueryHooks({ client: mediaClient });
```

`basePath` defaults to `/api/media` and `fetcher` to global `fetch`. The client
exposes `getUploadUrl`, `upload`, `list`, `getSignedUrls`, `deleteOne`, and
`deleteMany`. `createMediaQueryHooks` takes an optional `queryKeyNamespace`
(default `"media"`), also exposes `useSignedUrls` as an alias of
`useSignedMediaUrls`, invalidates the list queries after every mutation, and
retries through `shouldRetryMediaError`. The app must provide a single
`@tanstack/react-query` `QueryClientProvider`; React Query is a peer so the hooks
share the app's query context.

`useSignedMediaUrls({ mediaKeys, path?, enabled? })` is keyed on the whole list
(`queryKeys.signedUrls(keys, path)`) but caches URLs per object key. When the
list changes — an upload adds a key, a delete removes one — the new list reuses
every fresh URL any cached list holds for the same `path` and signs only the
rest, so an unchanged item keeps its URL and is not downloaded again. While
those sign, `data` holds the reused URLs (`isPlaceholderData` is true) instead
of `undefined`; a list the cache covers entirely starts with data and makes no
request. `staleTime` is the time until the first URL is due for replacement:
its lifetime, read off the URL (`X-Amz-Expires`, which the handlers set from
`readExpiresInSeconds`; `X-Goog-Expires`; or an `Expires` timestamp), less 10%
of it and at most five minutes. A URL that states no lifetime is never reused,
and its list keeps the client's default `staleTime`. `data.urlExpiresAt` holds
each URL's expiry in epoch milliseconds on the device clock
(`SignedMediaUrlsData`). Invalidating keeps its meaning: invalidate
`queryKeys.signedUrls(keys, path)`, or `[namespace, "signed-urls"]`, and the
refetch re-signs every key; invalidated lists are never reused.

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

The signing body is `{ mediaType, contentType, size?, customFilename?,
metadata? }`; extension-only signing is not the contract. The server derives the
extension from the approved content type and returns
`{ uploadUrl, key, expiresAt, headers: { "Content-Type" } }`.

`size` is optional but should always be sent: it is what the server's
per-media-type `maxBytes` check reads before the transfer, and it is signed as
`Content-Length`, so the PUT body must be exactly that many bytes (a whole
number; anything else is `400 invalid-size`). When it is omitted,
`upload()` measures the payload — including native file URIs, via
`resolveUploadSize()`, which stats them with `expo-file-system`. Native uploads
PUT through `expo/fetch` with an `expo-file-system` `File` body.

`metadata` is forwarded untouched and reaches `policy.canUpload` and
`events.onUploadSigned`. Use it for app-owned facts about the asset (EXIF capture
time, coordinates); the package never interprets it.

## Processing

`processAsset({ asset, allowlist, config?, adapter?, onPhase? })` is the entry
point on both platforms, with exactly two outcomes: an immutable
`ProcessedUpload` whose `contentType` is in the allowlist that was passed in, or
a thrown `MediaProcessingError` reported against that asset. There is no
`application/octet-stream` fallback.

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
including `applied` — the ordered, human-readable trace worth logging
(`["passthrough:176KB"]`, `["heic-decode", "resize:2048", "encode:image/jpeg"]`,
`["resize:1024", "encode:image/jpeg", "over-budget"]`).

`processAsset` is UI-free: it renders nothing and reports progress through
`onPhase` (`identifying`, `decoding-heic`, `compressing`, `passthrough`,
`converting-video`, `extracting-thumbnail`, `complete`), so toasts stay in the
app. `MediaProcessingError.code` is one of `unsupported-format`,
`heic-conversion-failed`, `decode-failed`, `encode-failed`, or `stat-failed`,
with `contentType` set when the offending source was identified.

### Image Presets

Compression is a descending long-edge ladder at fixed quality against a byte
budget: encode at the first rung, and if the result misses `byteBudget`, drop to
the next rung and re-encode from the source. Quality never decays.

| Preset | rungs (long edge px) | quality | byteBudget | passthroughBytes |
|---|---|---:|---:|---:|
| `avatar` | 512 | 0.8 | 200 KB | 0 |
| `thumbnail` | 256 | 0.7 | 100 KB | 0 |
| `product` | 1024, 768 | 0.85 | 500 KB | 0 |
| `gallery` | 2048, 1600, 1024 | 0.8 | 1000 KB | 300 KB |
| `highQuality` | 4096, 3072, 2048 | 0.8 | 3000 KB | 300 KB |
| `none` | `null` (no ladder) | — | — | — |

- `gallery` is the package default (`DEFAULT_PRESET` on the config subpath,
  re-exported from `/processing` as `DEFAULT_IMAGE_PRESET`); the app decides
  which preset its product actually uses.
- `passthroughBytes` is the source size at or below which an already-allowlisted
  asset uploads untouched. It is `0` for presets that exist to hit a specific
  display size, so those always resize.
- `format` is `null` on every preset, meaning "the upload format policy
  decides": PNG stays PNG, everything else encodes to JPEG. `null` is not JPEG.
- The last rung is used even if it misses the budget, and the result sets
  `overBudget: true` so the app can warn.
- `resolveCompressionConfig()` normalizes: rungs come back positive, deduped and
  descending; quality inside `[MIN_QUALITY, 1]` (`MIN_QUALITY` is 0.4); budgets
  non-negative; unknown preset names resolve to `null`. Route every user override
  through it so a single-field override cannot produce an unrunnable ladder.

```ts
resolveCompressionConfig("avatar");
resolveCompressionConfig("none"); // → null
resolveCompressionConfig({ rungs: [1600, 1200], quality: 0.8, byteBudget: 750 * 1024 });
```

### Format Policy

`resolveUploadFormatPolicy({ contentType, allowlist })` returns `passthrough`,
`transcode` (with an `outputFormat`), or `reject`, plus the flags the pipeline
needs (`requiresHeicDecode`, `flattensAnimation`, `sourceAllowlisted`). It is
pure, so both platforms get the same answers.

`chooseUploadCandidate()` decides whether to keep the processed output or revert
to the source. Reverting requires all of: the source type allowlisted, the
processed output in the *same* format, a known source size, and a processed file
that is not smaller. A format conversion therefore always wins, even when larger.

### Behavior Notes

- Pick at `quality: 1` with `expo-image-picker` so the picker does not
  pre-compress what the ladder is about to encode.
- Resolve the per-asset upload policy, and therefore its compression config,
  *before* processing.
- HEIC has no passthrough path. On web it is decoded with `heic2any` (lazy,
  optional peer) before the ladder runs; on native the encoder decodes HEIF
  directly. A failed decode fails the asset.
- Web never emits WebP (canvas support is not portable) and clamps the requested
  long edge to the browser's canvas ceiling before drawing: 4096 on iOS and iOS
  browsers (also the default for an unknown UA), 11180 on Firefox, 16384 on
  Chromium and desktop Safari.
- Ladder dimensions use *displayed* orientation, so an EXIF-rotated portrait
  photo is not capped along the wrong axis; `exifOrientation` on the input is
  metadata only.
- Every losing rung is disposed as soon as it loses, including when a later rung
  throws, so a selection does not accumulate temp files.
- Videos are not image-compressed. On web, formats in
  `FORMATS_NEEDING_CONVERSION` (`webm`, `avi`, `mkv`, `ogv`, `wmv`, `flv`,
  `3gp`) are transcoded to MP4 (H.264/AAC) when the source is at or under
  `MAX_CLIENT_CONVERSION_SIZE` (500 MB); `convertVideo()` throws on native. A
  failed or skipped conversion falls back to the source, and the asset is
  rejected only if that source type is not in the video allowlist.
- Web video conversion needs the FFmpeg worker served same-origin at
  `FFMPEG_WORKER_URL` (`/_expo/static/js/web/ffmpeg-worker.js`) in Metro and in
  the production server — see [FFmpeg worker](#ffmpeg-worker); the ~30 MB
  FFmpeg core is fetched lazily from `cdn.jsdelivr.net` (`@ffmpeg/core@0.12.6`),
  which CSP must allow. `FFmpegWorkerUnavailableError` is exported from both
  platform builds so `instanceof` checks stay platform-safe.
- `extractVideoThumbnail(uri, timeMs = 1000)` uses `<video>` + canvas on web and
  `createVideoPlayer().generateThumbnailsAsync()` plus `expo-image-manipulator`
  on native, saving the frame as JPEG to a cache-file URI. A thumbnail failure
  never fails the video.
- Use `mapWithConcurrency(items, limit, worker)` instead of `Promise.all` for
  multi-asset selections; each in-flight asset holds a full-resolution bitmap.
  Results stay in input order. Catch `MediaProcessingError` per asset so one bad
  photo does not fail the batch.

### FFmpeg worker

`convertVideo()` loads FFmpeg's worker from the app's own origin: it fetches
`FFMPEG_WORKER_URL` and wraps the script in a blob URL (the cross-origin worker
workaround from ffmpeg.wasm issue #694). The script ships in the package at
`dist/processing/videoConversion/ffmpeg-worker.js`, exported as
`@mrmeg/expo-media/processing/video-conversion/ffmpeg-worker.js` so the app's
Node-side code can find it wherever the package is installed. It is not a
module to import — serve its text as `application/javascript`:

```js
// metro.config.js — development
const fs = require("node:fs");
const FFMPEG_WORKER_URL = "/_expo/static/js/web/ffmpeg-worker.js"; // the package's FFMPEG_WORKER_URL
const workerSource = fs.readFileSync(
  require.resolve("@mrmeg/expo-media/processing/video-conversion/ffmpeg-worker.js"),
  "utf8",
);
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    if (req.url?.split("?")[0] === FFMPEG_WORKER_URL) {
      res.setHeader("Content-Type", "application/javascript");
      return res.end(workerSource);
    }
    return middleware(req, res, next);
  },
};
```

In production, answer the same path from the server in front of the export
(this repo's `server.bun.ts` does it through `server/ffmpegWorker.js`), or copy
the file to `public/_expo/static/js/web/ffmpeg-worker.js` so the static export
carries it. Without it, conversion fails with `FFmpegWorkerUnavailableError`
and the upload falls back to the original file where the allowlist accepts it.

### Lower-Level Entry Points

`processAsset` is the supported path; its steps are exported for apps that need
one in isolation. `/processing/image-compression` gives `compressImage`,
`compressImageWith`, `runDimensionLadder`, `resolveLadderRungs`,
`convertHeicToJpeg`, `convertHeicToJpegIfNeeded`, the canvas-limit helpers, and
the config re-exports; `/processing/video-conversion` gives `needsConversion`,
`convertVideo`, `preloadFFmpeg`, `isFFmpegLoaded`, `CONVERSION_PRESETS`,
`FFMPEG_WORKER_URL`, `MAX_CLIENT_CONVERSION_SIZE`;
`/processing/video-thumbnails` gives `extractVideoThumbnail`.

`compressImage()` runs the ladder for the current platform and returns
`{ uri, blob?, contentType, width, height, size, rung, attempts, overBudget }`.
It does not consult the allowlist — that is what `processAsset` adds.

## Picking And The Upload Queue

Two headless subpaths cover the screen-side flow: `/picker` turns
`expo-image-picker` into `PickedMediaAsset`s, and `/upload-queue` processes and
uploads each one through a per-item state machine. Neither renders anything,
shows a toast, or opens an `Alert`; the app maps results and `onSettled` to its
own UI. `@mrmeg/expo-ui/components/UploadQueue` renders the queue's `items`
directly.

```tsx
import { resolveCompressionConfig } from "@mrmeg/expo-media/processing/image-compression/config";
import { useMediaPicker } from "@mrmeg/expo-media/picker";
import { useUploadQueue } from "@mrmeg/expo-media/upload-queue";

function UploadScreen() {
  const { mutateAsync: upload } = useMediaUpload(); // from createMediaQueryHooks
  const { pick, picking } = useMediaPicker();
  const queue = useUploadQueue({
    upload, // or mediaClient.upload
    allowlist: MEDIA_CONTENT_TYPE_ALLOWLIST,
    // Per asset, before processing: avatars get the avatar preset, videos skip the ladder.
    resolve: (asset) =>
      asset.kind === "video"
        ? { mediaType: "videos", compression: null }
        : { mediaType: "uploads", compression: resolveCompressionConfig("gallery") },
    videoThumbnail: { mediaType: "thumbnails" },
    onSettled: ({ uploaded, failed }) => notifyUploadResult(uploaded.length, failed.length),
  });

  async function onPress() {
    const result = await pick({ mediaTypes: ["images", "videos"], multiple: true, selectionLimit: 20 });
    if (result.status === "picked") queue.add(result.assets);
    if (result.status === "denied") showPermissionHelp(result.canAskAgain);
  }

  // queue.items is what the UploadQueue component renders; wire retry and remove to it.
}
```

### Picker

`useMediaPicker()` returns `{ pick, picking, permission }`, and `pickMedia(options)`
is the same call without the hook. Options: `source` (`"library"`, the default, or
`"camera"`), `mediaTypes` (`["images"]` by default), `multiple`, `selectionLimit`,
`allowsEditing`. `pick` resolves to one of three results rather than throwing:

```ts
type PickMediaResult =
  | { status: "picked"; assets: PickedMediaAsset[] }
  | { status: "canceled" }
  | { status: "denied"; canAskAgain: boolean };
```

- It requests permission through the library or camera permission API when it is
  not already granted and can still be asked, and decides from the *response*, so
  a refusal given during this pick stops it. `denied` with `canAskAgain: false`
  means the OS will no longer prompt: send the user to Settings.
- It always picks at `quality: 1` with `exif: true` and `orderedSelection: true`,
  because the compression ladder encodes once, later, and EXIF is read here before
  re-encoding strips it.
- `permission` is the OS `PermissionResponse` from the latest `pick` (`null`
  before the first), for the source that pick used.
- `PickedMediaAsset` is `ProcessAssetInput` plus a unique `id` and
  `exif?: { takenAt?: Date; lat?: number; lng?: number }`. On web it carries the
  `Blob` the pipeline and the upload both use. Video `duration` (milliseconds from
  the picker) arrives as `durationSeconds`.
- The pure helpers are exported: `toPickedMediaAsset(imagePickerAsset, index)`,
  `parseExifGps`, `parseExifDate`, `parseExifOrientation`. A GPS coordinate that
  cannot be read is dropped, never reported as `0`.

### Upload Queue

`useUploadQueue(options)` returns `{ items, add, retry, remove, clearFinished,
clear, isActive, counts }`. Items appear the moment `add` is called, then move
`queued -> processing -> uploading -> done`, or to `failed`. Processing runs
inside the queue, so a UI shows every file as soon as it is picked.

| Option | Purpose |
|---|---|
| `upload` | `(options: MediaUploadOptions) => Promise<MediaUploadResult>`: the React Query `useMediaUpload().mutateAsync` (it invalidates the list queries) or `client.upload` |
| `allowlist` | the shared content-type allowlist handed to `processAsset` |
| `resolve(asset)` | `{ mediaType, compression? }`, run once per asset when it is added (pick-time policy, kept through retries) |
| `concurrency` | default 3; bounds processing and upload together, since each in-flight asset holds a full-resolution bitmap |
| `metadata(item, processed)` | replaces the default, which forwards EXIF as `{ takenAt: ISO string, lat: string, lng: string }` (only the keys present, `undefined` when none) |
| `videoThumbnail` | `{ mediaType, filename? }` uploads each video's frame as a second, best-effort file named by the video key's ID (a failure never fails the item); unset or `false` uploads none. See [Video Thumbnails](#video-thumbnails) |
| `onItemSettled(item)` | an item reached `done` or `failed` |
| `onSettled({ uploaded, failed })` | the queue drained; fires once per run |
| `adapter`, `processAsset` | test seams |

`UploadQueueItem` is `{ id, fileName, kind, status, previewUri?, progress?,
phase?, errorMessage?, error?, asset, processed?, key?, mediaType? }`. `progress`
is `0..1` (video conversion's 0-100 is normalized), `phase` is the
`processAsset` phase, and `errorMessage` is a short line mapped from
`MediaProcessingError` and `MediaError`; the raw failure stays on `error`.

- Options may be inline: the latest are read at each step.
- `retry(id)` re-runs a failed item from processing, or from upload when its
  processed result survived, so a failed upload never recompresses.
- `remove(id)` drops an in-flight item at once and ignores its eventual result.
  `upload()` has no abort signal, so the request is not cancelled, and the item
  keeps its concurrency slot until the work settles.
- `clearFinished()` drops `done` items; `failed` ones stay for `retry` or
  `remove`. `clear()` drops everything.
- On web the queue revokes `blob:` URLs it holds when an item is removed or
  cleared, but never on failure (`retry` needs the bytes) and never on unmount.
- The queue is not tied to the component's effects. StrictMode, Fast Refresh,
  and hidden `Activity` screens leave it alone, and unmounting only stops
  rendering: queued items still process and upload and the callbacks still fire,
  so an upload outlives the screen that started it.
- `createUploadQueueRunner(getOptions)` and `uploadQueueReducer` are exported for
  tests and non-React hosts: the runner is plain async code with no React in it.

## Error Handling

Client hooks throw `MediaError` with a typed `problem.kind`: `disabled`
(carrying `missing` / `details`), `bad-request` (with the server `code`),
`unauthorized`, `forbidden`, or `unknown` (with `status`).
`shouldRetryMediaError` never retries the first four and otherwise allows two
attempts.

Server JSON error codes: `media-disabled`, `bad-request`, `unauthorized`,
`forbidden`, `custom-filename-forbidden`, `invalid-media-type`,
`invalid-content-type`, `oversized-file`, `bad-key`, `storage-failure`, plus any
`code` a policy callback returns. Worker routing adds `not-found` and
`method-not-allowed`.

Client processing throws `MediaProcessingError`; narrow it with
`isMediaProcessingError()` and report it against the asset that caused it. Branch
on typed errors instead of parsing message text.

## Migration Checklist

1. Install the package and the peers your entrypoints need.
2. Move bucket definitions into `createMediaConfig()`; replace custom route logic
   with `createMediaHandlers()`, keeping route files as thin handler exports.
3. Create a package-backed `mediaClient`; replace custom React Query media hooks
   with `createMediaQueryHooks()`.
4. Add an app-wide media settings file with one shared content-type allowlist used
   by both `createMediaConfig()` and `processAsset()`.
5. Replace inline quality/path decisions with named upload policies, resolved per
   asset before processing.
6. Replace copied image processing helpers with one `processAsset()` call, and the
   multi-asset `Promise.all` with `mapWithConcurrency()` (or with
   `useUploadQueue`, which processes and uploads in one bounded pass).
7. Reconcile app-owned metadata in handler events, and add a `media-disabled`
   setup state.
8. Run validation.

Delete on the way: copied S3/R2 presigner code, route body parsing, signed URL
batching, React Query media hooks, image compression and HEIC conversion
utilities, video thumbnail extraction, per-branch content-type juggling and
`application/octet-stream` fallbacks, app-level "keep the original if it is
smaller" checks, temp-file cleanup passes over compression output, and copied
media error mappers.

## Validation

```sh
bun run packages:peer-check
bun run pkg media typecheck
bun run pkg media test
bun run pkg media build
bun run pkg media pack
bun run pkg media consumer-smoke
```

`pkg media consumer-smoke` installs the packed tarball into two clean fixtures: a
peer-free one proving core, `/server`, and `/worker` load without React Native or
Expo, and a fully provisioned one that type-checks every documented entrypoint. It
also verifies export-map files (the FFmpeg worker included, resolved the way a
`metro.config.js` would), root runtime imports, and that the installed package
ships `README.md`, `CHANGELOG.md`, `LLM_USAGE.md`, `llms.txt`, and
`llms-full.md`. CI installs packed consumers against Expo 55, 56, 57, and 58.
`scripts/__tests__/nodenextConsumer.test.ts` type-checks every public entry
point of the built declarations under `moduleResolution: nodenext`.

## Package Release

```sh
bun run pkg media release -- --patch [--publish]
```

Accepts `--patch`, `--minor`, `--major`, or an exact `x.y.z`; the default bump is
patch, and the committed version itself releases without a bump. It updates
`packages/media/package.json` and `bun.lock`, then runs `packages:peer-check`
and the `typecheck`, `test`, and `build` gates, packs one tarball, and runs the
consumer smoke against it. `--publish` publishes that same tarball; without it
the command stops after the gates. A clean working tree is required unless
`--allow-dirty` is passed.

## GitHub Publishing

The `Publish Packages` workflow (`.github/workflows/publish-packages.yml`)
publishes every workspace package. It runs on pushes to `main` that change a
`packages/*/package.json` — releasing the committed media version when it changed
in the push and npm does not already have it — and on `workflow_dispatch` with
`package=media`, which bumps `patch`, `minor`, `major`, or an exact version and
commits the bump to the selected branch before publishing. Either way it runs
the release script above, publishes the smoked tarball with
`npm publish <tarball> --provenance --access public`, and tags
`expo-media-v<version>`.

Configure npm trusted publishing for owner `mrmeg`, repository `expo-template`,
workflow filename `publish-packages.yml`. A repository secret `NPM_TOKEN` with
publish access to the `@mrmeg` scope, when set, is used instead.
