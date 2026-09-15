---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Design-system ESLint plugin for @mrmeg/expo-ui

## Goal

Add an agent-first lint layer, modeled on `@shadcn/lint`, that turns the
design-system rules currently written as prose in `packages/ui/LLM_USAGE.md`
into ESLint diagnostics: raw colors, off-scale spacing, appearance overrides on
design-system components, and raw primitives where a wrapper exists. Every
message tells the reader what to use instead and never suggests changing the
lint config. The rules run at `error` inside the existing `bun run lint` gate,
so the PR also clears the current violations in `app/` and `client/`.

## Context

Verified on `dev` at `0ee4c11`.

**Styling model.** `@mrmeg/expo-ui` (`packages/ui`) is React Native
`StyleSheet` based; there is no Tailwind or NativeWind anywhere in the repo.
App code builds styles at module scope with `StyleSheet.create({...})`
(72 sites) or `createThemedStyles(createStyles)` where
`const createStyles = (theme: Theme) => StyleSheet.create({...})` and the
component reads `const styles = themedStyles(theme)` (60 sites). There are no
cross-file style imports and no render-time `StyleSheet.create`. Style objects
are structured, so a style property's key is its category; no class grammar is
needed.

**Tokens.**
- `packages/ui/src/constants/spacing.ts`: `export const spacing = {...} as const`,
  a flat object of numeric literals. Keys starting `radius` are radii
  (0, 4, 8, 12, 14, 18, 24, 9999), keys starting `icon` are icon sizes
  (12, 16, 24, 32, 48); everything else is spacing (2, 4, 8, 10, 12, 16, 20,
  24, 32, 40, 44, 48, 64). `space(n)` multiplies the 8px base.
- `packages/ui/src/constants/colors.ts`: `const palette = {...}` of hex
  literals (exported at the bottom via `export { palette }`), `interface
  ThemeColors` with 30 semantic keys, `const lightTheme` / `const darkTheme`
  whose `colors` members reference `palette.<key>` or a literal
  (`overlay: "rgba(0, 0, 0, 0.5)"`). Apps read them through
  `useTheme().theme.colors.<token>`. `withAlpha(color, alpha)` is a standalone
  export of `packages/ui/src/hooks/useTheme.ts`, re-exported from
  `@mrmeg/expo-ui/hooks`, usable in module-scope styles.
- Typography is owned by `StyledText` (`size`, `variant`, `weight`, `align`
  props; `FONT_SIZES` in `StyledText.tsx`). `StyledText` has no `color` prop;
  the sanctioned text-color path is `style={{ color: theme.colors.x }}`.

**Component surface.** `packages/ui/src/components/index.ts` is 44
`export * from "./X"` lines. Components export as `export function X`,
`export const X`, trailing `export { ... }` lists, and compounds via
`Object.assign(ButtonRoot, { Text, Icon })` used as `<Button.Text>`.
Style-accepting props are `style` and props ending in `Style` (`textStyle`,
`pressedStyle`, `disabledStyle`, `labelStyle`, `contentContainerStyle`,
`wrapperStyle`, `focusedStyle`, `backgroundStyle`, ...). Color-valued props:
`Icon.color`, `Item.iconColor`, `Progress.fillColor`,
`SegmentedControl.tintColor`, `Toggle.color`, `ToggleGroup.color`. Variants are
string-literal type aliases in the component file (`type Presets = "default" |
"outline" | ...` for `Button.preset`, `export type BadgeVariant = ...` for
`Badge.variant`, etc.). Sized components declare `size?:` in their props.
Text-like components: `StyledText` and its 13 aliases exported from
`StyledText.tsx` (`SerifText`, `MonoText`, `TitleText`, `BodyText`,
`CaptionText`, ...), `Label`, `Button.Text`, `CardTitle`, `CardDescription`. `Tooltip.tsx` already provides
`TextColorContext` per variant.

**Third-party primitives.** App and client code import zero symbols from
`@expo/ui` or `@rn-primitives/*`; every import comes from `@mrmeg/expo-ui/...`.
The design system wraps them internally: 18 `@rn-primitives/*` packages, and
from `@expo/ui` the `TextInput` (root export) plus `community/bottom-sheet`,
`community/slider`, `community/segmented-control`. Decision: these packages are
implementation dependencies, not design-system components. `no-restyle`
ignores them; `no-raw-primitives` flags a direct app import only where a
wrapper exists, and leaves the rest of `@expo/ui` (`Host`, `Picker`, ...)
alone because the design system deliberately does not cover it.

