# Spec: Use Named Media Upload Policies

**Status:** Ready
**Priority:** Medium
**Scope:** Client

---

## What
Refactor the template Media screen to use the named upload policies from `MEDIA_APP_SETTINGS` instead of deriving media type and compression behavior inline. The in-repo consumer should demonstrate the package adoption pattern documented for other apps.

## Why
The media package docs tell consumers to centralize upload choices in app-owned policies so behavior does not scatter across screens. The template should be the reference implementation, otherwise future adopters and LLMs will copy the inline screen logic instead of the documented setup.

## Current State
`client/features/media/mediaSettings.ts` defines named `uploadPolicies` for `avatar`, `generalImage`, `originalImage`, and `video`. `Agent/Docs/EXPO_MEDIA_PACKAGE.md` tells screens to choose named policies instead of hardcoding media types, quality values, and target paths.

`app/(main)/(tabs)/media.tsx` currently computes upload media type in `getUploadMediaType()` from the active filter and asset MIME type. `handleUpload()` calls `pickMedia()` without passing a named compression policy, so compression comes from store defaults rather than the selected upload policy. Thumbnail upload still hardcodes `mediaType: "thumbnails"` and `contentType: "image/jpeg"`, which is acceptable if documented as generated-thumbnail behavior.

## Changes
1. Add policy resolution helpers.
   - Update `client/features/media/mediaSettings.ts` or add a small helper near the media feature.
   - Provide a function that resolves a `ProcessedAsset` and current filter to a named upload policy.
   - Keep the current filter behavior only where intentional: filtering to `avatars` should upload images as avatars, filtering to `videos` should upload videos, and filtering to `thumbnails` should not redirect normal uploads into thumbnails.
   - The resolver should return both the policy name and policy object so tests can assert that named policies are being used, not just equivalent values.

2. Use policy compression when picking media.
   - Update `app/(main)/(tabs)/media.tsx`.
   - For the current mixed image/video picker, pass the `generalImage` policy compression into `pickMedia()` because image processing happens before individual upload policy resolution and videos ignore image compression.
   - Document in code or docs that per-asset image policy compression requires a future picker split or per-asset processing hook change.

3. Use policy media type when uploading.
   - Replace `getUploadMediaType()` inline branching with the policy resolver.
   - Keep video thumbnail upload as a generated derivative using `mediaType: "thumbnails"` and `customFilename` matching the video basename.

4. Add coverage.
   - Add unit tests for the policy resolver covering all filters and image/video assets.
   - If the resolver stays inside the screen, extract it so it can be tested without rendering the whole Media tab.

5. Align docs if behavior changes.
   - Update `Agent/Docs/EXPO_MEDIA_PACKAGE.md` and `packages/media/README.md` only if the recommended consumer policy shape changes.

## Acceptance Criteria
1. The Media screen resolves uploads through named policies from `MEDIA_APP_SETTINGS.uploadPolicies`.
2. Images in the default all-media upload flow use the `generalImage` policy.
3. Videos in the default all-media upload flow use the `video` policy.
4. The thumbnails filter does not cause normal user-selected files to upload as thumbnails.
5. Unit tests cover policy resolution for images, videos, avatars, uploads, videos, and thumbnails filters.

## Constraints
- Do not move app-specific upload defaults into `@mrmeg/expo-media`.
- Do not change the package public API for this refactor.
- Do not remove the compression store; it still owns runtime overrides.
- Keep video thumbnail custom filename behavior intact.

## Out of Scope
- New media UI controls for choosing policies.
- Avatar-specific profile upload UI.
- Server auth policy changes.
- Media list prefix isolation.

## Files Likely Affected
Server:
- None expected.

Client:
- `app/(main)/(tabs)/media.tsx`
- `client/features/media/mediaSettings.ts`
- `client/features/media/__tests__/*` or `client/features/media/lib/__tests__/*`
- `Agent/Docs/EXPO_MEDIA_PACKAGE.md`
- `packages/media/README.md`

## Edge Cases
- Mixed image/video selection should not apply image compression to videos.
- The `thumbnails` filter should disable upload unless product requirements explicitly define a thumbnail upload flow.
- Runtime compression overrides should still apply after the named default policy is selected.
- Assets without MIME type should fall back conservatively and surface upload errors from the server if unsupported.

## Risks
- Compressing per mixed-selection asset may require restructuring `useMediaLibrary`. Mitigate by extracting policy resolution first and only changing picker behavior where the current hook supports it cleanly.
