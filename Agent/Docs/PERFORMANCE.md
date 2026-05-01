# Performance

> Budgets, benchmarks, and known considerations.

## Bundle Size

- Monitoring: `bun run bundle-size` compares client JS against `scripts/bundle-baseline.json`
- Threshold: 10% growth allowed before flagging
- Analysis: `bun run analyze` runs source-map-explorer on the production client export
- Only minified JS files in `dist/client` are measured. The SSR renderer in
  `dist/server` is tracked through export/server smoke tests, not the client
  bundle budget.

## React Query Defaults

| Setting | Value | Rationale |
|---------|-------|-----------|
| staleTime | 5 minutes | Reduce refetch frequency |
| gcTime | 10 minutes | Keep cache warm but bounded |
| retry | 2 (exponential backoff) | Resilient to transient failures |
| retry (401/403/404) | 0 | Don't retry auth/not-found errors |

## Image Handling

- **HEIC → JPEG conversion**: Client-side before upload (iOS captures in HEIC)
- **Compression**: Configurable quality/dimensions via compressionStore
- **Presigned URLs**: Upload URLs expire 5 min, read URLs expire 24 hours — no persistent public URLs

## Animation

- **Reanimated 4.2**: Worklet-based animations run on UI thread
- **useScalePress**: Shared press animation hook for consistent tap feedback
- **useStaggeredEntrance**: List item entrance animations with configurable delay
- **useReduceMotion**: Respects OS accessibility setting

## i18n

- English translations bundled inline
- Spanish (and future languages) lazy-loaded on demand
- Reduces initial bundle size for single-language users

## Metro Configuration

- **Inline requires enabled**: Defers module initialization until first use
- **Experimental import support**: Enables modern import features
- **Package deduplication**: @react-navigation packages deduped to prevent duplicate React contexts (Bun hoisting workaround)

## Web-Specific

- **Server rendering**: Expo Router SSR is enabled with `web.output = "server"`
  and `unstable_useServerRendering`. Routes render at request time through the
  Express `expo-server` adapter.
- **Express compression**: Gzip on all responses in production.
- **Static assets**: `dist/client` assets are served with 1-hour cache max-age.
- **HTML caching**: SSR HTML is request-time output. Add CDN/runtime cache rules
  per route before caching personalized or authenticated pages.
- **Shadows**: `getShadowStyle()` returns empty object on web — `boxShadow` causes React Native Web crashes
- **Async routes**: Disabled for web in the template baseline to keep the SSR
  experiment deterministic. Re-enable only after measuring route-level split
  gains against added request/chunk overhead.

## Rate Limiting

| Scope | Limit | Window |
|-------|-------|--------|
| General API (all `/api`) | 500 req | 15 min |
| Strict (`/api/media/getUploadUrl`, `/api/reports`, `/api/corrections`) | 10 req | 1 min |

Strict paths are configured in `server/rateLimits.js` and enforced by
`server/index.ts`. Both limiters stack; the strict window dominates for
covered routes.

## Color Contrast Caching

- `useTheme()` caches contrast calculations
- LRU cache with 500-entry max
- Avoids redundant WCAG ratio computation on re-renders

## FFmpeg Worker Contract (web video conversion)

Web client-side video conversion lazy-loads FFmpeg.wasm (~30MB core) on the
first unsupported upload. The worker file is served through a same-origin
URL to satisfy the cross-origin worker-blob workaround from
[ffmpeg.wasm issue #694](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/694).

| Piece | Value |
|-------|-------|
| URL the client fetches | `/_expo/static/js/web/ffmpeg-worker.js` |
| File in the repo | `client/features/media/lib/videoConversion/ffmpeg-worker.js` |
| Single source of truth | `server/ffmpegWorker.js` (CommonJS, consumed by both Metro and Express) |

Both runtimes that serve web assets read through `server/ffmpegWorker.js`
so the URL and the file path cannot drift apart:

- `metro.config.js` — dev server (`expo start`). Serves the worker via a
  middleware shim.
- `server/index.ts` — production Express server. Serves the worker from
  the static build via `app.get(FFMPEG_WORKER_URL, …)`.

If the worker file moves, update `FFMPEG_WORKER_RELATIVE_PATH` in
`server/ffmpegWorker.js`. The regression suite in
`server/__tests__/ffmpegWorker.test.js` asserts the file exists at that
path and that `client/features/media/lib/videoConversion/config.ts` still
exports the matching `FFMPEG_WORKER_URL`.

Failure handling: `convertVideo` throws `FFmpegWorkerUnavailableError`
when the worker URL returns a non-OK status or HTML (the Expo SSR
fallback), so the caller surfaces a "Video Converter Unavailable" toast
and uploads the original format instead of hanging inside
`FFmpeg.load()`.

To disable web video conversion entirely, delete the `FFmpeg` block in
both `metro.config.js` and `server/index.ts`, delete
`client/features/media/lib/videoConversion/`, and remove the call sites
in `useMediaLibrary`.

## Known Considerations

- **Style arrays on @rn-primitives**: Must use `StyleSheet.flatten()` — nested arrays crash React Native Web. This is a correctness issue that also prevents crash-loop performance degradation.
- **Auth store throttle**: 2-second minimum between state transitions prevents Amplify Hub listener loops that could cause excessive re-renders.
- **FFmpeg worker**: Optional web-only video conversion — see the contract section above. Safe to remove if video uploads never need cross-format normalization.

## Testing

- Jest timeout: 10 seconds (avoids hanging tests)
- Coverage targets: `client/**` (excludes devtools, test files, index re-exports)
- Coverage script: `test:ci` includes `--forceExit` to prevent Jest hanging on async cleanup
