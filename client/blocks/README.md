# Blocks

The middle tier of the template's three scales:

| Scale | Lives in | Is a |
|-------|----------|------|
| Component | `packages/ui/src/components/` | primitive (`Button`, `Card`, `Accordion`) |
| **Block** | **`client/blocks/<id>/`** | **composed section of a screen** |
| Screen template | `client/templates/<id>/` | full screen with routing + state |

A block is one section — a hero, a stat row, an FAQ. It sizes to its content
and renders no chrome: **no `flex: 1` root, no `ScrollView`, no safe-area
insets**. The host screen owns scrolling and edge insets, so blocks stack
cleanly in any order.

Blocks are open code. Copy the folder into your project and edit it; the only
imports are `react`, `react-native`, and `@mrmeg/expo-ui` (which publishes to
npm), so a copied block has no dependency on this repo.

## Adding a block

1. `mkdir client/blocks/<id>` — kebab-case, matching the `meta.id`.
2. `Block.tsx` — a props-driven component named `<Name>Block`, with a default
   for **every** prop so `<XBlock />` previews without configuration.
3. `meta.ts` — `export const meta: BlockEntry = { ... }` (see `types.ts`).
   `recipe` lists the `COMPONENTS` ids the block composes; the gallery renders
   it as the "built from" strip.
4. `README.md` — what it is, the files, a usage snippet.
5. `bun run gen:blocks` and commit `registry.generated.ts`.

`registry.generated.ts` is codegen — never hand-edit it. `gen:blocks:check`
runs in CI, in `bun run verify`, and on pre-commit, so a new folder without a
regenerate fails before review.

## Rules that aren't optional

- **Themed styles at module scope.** End the file with
  `const themedStyles = createThemedStyles(createStyles);` and call
  `themedStyles(theme)` in the component. Creating styles during render
  (`useMemo(() => createStyles(theme), [theme])`) misses the SSR head snapshot
  and paints unstyled on the first request after a server cold start —
  `docs/ssr-hydration.md` §7.
- **`useDimensions()`, never `useWindowDimensions()`,** for responsive
  branching. Only the former is SSR-seeded, so only it makes the server and the
  client's first render agree on the breakpoint — §4. Per-item widths that
  depend on the breakpoint go in an *inline* style (`style={[styles.card, {
  flexBasis }]}`), which always ships in the HTML.

Both are asserted against every block's source in
`client/blocks/__tests__/blocks.test.tsx`.

## Launch set

| Block | Category | Built from |
|-------|----------|-----------|
| `hero` | marketing | SectionHeader, Button |
| `feature-grid` | marketing | Card, Icon, StyledText |
| `stat-row` | data | StatCard, SectionHeader |
| `cta-banner` | marketing | Card, Button, StyledText |
| `faq-section` | content | SectionHeader, Accordion, StyledText |
| `sign-in-form` | auth | Card, Label, TextInput, Button, Separator |

Templates deliberately still carry their own copies of these patterns; they'll
be refactored onto blocks once the gallery proves the shapes.
