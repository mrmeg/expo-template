# Changelog

All notable changes to `@mrmeg/expo-metro` are documented here. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0]

### Added

- **`withBundleOptimizations(config, options)`**, the Metro bundle optimizations
  the template and the apps built from it kept copying:
  - `treeShaking` (default `true`) sets `EXPO_UNSTABLE_TREE_SHAKING` and
    `EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH` to `"1"` when unset, so `expo export`,
    `export:embed` and `eas update` tree-shake with no env. A `0` already in
    the environment opts out; `false` leaves both flags alone.
  - `zodLocaleStub` (default `true`) resolves zod's own `../locales/index.{js,cjs}`
    import to an empty module in client bundles, dropping every language pack
    (~280 kB raw on web) that `export * as locales` keeps.
- The resolver wraps whatever `config.resolver.resolveRequest` is when it runs
  and falls back to `context.resolveRequest`, so it composes with the Sentry and
  Reanimated wrappers in either order. It returns a new config and keeps every
  other key.
- The pure predicates `isZodLocaleBarrelImport`, `isServerEnvironment` and
  `packageOfModulePath`, and the `TREE_SHAKING_ENV` names, for apps that compose
  their own resolver.
- `index.d.ts`, an `exports` map, an optional `expo` peer dependency
  (`>=52.0.0`), `engines.node >= 18.18`, and `LICENSE` (MIT). No dependencies.
