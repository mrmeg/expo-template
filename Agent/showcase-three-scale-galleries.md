---
status: done
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/48
---

# Showcase redesign: three-scale Explore + component/blocks/templates galleries

## Goal
Replace the flat Explore grid with the "one system, three scales" layout (components → blocks → templates) and give each tier a real gallery screen with category filtering. Design source (approved): `mockups/01-home.html` (Explore/overview), `02-components.html`, `03-blocks.html`, `04-templates.html`, `05-mobile.html` (native/mobile-web adaptations). Mockups already use the repo's exact tokens (zinc palette, teal accent, Inter, radiusMd 12, dark `#09090B`).

## Context
Verified 2026-08-07:

- Explore tab UI lives in `app/(main)/(tabs)/index.tsx`, driven by `client/showcase/registry.ts`: `SCREEN_TEMPLATES` (generated), `DEMOS` (lines 58-65), `COMPONENTS` (77-111) with `ComponentCategory`, `getComponentCount()`.
- The component showcase is a single kitchen-sink screen `app/(main)/(demos)/showcase/index.tsx` with `Section`/`SubSection` helpers from `client/showcase/`.
- Template routes are one file each at `app/(main)/(demos)/screen-<id>.tsx` — except `detail-hero.tsx`. Always navigate via each entry's `route` field from `meta.ts` (label/description/icon/order/route), never a constructed `screen-<id>` path.
- `SegmentedControl` is exported from `packages/ui/src/components/index.ts` but missing from `COMPONENTS` — nothing in the package should be invisible to the showcase.
- Blocks registry (`BLOCKS`, categories, `recipe: string[]`) lands via `blocks-tier-foundation.md` — this spec consumes it.
- SSR constraint: new screens must register themed styles at module scope via `createThemedStyles` (`docs/ssr-hydration.md`).

## Work
1. **Explore tab** (`app/(main)/(tabs)/index.tsx`): restructure into the three-scale layout from `mockups/01-home.html` §sections / `05-mobile.html` frame 1 — search field (client-side filter over all three registries), horizontally scrolling component preview rail, blocks section with one spotlight block + count, templates grid, existing `DEMOS` section retained below.
2. **Components gallery** (new route, e.g. `app/(main)/(demos)/components/index.tsx`): category-filtered card grid per `mockups/02-components.html` / `05-mobile.html` frame 2. Cards render a small live instance of each component (a `preview` render function added per entry — extend `ComponentEntry` in `client/showcase/registry.ts` or a sibling `previews.tsx` map; keep the registry data-only). Category chips on mobile; counts from the registry.
3. **Component detail** (`components/[id].tsx` or BottomSheet per `05-mobile.html` frame 3): variants demo + copyable import/usage snippet per component. Seed detail content for the highest-traffic ~10 components (Button, TextInput, Switch, Select, Dialog, BottomSheet, Tabs, Badge, Card, StatCard); remaining components fall back to the live preview + import path.
4. **Blocks gallery** (`blocks/index.tsx`): stacked full-width previews per `mockups/03-blocks.html` — each block rendered live on a stage, category chips, recipe strip listing component ids (tappable → component detail).
5. **Templates gallery**: upgrade the Explore templates section or a dedicated screen per `mockups/04-templates.html` — cards navigate to the existing `screen-<id>` routes; category metadata added to `ScreenTemplateEntry` (new optional `category` field + regenerate; keep codegen backward-compatible).
6. Register `SegmentedControl` in `COMPONENTS` (category `form` or `navigation` — pick one and note it).
7. The old kitchen-sink `showcase/index.tsx` remains reachable (link from components gallery header) until parity is proven; do not delete it in this spec.
8. Tests: registry filter/search helpers (pure functions), gallery render smoke tests, template category codegen round-trip.

## Validation
- `bun run gen:templates:check && bun run gen:blocks:check`
- `bun run typecheck && bun run lint && bun run test:ci`
- Manual against the mockups side-by-side: Explore, components gallery + one detail, blocks gallery, templates gallery — web and one native platform, light + dark. SSR view-source of the new web routes contains real content (no blank shells).

## Out of scope
- Web navigation shell / Drawer rail (`web-drawer-navigation-shell.md`).
- ⌘K command palette (future spec; the Explore search field is plain filtering).
- New components or blocks beyond what the registries already hold.

## Open questions
- Component previews: per-entry render function vs a `previews.tsx` lookup keyed by id — implementer's choice; the constraint is `registry.ts` stays serializable data.
