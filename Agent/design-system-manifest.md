---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/86
---

# Design-system manifest and a publishable lint plugin

## Goal

Let a project that installs `@mrmeg/expo-ui` from npm run `@mrmeg/eslint-plugin-expo-ui`. Today the plugin parses the design system's TypeScript sources at lint time and the published UI tarball ships `dist` only, so the rules only work inside this repo. The UI build will emit a manifest of the facts the rules need into `dist/design-system.json`, the plugin will load that manifest when the sources are not on disk, and the plugin gets the same release path as the other two packages so it can be published. Nothing is published by this work.

## Context

Verified on `dev` at `1186cef`.

- `packages/lint/lib/source.js` `loadDesignSystem(uiSourceDir)` returns `{ loaded, tokens: { spacing, radius, icon }, palette, themeTokens, lightTheme, darkTheme, fontVariants, components }`. Each token group is `{ entries: [{ name, value }], values: number[], nameByValue: Map }`; `components` is a `Map<string, { name, file, hasSize, variantProp, variantValues, sizeValues }>` where `file` is a bare file name inside `components/` (compound members such as `Button.Text` carry the root's file). A module-level cache keys on `uiSourceDir` with an mtime signature re-checked at most every 2000 ms. `emptyDesignSystem()` has `loaded: false` and empty groups.
- All four rules call `readSettings(context)` then `loadDesignSystem(settings.uiSourceDir)` and register `Program: reportMissingDesignSystem(context, design, settings.uiSourceDir)`, which reports once per file when `!design.loaded` using `designSystemNotFoundMessage` (`lib/source.js:192-197`).
- `packages/lint/lib/settings.js` `readSettings` returns `{ uiSourceDir, uiSourceLabel, componentImports }`. `resolveUiSourceDir(value, startDirs)` accepts only an existing directory, walking upward from `context.cwd` then the linted file's directory. `uiSourceLabel` is `uiSourceDir` relative to cwd and collapses to the literal `packages/ui/src` when the directory is outside cwd (`settings.js:116-121`).
- Messages embed the label plus a hardcoded or per-component file: `rules/no-raw-colors.js:60` (`constants/colors.ts`), `rules/no-arbitrary-values.js:128` (`constants/spacing.ts`), `lib/contracts.js:118,125` (`components/StyledText.tsx`), `lib/contracts.js:325,344` (`components/${info.file}`). `{{uiSource}}` is substituted at `lib/contracts.js:309-310`.
- `packages/lint/bin/cli.js` `--doctor` step 3 fails before loading when `resolveUiSourceDir` is not a directory (`cli.js:406-408`), then reads `tokens.spacing.entries.length`, `Object.keys(palette).length`, `themeTokens.length`, `fontVariants.length`, `components.size`, `loaded`.
- `packages/lint/package.json`: `private: true`, version `0.1.0`, `bin`, `files: [index.js, bin, lib, rules, README.md]`, peers `eslint >=9.30` and `@typescript-eslint/parser >=8`, **no `scripts` block**, no `CHANGELOG.md`.
- `packages/lint/__tests__/source.test.ts` pins facts of the real `packages/ui/src` (spacing 12→`smd`, 16→`md`; radius 12→`radiusMd`; icon values `[12,16,24,32,48]`; `palette.red500 === "#EF4444"`; `fontVariants` `["sansSerif","serif","mono"]`; `Button` file/preset/sizes; `Badge` variant; missing dir → `loaded false`). `missing-design-system.test.ts` uses `settings: { "expo-ui": { uiSourceDir: "/nonexistent/dir" } }` and pins the not-found text.
- `packages/ui/package.json`: `build` is `rm -rf dist && tsc -p tsconfig.build.json && node ../../scripts/fix-package-esm.mjs ui && bun run check:forbidden-imports`; `files` includes `dist`; `exports` is an object map with `types`/`default` entries and no JSON subpath. `tsconfig.build.json` emits `src` → `dist` and emits no JSON. `fix-package-esm.mjs` rewrites `.js` only. `@typescript-eslint/parser` is a root devDependency and resolves from `packages/ui` through the hoisted `node_modules`.
- `scripts/run-package-script.mjs` has `PACKAGES = { ui, media }` and tasks `typecheck|test|build` (`bun run --cwd <dir> <task>`), `pack` (`publish:dry-run`), `consumer-smoke`, `release`. Root `ui:*`/`media:*` scripts are one-line aliases. `scripts/release-package.mjs` has `PACKAGES` with `exampleVersion` and `GATES = ["typecheck","test","build","pack","consumer-smoke"]`, run as `bun run <slug>:<gate>` after `bun install --lockfile-only` and `packages:peer-check`; it bumps the version, publishes with `npm publish --access public`, touches no changelog or tag. `--allow-dirty` skips the clean-tree gate.
- `scripts/check-package-consumer.mjs`: per-package entries `{ dir, packageName, exportChecks, requiredDocs, fixtures }`; it runs the package `build`, `bun pm pack`, installs the tarball into a temp fixture with `bun install`, then steps `assert-surface` (every `exports` target and every `requiredDocs` path must exist under `node_modules/<name>`), `run`, `expo-export`. `assertInstalledPackageSurface` indexes `manifest.exports[check.key]`, so a package without an `exports` map must use `exportChecks: []`. `ui` has `requiredDocs: []`.
- `scripts/check-package-peer-compatibility.mjs` hardcodes `media` and `ui` and reads `<dir>/src`; `packages/lint` has no `src`. `scripts/check-readme-versions.mjs` checks four root-dependency claims only.
- `scripts/__tests__/packageToolingScripts.test.ts:133,144` assert the unknown-package error lists exactly `media, ui`; `scripts/__tests__/runPackageScript.test.ts:47,65-78,152-159` match aliases with `\b(ui|media):` and pin twelve aliases. Root `package.json` already has `lint` and `lint:ui` scripts.
- `.github/workflows/publish-ui.yml` triggers on push to `main` filtered to `packages/ui/package.json` and on `workflow_dispatch` (`version`, `ref`); steps: checkout, node 24, bun, `bun install --frozen-lockfile`, inline version bump, `npm view` availability gate, `bun install --lockfile-only`, `packages:peer-check`, `ui:typecheck`, `ui:test`, `ui:build`, `ui:pack`, `ui:consumer-smoke`, publish (`NPM_TOKEN` or OIDC), commit the bump. `publish-media.yml` additionally handles a first-ever publish (no npm page yet) and requires `NPM_TOKEN` for it.
- `jest.config.js` matches `**/__tests__/**/*.test.[jt]s?(x)` repo-wide; `bun run verify` runs `bun x jest --ci`.
- `packages/ui/CHANGELOG.md` uses `## [x.y.z]` headings with `### Added` / `### Fixed` bullets.

## Work

### 1. Manifest extraction (`packages/lint/lib/manifest.js`, new)

CommonJS, no new dependencies.

- `serializeDesignSystem(design, { packageName, version })` → plain JSON object:
  `{ schemaVersion: 1, package, version, tokens: { spacing: { entries }, radius: { entries }, icon: { entries } }, palette, themeTokens, lightTheme, darkTheme, fontVariants, components: [ { name, file, hasSize, variantProp, variantValues, sizeValues } ] }`. Store only `entries` per group; `values` and `nameByValue` are derived on load. Preserve extractor order. Throw if `!design.loaded`.
- `loadDesignSystemFromManifest(manifestPath)` → the same shape `loadDesignSystem` returns (`Map`s rehydrated, `loaded: true`), cached per path on the file's mtime with the same 2000 ms throttle. Reject `schemaVersion !== 1` and malformed JSON by returning `emptyDesignSystem()` with `origin.error` set to a one-line reason.
- Both loaders attach `origin` to the returned object: `{ kind: "source", path: uiSourceDir }` or `{ kind: "manifest", path, package, version }`. `emptyDesignSystem()` gets `origin: null`. Add `origin` to the JSDoc typedef.
- Export `MANIFEST_SCHEMA_VERSION = 1` and `DEFAULT_MANIFEST_SPECIFIER = "@mrmeg/expo-ui/design-system.json"`.

### 2. UI build emits the manifest

- `scripts/build-design-system-manifest.mjs` (new, ESM like its siblings): `node ../../scripts/build-design-system-manifest.mjs ui` from `packages/ui`, or `node scripts/build-design-system-manifest.mjs ui` from root. Resolve the package dir like `fix-package-esm.mjs` does, `createRequire` the CJS `packages/lint/lib/source.js` and `lib/manifest.js`, load `src`, serialize with the package's `name` and `version`, write `dist/design-system.json` with a trailing newline. Exit 1 with a clear message when `loaded` is false or any of `tokens.spacing.entries`, `palette`, `themeTokens`, `fontVariants`, `components` is empty.
- `packages/ui/package.json`: append `&& node ../../scripts/build-design-system-manifest.mjs ui` to `build` after `fix-package-esm`; add `"./design-system.json": { "default": "./dist/design-system.json" }` to `exports`, in the object form the other entries use, and confirm every script that iterates `exports` (`scripts/check-package-consumer.mjs`, `scripts/check-package-consumer-profile.mjs`, `scripts/fix-package-esm.mjs`, `scripts/check-ui-forbidden-imports.mjs`) tolerates an entry without `types`. `files` already covers `dist`. Because `assert-surface` checks every `exports` target, the manifest's presence in the tarball is asserted automatically once exported.
- `packages/ui/CHANGELOG.md`: add an `## [Unreleased]` section with `### Added` describing the manifest and its export. The next UI release must be a minor bump because it adds an export.

### 3. Plugin resolution order

In `packages/lint/lib/settings.js`, `readSettings` returns an additional `origin` and a `manifestPath` setting, and rules stop calling `loadDesignSystem(settings.uiSourceDir)` directly:

1. `settings["expo-ui"].manifestPath` (new, optional). Absolute as written; relative searched upward from `context.cwd` then the linted file's directory, accepting an existing file. If set but not found, origin is `{ kind: "manifest", path: <resolved>, missing: true }`.
2. Else `uiSourceDir` resolved as today to an existing directory → `{ kind: "source", path }`.
3. Else `require.resolve(DEFAULT_MANIFEST_SPECIFIER, { paths: [fileDir, cwd] })` → `{ kind: "manifest", path }`. The linted file's directory goes first so the nearest installed package wins, as Node itself would resolve it.
4. Else `{ kind: "none", uiSourceDir: <resolved attempt> }`.

- Expose the resolution as `resolveOrigin({ rawSettings, cwd, filename })` from `lib/settings.js`; `readSettings(context)` calls it, and the CLI doctor calls it with the config it computed for the sample file, so both follow the same rules.
- `lib/source.js` gains `loadDesignSystemFor(settings)` dispatching on `origin.kind`; all four rules call it, and `reportMissingDesignSystem(context, design, settings)` takes settings. The not-found text becomes, for `none`: ``Design-system facts were not found: no sources at `<uiSourceDir>` and no manifest resolvable as `@mrmeg/expo-ui/design-system.json`. Install an @mrmeg/expo-ui release that ships the manifest, or set `settings["expo-ui"].uiSourceDir` or `settings["expo-ui"].manifestPath`.`` For a set-but-missing or rejected manifest: ``Design-system manifest could not be read at `<path>`: <reason>.`` Cache settings as today.
- `uiSourceLabel` follows the origin: unchanged for `source`; for `manifest` it is the manifest's `package` value (`@mrmeg/expo-ui`), so existing templates render `` `@mrmeg/expo-ui/constants/colors.ts` `` and `` `@mrmeg/expo-ui/components/Button.tsx` `` with no template changes. Keep `uiSourceLabel` derived, not configurable.
- `bin/cli.js` `--doctor` step 3: drop the directory pre-check; report the origin and load through `loadDesignSystemFor`. Output shapes: `design system: sources at <dir> — <counts>` or `design system: manifest @mrmeg/expo-ui@<version> at <path> — <counts>`; `FAIL` with the not-found or rejection reason otherwise. Usage text and README describe the new line.

### 4. Tests (`packages/lint/__tests__`)

- `manifest.test.ts` (new): serialize the real `packages/ui/src` to a temp file and load it back; assert deep equality of every fact with `loadDesignSystem` (compare `Map`s as entries) and `schemaVersion === 1`; every `components[].file` is a bare file name. RuleTester cases with `settings: { "expo-ui": { uiSourceDir: "/nonexistent/dir", manifestPath: <temp file> } }`: one `no-restyle` `<Button style={{ backgroundColor: "#f00" }}>` case whose message contains `` `@mrmeg/expo-ui/components/Button.tsx` ``, one `no-raw-colors` case containing `` `@mrmeg/expo-ui/constants/colors.ts` ``, and one `no-arbitrary-values` case naming the bracketing tokens. Auto-resolution: build a temp dir with `node_modules/@mrmeg/expo-ui/package.json` (`exports` including `./design-system.json`) and `dist/design-system.json`, where that manifest is hand-built with a distinct fact set (for example `Button` with `variantProp: "preset"` and `variantValues: ["alpha", "beta"]`), lint a file inside that temp dir with `uiSourceDir: "/nonexistent/dir"` and no `manifestPath`, and assert the `no-restyle` message lists `alpha | beta` — proving the temp package was resolved rather than this repo's `node_modules/@mrmeg/expo-ui`, which may or may not hold a built manifest. Rejection: a manifest with `schemaVersion: 2` yields the "could not be read" report once per file.
- `missing-design-system.test.ts`: update the pinned text to the new `none` message.
- `cli.test.ts`: `--doctor` output still passes in-repo and contains `sources at`.
- `scripts/__tests__/runPackageScript.test.ts` and `packageToolingScripts.test.ts`: extend to the `lint` target and its six aliases; the alias regex must match only the six task names so `lint` and `lint:ui` stay excluded; the unknown-package error lists `lint, media, ui`.

### 5. Release path for the plugin

- `packages/lint/package.json`: `private: false`; add `scripts`: `"typecheck": "tsc --noEmit -p tsconfig.json"` backed by a new `packages/lint/tsconfig.json` (`allowJs`, `checkJs`, `noEmit`, `module: commonjs`, `target: es2022`, `skipLibCheck`, `types: ["node"]`, `include: ["index.js", "bin", "lib", "rules"]`); if `checkJs` surfaces JSDoc typing errors that are not real defects and cannot be fixed in a few lines, set `checkJs: false` so the gate is a parse-and-resolve pass, and say which in the README Release section. Do not use shell loops in package scripts. `"test": "jest --config ../../jest.config.js packages/lint --runInBand --watchman=false"`, `"build": "node -e \"require('./index.js')\""` (the package is unbuilt; this is the load smoke the gate list requires), `"publish:dry-run": "bun pm pack --dry-run"`. Do **not** declare `@mrmeg/expo-ui` as a peer: the consumer fixture installs a `0.24.0` tarball that already carries the manifest, and an unmet range would only add install noise. The README states the minimum UI version that ships the manifest, and the `none` not-found message covers an older install. Add `CHANGELOG.md` (`## [0.1.0]`, `### Added`: the four rules, the CLI, manifest loading) and list it in `files`. Add `repository`, `homepage`, and `keywords` (`eslint`, `eslintplugin`, `expo`, `react-native`, `design-system`) mirroring `packages/ui`'s fields. Run `bun install` and commit `bun.lock` if it changes.
- `scripts/run-package-script.mjs`: add `lint: { dir: "packages/lint", slug: "lint" }`. Root `package.json`: add `lint:typecheck`, `lint:test`, `lint:build`, `lint:pack`, `lint:consumer-smoke`, `lint:release` aliases next to `ui:*`; leave `lint` and `lint:ui` untouched.
- `scripts/release-package.mjs`: add `lint: { dir: "packages/lint", exampleVersion: "0.1.0" }`; update the usage comment to `<ui|media|lint>`.
- `scripts/check-package-consumer.mjs`:
  - `ui`: `requiredDocs: ["dist/design-system.json"]` and a `run` step `node -e` asserting the file parses, `schemaVersion === 1`, and `components.length > 0`.
  - `lint` (new): `exportChecks: []`, `requiredDocs: ["index.js", "bin/cli.js", "lib/manifest.js", "rules/no-restyle.js", "README.md", "CHANGELOG.md"]`. Its fixture also needs the UI tarball: extend the script so a fixture can request additional packed workspace packages (build and `bun pm pack` `packages/ui`, pass the path into `files()`), and install both. Fixture files: `package.json` (both tarballs plus auto-filled peers), `eslint.config.mjs` using `@typescript-eslint/parser` and `expoUi.configs.recommended` over `src/**/*.tsx` with `settings["expo-ui"].uiSourceDir: "/nonexistent/dir"`, `src/fixture.tsx` holding the doctor's smoke fixture (`import { Text } from "react-native"`, `import { Slider } from "@expo/ui/community/slider"`, `import { Button } from "@mrmeg/expo-ui"`, `<Button style={{ backgroundColor: "#f00", padding: 13 }} />`), and `runtime.cjs` that requires the plugin (asserts four rules), lints `src/fixture.tsx` with ESLint's Node API, asserts counts `no-raw-colors` 1, `no-arbitrary-values` 1, `no-restyle` 2, `no-raw-primitives` 2, and asserts one message contains `` `@mrmeg/expo-ui/components/Button.tsx` ``. Steps: `run node runtime.cjs`, then `run node node_modules/@mrmeg/eslint-plugin-expo-ui/bin/cli.js --doctor src/fixture.tsx` expecting exit 0 and stdout containing `manifest @mrmeg/expo-ui@`. The fixture's `package.json` must set `@mrmeg/expo-ui` to the packed UI tarball path explicitly, because the auto-derived value from the root manifest is `workspace:*`. The UI tarball's peers (`react-native`, `expo`, …) are not needed for the manifest to load; pass `--omit=peer` through the fixture's `install` if the local `bun install --help` lists it, otherwise accept the peer install. `react-native` and `@expo/ui` appear only as import specifiers; `no-raw-primitives` reports on the specifier and the flat config has no resolver rule, so they need not be installed. Enable JSX in the fixture config (`languageOptions.parserOptions.ecmaFeatures.jsx: true`) as `eslint.config.mjs` here does.
- Do not register `lint` in `check-package-peer-compatibility.mjs` or `package-compatibility-profiles.mjs`; it has no runtime dependencies and no `src`.
- `.github/workflows/publish-lint.yml` (new): copy `publish-media.yml` (the first-publish-capable variant), substitute `packages/lint/package.json`, `@mrmeg/eslint-plugin-expo-ui`, and the `lint:*` scripts. **`workflow_dispatch` only** for now, with a header comment saying the `push` trigger on `packages/lint/package.json` is added after the first release exists on npm. Do not run it.

### 6. Docs

- `packages/lint/README.md`: status line (publishable, first release pending); Requirements: sources **or** a manifest, with the file list under each; Adopting rewritten for the npm path (install both packages as devDependencies, config block, `--doctor <file>` shows `manifest @mrmeg/expo-ui@…`), keep vendoring and workspace as alternatives, delete the "Not yet done" box and replace it with the release status; Settings: `manifestPath` row and the four-step resolution order; Messages: one paragraph that manifest-sourced messages spell the package name in place of `packages/ui/src`; CLI: the new doctor line; Troubleshooting rows for "manifest could not be read" and "installed UI package predates the manifest"; Tests: the new suite. Add a `## Release` section: the `lint:*` gates, `bun run lint:release -- --patch --publish`, the dispatch-only workflow, and that the first publish needs npm access configured.
- `packages/ui/README.md`: in "For LLMs And Coding Agents" replace the not-yet-published caveat; in "Package Checks" or "Package Release" add a short "Design-system manifest" paragraph: generated at build into `dist/design-system.json`, exported as `@mrmeg/expo-ui/design-system.json`, consumed by the lint plugin, asserted by `ui:consumer-smoke`.
- `packages/ui/LLM_USAGE.md`: replace the two sentences at the end of "Theme And Text Rules" with the npm install path (`bun add -d @mrmeg/eslint-plugin-expo-ui`, config pointer to the plugin README).
- Root `README.md`: Theming "Design-system lint" subsection — drop the tarball caveat, add the install sentence; Scripts table row for `bun run lint:release`; the release paragraph mentions `publish-lint.yml` beside the UI workflow. Do not add version numbers.
- `AGENTS.md`: Tech Stack `Lint` row → "published alongside `@mrmeg/expo-ui`; reads `packages/ui/src` here and `dist/design-system.json` in consumers"; Docs table row purpose adds "release".
- `bun run docs:llms` and commit the regenerated `llms-full.txt`.

## Validation

- `bun run verify` passes every gate.
- `bun run ui:build` writes `packages/ui/dist/design-system.json`; `node -e 'const m=require("./packages/ui/dist/design-system.json");console.log(m.schemaVersion,m.package,m.version,m.components.length)'` prints `1 @mrmeg/expo-ui 0.24.0` and a component count equal to the `components` count in `bun lint:ui --doctor`.
- `bun x jest packages/lint scripts` passes, including `manifest.test.ts` and the updated tooling tests.
- `bun run lint:typecheck`, `bun run lint:test`, `bun run lint:build`, `bun run lint:pack` (the dry-run file list contains `index.js`, `bin/cli.js`, `lib/manifest.js`, `rules/`, `README.md`, `CHANGELOG.md`, and no `__tests__`), `bun run lint:consumer-smoke`, and `bun run ui:consumer-smoke` all pass. The lint consumer smoke is the "fixture consumer project" check: two tarballs installed into a temp project, the rules fire with manifest-labelled messages, and `--doctor` reports the manifest.
- `bun lint:ui` is clean and `bun lint:ui --doctor` reports `sources at …/packages/ui/src`.
- `bun run docs:llms:check` and `bun run docs:versions:check` pass.
- Manual, after merge, not part of this work: configure npm publishing for `@mrmeg/eslint-plugin-expo-ui` (`NPM_TOKEN` or a trusted publisher), run `publish-lint.yml` by dispatch, release the UI package as a minor so the manifest ships, then add the `push` trigger.

## Out of scope

- Publishing either package or bumping the UI version.
- Adding `bun lint:ui` to `scripts/verify.mjs` or CI.
- Changing rule behaviour, contracts, or message templates beyond the label and the not-found text.
- Registering `packages/lint` in the peer-compatibility or compatibility-profile checks.
- Enabling the `push` trigger on the publish workflow.

## Open questions

None.
