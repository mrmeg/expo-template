# @mrmeg/eslint-plugin-expo-ui

The design-system rules of [`@mrmeg/expo-ui`](../ui), written as ESLint
diagnostics instead of prose. [`packages/ui/LLM_USAGE.md`](../ui/LLM_USAGE.md)
explains the system to a reader; this plugin says the same things at the call
site, where the mistake is being made. Every message names the replacement — the
token, the variant, the component — and never suggests changing the lint
configuration or disabling a rule. When a new token or preset really is the
answer, the message names the design-system file it belongs in, guarded by "only
if the design explicitly calls for it".

It is written for two audiences. People and agents working in this repo, where
the rules are already wired into [`eslint.config.mjs`](../../eslint.config.mjs)
and run through `bun run lint`, `bun lint:ui`, and the editor. And other projects
that consume `@mrmeg/expo-ui` and want the same enforcement — see
[Adopting in another project](#adopting-in-another-project). The rules need the
design system's facts at lint time: they read the TypeScript sources where those
are on disk, and otherwise the `design-system.json` manifest an installed
`@mrmeg/expo-ui` ships.

Status: publishable, first release pending. `private: false` with a full
[release path](#release), not yet on npm. Unbuilt CommonJS `.js` with JSDoc
types, so it loads in whatever Node runs ESLint — there is no build step and no
`dist`. `index.d.ts` types the plugin for an `eslint.config.ts`; the package is
MIT-licensed ([`LICENSE`](LICENSE)).

## Contents

- [Rules](#rules)
- [Requirements](#requirements)
- [Usage in this repo](#usage-in-this-repo)
- [Adopting in another project](#adopting-in-another-project)
- [CLI](#cli)
- [Editor and CI](#editor-and-ci)
- [Settings](#settings)
- [Style contracts](#style-contracts)
- [Messages](#messages)
- [Troubleshooting](#troubleshooting)
- [Extending](#extending)
- [Tests](#tests)
- [Release](#release)

## Rules

| Rule | What it catches |
|---|---|
| `expo-ui/no-raw-colors` | Hex, `rgb()`/`rgba()`/`hsl()`/`hsla()`, or CSS color keywords in a color property of a [style](#what-counts-as-a-style), or in a color-valued prop of a design-system component. `"transparent"` is allowed. |
| `expo-ui/no-arbitrary-values` | Numeric literals off the `spacing` and radius scales in the `padding*`, `margin*`, `gap`, `rowGap`, `columnGap`, and `border*Radius` properties of a [style](#what-counts-as-a-style). `0` is allowed. |
| `expo-ui/no-restyle` | `style` / `*Style` props on design-system components that override appearance the component owns. |
| `expo-ui/no-raw-primitives` | Importing a primitive the design system already wraps: a `react-native` component the design system exports a same-named component for (`TextInput`, `Switch`, `Button`, `KeyboardAvoidingView`, `StatusBar` today — read from the design system, not listed in the rule), `Text` from `react-native`, anything from `@rn-primitives/*`, and the wrapped `@expo/ui` surfaces. React Native APIs (`Alert`, `Keyboard`, …) are not primitives. A type-only import (`import type { Text }`, `import { type Text as T }`) is ignored — it renders nothing, so it cannot render unthemed. |

`no-raw-colors` and `no-arbitrary-values` read the real design system to build
their advice: the nearest palette entry by Euclidean RGB distance, the light-
theme tokens that resolve to it, and the two `spacing` tokens that bracket the
number that was written. A negative offset is bracketed by negated tokens:
`marginTop: -3` names `-spacing.xxs` (-2) and `-spacing.xs` (-4), because a
positive token there would flip the offset.

Out of scope by design: `fontSize`, `lineHeight`, `width`, `height`,
`borderWidth`, and `Icon`'s numeric `size` prop are not on the spacing scale.
`Pressable`, `TouchableOpacity`, `View`, `ScrollView`, and `Image` are not
wrapped, and `Pressable` is the sanctioned base for a custom interactive
surface.

### What counts as a style

`no-raw-colors` and `no-arbitrary-values` read a key only in an object the file
uses as a style. Chart series (`{ label, color, value }`), a map theme, a
palette table, or a config object carries the same keys without being one, and
is left alone. An object literal is a style when it reaches one of these,
directly or through the arrays, conditionals, `&&`/`||`/`??`, variables, sheet
members (`styles.card`), `useMemo`, Pressable style functions, and local helper
functions that lead to it:

- a `style` or `*Style` JSX prop, on any element (`contentContainerStyle`,
  `labelStyle`, …);
- a `style` or `*Style` property of an object — navigation options such as
  `headerStyle`, `tabBarStyle`, `contentStyle`;
- a named style of `StyleSheet.create({...})`, or of a
  `createThemedStyles((theme) => ({...}))` factory;
- an argument of `StyleSheet.flatten` / `StyleSheet.compose`, or what a
  `useAnimatedStyle` worklet returns;
- a value typed as a style — `const s: ViewStyle = {...}`, `{...} as TextStyle`,
  `{...} satisfies ViewStyle`, `StyleProp<…>`, or a function declared to return
  one.

A style that maps states to styles instead of properties to values —
`labelStyle={{ default: { color }, selected: { color } }}` on native tabs — has
each state checked. What the resolver cannot follow is skipped: an object
imported from another file is checked where it is declared only if it is a
`StyleSheet`/`createThemedStyles` style or typed as one there.

### `@expo/ui` and `@rn-primitives` are not design-system components

They are the layers underneath it. `@rn-primitives/*` is headless behaviour and
`@expo/ui` is platform-native UI; both arrive without the theme. Where
`packages/ui` exports a wrapper (`BottomSheet`, `Slider`, `SegmentedControl`,
`TextInput`), that wrapper is the component — importing the layer underneath
skips the font, the colors, and the shared props. Where it exports no wrapper
(`Host`, `Picker`, `@expo/ui/swift-ui`), the import is fine.

## Requirements

| Requirement | Why |
|---|---|
| ESLint >= 9.30, flat config | `configs.recommended` is a flat-config object spread into a `files` block. Declared as a peer dependency; this repo runs ESLint 10. |
| `@typescript-eslint/parser` >= 8 | Two jobs: the linted files must be parsed by a TypeScript-capable parser, and the plugin loads the parser itself to read the design-system sources. Declared as a peer dependency. This repo depends on it directly and sets `languageOptions.parser` in [`eslint.config.mjs`](../../eslint.config.mjs); a project on `eslint-config-expo` gets the parser from that config instead. |
| The design system's facts — its sources **or** its manifest | The messages quote the tokens, presets, sizes, and font families that exist today. Read from the sources at lint time where they are on disk, and from `@mrmeg/expo-ui/design-system.json` otherwise. |
| Node — whatever runs ESLint, 18.18 or later (`engines`) | CommonJS with JSDoc types. No build, no transpile, no `dist`. |
| `@mrmeg/expo-ui` >= 0.25 — optional | Declared as an optional peer dependency: it is where the manifest comes from in a project without the sources, and 0.25.0 is the first release that ships one. A project that points the rules at vendored sources or a manifest of its own does not need it installed. |

The sources read under `uiSourceDir` (default `packages/ui/src`) — only when the
`package.json` beside them (`packages/ui/package.json`) names `@mrmeg/expo-ui`,
so a project's own `packages/ui` is never mistaken for the design system:

- `constants/spacing.ts` — the spacing, radius, and icon scales
- `constants/colors.ts` — the palette and the light and dark themes
- `constants/fonts.ts` — the `FontVariant` union
- `components/index.ts` — which component modules exist
- every module that index re-exports, `.tsx` first then `.ts` — each component's
  `size` and variant unions

The manifest read instead, when no sources are on disk:

- `node_modules/@mrmeg/expo-ui/dist/design-system.json`, resolved through the
  package's `./design-system.json` export
- written by the UI package's own build
  ([`scripts/build-design-system-manifest.mjs`](../../scripts/build-design-system-manifest.mjs)),
  which serializes exactly the facts above out of `packages/ui/src`
- `schemaVersion: 1`; a manifest from a newer schema is refused rather than
  half-read
- present in `@mrmeg/expo-ui` from the first release built after the manifest was
  added; `0.24.0` and earlier ship none, and the rules then report that they
  found neither sources nor one. `--doctor` prints the version it read the
  manifest from, so the installed release answers the question

Reading is best-effort: a missing or unparseable file degrades that fact to
"unknown" rather than throwing. When neither sources nor a manifest can be read,
every rule reports once per file instead of going silent — see
[Settings](#settings).

## Usage in this repo

```js
// eslint.config.mjs
import expoUi from "@mrmeg/eslint-plugin-expo-ui";

export default [
  // ...
  {
    files: ["app/**/*.{ts,tsx}", "client/**/*.{ts,tsx}", "shared/**/*.{ts,tsx}"],
    ignores: ["**/__tests__/**", "**/*.test.{ts,tsx}"],
    ...expoUi.configs.recommended,
    settings: {
      ...expoUi.configs.recommended.settings,
      "expo-ui": { uiSourceDir: "packages/ui/src" },
    },
  },
];
```

`configs.recommended` carries no `files` key on purpose: the consuming config
decides which paths the design system governs. `packages/**` stays outside it —
the design system is where the tokens are implemented — and tests are excluded
so fixtures may use raw values.

Four surfaces run those rules, and they do not cover the same ground:

| Surface | Paths | Rules shown | Cache |
|---|---|---|---|
| `bun run lint` (`expo lint`) | `app/` — Expo's default inputs are `src`, `app`, `components`, and only `app/` exists here. Explicit paths work: `bun run lint client shared`. | every rule the config enables | `.expo/cache/eslint/`; `bun run lint --no-cache` skips it |
| `bun lint:ui` | `app client shared` by default, or the paths you name | `expo-ui/*` only, unless `--all` | none, ever |
| Editor | the open file | every rule the config enables | the ESLint server's, until it restarts |
| `bun run verify` | `lint` (so `app/`) plus the jest suites, including `packages/lint/__tests__` | as `bun run lint` | as `bun run lint` |

`bun run verify` is the CI-parity gate and it does **not** run `lint:ui`, so a
raw color in `client/` or `shared/` passes it. Run `bun lint:ui` before handing
work over.

## Adopting in another project

1. **Install both packages.** The design system is the source of the facts the
   messages quote, so the plugin wants it alongside:

   ```sh
   bun add -d @mrmeg/eslint-plugin-expo-ui
   bun add @mrmeg/expo-ui   # if the project does not depend on it already
   ```

   Bring `eslint >= 9.30` and `@typescript-eslint/parser >= 8` with them. The
   plugin declares `@mrmeg/expo-ui` as an *optional* peer dependency: installed,
   it supplies the manifest; a project that points the rules at vendored
   sources or a manifest of its own can leave it out.

2. **Add the config block.** No `uiSourceDir`: with no sources on disk, the rules
   resolve `@mrmeg/expo-ui/design-system.json` out of `node_modules` and quote
   the release the project installed.

   ```js
   // eslint.config.mjs
   import parser from "@typescript-eslint/parser";
   import expoUi from "@mrmeg/eslint-plugin-expo-ui";

   export default [
     {
       files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
       ignores: ["**/__tests__/**", "**/*.test.{ts,tsx}"],
       ...expoUi.configs.recommended,
       languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
     },
   ];
   ```

   Use the project's own `files` globs, and keep test fixtures outside them.
   `configs.recommended` carries a default `uiSourceDir` of `packages/ui/src`,
   which simply does not resolve in a consumer — that is the fall-through to the
   manifest, not a misconfiguration.

3. **Prove the wiring** with `expo-ui-lint --doctor <a file in scope>` — a file
   the `files` globs actually govern. Its design-system line names what it read:

   ```
   ok   design system: manifest @mrmeg/expo-ui@<installed version> at
        /project/node_modules/@mrmeg/expo-ui/dist/design-system.json — 26 spacing,
        31 palette, 26 theme colors, 3 font variants, 192 components
   ```

   It fails loudly when the plugin does not resolve, the rules are not at `error`
   for that file, no design system could be read, or a fixture stops tripping all
   four rules.

4. **Add it to CI** as `expo-ui-lint <paths>` (or
   `node node_modules/@mrmeg/eslint-plugin-expo-ui/bin/cli.js <paths>`). Name the
   project's own paths: the defaults are this repo's layout. Exit 1 means
   design-system errors.

Two alternatives to step 2, for a project that would rather not depend on the
manifest of a published release:

- **Vendor the sources.** Copy `packages/ui` — `src` *and* its `package.json`,
  whose `name` is how the rules tell `@mrmeg/expo-ui`'s sources from any other
  — into the project, and point `settings["expo-ui"].uiSourceDir` at the copy's
  `src`. Sources win over any manifest.
- **Consume this monorepo.** As a workspace or a git dependency, where
  `packages/ui/src` is already on disk and the default `uiSourceDir` resolves.

A checked-in manifest is a third option: build one with
`bun run pkg ui build` in a checkout of this repo, commit
`dist/design-system.json` into the project, and point
`settings["expo-ui"].manifestPath` at it.

Until the first npm release lands, install the plugin from this monorepo (a
workspace, a `file:` dependency on `packages/lint`, or a git dependency); the
config and the resolution order are the same either way.

## CLI

The same four rules on demand, over the paths the design system actually
governs. In this repo, `bun lint:ui` (the root script runs
`node packages/lint/bin/cli.js`):

```sh
bun lint:ui                           # app client shared
bun lint:ui client/features/auth      # or any paths you name
bun lint:ui --changed                 # only the .ts/.tsx files you touched
bun lint:ui --doctor                  # is the plugin actually wired?
bun lint:ui --doctor app/_layout.tsx  # ...against one file in particular
```

The package declares `bin: { "expo-ui-lint": "./bin/cli.js" }`, so a project
that installs it as a dependency gets `expo-ui-lint` on PATH
(`npx expo-ui-lint`, `bun x expo-ui-lint`) wherever the installer links
dependency bins. Bun does not link it for this workspace package, which is why
the root script names the file directly; `node <path>/bin/cli.js` always works.

It exists because `bun run lint` answers a narrower question. `expo lint` lints
`app/` only, so a raw color in `client/` or `shared/` never surfaces; it caches
results in `.expo/cache/eslint/` under a key that covers neither this plugin's
rule bodies nor `packages/ui/src`, so an edited message or a renamed token
replays the old text; and `client/` carries pre-existing react-hooks errors that
bury four design-system findings in thirty unrelated ones. This runs ESLint with
the project's own flat config, never from cache, and reports `expo-ui/*` only.

| Flag | Purpose |
|---|---|
| `--all` | Report every ESLint message on those files, not just `expo-ui/*`. |
| `--changed` | Lint only changed `.ts`/`.tsx` files: the branch diff against the base, plus staged, unstaged, and untracked files. |
| `--staged` | Lint only staged `.ts`/`.tsx` files — the pre-commit shape. |
| `--base <ref>` | Base ref for `--changed`; defaults to `origin/dev`, else `dev`. |
| `--rules` | List the four rules and what each catches. |
| `--clear-cache` | Delete `.expo/cache/eslint` so the next `bun run lint` re-reads the rules and the design system. |
| `--doctor [file]` | Check that the plugin resolves, the config enables all four rules at `error`, a design system was found and parsed — sources or manifest — and a fixture still trips every rule. |
| `-h`, `--help` | Usage. |

Default paths are `app client shared` — this repo's layout. Another project
names its own.

`--changed` and `--staged` drop files the config does not govern, so a touched
test file or a `packages/**` source reports nothing rather than an "ignored file"
warning. With nothing in scope they print `no changed .ts/.tsx files`.

Exit codes: `0` clean (or nothing to lint), `1` design-system errors — or a
failed `--doctor` check — and `2` bad usage or a lint run that could not start.

`--doctor` is the one to reach for when the rules go quiet. It prints the resolved
plugin path and version, the `expo-ui/*` rules and severities the config computes
for a real file, the design system it resolved with its token, palette, theme,
font, and component counts, and the observed-versus-expected rule counts on a
fixture that must produce `1/1/2/2`. Any `FAIL` line exits 1. The last line
reports the age of the `expo lint` cache and never fails.

The design-system line names the origin, which is the fastest way to see whether
a run is quoting what you think it is: `sources at /repo/packages/ui/src` in this
repo, `manifest @mrmeg/expo-ui@<installed version> at /project/node_modules/@mrmeg/expo-ui/dist/design-system.json`
in a project that installed a release.

The config check needs one real file. Name it as a positional argument
(`bun lint:ui --doctor app/_layout.tsx`) and that file is used, resolved against
the working directory; it must exist and end in `.ts` or `.tsx`, or the check
`FAIL`s with the path it tried. Name nothing and it falls back to
`app/_layout.tsx`, else the first `.tsx` it finds in a shallow walk of `app/` —
which is why a project with no `app/` directory should name a file. A file
outside the config's `files` globs is a legitimate `FAIL`: it reports
`0/4 rules at error`, which is the answer to "why is this file silent?".

Both argument forms work: `bun lint:ui --doctor` and `bun run lint:ui -- --doctor`.

## Editor and CI

Any ESLint integration picks the rules up from `eslint.config.mjs`; there is
nothing else to install or configure. The one catch is resolution: the editor's
ESLint server loads the plugin from `node_modules`, so after a fresh clone or a
pull that adds the dependency, `bun install` has to run before the server can
load the config — and a server already running with the old state needs a
restart to notice.

In CI, `bun run lint` covers `app/` and `bun run verify` runs the gates in CI's
order, tests included. Neither runs the CLI: add `bun lint:ui` (or
`expo-ui-lint <paths>`) as its own step to hold `client/` and `shared/` to the
design system, and `bun lint:ui --staged` in a pre-commit hook for the same rules
on the way in.

## Settings

`settings["expo-ui"]`:

| Key | Default | Meaning |
|---|---|---|
| `uiSourceDir` | `"packages/ui/src"` | Where the design-system sources live. Read for tokens, palette, themes, the `FontVariant` union, and the component index. A relative path is searched for from the ESLint working directory upwards, then from the linted file's directory upwards; an absolute path is used as written. |
| `manifestPath` | — | A `design-system.json` to read instead of any sources. Resolved like `uiSourceDir` but accepting a file. Set it to pin a checked-in manifest, or one that is not the installed package's. |
| `componentImports` | `["^@mrmeg/expo-ui(/|$)"]` | Regexes matched against an import source to decide whether a JSX element is a design-system component. |

Those three keys are the whole surface. There is a fourth value in play,
`uiSourceLabel` — how the messages spell the design system when they point at
`constants/colors.ts` or `components/Button.tsx` — but it is **derived**, not
configured: the source directory relative to the ESLint working directory
(falling back to `packages/ui/src` when the sources sit outside it), or the
package name a manifest says shipped it. Setting it does nothing.

Where the facts come from is decided per lint run, in the order a project is
most likely to mean:

1. `manifestPath`, if set. An explicit answer, right or wrong: a typo is
   reported rather than quietly falling through to some other design system.
2. `uiSourceDir`, if it resolves to a directory that exists **and** the
   `package.json` beside it names `@mrmeg/expo-ui`. Sources beat any manifest —
   they are what the manifest is generated from. A directory that is some other
   package's (a consumer's own `packages/ui/src` at the default path) is passed
   over; `--doctor` prints an `ok   skipped sources at …` line naming its
   package, and the not-found message names it too. The upward search keeps
   going past it, so `@mrmeg/expo-ui` sources further up still win.
3. `@mrmeg/expo-ui/design-system.json`, resolved with `require.resolve` from the
   linted file's directory first and then the ESLint working directory, so the
   nearest installed copy wins the way Node itself would resolve the import.
4. Nothing — reported once per file, per rule.

The upward search is what makes a relative `uiSourceDir` work from anywhere:
`bun x eslint` in `app/`, an editor whose working directory is a workspace
folder, or a pre-commit hook that runs from a subdirectory. Resolving only
against the working directory would have found nothing in all three, and
"nothing" is silent — every rule would pass every file.

So when step 4 is reached, each rule reports once per file, on the `Program`
node:

```
Design-system facts were not found: no sources at `/repo/packages/ui/src` and no
manifest resolvable as `@mrmeg/expo-ui/design-system.json`. Install an
@mrmeg/expo-ui release that ships the manifest, or set
`settings["expo-ui"].uiSourceDir` or `settings["expo-ui"].manifestPath`.
```

A manifest that was named but could not be read says which manifest and why,
because the project already said where the facts are:

```
Design-system manifest could not be read at `/repo/design-system.json`:
schemaVersion 2 is not supported (this plugin reads 1).
```

Those are the only messages about configuration in the plugin, and the one case
where the code at the call site is not what is wrong.

A JSX element counts as a design-system component when the identifier at the
root of its name resolves to an import whose source matches `componentImports`.
The name used in messages is the **imported** name, so `import { Button as Btn }`
still reports `<Button>`, and compound members are spelled `Button.Text`.

Reading the design system is best-effort and cached per directory, keyed on the
mtimes of the files it read. Those mtimes are re-checked at most every two
seconds — a full lint run asks four rules times every file for the same
directory, and the design system changes between runs, not during one. If a file
is missing or unparseable, the facts degrade to "unknown": the rules keep working
with less specific advice, and `no-arbitrary-values` goes silent rather than
reporting a scale it cannot name. Styles that cannot be resolved to concrete keys
are skipped for the same reason — a false positive costs more than a miss.

## Style contracts

`no-restyle` decides each resolved style key from its category:

| Category | Keys |
|---|---|
| `layout` | `margin*`, `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `width`, `minWidth`, `maxWidth`, `position`, `top`/`right`/`bottom`/`left`/`inset`, `zIndex`, `display`, `overflow`, `transform`, `textAlign` |
| `arrangement` | `flexDirection`, `flexWrap`, `alignItems`, `justifyContent`, `alignContent` |
| `spacing` | `padding*`, `gap`, `rowGap`, `columnGap`, `height`, `minHeight`, `maxHeight` |
| `color` | `backgroundColor`, `color`, `borderColor` and its sides, `shadowColor`, `tintColor`, `textDecorationColor`, `textShadowColor`, `overlayColor` |
| `typography` | `fontFamily`, `fontSize`, `fontWeight`, `fontStyle`, `lineHeight`, `letterSpacing`, `textTransform`, `textDecorationLine`, `textDecorationStyle`, `textAlignVertical`, `includeFontPadding` |
| `shape` | `borderRadius` and its corners, `borderWidth` and its sides, `borderStyle`, `shadowOffset`/`shadowOpacity`/`shadowRadius`, `boxShadow`, `elevation`, `opacity` |

The base policy is "you may place and space a component, you may not restyle
it": `layout`, `arrangement`, and `spacing` are allowed; `color`, `typography`,
and `shape` are not. A component whose props declare `size` owns its internal
spacing and arrangement too, so those close as well — put margin on it, or
padding on a parent, for space around it.

Text components are the one place where that reasoning needs care. They declare
`size`, so their spacing closes with everything else, but the type scale is not
the fix for a padding override — their spacing message says so and never names
`size`.

Contracts refine that per component:

```js
{
  "expo-ui/no-restyle": ["error", {
    contracts: [
      { pattern: "^Card$", prop: "^style$", allow: ["shape"] },
      { pattern: "^Metric", deny: ["fontSize"], message: "`\"{{key}}\"` is not allowed on `<{{component}}>`: use `size`." },
    ],
  }],
}
```

- `pattern` (required) — regex on the component name, e.g. `^BottomSheet(?:\.|$)`.
- `prop` — regex on the attribute name; omit to match every `style` / `*Style` prop.
- `allow` / `deny` — category names or exact style keys. An exact key beats a category.
- `message` — overrides the generated diagnostic. Substituted: `{{component}}`,
  `{{key}}`, `{{category}}`, `{{prop}}` (the attribute the style was written
  on), `{{uiSource}}` (the design-system directory as the messages spell it),
  and two unions read from the design system — `{{sizes}}` (the component's
  `size` values) and `{{fontVariants}}` (the `FontVariant` families). A union
  placeholder expands **with its own parentheses** — ` (sm | md | lg)` — and to
  nothing at all when the union cannot be resolved, so the sentence still reads
  either way.

Later entries win, and rule options are **appended** to the shipped defaults, so
a project adds a case without restating the design system. The defaults are:

| Components | Contract |
|---|---|
| Text: `StyledText` and its semantic aliases, `Button.Text`, `CardTitle`, `CardDescription`, `ItemTitle`, `ItemDescription`, `Label` | allow `color` (the value is still policed by `no-raw-colors`); deny `spacing` and `arrangement` with a message that does not name `size` |
| Those same components minus `Label` — everything whose props are `StyledText`'s `TextProps` | deny `typography`, naming `size`, `semantic`, `fontWeight`, `align`, and `variant` |
| `Label` | deny `typography`, naming its own `size` union — it pairs with a control and takes none of the other text props |
| Text, keys `fontStyle` / `textDecorationLine` / `textDecorationStyle` | deny, naming `StyledText.tsx` — there is no italic or text-decoration prop to point at, so the message does not pretend `size` or `fontWeight` would do it |
| `AnimatedView`, `KeyboardAvoidingView`, `DismissKeyboard`, `MaxWidthContainer`, `Skeleton` | allow everything — they exist to carry another component's styles |
| `BottomSheet.*`, prop `backgroundStyle` | allow `color` — the documented transparent-sheet path |
| `BottomSheet.Content`, prop `style` | allow `color` — the RN content column paints its own card fill, and `LLM_USAGE.md` clears it here so custom chrome shows through |
| `Button`, props `pressedStyle` / `disabledStyle` | allow `color` and `shape` — a pressed fill or a faded border is what the prop is for; typography stays denied |
| `Button`, props `textStyle` / `pressedTextStyle` / `disabledTextStyle` | allow `color`; deny `typography` with a message that names `Button.Text`, which takes `StyledText`'s props |
| `TextInput`, prop `focusedStyle` | allow `color` and `shape` — the focus treatment is the reason the prop exists |

`ItemMedia` is not on that list: it is the icon tile, not text, so it keeps the
base policy.

## Messages

`no-restyle` has three message shapes. Text typography, where the props are the
whole answer:

```
`"fontSize"` is not allowed on `<StyledText>`: StyledText owns its typography.
Use `size`, `semantic`, `fontWeight`, or `align`; `variant` picks the font
family (sansSerif | serif | mono).
```

Text spacing, where no prop is the answer:

```
`"paddingHorizontal"` is not allowed on `<SansSerifBoldText>`:
SansSerifBoldText owns its spacing. Put margin on it or padding on a parent for
space around it.
```

And the generated shape for everything else, which names the variant or size the
component does have and then the file a new one would go in:

```
`"backgroundColor"` is not allowed on `<Button>`: Button owns its color. Use
`preset`: default | outline | ghost | link | destructive | secondary. Add a
preset in `packages/ui/src/components/Button.tsx` only if the design explicitly
calls for a treatment none of them provides.

`"paddingHorizontal"` is not allowed on `<Button>`: Button owns its spacing.
Use `size`: sm | md | lg, or put margin on it or padding on a parent for space
around it.
```

Where no prop can produce the value, the message says so and names the file
instead of listing props that cannot help:

```
`"fontStyle"` is not allowed on `<StyledText>`: StyledText owns its typography
and has no italic prop. Add one in `packages/ui/src/components/StyledText.tsx`
only if the design explicitly calls for it.

`"fontWeight"` is not allowed in `textStyle` on `<Button>`: Button.Text owns
its typography. Render `<Button.Text size=… fontWeight=…>` as the child instead
of `textStyle`.
```

Every union in those messages is read out of the design system at lint time, so
a renamed preset or a fourth font family shows up in the diagnostic without a
plugin change.

The file paths in them follow the origin. Reading sources, a message names
`packages/ui/src/components/Button.tsx` — the file to open. Reading a manifest,
it names `@mrmeg/expo-ui/components/Button.tsx`: the manifest records the package
that shipped it, and in a consumer that import path is the useful address, since
there is no such file in the project to open. Same template, one substituted
label.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Every ESLint run — `bun run lint`, the CLI, the editor — dies with `ERR_MODULE_NOT_FOUND` loading `eslint.config.mjs` | `node_modules/@mrmeg/eslint-plugin-expo-ui` does not exist yet, so the config's import of the plugin cannot resolve | `bun install`, which creates the workspace symlink |
| The rules are silent everywhere, no errors of any kind | The config block does not govern the file, or the plugin is not loaded | `bun lint:ui --doctor <the file>`: it prints the rules and severities computed for that exact path. `0/4 rules at error` means the `files` globs, not the rules |
| Every file reports "Design-system facts were not found" | Neither step of the resolution order landed: no directory at `uiSourceDir`, and no `@mrmeg/expo-ui/design-system.json` in `node_modules` | In this repo, point `settings["expo-ui"].uiSourceDir` at the real sources. In a consumer, install `@mrmeg/expo-ui`, or set `manifestPath`. `--doctor` prints what it looked for |
| Every file reports "Design-system manifest could not be read at …" | The manifest that was found is not usable — no file at a configured `manifestPath`, invalid JSON, or a `schemaVersion` this plugin does not read | The message ends with the reason. A newer `schemaVersion` means the plugin is older than the design system: upgrade `@mrmeg/eslint-plugin-expo-ui` |
| `--doctor` prints `skipped sources at …/packages/ui/src: they belong to @acme/ui`, or the not-found message says the sources are another package's | The project has a `packages/ui` of its own at the default `uiSourceDir` | Expected: those are not the design system, so the rules use the installed `@mrmeg/expo-ui` manifest. Install `@mrmeg/expo-ui` if the not-found message fires |
| A consumer reports "Design-system facts were not found" although `@mrmeg/expo-ui` is installed | The installed release predates the manifest (0.24.0 or earlier), so its `exports` has no `./design-system.json` to resolve | Upgrade `@mrmeg/expo-ui` to a release that ships it; `--doctor` names the version it read the manifest from |
| `bun run lint` shows the old message text after you edited a rule or renamed a token | The `expo lint` result cache is keyed on the file and the config, not on plugin rule bodies or `packages/ui/src` | `bun run lint --no-cache`, or `bun lint:ui --clear-cache` once. `bun lint:ui` never reads that cache |
| `--changed` prints `no changed .ts/.tsx files` though you just edited files | The files you touched are outside the config's `files` globs — tests, `packages/**`, non-TypeScript files | Expected. Lint them by path if you want the config's other rules, or widen the globs if the design system really should govern them |
| A raw color in `client/` passes `bun run lint` | `expo lint` lints `app/` only | `bun lint:ui`, which covers `app`, `client`, and `shared` |
| The editor shows nothing after pulling a branch that adds the plugin | The ESLint server loaded before `bun install` created the symlink, and cached the failure | `bun install`, then restart the ESLint server |

## Extending

- **A new wrapped primitive.** A `react-native` component is picked up from
  the design system: export a component of the same name from
  `packages/ui/src/components` and `no-raw-primitives` enforces it, in this repo
  and in the manifest the next release ships. A component React Native does not
  have yet goes into `REACT_NATIVE_COMPONENTS`, and an `@expo/ui` surface into
  `EXPO_UI_MODULES` (or `EXPO_UI_SPECIFIERS`), in
  [`rules/no-raw-primitives.js`](rules/no-raw-primitives.js).
- **A new style helper.** Add it to the tables at the top of
  [`lib/stylePositions.js`](lib/stylePositions.js) — `MEMO_HOOKS`,
  `STYLE_WORKLETS`, `STYLE_SHEET_STYLE_ARGUMENTS` — so the objects it takes or
  returns count as styles.
- **A new style key.** Add it to the right table in
  [`lib/categories.js`](lib/categories.js). A key in no table is ignored, which
  is the safe default.
- **A new text component.** Add it to `TEXT_PROPS_COMPONENTS` in
  [`lib/contracts.js`](lib/contracts.js) when it forwards `StyledText`'s
  `TextProps` — that is what earns it the text typography and spacing messages.
- **A component that legitimately takes an override.** Add a contract to
  `DEFAULT_CONTRACTS` in `lib/contracts.js` if it is a property of the design
  system, or to the rule options if it is a property of one app.
- **A new token group.** [`lib/source.js`](lib/source.js) groups `spacing`
  members by key prefix (`radius*`, `icon*`, everything else). A new prefix needs
  a group there and a scale key set in `lib/categories.js`.

## Tests

```sh
bun x jest packages/lint
```

[`__tests__/source.test.ts`](__tests__/source.test.ts) asserts against the real
`packages/ui/src`, so it fails when a token, variant, or font family the messages
quote is renamed, and it pins the upward `uiSourceDir` search from a
subdirectory. [`__tests__/manifest.test.ts`](__tests__/manifest.test.ts) is the
manifest half: it serializes the real design system, reads it back, and asserts
the two loaders agree fact for fact, then lints through a manifest to pin the
package-labelled message text, the auto-resolution of an installed
`@mrmeg/expo-ui`, and the rejection of an unsupported `schemaVersion`.
[`__tests__/settings.test.ts`](__tests__/settings.test.ts) builds projects whose
`packages/ui` is `@mrmeg/expo-ui`, or some other package with or without an
installed manifest, and pins which one the rules read. The rule suites pin the
exact text of the messages the design system documents, and the color and
spacing suites pin both sides of [what counts as a style](#what-counts-as-a-style):
chart data and config objects stay silent, every style position reports;
[`__tests__/missing-design-system.test.ts`](__tests__/missing-design-system.test.ts)
pins the one-per-file not-found report for each of the four rules — through
ESLint's `Linter` with a working directory outside this repo, since anywhere
inside it the built manifest resolves and there is a design system to read — and
[`__tests__/index.test.ts`](__tests__/index.test.ts) pins the shape of
`configs.recommended`.
[`__tests__/cli.test.ts`](__tests__/cli.test.ts) spawns [`bin/cli.js`](bin/cli.js)
in a real Node process and pins `--doctor`, `--doctor <file>`, `--rules`,
`--help`, and the exit code for an unknown flag.

After editing a message, `bun run lint` replays the old text: `expo lint` caches
results in `.expo/cache/eslint/` and the cache key covers the linted file and
the config, not a plugin's rule bodies — and not `packages/ui/src` either, so a
renamed token or preset leaves the old union in the cached diagnostic too. Run
`bun run lint --no-cache` (`expo lint` accepts the flag and passes
`--cache=false` to ESLint), or `bun lint:ui --clear-cache`, after editing a
message, a rule, or the design system. `bun lint:ui` never reads that cache at
all.

## Release

The plugin has the same release path as the other two workspace packages, driven
by [`scripts/release-package.mjs`](../../scripts/release-package.mjs):

```sh
bun run pkg lint typecheck        # tsc -p packages/lint/tsconfig.json
bun run pkg lint test             # jest packages/lint
bun run pkg lint build            # require("./index.js") — the load smoke
bun run pkg lint pack             # bun pm pack --dry-run
bun run pkg lint consumer-smoke   # both tarballs in a temp project
bun run pkg lint release -- --patch --publish
```

`pkg lint release` bumps the version, updates `bun.lock`, runs
`packages:peer-check` and the typecheck, test, and build gates in order, packs
one tarball, runs the consumer smoke against it, then publishes that tarball
with `npm publish <tarball> --access public`. Without `--publish` it is a dry
run. (The unrelated `bun run lint` and `bun lint:ui` scripts run ESLint; they
are not part of this.)

Two notes on the gates. `pkg lint build` is a load smoke, not a build — the package
ships the `.js` it is written in. `pkg lint typecheck` runs with `checkJs: false`
([`tsconfig.json`](tsconfig.json)): the rules and AST helpers annotate ESTree
nodes as `object` and index string keys into literal maps, so checking the JSDoc
reports dozens of type errors that are not defects; the gate is a
parse-and-resolve pass over the shipped files instead. The repo's own `bun run typecheck`
covers `packages/lint/__tests__/*.ts` as TypeScript.

`pkg lint consumer-smoke` is the interesting one: it packs *both* this package and
`packages/ui`, installs them into a throwaway project with no design-system
sources, and asserts the four rules fire with the right counts, that a message
names `@mrmeg/expo-ui/components/Button.tsx`, and that `--doctor` reports
`manifest @mrmeg/expo-ui@…`. That is the manifest path proven end to end from a
consumer's position.

[`.github/workflows/publish-packages.yml`](../../.github/workflows/publish-packages.yml)
runs the same release in CI for every workspace package, publishes the smoked
tarball with provenance, and tags `eslint-plugin-expo-ui-v<version>`. A push to
`main` never makes a package's first publish, so this one's first release is a
manual run (`package=lint`, `version=0.1.0`) and needs npm access configured — an
`NPM_TOKEN` secret with publish rights, since package-level trusted publishing
cannot be set up for a package npm does not have yet. After that, configure
trusted publishing with workflow filename `publish-packages.yml`; later version
bumps on `main` publish on push.
