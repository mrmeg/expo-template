---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/137
---

# Remaining screen templates own their safe-area edges through `Screen`

## Goal
The seven screen templates that still render a plain `View` root — `card-grid`, `faq`, `notifications`, `pricing`, `search`, `stats`, `testimonials` — take the same `edges` contract #130 gave `settings`, `list`, `dashboard` and `profile`: a `Screen` root (`padded={false}`, they keep their own 16 pt inset), `edges` defaulting to `["bottom"]` (they sit under a Stack header), and the bottom inset on the scrolling surface's content so the last row scrolls out from under the home indicator instead of being hidden by it.

## Context
- Converted pattern: `client/templates/list/Screen.tsx` lines ~47–48 (`edges?: ScreenEdges`, default `["bottom"]`) and ~134–167 (FlatList owns the scroll: `useWindowInsets().bottom` goes on the list's `contentContainerStyle`, `Screen` gets `edges.filter(e => e !== "bottom")`… the loading/empty branches render `Screen edges={edges}` directly). `settings/Screen.tsx` uses `<Screen edges scroll padded={false}>` for a ScrollView body.
- Unconverted roots (all `<View style={[styles.container, styleOverride]}>`): `card-grid/Screen.tsx` 253 + 292 (FlatList, `contentContainerStyle` 301), `faq/Screen.tsx` 73 (ScrollView 74, `styles.scrollContent` paddingBottom `spacing.xxl`), `notifications/Screen.tsx` 186 + 304 (SectionList 305), `pricing/Screen.tsx` 97 (ScrollView 98), `search/Screen.tsx` 227 + 297 (FlatList 298; a horizontal filters ScrollView at 370 is not the scroll surface), `stats/Screen.tsx` 126 (ScrollView 127), `testimonials/Screen.tsx` 77 (read the body; horizontal carousel or vertical scroll).
- None of them reads insets today (`grep useWindowInsets client/templates/{card-grid,faq,…}` is empty), so on an iPhone the last card/row/plan ends under the home indicator once scrolled to the end.
- Tests: `client/templates/__tests__/screens.test.tsx` → `SettingsScreen` block (~line 296) shows the assertion style: render inside `SafeAreaInsetsContext.Provider value={ISLAND_INSETS}`, flatten `contentContainerStyle` of the screen's `testID`, expect `paddingBottom >= 34` and `paddingTop < 59`; with `edges={["top","bottom"]}` expect `paddingTop >= 59`.
- Safe-area rules: insets only from `react-native-safe-area-context` (through `useWindowInsets`/`Screen`), explicit edges, never literal numbers, no double inset under a native header. Flat layout: one 16 pt inset; a container pads or its children do, never both — keep each template's existing horizontal padding and pass `padded={false}`.

## Work
1. For each of the seven templates: add `edges?: ScreenEdges` (default `["bottom"]`, documented like `list`), replace the root `View` (every branch: loading, empty, populated) with `<Screen edges={…} padded={false} style={styleOverride} testID="<slug>-screen">`, keep `styles.container` only for what `Screen` does not provide. ScrollView bodies (`faq`, `pricing`, `stats`, `testimonials` if vertical): `Screen scroll` with `contentContainerStyle={styles.scrollContent}` (Screen adds the insets to it) and move any `ScrollView` props into `scrollProps`. List bodies (`card-grid`, `search`, `notifications`): `Screen edges={edges.filter(e => e !== "bottom")}` around the list and `paddingBottom: <existing> + (edges.includes("bottom") ? insets.bottom : 0)` on the list's `contentContainerStyle`, insets from `useWindowInsets()`.
2. If a template exposes a `testID` prop already, keep it and default it to `<slug>-screen`.
3. Docs: `docs/template-modernization-guide.md` — if it lists the `edges` prop for the converted templates, extend the list to all eleven; otherwise one sentence in the templates section. `bun run docs:llms`.

## Validation
- RED first in `screens.test.tsx`: a table over the seven screens (minimal props each) asserting the `<slug>-screen` node's `contentContainerStyle` has `paddingBottom >= 34` and `paddingTop < 59` under `ISLAND_INSETS`, and `paddingTop >= 59` with `edges={["top","bottom"]}`. Existing template tests must keep passing (roots may change from `View` to `Screen`; update queries that relied on `styles.container`).
- `bunx jest --maxWorkers=2 client/templates`, `bun run typecheck`, `bun run lint`, `bun lint:ui --changed`, `bun run gen --check` (through heavy-slot).
- Web after-pass (Metro 8133, 390×844): `/screen-faq`, `/screen-pricing`, `/screen-search`, `/screen-notifications`, `/screen-stats`, `/screen-testimonials`, `/screen-card-grid` light — unchanged layout on web (insets are 0 there); screenshots into `/tmp/fleet/ui/expo-ui/templates-screen/`.
- Device if a simulator is free: `/screen-faq` scrolled to the end shows its last row above the home indicator.

## Out of scope
Header/top handling changes for screens under a Stack header; the kit `Screen` itself; the web drawer shell.

## Open questions
None.
