---
status: draft
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Split the Clerk provider into an async chunk

## Goal
Remove the Clerk cluster — `@clerk/clerk-react` 142 kB + `@clerk/clerk-expo` 33 kB + `swr` 37 kB + `expo-auth-session` 47 kB ≈ 259 kB uncompressed — from the web entry bundle. It should download only when the active auth provider is Clerk, as an async chunk.

## Context
Verified against the exported bundle's module graph (2026-08-11):

- `client/features/auth/provider/AuthProviderGate.tsx` is the only app-level importer of `@clerk/*` in entry. It deliberately uses `require("@clerk/clerk-expo")` (line ~31) "so the Clerk SDK only enters the module graph when Clerk is actually selected" — but Metro bundles static `require()` calls exactly like imports, so the intent doesn't hold. Only `import()` creates a split point.
- The codebase already uses the working pattern: `client/features/auth/provider/index.ts:78` (`await import("./clerkClient")`) and `clerkClient.ts:74` (`await import("@clerk/clerk-expo")`) produce the existing lazy `clerkClient-*.js` chunk.
- `AuthProviderGate` is mounted in `client/features/app/RootLayout.tsx:148`, wrapping the app. When `getAuthProvider() !== "clerk"` it renders children straight through.
- `getAuthProvider()` (provider/index.ts:32) reads build-time `EXPO_PUBLIC_*` env. Template default env has no Clerk key, so the default build takes the pass-through path.

## Work
1. Create `client/features/auth/provider/ClerkProviderBoundary.tsx`: statically imports `ClerkProvider` from `@clerk/clerk-expo` and `tokenCache` from `@clerk/clerk-expo/token-cache`, renders `<ClerkProvider publishableKey={…} tokenCache={…}>{children}</ClerkProvider>` (move the existing prop wiring from `AuthProviderGate`).
2. Rewrite `AuthProviderGate.tsx`:
   - `provider !== "clerk"` → return children unchanged (current behavior).
   - `provider === "clerk"` → render the boundary via `React.lazy(() => import("./ClerkProviderBoundary"))` inside `<Suspense fallback={null}>`.
   - Delete the `require()`-based `loadClerkModule` machinery and its comment.
3. Constraints:
   - Zero change for the default (no Clerk) build path.
   - When Clerk is enabled, children must not render outside `ClerkProvider` (auth hooks would throw) — the Suspense fallback gates them until the chunk loads. A `null` fallback matches the current exported-HTML gate behavior; do not add a spinner.
   - Keep the splash-screen flow in `RootLayout` intact (fallback must not hide or race the splash logic).
4. Rebaseline: `bun run build && node scripts/check-bundle-size.js --update`, commit `scripts/bundle-baseline.json`.

## Validation
- `bun run typecheck && bun run lint && bun run test:ci`.
- Default env build: `bun run build-web`, then confirm no `@clerk/`, `swr`, or `expo-auth-session` sources in the entry map:
  `grep -c "@clerk/clerk-react" dist/client/_expo/static/js/web/entry-*.js.map` → 0.
- Clerk-enabled build: `EXPO_PUBLIC_AUTH_PROVIDER`/key env set to select Clerk (see `client/lib/validateEnv.ts` / provider/index.ts for exact vars), export again: `@clerk/clerk-react` must appear only in an async chunk map, not entry. Export prerender must still succeed.
- `node scripts/check-bundle-size.js` passes with the new baseline.
- Note for the reviewer: full Clerk sign-in flows can't run on localhost web with prod keys (prod Clerk keys reject localhost); structural checks above plus existing jest coverage are the acceptance bar.

## Out of scope
- Cognito path (already lazy via `cognitoClient` chunk) and any auth behavior changes.
- Native bundle (Metro native bundles don't code-split; the `import()` is harmless there).
- Keyboard-controller and async-routes specs (separate).

## Merge plan
Three bundle-size specs each rewrite `scripts/bundle-baseline.json`. Whichever lands later must rebuild and regenerate the baseline after rebasing on dev.

## Open questions
- None.
