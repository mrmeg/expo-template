# Spec: Fix Media Delete CORS for Web

**Status:** Ready
**Priority:** High
**Scope:** Server + Client

---

## What
Allow cross-origin web clients to delete media through the existing `DELETE /api/media/delete` contract. The fix should make the shared CORS preflight advertise `DELETE`, preserve the current delete handler shape, and update the docs so the published API contract matches runtime behavior.

## Why
The media tab already uses `DELETE` for single-file removal, but the shared preflight response only allows `GET, POST, OPTIONS`. In Expo web development and any split-origin deployment, browsers block the request before it reaches the route handler, so core media management appears broken even though the delete endpoint itself exists.

## Current State
- `client/features/media/hooks/useMediaDelete.ts` issues `DELETE /api/media/delete?key=...` for single-file removal.
- `app/api/media/delete+api.ts` implements both single-file `DELETE` and batch `POST` deletion.
- `app/api/_shared/cors.ts` returns `Access-Control-Allow-Methods: GET, POST, OPTIONS`, which excludes `DELETE`.
- `client/config/config.dev.ts` points web API traffic to `http://localhost:3000/api`, making development web usage cross-origin relative to Expo's default web host.
- `Agent/Docs/API.md` documents the delete endpoint, but the shared CORS section still omits `DELETE`.

## Changes
### 1. Expand the shared CORS contract to support single-file deletion
Files:
- `app/api/_shared/cors.ts`

Update the shared CORS helper so allowed origins keep the same allowlist behavior while the advertised methods include `DELETE` for both normal and preflight responses.

```ts
return {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Vary": "Origin",
};
```

### 2. Keep the delete API contract stable
Files:
- `app/api/media/delete+api.ts`
- `client/features/media/hooks/useMediaDelete.ts`

Preserve the current single-file delete shape:
- query-string key input for `DELETE`
- batch deletion via `POST`
- existing JSON success/error structure

Any client-side changes should be limited to clearer error handling or comments, not to rewriting single-file delete into a workaround such as `POST`.

### 3. Add regression coverage and doc updates
Files:
- `Agent/Docs/API.md`
- `Agent/Docs/PERFORMANCE.md`
- `app/api/_shared/__tests__/*` or equivalent
- `app/api/media/__tests__/*` or equivalent

Document that the media delete path is a supported cross-origin web operation when the request origin is on the configured allowlist. Add targeted tests around the shared CORS helper or route behavior so future edits do not silently drop `DELETE` again.

## Acceptance Criteria
1. A browser preflight from an allowed origin to `DELETE /api/media/delete?key=...` returns `Access-Control-Allow-Methods` that includes `DELETE`.
2. Single-file deletion from the web media screen works without a preflight failure when the API host is on an allowed origin.
3. Batch deletion via `POST /api/media/delete` continues to work unchanged.
4. Disallowed origins still do not receive `Access-Control-Allow-Origin`.
5. The API docs explicitly state that the shared CORS contract supports the delete method.

## Constraints
- Do not broaden the origin allowlist beyond the current `ALLOWED_ORIGINS` contract.
- Do not change the single-file delete route path or switch it to a different HTTP verb.
- Keep same-origin and native requests working when there is no `Origin` header.
- Do not add auth or object-ownership enforcement as part of this fix.

## Out of Scope
- Redesigning delete to use request bodies or a new route shape
- Media authorization and per-user object scoping
- Changes to upload, signed URL, or list endpoint semantics
- Broader CORS redesign for unrelated endpoints

## Files Likely Affected
### Server
- `app/api/_shared/cors.ts`
- `app/api/media/delete+api.ts`
- `app/api/**/__tests__/*` or equivalent shared test helpers

### Client
- `client/features/media/hooks/useMediaDelete.ts`

### Docs
- `Agent/Docs/API.md`
- `Agent/Docs/PERFORMANCE.md`

## Edge Cases
- Same-origin requests with no `Origin` header should continue to work without extra CORS headers.
- A disallowed origin should still fail preflight rather than being silently permitted.
- Batch `POST` deletion should remain valid after the method list changes.
- The client should surface route-level delete failures distinctly from network or preflight failures.

## Risks
- Because the helper is shared, changing the advertised methods affects every API route that uses it. `getCorsHeaders` is also imported by `app/api/media/getSignedUrls+api.ts`, `app/api/media/list+api.ts`, and `app/api/media/getUploadUrl+api.ts`. Those routes will begin advertising `DELETE` even though they don't implement it — harmless because the route handler itself still decides which verbs to answer. Keep the change narrow to method advertising and retain the existing origin allowlist so the blast radius stays low.
- The existing `Access-Control-Max-Age` is 86400 (24h). Browsers that cached the old methods list pre-deploy may continue to fail the preflight until their cache expires. This is a rollout artifact, not a correctness issue.

## Notes for Docs Updates
- `Agent/Docs/API.md:118` currently reads `Methods: GET, POST, OPTIONS` — that is the line that drifts.
- The `PERFORMANCE.md` update should be limited to any explicit CORS/methods references there, if any; do not introduce new performance claims. If nothing in `PERFORMANCE.md` mentions the CORS contract, no edit is required.
