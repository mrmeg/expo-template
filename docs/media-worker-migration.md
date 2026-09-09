# Media Worker: Contract and Migration

The shared media Worker is live (deployed 2026-09-03) at
`https://cdn.mrmeg.com/api/media/*` and fronts the R2 bucket `mrmeg`. Auth is a
static per-app bearer token in the `MEDIA_AUTH` Workers KV namespace. Deployment
and token provisioning: [`workers/media/README.md`](../workers/media/README.md).

## The contract

Base URL: `https://cdn.mrmeg.com/api/media`

| Route | Method | Request | Response |
|---|---|---|---|
| `/list` | GET | `?mediaType=` (required), `?prefix=`, `?limit=`, `?cursor=` | `{ items: [{ key, size, lastModified }], totalCount, nextCursor? }` |
| `/getUploadUrl` | POST | `{ mediaType, contentType, size?, customFilename?, metadata? }` | `{ key, uploadUrl, expiresAt, headers }` — PUT the bytes to `uploadUrl` with the same `Content-Type` |
| `/getSignedUrls` | POST | `{ keys: string[], path? }` | `{ urls: { [key]: signedUrl } }` (24 h expiry) |
| `/delete` | DELETE | `?key=` | `{ success, key }` |
| `/delete` (batch) | POST | `{ keys: string[] }` | `{ success, deleted: string[], errors? }` |

- Every request needs `Authorization: Bearer <token>`; anything else is
  `401 {"code":"unauthorized"}`.
- Unknown action → `404 {"code":"not-found"}`. Known action with an unsupported
  method → `405 {"code":"method-not-allowed"}`. `OPTIONS` is answered for known
  actions.
- Media types: `avatars` (`users/avatars/`), `videos` (`videos/`), `thumbnails`
  (`thumbnails/`), `uploads` (`uploads/`) — same content-type allowlists and size
  caps as the template's `server/media/config.ts`.
- Freshly provisioned tokens take up to a minute to reach every edge location.
  Intermittent 401s right after `wrangler kv key put` are propagation, not a bad
  token.

Worked example — runs as written against the live Worker with your app's token:

```sh
TOKEN="<your app token>"
BASE="https://cdn.mrmeg.com/api/media"

# 1. Sign an upload
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"mediaType":"uploads","contentType":"image/jpeg"}' "$BASE/getUploadUrl"
# → { "uploadUrl": "https://…r2.cloudflarestorage.com/…", "key": "uploads/01ABC….jpg", … }

# 2. PUT the bytes to uploadUrl (no bearer token — the URL is presigned)
curl -s -X PUT -H "Content-Type: image/jpeg" --data-binary @photo.jpg "$UPLOAD_URL"

# 3. List
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/list?mediaType=uploads&limit=10"

# 4. Sign reads
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"keys":["01ABC….jpg"],"path":"uploads"}' "$BASE/getSignedUrls"

# 5. Delete
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE/delete?key=uploads/01ABC….jpg"
```

## Consuming it from an Expo app

`createMediaClient` from `@mrmeg/expo-media/client` has no token option; inject
auth through a custom `fetcher`:

