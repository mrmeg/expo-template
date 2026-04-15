# Spec: Align Media Upload Rate Limiting

**Status:** Ready
**Priority:** High
**Scope:** Server

---

## What
Apply the strict 10 requests per minute limiter to the actual upload-URL endpoint the app uses today. The implementation should remove the route-name mismatch between Express middleware, Expo API routes, and the published docs so upload throttling is enforced intentionally rather than by accident.

## Why
The app generates upload URLs through `/api/media/getUploadUrl`, but the production server mounts the strict limiter on `/api/media/upload-url`. As written, the most abuse-prone media route only receives the general 500 per 15 minute limit, which weakens operational protection and drifts from the documented performance budget.

## Current State
- `client/features/media/hooks/useMediaUpload.ts` requests presigned uploads from `/api/media/getUploadUrl`.
- `app/api/media/getUploadUrl+api.ts` is the server route that generates presigned upload URLs.
- `server/index.ts` applies `strictLimiter` to `/api/media/upload-url`, which does not correspond to the real route path.
- `Agent/Docs/API.md` documents the `getUploadUrl` route name, while the production server section still references `/api/media/upload-url`.
- `Agent/Docs/PERFORMANCE.md` states that upload/sensitive routes should be limited to 10 requests per minute.

## Changes
### 1. Mount the strict limiter on the real upload path
Files:
- `server/index.ts`

Update the Express middleware registration so strict rate limiting applies to the actual presigned-upload route in production.

```js
app.use("/api/media/getUploadUrl", strictLimiter);
```

If the server keeps a list of strict-limited routes, use a shared constant or helper instead of repeating string literals.

### 2. Normalize route naming across code and docs
Files:
- `server/index.ts`
- `Agent/Docs/API.md`
- `Agent/Docs/PERFORMANCE.md`

Use one canonical endpoint name everywhere: `getUploadUrl`. Remove references to the stale `/api/media/upload-url` name so future implementation work and operational debugging point to the same route.

### 3. Add a regression check for limiter coverage
Files:
- `server/__tests__/*` or extracted route-config helper
- `app/api/media/getUploadUrl+api.ts` if constants are shared there

Add a targeted test or configuration-level assertion that the strict limiter covers `/api/media/getUploadUrl`. If `server/index.ts` is too side-effect-heavy to test directly, refactor just enough of the route wiring into an exported helper to make the mapping testable.

## Acceptance Criteria
1. The production server applies `strictLimiter` to `/api/media/getUploadUrl`.
2. No code or docs in the repo still describe `/api/media/upload-url` as the active upload-URL route.
3. The general limiter remains on `/api/*`.
4. The strict limiter budget remains 10 requests per minute unless explicitly changed in the same implementation.
5. A regression test or equivalent configuration assertion exists for the strict-limited upload path.

## Constraints
- Do not rename the existing Expo Router API file or change the client request path away from `getUploadUrl`.
- Keep the general `/api` limiter in place.
- Do not expand strict limiting to unrelated endpoints unless there is a clear documented reason.
- Avoid coupling the limiter change to auth or billing work.

## Out of Scope
- Per-user or per-token rate limiting
- Rate-limit UI messaging in the client
- Changes to upload key generation or presigned URL contents
- Broader security hardening of the media routes

## Files Likely Affected
### Server
- `server/index.ts`
- `server/**/__tests__/*` or extracted middleware config helper

### Docs
- `Agent/Docs/API.md`
- `Agent/Docs/PERFORMANCE.md`

## Edge Cases
- The strict limiter should still apply when the app is deployed behind the general `/api` limiter.
- Local development should continue to function even when the server is started with `start-local`.
- Rate-limit headers and body shape should remain whatever `express-rate-limit` currently emits.
- Future route refactors should not reintroduce a path mismatch between the client and the server middleware.

## Risks
- If route strings stay duplicated, this bug can recur during future renames. A shared constant or exported route list reduces that risk without forcing a larger server refactor.

## Clarifications
- The regression test should assert that a request to `/api/media/getUploadUrl` is subject to the stricter 10-per-minute budget, not merely that the middleware is registered. Both the `/api` general limiter and the strict limiter stack because Express applies both mounts; that stacking is intentional and the stricter window should dominate.
- `server/index.ts:74-75` also applies `strictLimiter` to `/api/reports` and `/api/corrections`, which have no corresponding Expo API route in `app/api/`. Leave those mounts alone in this spec — removing them is out of scope and their presence is harmless.
- `Agent/Docs/API.md:185` is the exact line that still says `/api/media/upload-url`. Update that row to `getUploadUrl`.
