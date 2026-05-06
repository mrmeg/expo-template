# Performance

> Budgets, benchmarks, and known considerations.

## Bundle Size

- Monitoring: `bun run bundle-size` compares budgeted client JS against
  `scripts/bundle-baseline.json` and separately reports total emitted JS.
- Current baseline: 5,995,827 budgeted bytes from the latest local web export
- Threshold: 10% growth allowed before flagging
- Analysis: `bun run analyze` runs source-map-explorer on the production client export
- Only minified JS files in `dist/client` are scanned. Known optional lazy media
  chunks, currently `heic2any-*` for HEIC conversion and
  `VideoThumbnails-*` for the native thumbnail adapter, are excluded from the
  threshold and printed separately so they stay visible without failing the
  app-bundle budget. The SSR renderer in `dist/server` is tracked through
  export/server smoke tests, not the client bundle budget.

## React Query Defaults

| Setting | Value | Rationale |
|---------|-------|-----------|
| staleTime | 5 minutes | Reduce refetch frequency |
| gcTime | 10 minutes | Keep cache warm but bounded |
| retry | 2 (exponential backoff) | Resilient to transient failures |
| retry (401/403/404) | 0 | Don't retry auth/not-found errors |

## Image Handling

- **HEIC → JPEG conversion**: Package processing helper before upload where needed
- **Compression**: App-wide defaults live in mediaSettings, flow through compressionStore, and use granular `@mrmeg/expo-media/processing/*` subpaths
- **Presigned URLs**: Upload URLs expire 5 min, read URLs expire 24 hours — no persistent public URLs

## Animation

- **Reanimated 4.2**: Worklet-based animations run on UI thread
- **useScalePress**: Shared press animation hook from `@mrmeg/expo-ui/hooks` for consistent tap feedback
- **useStaggeredEntrance**: List item entrance animations with configurable delay from `@mrmeg/expo-ui/hooks`
- **useReduceMotion**: Package hook that respects OS accessibility settings

## i18n

- English translations bundled inline
- Spanish (and future languages) lazy-loaded on demand
- Reduces initial bundle size for single-language users

## Metro Configuration

- **Inline requires enabled**: Defers module initialization until first use
- **Experimental import support**: Enables modern import features
- **Package deduplication**: @react-navigation and core React Native runtime packages are deduped to prevent duplicate React contexts and duplicate UI package peer runtimes under Bun/workspace resolution

## Web-Specific

- **Server rendering**: Expo Router SSR is enabled with `web.output = "server"`
  and `unstable_useServerRendering`. Routes render at request time through the
  Bun `expo-server` adapter by default. The Express adapter remains available
  through the fallback scripts.
- **Server middleware**: `unstable_useServerMiddleware` is enabled and the root
  `+middleware.ts` is matched to `/api` plus the Server Alpha demo routes. Keep
  broad middleware work minimal because it runs before matched request
  handlers.
- **Data loaders**: `unstable_useServerDataLoaders` is enabled. Use loaders for
  route-scoped server data that should be embedded into SSR HTML or fetched by
  Expo Router's loader endpoint during client navigation. Request-specific
  loaders should set explicit cache headers, return JSON-serializable data
  only, and avoid leaking secrets into the hydrated client payload.
  `/(main)/(demos)/server-alpha` shows an overview loader, and
  `/(main)/(demos)/server-alpha/[example]` shows dynamic route params flowing
  through a loader.
- **Static compression**: The Bun server negotiates Brotli first, then gzip,
  for text-like static assets (JS, CSS, HTML, JSON, XML, SVG, maps, and other
  text extensions). It sets `Content-Encoding`, `Content-Length`, and
  `Vary: Accept-Encoding`; compressed immutable asset bodies are cached in
  memory so bundles are not recompressed on every request.
- **Static assets**: `dist/client` assets are served with 1-hour cache max-age.
  Expo assets under `/_expo/static/*` and package assets under `/assets/*`
  receive immutable 1-year caching, including Bun virtual-store paths such as
  `dist/client/assets/node_modules/.bun`.
- **HTML caching**: SSR HTML is request-time output. Add CDN/runtime cache rules
  per route before caching personalized or authenticated pages.
- **Shadows**: `getShadowStyle()` returns empty object on web — `boxShadow` causes React Native Web crashes
- **Async routes**: Enabled for production web exports
  (`asyncRoutes.web = "production"`) to keep route-specific demo/template code
  out of the built entry bundle while preserving SSR through the Expo Router
  server output. Development web keeps routes eager because Expo Router async
  route HMR can resolve grouped tab chunks such as `./media` from the repo root
  and crash Metro.

## Entry Bundle Hygiene

- Sentry is loaded through `client/lib/sentry.ts` with a dynamic import. When
  `EXPO_PUBLIC_SENTRY_DSN` is unset, startup does not install global handlers
  or pull `@sentry/react-native` into the entry bundle.
- Shared icon/resource code imports `@expo/vector-icons/Feather` directly
  rather than the package barrel so other icon sets do not become entry
  dependencies.