**Tooling.** ESLint 10.10 flat config in `eslint.config.mjs`,
`@typescript-eslint/parser` 8.70, run via `expo lint`. CI
(`.github/workflows/ci.yml`) installs only Bun; the runner's Node version is
unmanaged, so the plugin must be plain JavaScript with no TypeScript syntax.
ESLint's `RuleTester` with the TS parser runs inside this repo's jest-expo
setup (verified with a throwaway test). `bun run lint` today: 0 errors, 1
pre-existing `no-explicit-any` warning in `app/(main)/(demos)/developer.tsx`.
Package tooling (`scripts/run-package-script.mjs`,
`check-package-peer-compatibility.mjs`, `check-package-consumer-profile.mjs`,
`build-llms-full.mjs`) uses explicit package lists, so a new `packages/lint`
workspace does not touch them. `AGENTS.md` is not an `llms-full.txt` source;
`packages/ui/LLM_USAGE.md` is.

**Baseline in `app/` + `client/` (non-test).** Raw colors in style positions:
3 hex (`profile.tsx` Google brand red `#DB4437`; two `StyledText` overrides in
`client/showcase/ShowcaseScreen.tsx` inside `TooltipContent variant="dark|light"`),
6 `rgba(...)` and 10 `"black"`/`"white"` in media overlay chrome
(`client/features/media/components/ImagePreview.tsx`, `VideoPlayer.tsx`,
`app/(main)/(tabs)/media.tsx`, `client/templates/detail-hero/Screen.tsx`).
`client/showcase/ThemedShowcaseScreen.tsx` holds 44 hex literals in a
`PALETTES` brand-override table keyed by theme token names (`primary`,
`border`, ...); those are theme definitions, not style properties, and must not
be flagged. One file imports `Text` from `react-native`
(`client/showcase/ThemeToggle.tsx`). Two files import `palette` (allowed).
Off-scale spacing and appearance-override counts are unknown until the rules
run; the 221 numeric literals seen include many `fontSize` values, which are
out of scope for `no-arbitrary-values`.

## Work

### 1. Plugin package `packages/lint`

`@mrmeg/eslint-plugin-expo-ui`, `"private": true`, CommonJS `.js` with JSDoc,
no build step. `peerDependencies`: `eslint >=9.30`,
`@typescript-eslint/parser >=8` (both hoisted from the root). Add
`"@mrmeg/eslint-plugin-expo-ui": "workspace:*"` to root `devDependencies`, run
`bun install`, commit `bun.lock`. Do not register it in
`scripts/run-package-script.mjs` or the peer/consumer checks.

Layout:

- `index.js`: `{ meta: { name: "expo-ui" }, rules, configs: { recommended } }`.
  `recommended` is `{ plugins, settings, rules }` with all four rules at
  `"error"` and the default contracts below; it carries no `files`.
- `lib/settings.js`: reads `context.settings["expo-ui"]`:
  `uiSourceDir` (default `packages/ui/src`, resolved from `context.cwd`) and
  `componentImports` (regex strings, default `["^@mrmeg/expo-ui(/|$)"]`).
- `lib/source.js`: parses design-system sources with
  `@typescript-eslint/parser`, cached by file mtime. Produces:
  tokens (`spacing` members grouped into `spacing` / `radius` / `icon` by key
  prefix; `palette` hex map; light and dark `ThemeColors` member → palette key
  or literal; `ThemeColors` key list) and a component index: exported name →
  source file, built from `components/index.ts` re-exports plus each file's
  `export function`, `export const`, `export { }` lists, and `Object.assign`
  compounds (`Button.Text`). Per component: whether its props type declares
  `size`; its variant prop (`preset` or `variant`) and that prop's
  string-literal union, resolved through the type alias in the same file;
  `size` union the same way. Resolution failures degrade to "unknown", never
  throw.
- `lib/components.js`: a JSX element is a design-system component when its
  identifier (or the root of a `JSXMemberExpression`) resolves through
  `sourceCode.getScope` to an `ImportDeclaration` whose source matches
  `componentImports`. Name = imported name (not the local alias) plus
  `.Member` for compounds.
