# Changelog

All notable changes to `@mrmeg/eslint-plugin-expo-ui` are documented here. This
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