## Rate Limiting

| Scope | Limit | Window |
|-------|-------|--------|
| General API (all `/api`) | 500 req | 15 min |
| Media signer (`/api/media/getUploadUrl`) | 60 req | 1 min |
| Strict side-effect routes (`/api/reports`, `/api/corrections`, billing session creation) | 10 req | 1 min |

Scoped paths are configured in `server/rateLimits.js` and enforced by both
`server.bun.ts` and the Express fallback. The general limiter stacks with the
media signer and strict limiters; the narrowest matching route limiter
dominates for covered routes.

## Color Contrast Caching

- `useTheme()` caches contrast calculations
- LRU cache with 500-entry max
- Avoids redundant WCAG ratio computation on re-renders

## Render Churn Checks

- Local web pages can opt into React Scan by adding `?scan` to the URL. The
  root web HTML injects `https://unpkg.com/react-scan/dist/auto.global.js`
  only for local hosts such as `localhost`, `127.0.0.1`, and `.local`.
- `bun run web:scan` starts the Expo web server. Open
  `http://localhost:8081/showcase?scan` to inspect the
  showcase with render outlines.
- `bun run scan:showcase` opens the scan-enabled showcase route on port 8081
  against an already-running web server. Set `EXPO_DEV_SERVER_PORT` or `PORT`
  when this repo is running on another port.
- Large catalog/demo routes should isolate frequently changing examples into
  small components with local state. State for text input, switches, skeleton
  toggles, animations, select/radio controls, sliders, and OTP inputs should
  not live at the top of the full showcase route.
- Auth forms use `client/features/auth/components/AuthTextField.tsx` to keep
  per-keystroke value and validation state inside each field. The form card
  shell should not re-render while typing; keep new auth inputs on that
  boundary and cover them with
  `client/features/auth/components/__tests__/authRenderChurn.test.tsx`.
- Reusable screen templates and package controls should memoize
  theme-derived StyleSheet factories with `useMemo()` so parent renders,
  typing, toggles, and list refreshes do not allocate new style objects unless
  the theme or size inputs changed.

## FFmpeg Worker Contract (web video conversion)

Web client-side video conversion lazy-loads FFmpeg.wasm (~30MB core) on the
first unsupported upload. The worker file is served through a same-origin
URL to satisfy the cross-origin worker-blob workaround from
[ffmpeg.wasm issue #694](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/694).

| Piece | Value |
|-------|-------|
| URL the client fetches | `/_expo/static/js/web/ffmpeg-worker.js` |
| File in the repo | `packages/media/src/processing/videoConversion/ffmpeg-worker.js` |
| Single source of truth | `server/ffmpegWorker.js` (CommonJS, consumed by Metro, Bun, and Express) |

Both runtimes that serve web assets read through `server/ffmpegWorker.js`
so the URL and the file path cannot drift apart:

- `metro.config.js` — dev server (`expo start`). Serves the worker via a
  middleware shim.
- `server.bun.ts` — default production Bun server. Serves the worker through
  the same static-compression path as exported JS.
- `server/index.ts` — fallback production Express server. Serves the worker
  from the static build via `app.get(FFMPEG_WORKER_URL, …)`.

If the worker file moves, update `FFMPEG_WORKER_RELATIVE_PATH` in
`server/ffmpegWorker.js`. The regression suite in
`server/__tests__/ffmpegWorker.test.js` asserts the file exists at that
path and that `@mrmeg/expo-media/processing/video-conversion` exports the matching
`FFMPEG_WORKER_URL`.

Failure handling: `convertVideo` throws `FFmpegWorkerUnavailableError`
when the worker URL returns a non-OK status or HTML (the Expo SSR
fallback), so the caller surfaces a "Video Converter Unavailable" toast
and uploads the original format instead of hanging inside
`FFmpeg.load()`.

To disable web video conversion entirely, delete the `FFmpeg` block in
`metro.config.js`, `server.bun.ts`, and `server/index.ts`, delete
the package worker-serving adapter if unused, and remove the conversion call
sites in `useMediaLibrary`.

## Known Considerations

- **Style arrays on @rn-primitives**: Must use `StyleSheet.flatten()` — nested arrays crash React Native Web. This is a correctness issue that also prevents crash-loop performance degradation.
- **Auth store throttle**: 2-second minimum between state transitions prevents Amplify Hub listener loops that could cause excessive re-renders.
- **FFmpeg worker**: Optional web-only video conversion — see the contract section above. Safe to remove if video uploads never need cross-format normalization.

## Testing

- Jest timeout: 10 seconds (avoids hanging tests)
- Coverage targets: `client/**` (excludes devtools, test files, index re-exports)
- Coverage script: `test:ci` includes `--forceExit` to prevent Jest hanging on async cleanup
- CI: `.github/workflows/ci.yml` runs `bun run test:ci` and a separate `Web Build + Bundle Size` job that runs `bun run build && bun run bundle-size` so >10% client bundle growth is gated at the PR level
