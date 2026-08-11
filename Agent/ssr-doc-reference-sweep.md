---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Sweep stale `docs/ssr-hydration.md` references after SSR removal

## Goal

PR #56 deleted `docs/ssr-hydration.md` but ~14 files still cite it (§3/§4/§7) and describe the constraints in request-time SSR terms. Reword the citations and phrasing so they describe the current reality — a build-time prerendered shell hydrated by the client — and point at `docs/server-guide.md` ("Enable Server Output" section). The underlying rules remain true and must not be weakened.

## Context

- Web is client-rendered under `web.output: "server"`; `expo export` still prerenders each route once in Node, and the client hydrates that shell. So "the prerendered HTML and the first client render must agree" and "module-scope style registration" both still hold — only the "per-request SSR" framing is wrong.
- The three rules being cited:
  - old §7: `createThemedStyles` at module scope so styles exist in the export-time stylesheet snapshot (render-time creation paints unstyled in the shell).
  - old §4: `useDimensions()` (seeded) instead of raw `useWindowDimensions()` so the prerendered layout and the first client render agree.
  - old §3: i18next must initialize synchronously so prerendered strings match the first client render.
- Files (verified via grep, 2026-08-11): `client/blocks/{cta-banner,faq-section,feature-grid,hero,sign-in-form,stat-row}/Block.tsx`, `client/blocks/__tests__/blocks.test.tsx` (2 refs), `client/blocks/README.md`, `client/blocks/{cta-banner,feature-grid}/README.md`, `client/features/i18n/index.ts`, `packages/ui/src/components/Avatar.tsx:428`, `packages/ui/src/lib/themedStyles.ts:15`.
- `packages/ui/dist/lib/themedStyles.d.ts` is generated — fix the src file only.
- `Carousel.tsx`, `clientNavigation.ts`, and `useProgressivePreviewCount.ts` were already reworded during the #56 merge; leave them.

## Work

In each listed file, rewrite the comment/doc sentence(s) so they:

1. State the constraint in prerender terms (e.g. "styles created during render miss the exported HTML's stylesheet snapshot and the shell paints unstyled" instead of "miss the SSR head snapshot").
2. Replace `docs/ssr-hydration.md §N` citations with `docs/server-guide.md` ("Enable Server Output") or drop the citation where the sentence is self-contained.
3. Keep the rule's force — do not soften "must" language or delete the guidance.

No behavior changes; comments, docstrings, and READMEs only (plus the one test-file comment — test assertions untouched). Run `bun run docs:llms` afterward; block READMEs feed `llms-examples.txt`.

## Validation

- `git grep -l "ssr-hydration"` returns nothing outside `Agent/` history specs and `packages/ui/dist/` (regenerates on next build).
- `bun run typecheck && bun run lint`
- `bunx jest client/blocks --silent` passes
- `bun run docs:llms:check`, `gen:blocks:check` pass

## Out of scope

- Any runtime/behavior change; `createThemedStyles` mechanics; historical `Agent/ssr-*.md` specs; regenerating `packages/ui/dist`.
