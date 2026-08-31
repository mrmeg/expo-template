---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Replace AWS SDK with aws4fetch in @mrmeg/expo-media

## Goal

Remove `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` from `packages/media` and implement the same S3/R2 operations with `aws4fetch` (~2KB SigV4 signer). Every downstream project sheds the AWS SDK on upgrade. This is phase 1 of the media-worker plan; the HTTP contract of all handlers must not change, because phase 2 deploys these same handlers as a Cloudflare Worker.

Publish as **0.3.0** (version bump in this PR; `.github/workflows/publish-media.yml` auto-publishes when the bump reaches `main`).

## Context

- Sole SDK consumer: `packages/media/src/server/handlers.ts`. Operations used:
  - `PutObjectCommand` + `getSignedUrl` — presigned upload URL, default expiry 300s (`handlers.ts:224-231`). The SDK signs `content-type` into `X-Amz-SignedHeaders`; the response tells the client to send that `Content-Type` header (`handlers.ts:245-247`).
  - `GetObjectCommand` + `getSignedUrl` — presigned read URL, default expiry 86400s (`handlers.ts:297-300`).
  - `ListObjectsV2Command` (`handlers.ts:346-353`) — maps `Contents[].{Key,Size,LastModified}`, `NextContinuationToken`.
  - `DeleteObjectCommand` (`handlers.ts:436-438`) and batch `DeleteObjectsCommand` with `Quiet: false` (`handlers.ts:443-456`), grouped per bucket, response `{ success, deleted, errors: [{key, message}] }`.
- Client construction/cache: `getS3Client` (`handlers.ts:649-666`), cache keyed by `getBucketClientCacheKey` (endpoint/region/bucket/accessKeyId); `resetMediaStorageForTests` clears it (`handlers.ts:124-126`).
- `MediaBucketConfig` (`packages/media/src/config.ts`): `provider: "s3" | "r2"`, `bucket`, `region`, optional `endpoint` (required when provider is `r2`, enforced by `validateMediaConfig`), `credentials.{accessKeyId,secretAccessKey}`, optional `forcePathStyle`. Path style currently defaults to `forcePathStyle ?? provider === "r2"`.
- Tests: `packages/media/src/server/__tests__/handlers.test.ts` (333 lines) mocks both SDK packages (`jest.mock` at lines 3 and 23) and asserts on `mockSend` command inputs. These mocks must be replaced; the behavioral assertions must survive.
- Failure contract: any storage error is caught and returned as 500 `storage-failure` via `storageFailure()` (`handlers.ts:700-714`).
- All handler code is already web-standard (Request/Response); nothing else in the repo imports the AWS SDK (root `aws-amplify` deps are Cognito-only).

## Work

All in `packages/media` unless noted.

1. **New internal storage module** `src/server/storage.ts` wrapping `aws4fetch`'s `AwsClient` (`service: "s3"`), exposing:
   - `presignPutUrl({bucket, key, contentType, expiresIn})` and `presignGetUrl({bucket, key, expiresIn})` — build the object URL, set `X-Amz-Expires` as a query param, sign with `{ aws: { signQuery: true } }`, return `url.toString()`. The PUT presign must include `content-type` in the signed headers so the bucket enforces it exactly as the SDK did.
   - `listObjects({bucket, prefix, maxKeys, continuationToken})` — signed `GET {bucketUrl}?list-type=2&...`, parse the XML response into `{ items: [{key, size, lastModified}], nextContinuationToken }`.
   - `deleteObject({bucket, key})` — signed `DELETE {objectUrl}`.
   - URL construction: path-style (`{endpoint}/{bucket}/{key}`) when `forcePathStyle ?? provider === "r2"`, else virtual-hosted (`https://{bucket}.{host}/{key}`). When `provider === "s3"` and `endpoint` is unset, default to `https://s3.{region}.amazonaws.com`.
   - Object keys go into the URL path percent-encoded per segment (`key.split("/").map(encodeURIComponent).join("/")`) so `/` separators survive but spaces/reserved chars match the SigV4 canonical URI — the SDK did this internally; a mismatch yields SignatureDoesNotMatch.
   - Non-2xx responses throw an `Error` carrying status and a body excerpt, so handlers' existing catch → 500 `storage-failure` path is preserved.
   - Cache `AwsClient` instances with the same cache key fields as today; keep `resetMediaStorageForTests` working.
2. **XML parsing** for ListObjectsV2: minimal hand-rolled extraction (no new dependency), and it must unescape the five XML entities (`&amp; &lt; &gt; &quot; &apos;`) in `<Key>` values — keys containing `&` etc. round-trip today via the SDK. Do not request `encoding-type=url`.
3. **Batch delete**: replace `DeleteObjectsCommand` with per-key `deleteObject` calls at bounded concurrency (e.g. 10) using `Promise.allSettled`, preserving the exact response shape `{ success, deleted: string[], errors: [{key, message}] }` and the per-bucket grouping in `deleteKeys` (`handlers.ts:427-497`). Rationale: the XML `DeleteObjects` API requires a `Content-MD5` header and MD5 is not in standard Web Crypto, so this keeps the code portable to Workers (phase 2). The existing 1000-key request cap stays.
4. **Rewire `handlers.ts`** to the storage module; remove all `@aws-sdk/*` imports. No changes to request/response shapes, error codes, policy/event/cors callbacks, or expiry defaults.
5. **Tests**: rework `handlers.test.ts` to mock `global.fetch` (assert method, URL — bucket/key/query params incl. `X-Amz-Expires`, `list-type=2`, `prefix`, signed-header presence for PUT content-type) with XML fixtures for list responses. Keep every existing behavioral case (validation errors, policy denials, batch delete partial-failure reporting — now N fetches instead of one batch call). Add a case for a list key containing `&amp;` to lock in entity unescaping.
6. **package.json**: drop the two `@aws-sdk/*` dependencies, add `aws4fetch` (^1.0.20), bump version to `0.3.0`. Update `CHANGELOG.md`. Grep `packages/media/README.md`, `LLM_USAGE.md`, `llms.txt`, `llms-full.md` for AWS-SDK mentions and update any found.
7. Run `bun install` so the lockfile drops the SDK subtree.

## Validation

From repo root:

- `bun run media:typecheck`
- `bun run media:test`
- `bun run media:build`
- `bun run media:consumer-smoke`
- `bun run media:pack` — confirm the tarball no longer pulls `@aws-sdk/*`.
- Manual (optional, needs `.env` R2 vars): start the app, exercise the Media tab (upload, list, view, delete) against the real `expo-template` bucket.

## Out of scope

- The Cloudflare Worker (`./worker` subpath, `workers/media/`, KV auth, `cdn.mrmeg.com`) — phase 2 spec.
- Old-worker cleanup and downrangedays/terlo migrations — phase 3 spec.
- Client, react-query, and processing subpaths — untouched.
- Inlining ULID (optional polish, separate change if ever).
- Actually publishing to npm — the existing workflow handles it on promotion to `main`.

## Open questions

None.
