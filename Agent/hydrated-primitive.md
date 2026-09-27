---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/139
---

# `Hydrated`: the kit's gate for client-only markup under SSR

## Goal
Consumers on Expo Router SSR hit the `useId` divergence documented in `docs/server-guide.md` whenever a Radix-backed component (Tabs, Accordion, Collapsible, Select, DropdownMenu, Popover) renders on a server route. The kit exports the gate the template already uses: `<Hydrated fallback>` renders `fallback` on the server and through the hydration pass, then its children — so an app can keep SSR for the page and defer only the Radix subtree. Additive; nothing changes by default.

## Context
- `packages/ui/src/hooks/useHydrated.ts` exists (#129); no component wraps it. `client/showcase/lazyGallery.tsx` defines a local `ClientOnly` (#136) doing exactly this plus `Suspense`.
- `/screen-faq` (FaqScreen → Accordion) logs the mismatch in dev today; it stays a documented dev-only log (a FAQ page needs its questions in the server HTML, so the template does not gate its Accordion).
- Barrel: `packages/ui/src/components/index.ts` (`export * from "./X"`, alphabetical; `Hydrated` goes after `ErrorBoundary`). Docs: CHANGELOG `## [Unreleased]` → `### Added`; `packages/ui/LLM_USAGE.md` SSR bullets (~line 191); `packages/ui/README.md` near the `InitialSchemeProvider` paragraph (~line 109); `docs/server-guide.md` "useId diverges" paragraph names the kit gate.

## Work
1. `packages/ui/src/components/Hydrated.tsx`: `Hydrated({ fallback = null, children })` → `useHydrated() ? children : fallback` (fragments). JSDoc: when to use (a Radix-backed component inside a server-rendered route; any DOM id you write yourself), when not to (native, or content that must be in the server HTML). Export from the barrel.
2. `client/showcase/lazyGallery.tsx`: `ClientOnly` becomes `Hydrated` + `Suspense` (keep the `ClientOnly` export and its test).
3. Docs: CHANGELOG `### Added` entry; LLM_USAGE bullet ("Radix-backed component on an SSR route → wrap it in `Hydrated`; never `typeof window` branches"); README paragraph; `docs/server-guide.md` names `Hydrated` as the gate; `bun run docs:llms`.

## Validation
- RED first: `packages/ui/src/components/__tests__/Hydrated.test.tsx` — with `useHydrated` mocked false: fallback rendered, children not mounted; true: children rendered, fallback absent; default fallback renders nothing.
- `bun run pkg ui test -- --maxWorkers=2 Hydrated`, `bun run pkg ui typecheck`, `bun run typecheck`, `bun run lint`, `bunx jest client/showcase`, `bun run gen --check` (through heavy-slot). CI.

## Out of scope
Gating any kit component internally; changing FaqScreen's SSR output.

## Open questions
None.
