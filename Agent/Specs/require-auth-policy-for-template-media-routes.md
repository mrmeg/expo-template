# Spec: Require Auth Policy For Template Media Routes

**Status:** Ready
**Priority:** High
**Scope:** Server + Client

---

## What
Make the template media routes safe by default when real storage is configured. The route layer should require authenticated users for upload/list/read/delete unless an explicit development-only env flag opts into public media access.

## Why
Once R2/S3 environment variables are present, the current template handlers allow public upload, listing, signing, and deletion. A production adopter can accidentally ship public media mutation routes while following the package integration path.

## Current State
`server/media/handlers.ts` creates `mediaHandlers` with `config`, CORS callbacks, and an upload policy that only limits custom filenames to thumbnails. It does not pass an `authorize` callback and does not define `canRead`, `canList`, or `canDelete` policies, so package defaults allow every operation.

`Agent/Docs/USER_FLOWS.md` documents the Media tab as public, and `Agent/Docs/ARCHITECTURE.md` describes media API routes but does not call out the public-route risk. `server/api/shared/auth.ts` already provides authenticated-user helpers for API routes.

## Changes
1. Add a template media authorization policy.
   - Update `server/media/handlers.ts`.
   - Use the existing shared API auth helper to require an authenticated user for upload, signed URL reads, listing, and deletion when real storage is configured.
   - Add one explicit opt-in env flag for local/demo public media access, for example `EXPO_TEMPLATE_ALLOW_PUBLIC_MEDIA=true`.
   - The opt-in must be ignored in production (`NODE_ENV === "production"`), where real storage always requires auth.
   - Keep the template explorable with storage disabled; `media-disabled` should remain available without auth so setup guidance still renders.

2. Add operation policies.
   - Define `canUpload`, `canRead`, `canList`, and `canDelete`.
   - Keep the thumbnail custom filename rule.
   - Keep policy functions simple and app-owned so consumers can replace them.

3. Update client behavior for unauthorized media.
   - Ensure Media tab errors for 401/403 are user-readable.
   - If a signed-out user opens Media while real storage requires auth, show an auth-required or sign-in state instead of a generic media failure.
   - Do not make the Media tab protected through `AuthGate` unless the UX decision is documented; the current docs classify it as public.

4. Add regression coverage.
   - Add route tests for upload, list, signed URLs, and delete returning 401 when auth is required and no valid token/verifier is present.
   - Add a test for the explicit development bypass if one is introduced.
   - Add a test that `media-disabled` still wins before storage clients are constructed when env vars are missing.

5. Update docs.
   - Update `Agent/Docs/USER_FLOWS.md`, `Agent/Docs/ARCHITECTURE.md`, and `Agent/Docs/EXPO_MEDIA_PACKAGE.md` to describe the template route auth posture and consumer customization point.

## Acceptance Criteria
1. With real storage configured and no valid auth, media upload/list/read/delete routes do not allow public access by default.
2. `media-disabled` setup state still works without requiring auth when storage env vars are missing.
3. The Media tab presents 401/403 media errors as an auth/access state, not an unknown failure.
4. Tests cover unauthorized access for every media route.
5. Docs state how consumers should customize media authorization policy.

## Constraints
- Do not move auth into `@mrmeg/expo-media`; the package must stay auth-system agnostic.
- Do not break the template's no-env explorable mode.
- Do not make public media access possible in production without an explicit opt-in.
- Do not honor the public-media opt-in in production.
- Keep CORS preflight behavior intact.

## Out of Scope
- Per-user media ownership rows or database metadata.
- Entitlement-based paid media limits.
- Native deep-link redirect preservation for sign-in.
- Reworking Cognito token verification outside the media route policy.

## Files Likely Affected
Server:
- `server/media/handlers.ts`
- `server/api/shared/auth.ts`
- `app/api/media/__tests__/*`
- `Agent/Docs/ARCHITECTURE.md`
- `Agent/Docs/EXPO_MEDIA_PACKAGE.md`
- `Agent/Docs/USER_FLOWS.md`

Client:
- `app/(main)/(tabs)/media.tsx`
- `client/features/media/lib/problem.ts`
- `client/features/media/hooks/*`

## Edge Cases
- Storage disabled should return `503 media-disabled` with missing env names even for signed-out users.
- CORS `OPTIONS` requests must not require auth.
- Local demos with no Cognito env vars and no storage env vars should remain explorable.
- Local demos with real storage and `EXPO_TEMPLATE_ALLOW_PUBLIC_MEDIA=true` may allow public access outside production only.
- Invalid tokens should fail closed.
- If an adopter wants public read-only media, they should be able to replace policy callbacks without forking the package.

## Risks
- Tightening auth can make local demos less convenient when real storage env vars are present. Mitigate with explicit development opt-in and clear docs.
