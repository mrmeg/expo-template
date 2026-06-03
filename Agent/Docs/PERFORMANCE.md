# Performance

Performance work in this repo is mostly about web bundle hygiene, SSR
correctness, media processing cost, and avoiding unnecessary render churn.

## Bundle Budget

`bun run bundle-size` compares production client JS against
`scripts/bundle-baseline.json`. The current checked-in guard allows 10 percent
growth before failing.

Useful commands:

- `bun run build`
- `bun run bundle-size`
- `bun run analyze`
- `bun run analyze:gzip`

`docs/bundle-analysis.md` has the detailed workflow for reading or updating
the baseline. Do not update the baseline just to hide uninvestigated growth.

## SSR And Hydration

Web output is server-rendered. Hydration requires the server HTML and the first
client render to match.

Read `docs/ssr-hydration.md` before editing:

- `app/+html.tsx`
- font/resource loading
- i18n initialization
- theme startup
- onboarding startup
- viewport-dependent rendering

Jest and `tsc` are not enough for SSR bugs. Use real server HTML and browser
console checks for hydration work.

## Entry Bundle Hygiene

- Sentry runtime setup is gated by DSN and should avoid pulling Sentry into the
  entry path when disabled.
- Route code should stay route-scoped; production web async routes are enabled.
- Prefer granular package imports such as package subpaths over broad barrels
  when a package exposes them for that purpose.
- Keep optional media conversion paths lazy.

## Media Processing

Image compression and video conversion happen client side before upload. The
caller should upload the original asset when conversion does not improve size.

Web video conversion relies on the FFmpeg worker contract shared by:

- `server/ffmpegWorker.js`
- `metro.config.js`
- `server.bun.ts`
- `server/index.ts`
- `packages/media/src/processing/videoConversion/ffmpeg-worker.js`

If the worker is unavailable, callers should surface a recoverable message and
upload the original video rather than hanging.

## Server And Caching

The Bun server serves static assets with compression and cache headers before
delegating SSR requests to Expo Server. The Express fallback should preserve
the same route limits and security posture.

Do not cache personalized SSR HTML without explicit route-level cache rules.
Static Expo assets can receive long immutable caching; request-time HTML should
be treated differently.

## Render Churn

Use React Scan through the local showcase when editing reusable UI or large demo
surfaces:

- `bun run web:scan`
- `bun run scan:showcase`

Keep high-frequency state inside small demo or field components. New UI package
components should have focused tests, and style factories should avoid
allocating new objects on every parent render when the inputs are unchanged.

## Verification Gates

Common local checks:

- `bun run typecheck`
- `bun run lint`
- `bun run check:features`
- `bun run test:ci`
- `bun run build`
- `bun run bundle-size`
- `bun run ui:typecheck && bun run ui:test && bun run ui:build`
- `bun run media:typecheck && bun run media:test && bun run media:build`
