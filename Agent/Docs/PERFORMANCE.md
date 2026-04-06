# Performance

> Budgets, benchmarks, and known considerations.

## Bundle Size

- Monitoring: `npm run bundle-size` compares against `scripts/bundle-baseline.json`
- Threshold: 10% growth allowed before flagging
- Analysis: `npm run analyze` runs source-map-explorer on production export
- Only minified JS files are measured

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

- **Express compression**: Gzip on all responses in production
- **Static assets**: 1-hour cache max-age
- **Shadows**: `getShadowStyle()` returns empty object on web — `boxShadow` causes React Native Web crashes
- **Async routes**: Enabled for web, allowing route-level code splitting

## Rate Limiting

| Scope | Limit | Window |
|-------|-------|--------|
| General API | 500 req | 15 min |
| Upload/sensitive | 10 req | 1 min |

## Color Contrast Caching

- `useTheme()` caches contrast calculations
- LRU cache with 500-entry max
- Avoids redundant WCAG ratio computation on re-renders

## Known Considerations

- **Style arrays on @rn-primitives**: Must use `StyleSheet.flatten()` — nested arrays crash React Native Web. This is a correctness issue that also prevents crash-loop performance degradation.
- **Auth store throttle**: 2-second minimum between state transitions prevents Amplify Hub listener loops that could cause excessive re-renders.
- **FFmpeg worker**: Optional video conversion on web — can be removed to reduce bundle if video features aren't needed (see comments in `metro.config.js` and `server/index.ts`).

## Testing

- Jest timeout: 10 seconds (avoids hanging tests)
- Coverage targets: `client/**` (excludes devtools, test files, index re-exports)
- CI: `--forceExit` flag to prevent Jest hanging on async cleanup
