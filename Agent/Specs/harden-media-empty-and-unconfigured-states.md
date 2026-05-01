# Spec: Harden Media Empty And Unconfigured States

**Status:** Ready
**Priority:** High
**Scope:** Server + Client

---

## What
Make the media feature degrade cleanly when R2/S3 storage is not configured and surface explicit query errors in the Media tab. The feature should remain explorable in a fresh template while still supporting the current upload, list, signed URL, and delete flows when storage is configured.

## Why
Media is a reusable feature, but many new apps will not configure storage on day one. A template should show a clear disabled/setup state rather than failing through opaque 500s or endless loading states.

## Current State
`app/(main)/(tabs)/media.tsx` immediately calls `useMediaList({ prefix })`. `useMediaList` throws a generic error on non-OK responses. Media API route modules create `S3Client` instances from `process.env.R2_*` values at module scope and use non-null assertions, so missing storage config can fail at point of use without a typed disabled response.

## Changes
1. Add a typed media-disabled server response.
   - Create a small media env reader or storage bootstrap helper.
   - Return a structured `503 media-disabled` response when required storage env vars are absent.
   - Apply the same behavior to list, upload URL, signed URL, and delete routes.

2. Move storage client creation behind configuration checks.
   - Avoid constructing `S3Client` with empty credentials at module load.
   - Preserve existing CORS and preflight behavior.

3. Update client hooks to expose typed states.
   - `useMediaList`, `useMediaUpload`, `useSignedUrls`, and delete hooks should distinguish disabled/configuration problems from network or server errors.
   - Keep React Query behavior predictable and avoid retrying disabled config responses.

4. Add Media tab disabled and error UI.
   - Show a setup-oriented empty state when media is disabled.
   - Show a retryable error state for transient fetch failures.
   - Keep upload controls disabled with a clear reason when storage is not configured.

5. Add regression tests.
   - Cover missing env responses in server routes.
   - Cover client disabled/error state rendering for the Media tab or hook-level behavior.

## Acceptance Criteria
1. With blank R2/S3 env, Media tab renders a clear storage setup state and does not show a generic crash/error.
2. Media API routes return typed `503 media-disabled` responses when storage config is absent.
3. Existing configured-storage happy paths continue to work.
4. CORS preflight responses remain unchanged.
5. Relevant tests pass with no real R2/S3 network access.

## Constraints
- Do not make storage mandatory for launching the template.
- Do not expose secret env values in client responses.
- Do not remove existing media compression or video thumbnail behavior.
- Keep media path constants in `shared/media.ts` as the canonical path source.

## Out of Scope
- Building a storage setup wizard.
- Supporting providers beyond the current S3/R2-compatible API.
- Adding auth requirements to media routes unless a separate spec approves it.

## Files Likely Affected
Server:
- `app/api/media/list+api.ts`
- `app/api/media/getUploadUrl+api.ts`
- `app/api/media/getSignedUrls+api.ts`
- `app/api/media/delete+api.ts`
- New `server/api/media/*` helper if useful

Client:
- `app/(main)/(tabs)/media.tsx`
- `client/features/media/hooks/useMediaList.ts`
- `client/features/media/hooks/useMediaUpload.ts`
- `client/features/media/hooks/useSignedUrls.ts`
- `client/features/media/hooks/useMediaDelete.ts`

Docs:
- `.env.example`
- `Agent/Docs/API.md`
- `Agent/Docs/USER_FLOWS.md`

## Edge Cases
- Only one R2 env var missing should still disable media with a safe response.
- OPTIONS requests should succeed even when media is disabled.
- Upload buttons should remain disabled while configuration state is unknown.
- Existing S3 errors after valid configuration should still surface as server errors, not media-disabled.

## Risks
Changing media route setup can accidentally alter happy-path uploads. Mitigate with route-level tests that mock S3 commands and cover both disabled and configured paths.
