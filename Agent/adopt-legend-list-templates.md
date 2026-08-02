---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/30
---

# Adopt Legend List for list-based screen templates

## Goal

Replace RN `FlatList`/`SectionList` with `@legendapp/list` in the five list-based screen templates so every project scaffolded from a template starts with a high-performance virtualized list on native **and** web. Legend List was chosen over FlashList deliberately: it is JS-only (no native module), so it works through react-native-web with full parity — web support is a hard requirement.

## Context

Verified current usage (all in `client/templates/`):

- `chat/Screen.tsx:375` — **inverted** `FlatList`, data sorted newest-first (`sortedMessages`, line 293); `renderItem` reads the chronologically-previous message at `index + 1` for timestamp/day-separator logic; `ListHeaderComponent` renders the typing indicator (appears at the visual bottom because of inversion); `keyboardShouldPersistTaps="handled"`.
- `search/Screen.tsx:298` — `FlatList` with `ListHeaderComponent` passed as a component (not element) for lazy header construction; empty state via `contentContainerStyle` switch (`emptyFlatList`, line 551). Not a plain list: it also sets `numColumns`, `columnWrapperStyle={styles.gridRow}`, and `key={viewMode}` to force remount on list/grid toggle.
- `list/Screen.tsx:175` — plain `FlatList`, same lazy-header + empty-state pattern.
- `card-grid/Screen.tsx:287` — `FlatList` with `numColumns={columns}` and a memoized `columnWrapperStyle` (line 208) for the grid gap.
- `notifications/Screen.tsx:304` — `SectionList` with date-grouped sections, `stickySectionHeadersEnabled={false}`, `refreshControl`, `ListHeaderComponent`/`ListEmptyComponent`.

Constraints and facts:

- `@legendapp/list` is not yet a dependency. Current published version is **3.3.3** (there is no 2.x line to install). It is pure JS over RN primitives (only runtime dep: `use-sync-external-store`) — no prebuild, no pod install, no Metro dedupe entry needed.
- **Import path: `@legendapp/list/react-native`.** The package has no root `"."` export — subpaths only (`./react-native`, `./section-list`, `./animated`, `./reanimated`, `./keyboard`, `./keyboard-legacy`, `./react`). `./react-native` carries a `browser` condition mapping to the `react-native.web.*` build, so web parity is built in.
- `inverted` does not exist in v3. Chat must move to chronological data (oldest-first) with `alignItemsAtEnd` + `maintainScrollAtEnd` (+ `maintainScrollAtEndThreshold`) — all three props exist on the v3 `LegendList` types. This inverts the chat template's data flow: drop the newest-first sort, previous message becomes `index - 1`, and the typing indicator moves to `ListFooterComponent`.
- `numColumns` and `columnWrapperStyle` are both supported, but v3's `ColumnWrapperStyle` accepts **only `{ rowGap?, gap?, columnGap? }`** — no padding/margin/alignment. If a screen's existing `columnWrapperStyle` sets anything else, move that part into the per-item wrapper; the `flex: 1 / columns` skeleton wrapper at `card-grid/Screen.tsx:253` shows the existing pattern.
- v3 ships a real `SectionList` at `@legendapp/list/section-list` (with `buildSectionListData` and `stickyHeaderIndices`), so `notifications` can migrate directly instead of hand-flattening sections.
- Prefer stable `keyExtractor` ids (already present) and set `recycleItems` only if item-local state is safe to recycle; the templates hold no per-row state, so enabling it is fine.
- Tests: `client/templates/__tests__/screens.test.tsx` renders template screens under jest-expo, but of the five lists **only `list` is covered** — `chat`, `search`, `card-grid`, and `notifications` have no test; don't expect the suite to catch regressions there (rely on the manual pass). `@legendapp/list` ships pre-compiled CJS + ESM, so **no `transformIgnorePatterns` change is needed** in `jest.config.js`.
- Web/SSR: templates render through the showcase routes with SSR (`web.output: "server"`). Per `AGENTS.md`, verify with real server HTML, not only Jest/tsc — read `docs/ssr-hydration.md` first. Legend List must render initial rows in server output (no blank list before hydration). Note: server HTML for every `(main)` route is the onboarding gate until the `has-seen-onboarding` state resolves, so curling a showcase route shows the gate, not list rows — use the temporary gate short-circuit documented in `docs/ssr-hydration.md` (~line 264, "the onboarding gate masks `(main)` routes on the server") to inspect real route HTML, and revert it before commit.
- CI runs `bundle-size` (fails on >10% web bundle growth) and `docs:llms:check`. Template screens are walked by `scripts/build-llms-full.mjs`, so regenerate after editing.

## Work

1. `bun add @legendapp/list` (root `dependencies`, caret range on 3.3.3).
2. Migrate the four `FlatList` screens (`chat`, `search`, `list`, `card-grid`) to `LegendList` from `@legendapp/list/react-native`, preserving each screen's public props and visual behavior:
   - Keep the lazy `ListHeaderComponent`-as-component and empty-state `contentContainerStyle` patterns.
   - Chat: chronological data + `alignItemsAtEnd`/`maintainScrollAtEnd`; typing indicator as footer; day separators and timestamps must still appear above the first message of a group.
   - Search and card-grid: keep `numColumns` and `columnWrapperStyle`, trimming the style objects to the gap-only keys v3 accepts and relocating anything else per-item. Keep search's `key={viewMode}` remount.
3. Migrate `notifications/Screen.tsx` to `SectionList` from `@legendapp/list/section-list`, keeping the existing section shape, `refreshControl`, mark-all-read header, empty state, and the staggered `AnimatedView` entrance. Sticky headers stay off.
4. Provide `estimatedItemSize` per list using realistic row heights (v3 prop; `estimatedListSize` is optional).
5. Fix any test fallout in `client/templates/__tests__/screens.test.tsx` without weakening assertions. No `jest.config.js` change is expected.
6. Run `bun run docs:llms` and commit regenerated `llms-full.txt`/`llms-examples.txt` if they change.

Do not touch `client/features/onboarding/OnboardingFlow.tsx` — its horizontal paging FlatList stays.

## Validation

- `bun run typecheck && bun run lint`
- `bun run test:ci` (template screen suite must pass)
- `bun run gen:templates:check` and `bun run docs:llms:check`
- `bun run build && bun run bundle-size` (the guard reads `dist/client`, so the build must run first; web export must stay within the 10% threshold)
- Manual, per `AGENTS.md`: with the onboarding gate temporarily short-circuited, confirm the showcase routes for all five templates return list rows in the raw server HTML; on iOS simulator and web, scroll each template (including chat with keyboard open and card-grid at both column counts) — no blank cells, no jumpy scroll, chat pinned to newest message.

## Out of scope

- `OnboardingFlow.tsx` horizontal pager.
- Adding Legend List to `packages/ui` (`EmptyState` only mentions FlatList in a doc comment).
- React Compiler, asyncRoutes, or other perf items from the broader audit.
- Removing `FlatList` usage anywhere outside `client/templates/`.

## Open questions

- None. Prop names above were checked against `@legendapp/list@3.3.3` types.
