---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/45
---

# Blocks tier: registry, codegen, and first six blocks

## Goal
Introduce "blocks" — composed sections that sit between components and full screen templates (pitsi/ui's Blocks concept). A block is open code in `client/blocks/<id>/` with a meta file, collected into a generated registry exactly like templates. Ships the infrastructure plus six launch blocks extracted from patterns already living inside the templates. Design reference: `mockups/03-blocks.html` (committed with this spec).

## Context
Verified 2026-08-07:

- No blocks concept exists anywhere (`grep -ri "block" client/ packages/` hits only comments; `client/templates/hero/Screen.tsx` mentions "pitsi-ui block-anatomy style").
- The pattern to mirror is the template registry: folders `client/templates/<id>/` containing `Screen.tsx` + `meta.ts` (+ `demo.tsx`, `README.md`), typed by `client/templates/types.ts` (`ScreenTemplateEntry`), collected by `scripts/generate-template-registry.ts` into `client/templates/registry.generated.ts`, re-exported from `client/showcase/registry.ts:52`. Scripts: `gen:templates` / `gen:templates:check` (`package.json:18-19`); the `--check` mode is the CI drift guard.
- `client/showcase/registry.ts` already defines `ComponentCategory` (lines 38-44) and `COMPONENTS` (33 UI components); blocks compose these.
- Source patterns for extraction already exist in templates: hero (`client/templates/hero/Screen.tsx`), stat grid (`client/templates/stats/`, `dashboard/`), FAQ accordion (`client/templates/faq/`), auth forms (`app/(main)/(demos)/auth-demo.tsx` and the showcase auth forms), testimonials (`client/templates/testimonials/`).
- SSR constraint: themed styles must be registered at module scope via `createThemedStyles` (not render-time `createStyles`) or the SSR head snapshot misses them — see `docs/ssr-hydration.md`.

## Work
1. `client/blocks/types.ts`: `BlockEntry` — `id`, `label`, `description`, `category` (`"marketing" | "data" | "social-proof" | "auth" | "content"`), `recipe: string[]` (component ids from the showcase registry, e.g. `["StatCard", "SectionHeader"]`), `icon` (Feather `IconName`), `order`. The recipe is data, rendered by the gallery as the "built from" strip.
2. `scripts/generate-block-registry.ts`: mirror `generate-template-registry.ts` (scan `client/blocks/*/meta.ts`, emit `client/blocks/registry.generated.ts` exporting `BLOCKS`, sorted by order then id, `--check` mode). Either copy-adapt or extract the shared scan/render logic — implementer's choice; keep both `--check` guards wherever `gen:templates:check` already runs: `.github/workflows/ci.yml:45-46`, `lefthook.yml:29-30` (pre-commit), `scripts/verify.mjs:36`.
3. `package.json`: add `gen:blocks` and `gen:blocks:check` scripts.
4. `client/showcase/registry.ts`: re-export `BLOCKS` and `BlockEntry`/`BlockCategory` alongside `SCREEN_TEMPLATES`; add `getBlockCount()`.
5. Six launch blocks, each `client/blocks/<id>/` with `Block.tsx` + `meta.ts` (props kept minimal — content via props with sensible defaults, themed via `useTheme`/`createThemedStyles`):
   - `hero` (marketing) — eyebrow / headline / copy / paired buttons, extracted from the hero template's centered variant.
   - `feature-grid` (marketing) — icon + title + copy cards, 1-col native, 2–3-col wide.
   - `stat-row` (data) — StatCard row, shared shape with dashboard/stats templates.
   - `cta-banner` (marketing) — Card + copy + Button.
   - `faq-section` (content) — SectionHeader + Accordion, extracted from the faq template.
   - `sign-in-form` (auth) — Card + Label/TextInput + Button + Separator + social buttons.
6. Templates are NOT refactored to consume blocks in this spec (see Out of scope) — blocks duplicate the pattern for now to keep the diff reviewable.
7. Tests: registry generator unit tests (mirror whatever exists for the template generator; if none, add scan/render tests for both), a render smoke test per block (renders without error in light + dark).

## Validation
- `bun run gen:blocks && bun run gen:blocks:check && bun run gen:templates:check`
- `bun run typecheck && bun run lint && bun run test:ci`
- Manual: temporary route or existing demo screen rendering all six blocks, checked on web + one native platform; light and dark.

## Out of scope
- Refactoring templates to import blocks (follow-up once the gallery proves the shapes).
- The blocks gallery UI (`showcase-three-scale-galleries.md`).
- New components (Avatar/Carousel have their own specs); blocks in this wave only use components that exist today.

## Open questions
- None blocking. Category set may grow; keep the union type in one place.
