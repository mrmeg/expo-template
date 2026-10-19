---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/158
---

# brand.md: state the real `StyledText` type scale, and guard it

## Goal

`docs/brand.md` → Type says "Body 16/24, captions 14/20 and 12/16". What `StyledText` actually renders in
`@mrmeg/expo-ui` is body 15/24.75, caption 12/18, label 14/21 (medium) and subheading 18/27 (medium). Housefold found
the mismatch (`housefold/Agent/typography-roles-and-ci-guard.md:43-55`). The fleet audit reference copied the wrong
numbers (`/tmp/fleet-audit/reference.md:64`), so fleet specs inherit them.

**The doc is wrong, not the tokens.** `brand.md`'s numbers are the Tailwind table in the separate `typography`
constant (`packages/ui/src/constants/fonts.ts:307-321`). Nothing in the kit or the template renders from that table.
The `StyledText` scale is what every consumer app ships, what `design-system.json` → `tokens.typography` publishes,
and what `@mrmeg/eslint-plugin-expo-ui`'s `no-raw-typography` enforces. Changing the tokens to 16/24 would reflow
every consumer app's text for a doc error.

Fix the doc, add a test that keeps the doc tied to the rendered scale, and label the `typography` constant so it
stops being mistaken for the text scale.

## Context

Verified on `dev` at 156c9a1.

- `packages/ui/src/components/StyledText.tsx`:
  - `FONT_SIZES` (line 29) is xs 11, sm 12, base 14, body 15, lg 18, xl 22, xxl 28, display 34.
  - `LINE_HEIGHTS` (line 40) is 16.5, 18, 21, 24.75, 27, 26.4, 33.6, 40.8.
  - `SEMANTIC_CONFIGS` (line 71) maps title→xxl semibold, heading→xl semibold, subheading→lg medium, body→body
    regular, caption→sm regular, label→base medium, eyebrow→sm semibold (uppercase).
  - The scale is not platform-specific.
- `packages/ui/src/constants/fonts.ts:307-321`: `typography` (xs 12/16, sm 14/20, base 16/24, …), described as
  "Tailwind-matching … Components can progressively adopt these tokens". It is used nowhere in `packages/ui/src`,
  `app`, `client` or `shared`. But it is public (`constants/index.ts` re-exports `fonts`) and appears in the import
  examples (`packages/ui/LLM_USAGE.md:15`, `packages/ui/README.md:49`), so **do not remove or change it**.
- `docs/brand.md:51-60` is the Type section. `docs/brand.md` is a source doc for `llms-full.txt`
  (`scripts/build-llms-full.mjs:19`), so regenerate after the edit.
- Doc tests live in `scripts/__tests__/` (Jest, root config, jest-expo preset).
- No open PR touches `docs/brand.md`, `StyledText.tsx` or `fonts.ts`. #156 and #157 add
  `packages/ui/CHANGELOG.md` entries.

## Work

1. **`docs/brand.md`, Type → Sans bullet.** Replace "Body 16/24, captions 14/20 and 12/16, headings from the
   `StyledText` size scale (`xs`…`display`) and semantics (…)" with the rendered roles, in this exact form so the
   test can parse it:

   > Roles (`StyledText` `semantic`): body 15/24.75, label 14/21 medium, caption 12/18, subheading 18/27 medium,
   > heading 22/26.4 semibold, title 28/33.6 semibold; eyebrows 12 px, uppercase, tracked, `mutedForeground`.
   > Sizes beyond the roles come from the `size` scale (`xs` 11 … `display` 34).

   Keep the rest of the section.
2. **`packages/ui/src/constants/fonts.ts:307-310`.** Replace the `typography` JSDoc: "A Tailwind-style size table
   for hand-built layouts. It is **not** the text scale: `StyledText` (`size` / `semantic`) renders its own scale
   (body 15/24.75, caption 12/18, label 14/21). Use `StyledText` for text." Change no values.
3. **New `scripts/__tests__/brandTypeScale.test.tsx`.**
   - Read `docs/brand.md`. For each role `body`, `label`, `caption`, `subheading`, `heading` and `title`, extract
     `<role> <size>/<lineHeight>` with a regex, and fail with a clear message if one is missing.
   - Render `<StyledText semantic={role}>x</StyledText>` from `@mrmeg/expo-ui/components/StyledText` (with
     `@/test/mockTheme` if it needs a theme).
   - Assert that the flattened `fontSize` and `lineHeight` equal the doc's numbers.
   - Also assert that the doc does not contain `16/24` or `14/20` in the Type section, so the Tailwind numbers
     cannot creep back.
4. **CHANGELOG** (`packages/ui/CHANGELOG.md` `## [Unreleased]` → `### Fixed`, no version bump): "Docs: the
   template's brand guide stated a 16/24 body and 14/20 caption; `StyledText` renders body 15/24.75, caption 12/18,
   label 14/21, subheading 18/27. The tokens are unchanged. The `typography` constant's JSDoc now says it is not the
   text scale."
5. Run `bun run docs:llms` (or `bun run gen`) and commit the regenerated `llms-full.txt`.

Exclusions: no change to `FONT_SIZES`, `LINE_HEIGHTS`, `SEMANTIC_CONFIGS` or `typography` values; no version bump.
Correcting `/tmp/fleet-audit/reference.md` and consumer-app specs is outside this repo.

## Validation

- `bunx jest scripts/__tests__/brandTypeScale.test.tsx`:
  - Before the doc edit, it fails: there is no `body 15/24.75` in the doc, and `16/24` is present.
  - After the edit, it passes.
  - Temporarily change `body: 15` in `StyledText.tsx` and confirm it fails, then revert.
- The test is platform-independent: the scale has no `Platform` branch. One run covers iOS, Android and web.
- `bun run docs:llms:check` (or `bun run gen --check`), `bun run typecheck` and `bun run verify` pass.
