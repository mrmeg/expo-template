# Changelog

All notable changes to `@mrmeg/expo-ui` are documented here. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.1]

### Fixed

- Fix TextInput rounded-corner fill leak on New Architecture. On Fabric, the
  `outline`/`filled` variants stroked a rounded border but painted the
  background fill as an un-clipped rect, so the fill's square corners poked past
  the rounded stroke (most visible on dark themes and the `filled` variant). The
  fill, border, and radius now live on the RN wrapper `View` with
  `overflow: "hidden"`, and the native `@expo/ui` host renders transparent inside
  that clipped rounded surface. The `underlined` variant (bottom border only),
  error state, `forceLight` mode, and the secure-entry eye toggle are unchanged.

## [0.10.0]

### Added

- Drawer collapsible rail mode (`variant="rail"`, `Drawer.ToggleCollapse`).
- Theme-aware Icon color resolution.
