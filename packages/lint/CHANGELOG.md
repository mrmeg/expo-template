# Changelog

All notable changes to `@mrmeg/eslint-plugin-expo-ui` are documented here. This
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Changes on top of the 0.1.0 notes below, which have not been published yet.

### Changed

- **`no-raw-colors` and `no-arbitrary-values` police styles only.** They used
  to check every object literal with a `color` or `padding` key, so chart
  series, map themes, and config objects drew errors. A literal is now checked
  only in a style position: a `style` / `*Style` prop on any element, a
  `*Style` property (navigation options), a named style of `StyleSheet.create`
  or a `createThemedStyles` factory, `StyleSheet.flatten` / `compose`
  arguments, a `useAnimatedStyle` worklet's result, or a value typed as a style
  (`ViewStyle`, `TextStyle`, `StyleProp<…>`, …) — directly or through arrays,
  conditionals, variables, sheet members, `useMemo`, Pressable style functions,
  and local helpers. A style that is a map of states
  (`{ default: {...}, selected: {...} }`) has each state checked.
- **`no-raw-primitives` catches React Native components the design system
  wraps**, not only `Text`: any `react-native` component the design system
  exports a same-named component for — `TextInput`, `Switch`, `Button`,
  `KeyboardAvoidingView`, `StatusBar` today. The list is read from the sources
  or manifest in use, so a new wrapper is enforced the release it ships. APIs
  (`Alert`, `Keyboard`, …) are not primitives and stay allowed.
- **Local sources count only when they are `@mrmeg/expo-ui`'s.** A
  `uiSourceDir` (default `packages/ui/src`) is read only if the `package.json`
  beside it names `@mrmeg/expo-ui`; a project's own `packages/ui` is passed over
  for the installed manifest, and `--doctor` names what it skipped. A vendored
  copy has to keep that `package.json`.

### Added

- `@mrmeg/expo-ui` as an optional peer dependency (`>=0.25.0 <1.0.0`, the
  releases that ship `design-system.json`), `engines.node >= 18.18`, an
  `exports` map, `index.d.ts` for `eslint.config.ts`, and `LICENSE` (MIT).

## [0.1.0]

### Added

- **Four design-system rules**, exposed together as
  `plugin.configs.recommended`: `no-raw-colors` (literal colors and gradients
  instead of `theme.colors` or `palette`), `no-arbitrary-values` (off-scale
  spacing, radii and icon sizes), `no-restyle` (styling a design-system
  component's contract props instead of using its presets and sizes), and
  `no-raw-primitives` (React Native and `@expo/ui` primitives where a
  `@mrmeg/expo-ui` component exists).
- **`expo-ui-lint` CLI** (`bin/cli.js`): lints the paths the design system
  governs and keeps only `expo-ui/*` messages, with `--changed`/`--staged` for a
  branch's files, `--rules` for what each rule catches, and `--doctor` to check
  the plugin's own wiring — plugin shape, flat-config settings, the design system
  it resolved, and a smoke lint that must report a known set of errors.
- **Design-system facts from a manifest.** The rules read `packages/ui/src` when
  the sources are on disk and `@mrmeg/expo-ui/design-system.json` from an
  installed release otherwise, so messages quote the tokens, presets and sizes of
  the design system in use. `settings["expo-ui"].manifestPath` points at a
  specific manifest.
