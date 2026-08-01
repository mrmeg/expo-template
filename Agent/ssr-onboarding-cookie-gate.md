---
status: draft
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Resolve the onboarding gate server-side via cookie

## Goal

Let the SSR server know whether the visitor has completed onboarding, so returning users get HTML without the onboarding gate instead of a server-rendered gate hidden by a blocking inline script before paint. Removes one shield script and the wasted gate render/DOM for every returning web visitor.

## Context

- `client/features/onboarding/onboardingStore.ts` persists `has-seen-onboarding` to AsyncStorage on native and `localStorage` on web; native eagerly hydrates at store creation, web resolves post-hydration.
- `app/+html.tsx:126-133`: because the server can't read localStorage, SSR always emits the gate; a blocking script adds the `onboarding-seen` class when the localStorage flag is truthy, and CSS at lines 112-117 hides `[data-testid="onboarding-gate"]` under `html.onboarding-seen`. Runtime hydration then swaps in real state (a runtime onboarding reset still shows the gate).
- `app.config.ts` already enables `unstable_useServerMiddleware` and `unstable_useServerDataLoaders`; custom servers are `server.bun.ts` and `server/index.ts` (both must pass cookies through — verify neither strips headers).
- **Read `docs/ssr-hydration.md` before editing** (AGENTS.md requirement for SSR work) and verify with real server HTML, not only Jest/tsc. Related repo constraint: the `+html.tsx` snapshot filter and `SsrStyleFlush` must not be disturbed.
- The gate itself is rendered by the root layout's OnboardingGate (`client/features/app/RootLayout.tsx`); tests exist under `client/features/onboarding/__tests__/`.

## Work

1. On web, dual-write the flag: when `setSeen` runs in `onboardingStore.ts`, also set a `has-seen-onboarding=1` cookie (path=/, SameSite=Lax, max-age ~1 year, no domain). localStorage remains the client source of truth; the cookie exists only for SSR. Clearing onboarding state must also clear the cookie.
2. Read the cookie server-side — prefer an Expo Router data loader or middleware (both flags already on) that exposes `hasSeenOnboarding` to the root layout during SSR; the store's initial web state uses that value when rendering on the server, and still reconciles from localStorage after hydration (localStorage wins on mismatch to avoid a stale cookie trapping a user).
3. Keep hydration consistent: the client's first render must match server HTML for the cookie-derived state, then reconcile — follow the pattern `docs/ssr-hydration.md` prescribes. No hydration mismatch warnings in the browser console.
4. Remove the onboarding blocking script and the `onboarding-seen` CSS from `app/+html.tsx` once server HTML is correct for both cookie states. Leave the theme shield script untouched.
5. Update `client/features/onboarding/__tests__/` for the cookie behavior and add a server-side test if the repo's test setup can exercise the loader/middleware; otherwise cover via the manual validation below.

## Validation

- `bun run typecheck && bun run lint && bun run test:ci`
- Real server HTML (per AGENTS.md): `bun run build && bun run start`, then
  - `curl -s localhost:<port>/ | grep onboarding-gate` → present with no cookie;
  - `curl -s -H 'Cookie: has-seen-onboarding=1' localhost:<port>/ | grep onboarding-gate` → absent.
- Browser: fresh profile shows onboarding, completing it sets the cookie, reload serves gate-free HTML with no flash and no hydration warnings; clearing site data shows the gate again.
- Native (iOS simulator): onboarding flow unchanged — store behavior on native must be untouched.

## Out of scope

- Moving the theme preference to a cookie (same pattern, separate decision — note as follow-up).
- Any change to native persistence or the onboarding UI itself.

## Open questions

- None.
