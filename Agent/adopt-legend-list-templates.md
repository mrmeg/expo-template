---
status: draft
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Adopt Legend List for list-based screen templates

## Goal

Replace `FlatList`/`SectionList` with `@legendapp/list` (`LegendList`) in the five list-based screen templates so every project scaffolded from a template starts with a high-performance virtualized list on native **and** web. Legend List was chosen over FlashList deliberately: it is JS-only (no native module), so it works through react-native-web with full parity — web support is a hard requirement.

## Context

Verified current usage (all in `client/templates/`):

- `chat/Screen.tsx:375` — **inverted** `FlatList`, data sorted newest-first (`sortedMessages`, line 293); `renderItem` reads the chronologically-previous message at `index + 1` for timestamp/day-separator logic; `ListHeaderComponent` renders the typing indicator (appears at the visual bottom because of inversion); `keyboardShouldPersistTaps="handled"`.
- `search/Screen.tsx:298` — plain `FlatList` with `ListHeaderComponent` passed as a component (not element) for lazy header construction; empty state via `contentContainerStyle` switch (`emptyFlatList`, line 551).
- `list/Screen.tsx:175` — plain `FlatList`, same lazy-header + empty-state pattern.
- `card-grid/Screen.tsx:287` — `FlatList` with `numColumns={columns}` and a memoized `columnWrapperStyle` (line 208) for the grid gap.
- `notifications/Screen.tsx:304` — `SectionList` with date-grouped sections, `stickySectionHeadersEnabled={false}`, `refreshControl`, `ListHeaderComponent`/`ListEmptyComponent`.

Constraints and facts:

- `@legendapp/list` is not yet a dependency. Install the current stable 2.x. It is pure JS over RN primitives — no prebuild, no pod install, no Metro dedupe entry needed.
- Legend List discourages `inverted`; the chat pattern is chronological data (oldest-first) with `alignItemsAtEnd` + `maintainScrollAtEnd` (+ `maintainScrollAtEndThreshold`). This inverts the chat template's data flow: drop the newest-first sort, previous message becomes `index - 1`, and the typing indicator moves to `ListFooterComponent`. Verify exact prop names against the installed version's types.
- `numColumns` is supported in v2; `columnWrapperStyle` may not be. If not, move the grid gap into the per-item wrapper — the `flex: 1 / columns` skeleton wrapper at `card-grid/Screen.tsx:253` shows the existing pattern.
- There is no `SectionList` equivalent. Flatten sections into one array of `{ type: "header" } | { type: "item" }` rows and branch in `renderItem`. Sticky headers are already disabled, so nothing is lost.
- Prefer stable `keyExtractor` ids (already present) and set `recycleItems` only if item-local state is safe to recycle; the templates hold no per-row state, so enabling it is fine.
- Tests: `client/templates/__tests__/screens.test.tsx` renders these screens under jest-expo. `@legendapp/list` ships untranspiled ESM/JSX — extend `transformIgnorePatterns` in `jest.config.js` if the suite fails to parse it.
- Web/SSR: templates render through the showcase routes with SSR (`web.output: "server"`). Per `AGENTS.md`, verify with real server HTML, not only Jest/tsc — read `docs/ssr-hydration.md` first. Legend List must render initial rows in server output (no blank list before hydration).
- CI runs `bundle-size` (fails on >10% web bundle growth) and `docs:llms:check`. Template screens are walked by `scripts/build-llms-full.mjs`, so regenerate after editing.

## Work

1. `bun add @legendapp/list` (root `dependencies`, caret range on current 2.x).
2. Migrate the four `FlatList` screens (`chat`, `search`, `list`, `card-grid`) to `LegendList`, preserving each screen's public props and visual behavior:
   - Keep the lazy `ListHeaderComponent`-as-component and empty-state `contentContainerStyle` patterns.
   - Chat: chronological data + `alignItemsAtEnd`/`maintainScrollAtEnd`; typing indicator as footer; day separators and timestamps must still appear above the first message of a group.
   - Card-grid: keep `numColumns`; replace `columnWrapperStyle` with per-item gap styling if unsupported.
3. Migrate `notifications/Screen.tsx` from `SectionList` to a flattened `LegendList` with header rows; keep `refreshControl`, mark-all-read header, empty state, and the staggered `AnimatedView` entrance.
4. Provide `estimatedItemSize` (or the installed version's sizing prop) per list using realistic row heights.
5. Update `jest.config.js` `transformIgnorePatterns` if required; fix any test fallout in `client/templates/__tests__/screens.test.tsx` without weakening assertions.
6. Run `bun run docs:llms` and commit regenerated `llms-full.txt`/`llms-examples.txt` if they change.

Do not touch `client/features/onboarding/OnboardingFlow.tsx` — its horizontal paging FlatList stays.

## Validation

- `bun run typecheck && bun run lint`
- `bun run test:ci` (template screen suite must pass)
- `bun run gen:templates:check` and `bun run docs:llms:check`
- `bun run bundle-size` (web export must stay within the 10% guard)
- Manual, per `AGENTS.md`: start the SSR server and confirm the showcase routes for all five templates return list rows in the raw server HTML; on iOS simulator and web, scroll each template (including chat with keyboard open and card-grid at both column counts) — no blank cells, no jumpy scroll, chat pinned to newest message.

## Out of scope

- `OnboardingFlow.tsx` horizontal pager.
- Adding Legend List to `packages/ui` (`EmptyState` only references FlatList in a doc comment).
- React Compiler, asyncRoutes, or other perf items from the broader audit.
- Removing `FlatList` usage anywhere outside `client/templates/`.

## Open questions

- None. Prop-name details (`alignItemsAtEnd`, sizing props, `columnWrapperStyle` support) are verify-at-implementation against the installed version, with fallbacks stated in Work.
