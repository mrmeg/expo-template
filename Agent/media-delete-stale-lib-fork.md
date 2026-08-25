---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Delete the stale media-processing fork under client/features/media/lib

## Goal
Remove ~1,620 LOC of dead, diverged media-processing code that predates the
`packages/media` extraction, leaving `@mrmeg/expo-media` as the single source
of truth. No runtime behavior change.

## Context
- `client/features/media/lib/imageCompression/` (9 files, ~778 LOC incl. test)
  and `client/features/media/lib/videoConversion/` (7 files, ~695 LOC incl.
  test) are a stale fork of `packages/media/src/processing/`. Git history:
  fork last touched `fc90a20` (2026-03-16); the package was created `d235ed6`
  (2026-05-04) and evolved since — every diverging file is newer/superset in
  the package (added `trackBlobUrl`, `revokeAllTrackedUrls`,
  `shouldUseProcessedFile`, `shouldUseCompressedImage`, `FFMPEG_WORKER_URL`).
- Zero runtime importers of either fork directory (verified by grep across
  `client/`, `app/`, tests). All real callers import the package:
  `client/features/media/hooks/useMediaLibrary.ts`
  (`@mrmeg/expo-media/processing/image-compression`, `.../video-conversion`,
  `.../video-thumbnails`), `client/features/media/mediaSettings.ts` and
  `client/features/media/stores/compressionStore.ts`
  (`.../image-compression/config`).
- The only live file in `lib/` is `client/features/media/lib/problem.ts`
  (7-line re-export of `@mrmeg/expo-media/client`), imported by
  `app/(main)/(tabs)/media.tsx:35` and tested by
  `client/features/media/lib/__tests__/problem.test.ts` (139 LOC).
- Fork-only test coverage that must not be lost:
  - `client/features/media/lib/imageCompression/__tests__/utils.test.ts`
    (146 LOC) covers `calculateDimensions`, `getMimeType`, `reduceQuality`;
    the package's `packages/media/src/processing/imageCompression/__tests__/utils.test.ts`
    (40 LOC) covers only `shouldContinueCompression` /
    `shouldUseProcessedFile` / `shouldUseCompressedImage`.
  - `client/features/media/lib/videoConversion/__tests__/convert.test.ts`
    (49 LOC) is the ONLY test of the `FFmpegWorkerUnavailableError` behavior;
    `packages/media/src/processing/videoConversion/` has no `__tests__` dir.
- `server/api/media/storage.ts` (60 LOC) is a self-described compatibility
  shim whose only consumers are three tests:
  `app/api/media/__tests__/{mediaDisabled,delete,auth}.test.ts`. The real
  implementations live in `server/media/config.ts`
  (`getMissingMediaStorageEnv`) and `server/media/handlers.ts`
  (`resetMediaStorageForTests`).
- Stale comments point at the fork as the ffmpeg worker source; the worker
  actually served comes from
  `packages/media/src/processing/videoConversion/ffmpeg-worker.js` (locked by
  `server/__tests__/ffmpegWorker.test.js`):
  - `metro.config.js` ffmpeg block header ("delete
    client/features/media/lib/videoConversion/")
  - `server/index.ts:118-119` (same wording)
  - `server/ffmpegWorker.js` header (mentions only the Express server, not
    `server.bun.ts`, which also serves the worker via `serveFfmpegWorker()`)

## Work
1. Port the fork-only test coverage into the package first:
   - Merge the `calculateDimensions` / `getMimeType` / `reduceQuality` cases
     from the fork's `imageCompression/__tests__/utils.test.ts` into
     `packages/media/src/processing/imageCompression/__tests__/utils.test.ts`,
     adapting imports to package-relative paths.
   - Create `packages/media/src/processing/videoConversion/__tests__/convert.test.ts`
     from the fork's convert test (the `FFmpegWorkerUnavailableError`
     regression), adapting imports.
2. Delete `client/features/media/lib/imageCompression/` and
   `client/features/media/lib/videoConversion/` entirely.
3. Repoint `app/(main)/(tabs)/media.tsx` to import directly from
   `@mrmeg/expo-media/client`, then delete
   `client/features/media/lib/problem.ts`. Keep the behavior assertions from
   `lib/__tests__/problem.test.ts`: if the package has no equivalent test,
   move it into `packages/media` against the package export; otherwise delete
   it. Remove the `lib/` directory if nothing remains.
4. Delete `server/api/media/storage.ts`; repoint the three tests under
   `app/api/media/__tests__/` at `server/media/config.ts` and
   `server/media/handlers.ts`. If any test uses the shim's
   `mediaDisabledResponse` helper, inline it or import the real source.
5. Fix the stale comments listed in Context (metro.config.js,
   server/ffmpegWorker.js header; `server/index.ts` only if it still exists —
   see Merge plan).
6. Run `bun run check:features` and `bun run docs:llms:check`; update the
   feature-isolation allowlist or regenerate llms files only if they
   referenced the deleted paths.

## Validation
- `bun run typecheck && bun run lint`
- `bunx jest client/features/media app/api/media server` (all green)
- `bun run media:test` (package tests, including the newly ported ones)
- `bun run check:features`
- `bun run docs:llms:check`
- `grep -rn "features/media/lib" client app server scripts docs` returns
  nothing (except git history).

## Out of scope
- The ffmpeg worker serving triangle (metro dev middleware +
  `server.bun.ts` + `server/ffmpegWorker.js`) stays as is.
- `packages/media` dist/publishing policy.
- CORS consolidation.

## Merge plan
Trivial overlap with `server-drop-express-fallback` (both touch
`server/index.ts` — that spec deletes it, this one only edits a comment in
it). Land in either order; if the Express file is already gone, skip that
comment fix.
