# Spec: Restore Web FFmpeg Worker Serving

**Status:** Ready
**Priority:** Medium
**Scope:** Server + Client

---

## What
Restore the FFmpeg worker path needed for lazy web video conversion, and make that worker available reliably in both supported web runtimes. The solution should remove the current file-path mismatch, stop assuming the worker is always served from a valid runtime origin, and preserve the existing lazy-load model for the heavy FFmpeg core.

## Why
Unsupported video uploads on web depend on FFmpeg booting successfully before conversion can begin. Right now the client requests `/_expo/static/js/web/ffmpeg-worker.js`, but the Express server looks for the worker in a nonexistent directory, so production serving is broken and the web conversion path becomes fragile or unusable.

## Current State
- `client/features/media/lib/videoConversion/config.ts` defines `FFMPEG_WORKER_URL` as `/_expo/static/js/web/ffmpeg-worker.js`.
- `client/features/media/lib/videoConversion/convert.ts` resolves that worker through `window.location.origin` and passes it into `ffmpeg.load(...)` via a blob URL (GitHub issue #694 workaround for cross-origin worker loading).
- `server/index.ts:89` attempts to read `client/lib/videoConversion/ffmpeg-worker.js`, but the bundled worker actually lives at `client/features/media/lib/videoConversion/ffmpeg-worker.js`. Because `fs.existsSync(ffmpegWorkerPath)` fails, the Express route is never registered.
- `metro.config.js:42` has the **same broken path** (`client/lib/videoConversion/ffmpeg-worker.js`). As a result, Metro dev also fails to serve the worker, so web dev and the Express production server share the same defect and must be fixed together.
- `Agent/Docs/PERFORMANCE.md` describes the FFmpeg worker as optional web infrastructure, but it does not capture the current serving assumptions or failure modes.

## Changes
### 1. Establish one valid worker asset path
Files:
- `client/features/media/lib/videoConversion/config.ts`
- `client/features/media/lib/videoConversion/ffmpeg-worker.js`
- `server/index.ts`
- `metro.config.js`

Choose a single worker asset strategy that works in both supported web runtimes:
- production Express export (`server/index.ts`)
- local web development flow via Metro (`metro.config.js`)

Preferred outcome: keep the existing `FFMPEG_WORKER_URL` (`/_expo/static/js/web/ffmpeg-worker.js`) as the single URL contract, and fix both `server/index.ts` and `metro.config.js` to read the worker from the real repository path (`client/features/media/lib/videoConversion/ffmpeg-worker.js`). Changing the URL to a new path (e.g. `/static/ffmpeg-worker.js`) is acceptable only if both runtimes are updated to serve that new path and the decision is documented.

### 2. Fix server-side worker lookup and routing
Files:
- `server/index.ts`
- `metro.config.js`

Update both Express and Metro to read the worker from the actual repository path, and only register the route when the file exists at that real location. The worker-serving route should be easy to audit and should not rely on stale path comments or duplicated directory assumptions. If a shared constant for the worker path reduces drift, introduce one in a location both files can reach (e.g. a small Node-compatible helper).

### 3. Make client worker resolution runtime-safe
Files:
- `client/features/media/lib/videoConversion/convert.ts`
- `client/features/media/lib/videoConversion/config.ts`

The `${window.location.origin}${FFMPEG_WORKER_URL}` concat is required for the cross-origin worker blob trick on lines ~170-173 — do not remove it. The runtime-safety fix is about making sure the URL it builds actually resolves, not about removing origin prefixing. Keep the existing blob-URL approach to worker loading.

If the decision is to keep `FFMPEG_WORKER_URL` pointing at `/_expo/static/js/web/ffmpeg-worker.js`, the client code can stay essentially the same — the fix is on the server/Metro side. If the decision is to move to a different URL, update `FFMPEG_WORKER_URL` alongside the matching server/Metro routes in the same change.

### 4. Add graceful failure handling and regression coverage
Files:
- `client/features/media/lib/videoConversion/convert.ts`
- `client/features/media/hooks/useMediaUpload.ts` (if needed to surface the error)
- `server/**/__tests__/*` or equivalent
- `Agent/Docs/PERFORMANCE.md`

If the worker still cannot be loaded, the conversion flow should reject from `convertVideo` with a clearly-typed error (not hang on the load promise). The caller — currently `useMediaLibrary`/`useMediaUpload` — should translate that rejection into the existing toast/notification path rather than leaving the user stuck in a loading state. The spec does not require new UI surfaces; use the existing `globalUIStore` notification pattern.

Add focused coverage or configuration checks around the worker path so a future file move does not silently break web conversion again. A minimal regression test can simply assert that the file at the configured worker path exists relative to the repo root.

## Acceptance Criteria
1. The configured FFmpeg worker URL points to a file that is actually served in the supported web runtime(s).
2. `server/index.ts` reads the worker from the correct file path in the repository.
3. Web video conversion continues to lazy-load FFmpeg rather than bundling it eagerly at startup.
4. When the worker cannot be loaded, the user receives a clear failure instead of an indefinite conversion state.
5. The worker path contract is documented and covered by a regression test or equivalent configuration assertion.

## Constraints
- Keep FFmpeg lazy-loaded; do not move the 30MB core into the initial web bundle.
- Do not replace the existing client-side conversion approach with server-side transcoding in this spec.
- Preserve the option to remove FFmpeg entirely later, as described in the performance docs.
- Keep the change focused on worker availability and runtime resolution, not on broader media UX redesign.

## Out of Scope
- Native video conversion changes
- New server-side video transcoding infrastructure
- Expanding supported media formats beyond the current conversion list
- Upload UI redesign or progress-indicator polish beyond failure handling

## Files Likely Affected
### Server / Build
- `server/index.ts`
- `metro.config.js`
- `server/**/__tests__/*` or route/config helpers

### Client
- `client/features/media/lib/videoConversion/config.ts`
- `client/features/media/lib/videoConversion/convert.ts`
- `client/features/media/lib/videoConversion/ffmpeg-worker.js`
- `client/features/media/hooks/useMediaLibrary.ts`
- `client/features/media/hooks/useMediaUpload.ts` (only if needed to surface load failures)

### Docs
- `Agent/Docs/PERFORMANCE.md`
- `Agent/Docs/ARCHITECTURE.md`

## Edge Cases
- Web development and production builds may not share the same origin or asset server shape.
- The worker file may move again during future feature-folder refactors.
- FFmpeg core loading may succeed while the worker URL fails; the client must surface that distinction clearly enough to debug.
- The app should still upload already-compatible MP4 videos without triggering the FFmpeg path.

## Risks
- Asset-path fixes that only work in one runtime can create another hidden split between development and production. The safest mitigation is a single documented URL contract plus a testable serving path.
