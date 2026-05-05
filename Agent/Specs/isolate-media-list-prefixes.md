# Spec: Isolate Media List Prefixes

**Status:** Ready
**Priority:** High
**Scope:** Server + Client

---

## What
Constrain media listing so every request is scoped to configured media type prefixes. The package should never list a whole bucket by default, and the template app's "all" media view should aggregate known media types without escaping the media path contract.

## Why
Media buckets may contain unrelated objects, app-private files, or prefixes owned by other systems. Listing the bucket root is a data exposure risk and contradicts the package contract that clients choose media types rather than raw buckets or paths.

## Current State
`packages/media/src/server/handlers.ts` reads `prefix` and `mediaType` from query params in `list()`. If neither is provided, it picks the first configured media type's bucket and sends `ListObjectsV2Command` with `Prefix: undefined`, which lists the bucket root.

The Media tab computes `prefix = ""` for the `"all"` filter in `app/(main)/(tabs)/media.tsx` and calls `useMediaList({ prefix })`. That path reaches the unscoped server list behavior.

Docs in `Agent/Docs/EXPO_MEDIA_PACKAGE.md` and `packages/media/README.md` describe `mediaTypes.*.prefix` as the path contract. Tests currently cover disabled media routes but do not cover scoped list behavior.

## Changes
1. Enforce list scoping in package handlers.
   - Update `packages/media/src/server/handlers.ts`.
   - If `mediaType` is present, derive the list prefix from that media type config unless a narrower prefix is also supplied.
   - If `prefix` is present without `mediaType`, resolve it to a configured media type and reject unknown or escaping prefixes with `400 bad-key`.
   - If both `mediaType` and `prefix` are present, require the prefix to stay inside that media type's configured prefix.
   - If neither `mediaType` nor `prefix` is present, return `400 bad-request` with a clear message. Do not add package-level unscoped or multi-prefix listing in this spec.

2. Make the template "all" view safe.
   - Update `app/(main)/(tabs)/media.tsx` and any related media hook adapters.
   - Query each configured template media type separately for `"all"` and merge results client-side.
   - Prefer `useMediaList({ mediaType })` over raw prefix strings where the UI is selecting a known media type.
   - Preserve existing per-filter behavior for `avatars`, `videos`, `thumbnails`, and `uploads`.

3. Add regression coverage.
   - Add package/server tests for:
     - `GET /list?mediaType=uploads` sends the configured `uploads` prefix.
     - `GET /list` does not send `Prefix: undefined`.
     - unknown prefixes are rejected.
   - Add app route tests if the behavior is exercised through Expo API route wrappers.

4. Update docs.
   - Update `Agent/Docs/EXPO_MEDIA_PACKAGE.md` if the client contract changes.
   - Ensure docs state how an all-media view should list only configured media types.

## Acceptance Criteria
1. A list request without `mediaType` or a valid configured prefix returns `400 bad-request` and never sends `ListObjectsV2Command`.
2. `mediaType=uploads` lists only the configured `uploads` prefix.
3. A prefix outside configured media type prefixes returns a typed 400 response.
4. The Media tab's `"all"` view still shows media from configured template media types without listing bucket root.
5. Regression tests fail on the current unscoped behavior and pass after the fix.

## Constraints
- Preserve the public package import paths and existing `createMediaClient().list()` method shape unless a small backward-compatible option is required.
- Do not require consumers to expose raw bucket names.
- Do not make the all-media view depend on hardcoded R2/S3 bucket details.
- Keep React Query retry behavior unchanged for typed client errors.

## Out of Scope
- Pagination across multiple media types beyond a simple safe implementation.
- Metadata-backed media indexes.
- Authorization policy changes for media routes.
- Batch delete behavior, covered by a separate spec.

## Files Likely Affected
Server:
- `packages/media/src/server/handlers.ts`
- `packages/media/src/keys.ts`
- `packages/media/src/__tests__/*`
- `app/api/media/__tests__/*`
- `Agent/Docs/EXPO_MEDIA_PACKAGE.md`

Client:
- `app/(main)/(tabs)/media.tsx`
- `client/features/media/hooks/useMediaList.ts`
- `client/features/media/mediaClient.ts`

## Edge Cases
- A media type prefix that is a prefix of another media type must resolve to the longest matching prefix.
- Empty, whitespace, absolute, traversal, and backslash prefixes must be rejected.
- `limit` and `cursor` should keep their current bounds and meaning for single-prefix queries.
- If one media type fails in an all-media view, the UI should show a retryable error rather than silently hiding that type.
- If all media-type queries return empty lists, the current empty-state UI should remain unchanged.

## Risks
- Client-side "all" merging can complicate pagination. Mitigate by keeping per-type pagination behavior intact and documenting any all-view limitation rather than adding unsafe bucket-root listing.
