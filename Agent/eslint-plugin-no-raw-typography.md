---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/122
---

# eslint-plugin-expo-ui: `no-raw-typography` rule, docs polish (no publish)

## Goal

Consumer apps get flagged for hardcoded font sizes, line heights and font
families the same way they are for raw colors, with messages that name the
`StyledText` token to use. `@mrmeg/eslint-plugin-expo-ui` stays 0.1.0 and
unpublished.

## Context

- `packages/lint/rules/`: `no-raw-colors`, `no-arbitrary-values`, `no-restyle`,
  `no-raw-primitives`; `lib/source.js` parses `packages/ui/src` for tokens
  (`spacing`/`radius`/`icon` groups, palette, light/dark themes) and
  `scripts/build-design-system-manifest.mjs` serializes the same facts to
  `dist/design-system.json` for consumers (`schemaVersion` pinned by
  `__tests__/manifest.test.ts`).
- README "Rules" says `fontSize`/`lineHeight` are out of scope by design;
  "Extending" explains token groups and `lib/categories.js`.
- Type scale sources: `StyledText.tsx` size config (xs…display) and
  `constants/fonts.ts` `typography` (xs…4xl) plus `fontFamilies`.
- Repo wiring: `eslint.config.mjs` registers the plugin; `bun run lint` covers
  `app/`; `bun lint:ui` covers `app`, `client`, `shared`.

## Work

1. `lib/source.js` + manifest: new `tokens.typography` group (name → fontSize,
   lineHeight, from `StyledText`'s size map) and `fonts.families` (variant →
   weight → family) read from the sources; manifest `schemaVersion` bumps, the
   loader still accepts the previous version with an empty typography group,
   and the rule reports the "design system lacks typography facts" message in
   that case (same shape as `DESIGN_SYSTEM_MISSING_MESSAGES`).
2. `rules/no-raw-typography.js`: in style positions (`lib/stylePositions.js`)
   flag numeric `fontSize` / `lineHeight` literals and string `fontFamily`
   literals. Messages: the `StyledText` `size` whose fontSize matches, else the
   two bracketing sizes (reuse `nearestTokens` from `no-arbitrary-values`, move
   it to `lib/`); for `fontFamily`, "use `StyledText variant` or
   `useFontStyle`, or `setFonts` for a brand face". `0` and `undefined` allowed;
   `packages/ui/src` itself is exempt through the existing design-system-source
   detection. Add to the recommended config and `index.d.ts`.
3. Wire into `eslint.config.mjs`; run `bun run lint` and `bun lint:ui`; fix the
   findings in `app/` (switch to `StyledText` sizes/semantics) so `bun run lint`
   is clean; leave `client/`/`shared/` findings listed in the PR body if more
   than a handful (they are outside `bun run lint`'s gate).
4. Tests first: `__tests__/no-raw-typography.test.ts` (RuleTester: valid token
   usage, invalid literals with exact messages, manifest-without-typography
   message), extend `source.test.ts` and `manifest.test.ts` for the new facts.
5. Docs: README Rules table row, remove the "out of scope" sentence for
   fontSize/lineHeight, Extending ("a new token group" example now cites
   typography), Messages section, CHANGELOG under 0.1.0 Unreleased;
   `bun run docs:llms`.

## Validation

- `bun run lint:test`, `bun run lint:typecheck`, `bun run lint:build`,
  `bun run ui:build` (regenerates `design-system.json`; check
  `bun run packages:drift-check` if it covers the manifest), `bun run lint`,
  `bun lint:ui --doctor`, `bun run docs:llms:check`, `bun run verify`.

## Out of scope

Publishing; a `letterSpacing` rule; autofixes.

## Open questions

None.