- `lib/styles.js`: resolves a style attribute to `{ key, keyNode, valueNode }`
  entries. Handles `ObjectExpression`; `ArrayExpression` elements;
  `ConditionalExpression` and `LogicalExpression` branches; identifiers and
  member expressions that resolve via scope to a module-scope
  `StyleSheet.create({...})` property, or to `themedStyles(theme).x` /
  `createThemedStyles(factory)` where the factory returns
  `StyleSheet.create({...})` or an object literal. Anything unresolvable
  (spreads, imported objects, call results) is skipped silently. No false
  positives from opacity of the resolver.
- `lib/categories.js`: style key → category.
  - `layout`: `margin*` (all sides, Horizontal, Vertical, Start, End), `flex`,
    `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `width`, `minWidth`,
    `maxWidth`, `position`, `top`, `right`, `bottom`, `left`, `start`, `end`,
    `zIndex`, `display`, `overflow`, `transform`, `textAlign`.
  - `arrangement`: `flexDirection`, `flexWrap`, `alignItems`,
    `justifyContent`, `alignContent`.
  - `spacing`: `padding*` (all variants), `gap`, `rowGap`, `columnGap`,
    `height`, `minHeight`, `maxHeight`.
  - `color`: `backgroundColor`, `color`, `borderColor` and its side variants,
    `shadowColor`, `tintColor`, `textDecorationColor`, `textShadowColor`,
    `overlayColor`.
  - `typography`: `fontSize`, `fontFamily`, `fontWeight`, `fontStyle`,
    `lineHeight`, `letterSpacing`, `textTransform`, `textDecorationLine`,
    `textDecorationStyle`, `textAlignVertical`, `includeFontPadding`.
  - `shape`: `borderRadius` and its corner variants, `borderWidth` and side
    variants, `borderStyle`, `shadowOffset`, `shadowOpacity`, `shadowRadius`,
    `elevation`, `opacity`, `boxShadow`.
  - Keys not listed are ignored (TypeScript already types them).
- `lib/colors.js`: raw-color detection and nearest-token lookup (below).
- `lib/contracts.js`: policy compilation and message assembly.
- `rules/no-raw-colors.js`, `rules/no-arbitrary-values.js`,
  `rules/no-restyle.js`, `rules/no-raw-primitives.js`.
- `README.md`: rules, settings, contract schema, how to extend, and the
  "@expo/ui and @rn-primitives are not design-system components" decision.
- `__tests__/*.test.ts`: `RuleTester` per rule using `@typescript-eslint/parser`
  with JSX, plus loader tests against the real `packages/ui/src` (e.g.
  `spacing.smd` is 12 in the `spacing` group, `radiusMd` in `radius`,
  `Button` variant prop is `preset` with six values, `Button` has `size`,
  `TitleText` maps to `StyledText.tsx`).

### 2. Rules

Messages use placeholders and follow the shadcn pattern: what is not allowed,
who owns it, what to use, and the guarded "add a new one only if the design
explicitly calls for it" sentence naming the design-system file. No message
mentions ESLint options or disabling.

**`expo-ui/no-raw-colors`.** Sites: (a) any `ObjectExpression` property whose
key is in the `color` category, including inside `StyleSheet.create` and
`createThemedStyles` factories; (b) a JSX attribute on a design-system element
named `color`, `iconColor`, `fillColor`, `tintColor`, or ending in `Color`. A
value is raw when it is a string literal or expression-free template literal
matching a 3/4/6/8-digit `#` hex, `rgb(`/`rgba(`/`hsl(`/`hsla(`, or a CSS named
color; `"transparent"` is allowed. Message names the nearest palette entry
(Euclidean RGB distance) and up to three light-theme tokens that resolve to
it, then the alpha helper when the raw value carried alpha:

> `"#DB4437"` is a raw color. Use a theme token from `useTheme()`:
> `theme.colors.destructive`. Use `palette.red500` from
> `"@mrmeg/expo-ui/constants"` only where the color must ignore the color
> scheme. For alpha, `withAlpha(color, 0.3)` from `"@mrmeg/expo-ui/hooks"`.
> Add a token in `packages/ui/src/constants/colors.ts` only if the design
> explicitly calls for one.

The `PALETTES` table in `ThemedShowcaseScreen.tsx` is not flagged because its
keys (`primary`, `border`, ...) are token names, not style keys.

**`expo-ui/no-arbitrary-values`.** Sites: any `ObjectExpression` property
whose key is a spacing key (`padding*`, `margin*`, `gap`, `rowGap`,
`columnGap`) or a radius key (`borderRadius` and corner variants). Value: a
numeric literal or negated numeric literal. Allowed: `0`, the `spacing`-group
values for spacing keys, the `radius`-group values for radius keys, and their
negatives. Non-numeric values are ignored. Message:

> `13` is not a spacing token. Nearest: `spacing.smd` (12), `spacing.md` (16).
> Import `{ spacing }` from `"@mrmeg/expo-ui/constants"`. Add a token in
> `packages/ui/src/constants/spacing.ts` only if the design explicitly calls
> for one.

`fontSize`, `lineHeight`, `width`, `height`, `borderWidth`, and `Icon`'s
numeric `size` prop are out of this rule.

**`expo-ui/no-restyle`.** Sites: JSX attributes on design-system elements
named `style` or ending in `Style`, resolved through `lib/styles.js`. Each
resolved key is categorized and decided by contracts. Default policy: allow
`layout`, `arrangement`, `spacing`; deny `color`, `typography`, `shape`.
Default contracts shipped in `configs.recommended`:

| Components | Rule |
|---|---|
| Any component whose props declare `size` | also deny `spacing` and `arrangement` |
| `StyledText`, its 13 aliases, `Label`, `Button.Text`, `CardTitle`, `CardDescription` | allow `color` (value policed by `no-raw-colors`); deny `typography` with a message naming `size`, `variant`, `weight`, `align` |
| `AnimatedView`, `KeyboardAvoidingView`, `DismissKeyboard`, `MaxWidthContainer`, `Skeleton` | allow everything |
| `BottomSheet.*` prop `backgroundStyle` | allow `color` (documented transparent-sheet path in `LLM_USAGE.md`) |

Contract schema for rule options: `{ pattern, prop?, allow?, deny?, message? }`
where `pattern` and `prop` are regexes on component name and attribute name,
and `allow`/`deny` accept category names or exact style keys; later entries
win; rule options extend the defaults. Messages:

> `"backgroundColor"` is not allowed on `<Button>`: Button owns its color. Use
> `preset`: default | outline | ghost | link | destructive | secondary. Add a
> preset in `packages/ui/src/components/Button.tsx` only if the design
> explicitly calls for a treatment none of them provides.

> `"paddingHorizontal"` is not allowed on `<Button>`: Button owns its spacing.
> Use `size`: sm | md | lg, or put margin on it or padding on a parent for
> space around it.

> `"fontSize"` is not allowed on `<StyledText>`: StyledText owns its
> typography. Use `size`, `variant`, `weight`, or `align`.

When the variant union cannot be resolved, the message names the prop without
values. Update the `style` docstring in `Button.tsx` (currently "useful for
padding & margin") to "useful for margin and layout" so the source matches the
contract.

**`expo-ui/no-raw-primitives`.** `ImportDeclaration` checks:

- `react-native` specifier `Text` → use `StyledText` or a semantic alias from
  `"@mrmeg/expo-ui/components"`; it applies the theme font and color.
  `Pressable`, `TouchableOpacity`, `View`, `TextInput` are not flagged;
  `Pressable` is the sanctioned base for custom interactive surfaces.
- Source matching `^@rn-primitives/` → headless layer the design system wraps;
  import the styled component from `"@mrmeg/expo-ui/components"`.
- `@expo/ui/community/bottom-sheet`, `.../slider`,
  `.../segmented-control`, and `@expo/ui` specifier `TextInput` → use the
  design-system `BottomSheet`, `Slider`, `SegmentedControl`, `TextInput`.
  Other `@expo/ui` imports are allowed.
- `palette` imports are allowed.

### 3. Wire into `eslint.config.mjs`

Add a block after the existing rules block:

```js
import expoUi from "@mrmeg/eslint-plugin-expo-ui";
// ...
{
  files: ["app/**/*.{ts,tsx}", "client/**/*.{ts,tsx}", "shared/**/*.{ts,tsx}"],
  ignores: ["**/__tests__/**", "**/*.test.{ts,tsx}"],
  ...expoUi.configs.recommended,
  settings: { ...expoUi.configs.recommended.settings, "expo-ui": { uiSourceDir: "packages/ui/src" } },
},
```

`packages/**` stays outside the rules: the design system implements the
tokens. Tests are excluded so fixtures may use raw values.

### 4. Clear the baseline

Run `bun run lint` and fix every report in `app/`, `client/`, `shared/`:

- Media overlay chrome (`ImagePreview.tsx`, `VideoPlayer.tsx`, `media.tsx`,
  `detail-hero/Screen.tsx`): scheme-independent black/white becomes
  `palette.black` / `palette.white`; translucent values become
  `withAlpha(palette.black, 0.8)` etc. in the module-scope `StyleSheet.create`,
  or `theme.colors.overlay` where the file already uses `createThemedStyles`
  and the intent is a scrim.
- `profile.tsx` Google brand red: keep, with
  `// eslint-disable-next-line expo-ui/no-raw-colors -- Google brand color; must not follow the theme`.
- `ShowcaseScreen.tsx` tooltip text overrides (`#fff`, `#2C2C2C`): remove
  them; `TooltipContent` already provides `TextColorContext` per variant.
  Confirm the dark and light tooltip labels still read correctly in the
  showcase.
- `ThemeToggle.tsx`: replace `Text` with `StyledText`.
- Off-scale spacing and radius literals: use the exact token when one matches;
  otherwise snap to the nearest token. These are template and demo screens, not
  pixel-locked designs. Do not add tokens. List any snap larger than 2px in the
  PR description.
- `no-restyle` findings: switch to the component's `preset`/`variant`/`size`,
  or move the style onto a wrapping `View`. Where a legitimate override has no
  variant, add a disable comment with a reason and list it in the PR
  description as a design-system follow-up.

End state: `bun run lint` exits 0 with the four rules at `error`. The
pre-existing `no-explicit-any` warning may remain.

### 5. Docs

- `AGENTS.md`: add a Docs-table row for `packages/lint/README.md` and a
  Project Notes bullet: design-system rules are enforced by
  `@mrmeg/eslint-plugin-expo-ui` through `bun run lint`; read the message, use
  the named token or variant, and never disable a rule without a `--` reason.
- `packages/lint/README.md` as described in section 1.
- No change to `packages/ui/LLM_USAGE.md` (it documents the published
  package for external consumers; the plugin is repo-internal).

## Validation

- `bun run lint` exits 0; the only remaining report is the pre-existing
  `no-explicit-any` warning.
- `bun x jest packages/lint` passes: `RuleTester` suites for all four rules,
  and loader tests against the real `packages/ui/src`.
- Smoke check: create a temporary `client/tmp-lint-smoke.tsx` containing
  `<Button style={{ backgroundColor: "#f00", padding: 13 }} />`, an
  `import { Text } from "react-native"`, and an
  `import { Slider } from "@expo/ui/community/slider"`; `bun run lint` must
  report one `no-raw-colors`, one `no-arbitrary-values`, two `no-restyle`
  (color and spacing on `Button`), and two `no-raw-primitives` errors, each
  message naming the replacement. Delete the
  file.
- `bun run verify` passes (peer-check, typecheck, lint, check:features,
  registry checks, docs checks, tests).
- Visual: `bun run build && bun run start`, then open the home, profile,
  media, and showcase routes in a browser and spot-check every screen whose
  spacing was snapped, the media overlay chrome, and the dark/light tooltip
  labels in the showcase. Web only is acceptable; say so in the PR.

## Out of scope

- Publishing the plugin, registering it in `run-package-script.mjs` or the
  peer/consumer checks, and changing `LLM_USAGE.md`.
- Type-aware linting and cross-file shared style modules (none exist today).
- Local wrapper components that forward `style` to design-system components.
- `Icon`'s numeric `size` prop (130 sites; needs an icon-scale decision) and
  `fontSize` literals outside design-system components.
- Linting `packages/ui` and `packages/media` sources.
- Autofixers, ESLint suggestions, Oxlint support, and an evals harness.
- Flagging `Pressable`, `TouchableOpacity`, or `palette` imports.

## Open questions

None.
