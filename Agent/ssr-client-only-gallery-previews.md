---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Client-only gallery previews (Expo Router SSR `useId` divergence)

## Goal
Stop the dev hydration error ("A tree hydrated but some attributes of the server rendered HTML didn't match") on every gallery route by rendering the lazy showcase boundaries only after hydration, and document the underlying framework issue so app routes that render Radix-backed components under SSR know what they will see.

## Context
- Reproduced on origin/dev `c4bccf1` (`/tmp/fleet/ui/expo-ui/w5-before/probes.md`): `/showcase` and `/components/Tabs` log one hydration error each; the diff is the Radix Tabs pair `id="radix-_R_…-trigger-day"` / `aria-controls` with a different `_R_` id on each side. Both ids are hydration-style, so the server's component tree above the boundary differs from the client's: the server renders the app inside `app/+html.tsx` (`<html>` → `<head>`/`<body>` fork → `#root`) while the client hydrates `#root` only, and React's `useId()` encodes the tree path. Every `useId` differs; the kit already defers its own (`useHydrated()`, #129), so what remains is third-party ids (Radix via `@rn-primitives/*`: Tabs, Accordion, Collapsible…) that are emitted on both sides. On `/` the home rail's boundary is client-rendered (`_r_` ids) and logs nothing.
- Effect at runtime: React keeps the server attributes, so the initial trigger/panel pair stays consistent; a panel mounted later on the client gets a client id and the trigger's `aria-controls` points at a stale id. Dev shows the error as a LogBox toast; production is silent.
- `client/showcase/lazyGallery.tsx` holds the one `import()` of the cluster; `LazyPreview`, `LazyBlockStage` and `GalleryRoute` render inside `Suspense`. Its header comment says streamed HTML already carries the previews; that is what changes. `client/showcase/__tests__/gallerySplitPoint.test.ts` guards the single split point and must keep passing.
- `docs/server-guide.md` → `### Server Rendering` lists the SSR constraints; the hydration guardrail test is `__tests__/ssrHydration.guardrail.test.ts`.

## Work
1. `lazyGallery.tsx`: add a `ClientOnly` wrapper using `useHydrated()` from `@mrmeg/expo-ui/hooks`: server render and the hydration pass return the `fallback`; the first client render after hydration mounts the lazy child inside `Suspense` (so the chunk request starts after hydration; navigations are unchanged). Apply it in `LazyPreview` and `LazyBlockStage` (they take the caller's `Suspense` fallback, so wrap the element they return) and `GalleryRoute`. Rewrite the header comment: previews are client-only because the server and client trees diverge and Radix ids would mismatch.
2. Confirm the Explore tab's spotlight fallback (`styles.spotlightStage` empty view) and the gallery routes' `GalleryLoading` are acceptable SSR placeholders; no layout shift beyond today's spinner.
3. `docs/server-guide.md`: new bullet or short subsection under `### Server Rendering`, "`useId` diverges between server and client": the cause above, the kit rule (`useHydrated` for any id emitted in DOM), that Radix-backed components inside a server-rendered route log the error in dev and lose `aria-controls` pairing for panels mounted later, the template's mitigation (client-only gallery), and the framework fix (hydrate the same root the server rendered, as React recommends for `<html>` roots). Add a ready-to-file issue draft for `expo/expo` (title, repro steps with the probe script, expected/actual) as a fenced block; filing is Matt's step.
4. Production first-render check (queue item g): `bun run build` then `bun run start` on port 3133 (`PORT=3133` if the server reads it; check `server.bun.ts`), load `/`, `/showcase`, `/settings` at 390×844 light and dark with the `color-scheme` cookie: HTML 200, no console errors, no hydration error. Record in `/tmp/fleet/ui/expo-ui/ssr-client-only/`.

## Validation
- RED first: `client/showcase/__tests__/lazyGallery.test.tsx` — with `useHydrated` mocked to `false`, `GalleryRoute`/`LazyPreview` render the fallback and do not call the gallery import (mock the specifier); with `true` they render the lazy content.
- `bun run test:ci -- --maxWorkers=2 client/showcase __tests__/ssrHydration`, `bun run typecheck`, `bun run lint`, `bun run docs:llms` then `bun run gen --check` (through heavy-slot).
- Dev probe: Metro 8133, `SCHEME=dark node /tmp/fleet/ui/expo-ui/radix-ids.mjs / /showcase /components/Tabs` → 0 hydration errors, server radix ids 0.
- Production check from Work 4.

## Out of scope
Changing `@rn-primitives`/Radix id generation; kit-level SSR placeholders for Tabs/Accordion; the Expo Router client entry.

## Open questions
None.
