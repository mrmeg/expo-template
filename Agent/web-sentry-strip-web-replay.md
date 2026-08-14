---
status: draft
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Strip unused Sentry Session Replay from the web bundle

## Goal
Shrink the ~848 KB raw (~226 KB gzip) lazy Sentry chunk on web by removing Session Replay code the app never configures. Replay accounts for ~137 KB raw (`@sentry-internal/replay` 122.6 KB + `@sentry-internal/replay-canvas` 14.3 KB). The chunk is lazy but loads at startup via `setupSentry()`, so it competes with time-to-interactive on every page load.

## Context
- `client/lib/sentry.ts` dynamically imports `@sentry/react-native` from a single split point (good) and calls `Sentry.init` with no replay or feedback integrations.
- The resulting web chunk (`index-c67a00…js` in the 2026-08-13 build) is entirely Sentry: `@sentry/core` 244.6 KB, `@sentry/react-native` 201.9 KB, `@sentry-internal/replay` 122.6 KB, `@sentry/browser` 95.7 KB, `@sentry-internal/feedback` 47.6 KB, `@sentry-internal/browser-utils` 42.2 KB, `@sentry-internal/replay-canvas` 14.3 KB.
- `@sentry/react-native/metro` (installed version, `dist/js/tools/metroconfig.js`) exports `withSentryResolver(config, includeWebReplay)`. With `includeWebReplay === false` it resolves any module matching `@sentry(-internal)?/replay` to `{ type: "empty" }` on all platforms. It chains to the existing `resolveRequest`, so it composes with the dedupe resolver already installed in `metro.config.js`.
- Default behavior (flag undefined) already strips replay on android/ios only — web is the only platform currently bundling it. Since `Sentry.init` never enables any replay integration, stripping it on web changes no runtime behavior.
- Use the minimal `withSentryResolver` wrapper, not full `withSentryConfig`/`getSentryExpoConfig` — the latter also install a debug-id serializer and babel transformer changes that are out of scope here.

## Work
1. In `metro.config.js`:
   - `const { withSentryResolver } = require("@sentry/react-native/metro");`
   - Change the export to `module.exports = wrapWithReanimatedMetroConfig(withSentryResolver(config, false));` — applied after the dedupe `resolveRequest` is installed so the Sentry resolver chains to it.
2. Run `node scripts/check-bundle-size.js --update` and commit the new baseline.

## Validation
- `bun run typecheck`, `bun run test:ci` pass (metro config is not used by jest, so this mainly guards accidental syntax errors).
- After `bun run build-web`: no `@sentry-internal/replay` or `replay-canvas` sources in any web chunk sourcemap; the Sentry chunk shrinks by roughly 137 KB raw.
- Native builds still bundle (replay was already stripped there by default; behavior unchanged). A dev `expo start` boot on web with a DSN set should initialize Sentry without console errors.

## Out of scope
- Removing `@sentry-internal/feedback` (~48 KB) — no supported metro flag; would require patching or a Sentry upgrade.
- Deferring `setupSentry()` timing (e.g. to idle) — separate concern from bundle content.
- Sentry source-map upload / debug-id serializer setup.

## Merge plan
`scripts/bundle-baseline.json` is also updated by `web-amplify-single-split-point` and `web-auth-screen-lazy-chunk`. If another of these merges first, sync with `dev` and re-run `node scripts/check-bundle-size.js --update` before merge.
