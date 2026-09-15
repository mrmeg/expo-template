# @mrmeg/eslint-plugin-expo-ui

The design-system rules of [`@mrmeg/expo-ui`](../ui), written as ESLint
diagnostics instead of prose. `packages/ui/LLM_USAGE.md` explains the system to
a reader; this plugin says the same things at the call site, where the mistake
is being made.

Every message names the replacement — the token, the variant, the component —
and never suggests changing the lint configuration or disabling a rule. When a
new token or preset really is the answer, the message names the design-system
file it belongs in, guarded by "only if the design explicitly calls for it".

The plugin is private to this repo and unbuilt: CommonJS `.js` with JSDoc
types, so it loads in whatever Node runs ESLint.

## Rules

| Rule | What it catches |
|---|---|
| `expo-ui/no-raw-colors` | Hex, `rgb()`/`rgba()`/`hsl()`/`hsla()`, or CSS color keywords in a color style property or a color-valued prop. `"transparent"` is allowed. |
| `expo-ui/no-arbitrary-values` | Numeric literals off the `spacing` and radius scales in `padding*`, `margin*`, `gap`, `rowGap`, `columnGap`, and `border*Radius`. `0` is allowed. |
| `expo-ui/no-restyle` | `style` / `*Style` props on design-system components that override appearance the component owns. |
| `expo-ui/no-raw-primitives` | Importing a primitive the design system already wraps: `Text` from `react-native`, anything from `@rn-primitives/*`, and the wrapped `@expo/ui` surfaces. A type-only import (`import type { Text }`, `import { type Text as T }`) is ignored — it renders nothing, so it cannot render unthemed. |

`no-raw-colors` and `no-arbitrary-values` read the real design system to build
their advice: the nearest palette entry by Euclidean RGB distance, the light-
theme tokens that resolve to it, and the two `spacing` tokens that bracket the
number that was written. A negative offset is bracketed by negated tokens:
`marginTop: -3` names `-spacing.xxs` (-2) and `-spacing.xs` (-4), because a
positive token there would flip the offset.

Out of scope by design: `fontSize`, `lineHeight`, `width`, `height`,
`borderWidth`, and `Icon`'s numeric `size` prop are not on the spacing scale.
`Pressable`, `TouchableOpacity`, `View`, and `react-native`'s `TextInput` are
not wrapped, and `Pressable` is the sanctioned base for a custom interactive
surface.

### `@expo/ui` and `@rn-primitives` are not design-system components

They are the layers underneath it. `@rn-primitives/*` is headless behaviour and
`@expo/ui` is platform-native UI; both arrive without the theme. Where
`packages/ui` exports a wrapper (`BottomSheet`, `Slider`, `SegmentedControl`,
`TextInput`), that wrapper is the component — importing the layer underneath
skips the font, the colors, and the shared props. Where it exports no wrapper
(`Host`, `Picker`, `@expo/ui/swift-ui`), the import is fine.

## Usage

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

## Settings

`settings["expo-ui"]`:

| Key | Default | Meaning |
|---|---|---|
| `uiSourceDir` | `"packages/ui/src"` | Where the design-system sources live. Read for tokens, palette, themes, the `FontVariant` union, and the component index. A relative path is searched for from the ESLint working directory upwards, then from the linted file's directory upwards; an absolute path is used as written. |
| `componentImports` | `["^@mrmeg/expo-ui(/|$)"]` | Regexes matched against an import source to decide whether a JSX element is a design-system component. |

Those two keys are the whole surface. There is a third value in play,
`uiSourceLabel` — how the messages spell the design-system directory when they
point at `constants/colors.ts` or `components/Button.tsx` — but it is **derived**
from `uiSourceDir`, not configured: it is that path relative to the ESLint
working directory, falling back to `packages/ui/src` when the sources sit
outside it. Setting it does nothing.

The upward search is what makes a relative `uiSourceDir` work from anywhere:
`bun x eslint` in `app/`, an editor whose working directory is a workspace
folder, or a pre-commit hook that runs from a subdirectory. Resolving only
against the working directory would have found nothing in all three, and
"nothing" is silent — every rule would pass every file.

So when the sources cannot be read at all, each rule reports once per file, on
the `Program` node:

```
Design-system sources were not found at `/repo/packages/ui/src`; the expo-ui
rules need `packages/ui/src` (or `settings["expo-ui"].uiSourceDir`) to point at
the @mrmeg/expo-ui sources.
```

That is the one message about configuration in the plugin, and it is the one
case where the code at the call site is not what is wrong.

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

Every union in those messages is read out of `packages/ui/src` at lint time, so
a renamed preset or a fourth font family shows up in the diagnostic without a
plugin change.

## Extending

- **A new wrapped primitive.** Add the module to `EXPO_UI_MODULES` (or the
  specifier to `EXPO_UI_SPECIFIERS`) in `rules/no-raw-primitives.js`.
- **A new style key.** Add it to the right table in `lib/categories.js`. A key
  in no table is ignored, which is the safe default.
- **A new text component.** Add it to `TEXT_PROPS_COMPONENTS` in
  `lib/contracts.js` when it forwards `StyledText`'s `TextProps` — that is what
  earns it the text typography and spacing messages.
- **A component that legitimately takes an override.** Add a contract to
  `DEFAULT_CONTRACTS` in `lib/contracts.js` if it is a property of the design
  system, or to the rule options if it is a property of one app.
- **A new token group.** `lib/source.js` groups `spacing` members by key prefix
  (`radius*`, `icon*`, everything else). A new prefix needs a group there and a
  scale key set in `lib/categories.js`.

## Tests

```sh
bun x jest packages/lint
```

`__tests__/source.test.ts` asserts against the real `packages/ui/src`, so it
fails when a token, variant, or font family the messages quote is renamed, and
it pins the upward `uiSourceDir` search from a subdirectory. The rule suites pin
the exact text of the messages the design system documents;
`__tests__/missing-design-system.test.ts` pins the one-per-file not-found report
for each of the four rules, and `__tests__/index.test.ts` pins the shape of
`configs.recommended`.

After editing a message, `bun run lint` replays the old text: `expo lint` caches
results in `.expo/cache/eslint/` and the cache key covers the linted file and
the config, not a plugin's rule bodies — and not `packages/ui/src` either, so a
renamed token or preset leaves the old union in the cached diagnostic too. Run
`bun run lint --no-cache` (`expo lint` forwards the flag to ESLint), or delete
`.expo/cache/eslint/`, after editing a message, a rule, or the design system.