```ts
import { createMediaClient } from "@mrmeg/expo-media/client";

const media = createMediaClient({
  basePath: "https://cdn.mrmeg.com/api/media",
  fetcher: (url, init) =>
    fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${process.env.MEDIA_WORKER_TOKEN!}`,
      },
    }),
});
// media.getUploadUrl / media.upload / media.list / media.getSignedUrls /
// media.deleteOne / media.deleteMany
```

The token is app-level, not user-level — treat it like an API key. It belongs on
**your server**, not in the JS bundle: proxy the calls through your own API route
that attaches the token, unless the app is fully trusted (internal tooling).

Raw `fetch` works the same way; only `getUploadUrl` → `PUT` takes two steps.

## Switching a project onto the Worker

Steps 1 and 2 are independent; both are usually wanted.

**1. Upgrade to `@mrmeg/expo-media` >= 0.5.0.**

```sh
bun add @mrmeg/expo-media@^0.5.0
```

0.5.0 rebuilt the client image pipeline and is **breaking** for anything older —
apps on `^0.2.1` will not compile untouched.

- Removed: `keepOriginalIfLarger`, `getMimeType()`, `shouldUseProcessedFile()`,
  `shouldUseCompressedImage()`, `reduceQuality()`, `shouldContinueCompression()`,
  the cleanup subsystem, `configureMediaDebugLogger()`.
- Changed: `CompressionConfig` is ladder-shaped
  (`{ rungs, quality, byteBudget, passthroughBytes, format }`), and `format: null`
  now means "the upload policy decides" (PNG stays PNG) rather than "default to
  JPEG".
- Migration: call `processAsset()` from `@mrmeg/expo-media/processing` instead of
  `compressImage` plus a per-branch content type. It returns one frozen
  `ProcessedUpload` whose `contentType` is guaranteed to be in the allowlist you
  passed, or throws `MediaProcessingError`.
- Full list: [`packages/media/CHANGELOG.md`](../packages/media/CHANGELOG.md).

Worth doing even self-hosted: it fixes rejected HEIF uploads, PNG alpha loss, and
rotated-photo distortion.

**2. Check the storage precondition.** The Worker fronts the **`mrmeg` R2 bucket
only**, and every valid token sees that whole bucket. An app with its own bucket
must either copy its objects across (`rclone` / `wrangler r2 object`) or wait for
per-app bucket/prefix scoping to be specced (`MediaTokenAuth.app` in
`packages/media/src/worker/index.ts` is the extension point). Do not point half an
app at each bucket.

**3. Provision a token** (from `workers/media/`; `--remote` is required or
wrangler writes to the *local* KV emulator and the deployed Worker never sees the
token):

```sh
TOKEN="$(openssl rand -hex 32)"
bunx wrangler kv key put --binding MEDIA_AUTH "token:$TOKEN" '{"app":"myapp"}' --remote
echo "$TOKEN"
```

Store it in that app's own server secret store — it is not recoverable from KV.

**4. Wire the client** as above, keeping the token server-side: replace the app's
own `/api/media/*` route bodies with proxied calls to the Worker.

**5. Verify** before deleting anything: upload → list → signed read → delete
round-trip from the app, then confirm the objects land under the expected
`mediaType` prefix.

## Consumer state

### terlo — already compliant, stays self-hosted (decision 2026-09-03)

terlo runs `@mrmeg/expo-media/server` handlers in its own `/api/media/[action]`
Expo API route against its own bucket (`hautemap`) — the same contract,
self-hosted. **No migration, no token.** Its old worker source
(`~/Development/serverless_functions/cloudflare/terlo`) was never deployed and
`cdn.terlo.app` has no DNS record, so nothing needs tearing down beyond retiring
that source directory and its plaintext credentials (see teardown). If terlo later
wants centralized media ops, it repoints its `createMediaHandlers`-based routes at
this Worker using the checklist above.

### downrangedays — the real migration (partially deferred)

Today:

- Its own Expo API routes: `/api/media/getUploadUrl`, `/api/media/getSignedUrls`,
  `/api/media/index`, `/api/media/[id]`, `/api/media/file/[...key]`.
- A deployed worker at `cdn.downrangedays.com` (bucket `downrangedays`) serving
  `GET/PUT/DELETE /<key>?token=<JWT>` for public-ish media URLs and HLS playlists,
  with its own server minting HS256 JWTs in `server/r2.ts`. That path is in the
  **downrangedays repo**; this template has no `server/r2.ts` — its server media
  code is `server/media/config.ts` + `server/media/handlers.ts` behind
  `app/api/media/[action]+api.ts`.

| Old (downrangedays) | New | Notes |
|---|---|---|
| `POST /api/media/getUploadUrl` (own route) | `POST $BASE/getUploadUrl` | same shape |
| `POST /api/media/getSignedUrls` (own route) | `POST $BASE/getSignedUrls` | same shape |
| `GET /api/media/index` (own route) | `GET $BASE/list?mediaType=…` | |
| `DELETE /api/media/[id]` (own route) | `DELETE $BASE/delete?key=…` | batch via POST |
| `PUT cdn.downrangedays.com/<key>?token=` | presigned `uploadUrl` from `getUploadUrl` | worker-direct PUT goes away |
| `GET cdn.downrangedays.com/<key>?token=` (public URLs) | **no equivalent yet** | deferred |
| HLS playlist/segment serving | **no equivalent yet** | deferred |

**Deferred (decision 2026-09-03):** the shared Worker only signs URLs — no public
serving path, no HLS playlist rewriting. downrangedays' playback migration waits on
a separate spec adding a public `GET` path. Until it lands,
`cdn.downrangedays.com` keeps running and **teardown stays gated**.

The API-route half, doable now:

1. Provision a token — runbook step 4 in `workers/media/README.md` with
   `{"app":"downrangedays"}`; store it in downrangedays' server env.
2. In the downrangedays repo, replace the bodies of the four API routes with
   proxied calls to `$BASE` (bearer token attached server-side), or call the Worker
   from server code via `@mrmeg/expo-media/client`.
3. Decide the storage move: the Worker fronts bucket `mrmeg`, downrangedays'
   objects live in bucket `downrangedays`. Copy objects across (`rclone` /
   `wrangler r2 object`) or hold this half until per-app scoping is specced. Do not
   point half the app at each bucket.
4. Verify the upload → list → signed read → delete round-trip against the Worker;
   playback still through `cdn.downrangedays.com`.
5. Report done — this gates the first half of teardown.

## Teardown checklist

Versioned here with the Worker; execute a gate only when it is met. Old credentials
sit in `~/Development/serverless_functions/cloudflare/*/wrangler.{toml,jsonc}` —
all of them keep R2 keys and JWT secrets in **plaintext `[vars]`**, which is why
rotation is part of teardown, not optional cleanup.

**Gate A** — downrangedays API routes migrated AND the public-serving/HLS Worker
extension live and verified:

1. Remove the `cdn.downrangedays.com` custom domain from the `downrangedays`
   worker; point serving at the shared Worker's public path.
2. `wrangler delete downrangedays` (account `776658da…`).
3. Rotate the R2 API token/keys that lived in its config; retire the HS256
   `R2_SECRET`; delete the JWT minting in that app's `server/r2.ts`.

**Gate B** — always safe now (nothing deployed):

4. Delete the never-deployed worker sources for `terlo` and any other app that has
   confirmed it will not use them, after rotating every credential embedded in them
   (`terlo`'s config exposes R2 keys for bucket `hautemap`).

Non-goals: the `wagbi`, `memoriam`, and `mrmeg-media` worker sources belong to other
apps. Widening the shared Worker's route beyond `/api/media/*` (owning the whole
`cdn.mrmeg.com` hostname) is a future decision — the rest of that hostname is the R2
public bucket domain for `mrmeg`.

## Gaps that get their own specs

- **Public serving + HLS path** on the shared Worker — blocks downrangedays' playback
  migration and teardown Gate A.
- **Per-app storage scoping** — `MediaTokenAuth.app` is the extension point; today
  every token sees the whole `mrmeg` bucket, fine for one consumer and wrong for two.
