# Spec: Group Media Batch Delete By Bucket

**Status:** Ready
**Priority:** High
**Scope:** Server

---

## What
Fix package batch deletion so keys are deleted from the bucket configured for each key's resolved media type. The package should group batch deletes by bucket and preserve the existing delete response shape.

## Why
`@mrmeg/expo-media` exposes a reusable configuration model with multiple buckets and media types. Sending every key in a batch to the first key's bucket can fail valid deletes or, in the worst case, delete same-named objects from the wrong storage bucket.

## Current State
`packages/media/src/server/handlers.ts` resolves every requested key to a media type in `deleteKeys()`, but then reads only `resolved.mediaTypes[0]` to pick a bucket. For batch deletes, it sends all `resolved.keys` in one `DeleteObjectsCommand` to that one bucket.

The template currently uses one R2 bucket, so existing app tests do not catch this. Package tests cover config helpers, but not server batch delete behavior with multiple buckets.

## Changes
1. Add bucket-aware delete planning.
   - Update `packages/media/src/server/handlers.ts`.
   - After `resolveKeys()`, map each key to its `mediaType` and bucket config.
   - For single-key delete, preserve the current `DeleteObjectCommand` behavior.
   - For batch delete, group keys by physical bucket/client cache identity and send one `DeleteObjectsCommand` per group.
   - Use a stable group key derived from the bucket config already used by `getS3Client()` so two media types backed by the same physical bucket still share one delete command.

2. Preserve policy semantics.
   - Keep one `canDelete` policy call with the full resolved key list and media type list before storage deletion.
   - If policy denies, no bucket should receive a delete command.

3. Return a combined result.
   - Merge `Deleted` arrays across bucket groups into the existing `deleted` response field.
   - Merge S3-reported errors into the existing `errors` response field.
   - Use an all-settled strategy across bucket groups.
   - Return `success: true` only when every bucket group succeeds and S3 reports no per-key errors.
   - For a bucket command failure, add an error entry for each key in that failed group using the thrown error message.
   - Call `events.onDeleted` once with all successfully deleted keys after all bucket groups finish. Do not call it if no key was confirmed deleted.

4. Add regression coverage.
   - Add package/server tests with two bucket configs and keys in two media type prefixes.
   - Assert two `DeleteObjectsCommand` calls are sent to the correct buckets.
   - Assert mixed-bucket errors are returned without losing successful deletes.

## Acceptance Criteria
1. A batch delete with keys from two buckets sends separate delete commands to each bucket.
2. A batch delete with keys from one bucket keeps the current single-command behavior.
3. `canDelete` receives all resolved keys and media types before any delete command is sent.
4. The response shape remains compatible: `{ success, deleted, errors }`, with `success: false` allowed for partial failures.
5. Regression tests cover mixed-bucket batch deletes.

## Constraints
- Do not change the public `createMediaHandlers()` API unless unavoidable.
- Do not change `createMediaClient().deleteMany()` response expectations.
- Keep the maximum 1000-key validation.
- Keep safe-key validation before any storage command.

## Out of Scope
- Transactional all-or-nothing deletes across buckets.
- Database metadata reconciliation beyond existing `events.onDeleted`.
- Client UI changes.
- New storage providers.

## Files Likely Affected
Server:
- `packages/media/src/server/handlers.ts`
- `packages/media/src/__tests__/*`
- `app/api/media/__tests__/delete.test.ts`

Client:
- None expected.

## Edge Cases
- If one bucket group fails and another succeeds, return the successful deleted keys plus errors for failures.
- If a bucket group throws before returning `Deleted`, mark every key in that group as an error.
- If a bucket config is missing after validation, return `503 media-disabled` before sending deletes.
- Duplicate keys in the request should not cause duplicate delete commands unless current behavior intentionally allows it.
- Keys that resolve to overlapping prefixes must use the longest matching media type prefix.

## Risks
- Partial success semantics can surprise callers. Mitigate by preserving the existing `errors` field and documenting the behavior in package docs if needed.
