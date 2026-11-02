# @mrmeg/expo-metro

The Metro bundle optimizations Expo apps keep copying from this template,
as one tested package so they stop drifting:

- **Tree shaking on every build.** Sets `EXPO_UNSTABLE_TREE_SHAKING` and
  `EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH` when `metro.config.js` loads. Expo reads
  both after loading that file, so `expo export`, `export:embed` (Xcode, Gradle,
  EAS) and `eas update` all tree-shake with no `.env`.
- **Zod locale stub.** `export * as locales` in zod's core, mini, and classic
  entries keeps every language pack (~280 kB raw on web) however the app imports
  zod. The resolver rule resolves zod's own `../locales/index` import to an empty
  module in client bundles.

Status: publishable, first release pending. Plain CommonJS with `index.d.ts`, no
build step, no dependencies, MIT-licensed ([`LICENSE`](LICENSE)). What these
optimizations save, and what tree shaking breaks, is measured in
[`docs/bundle-analysis.md`](../../docs/bundle-analysis.md).

## Install

```sh
bun add -d @mrmeg/expo-metro
```

Node only: it runs while Metro loads `metro.config.js`. Never import it from
`app/`, `client/`, or app code that ships in a bundle. `expo` is an optional peer
(`>=52`): the package never requires it, but the env flags mean nothing without
Expo's CLI.

## Usage

```js
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withBundleOptimizations } = require("@mrmeg/expo-metro");

const config = getDefaultConfig(__dirname);

module.exports = withBundleOptimizations(config, {
  treeShaking: true, // default
  zodLocaleStub: true, // default
});
```

| Option | Default | Effect |
|--------|---------|--------|
| `treeShaking` | `true` | Set both env flags to `"1"` when unset. `false` leaves them alone, for apps that set them only in web build scripts so native output and OTA fingerprints stay unchanged. |
| `zodLocaleStub` | `true` | Stub zod's locale barrel in client bundles. `node` and `react-server` bundles keep it. |

An unknown option name or a non-boolean value throws.

### Opting out

Set a flag to `0` in the process environment before Metro starts:

```sh
EXPO_UNSTABLE_TREE_SHAKING=0 EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=0 bun run build
```

The flags are set when `withBundleOptimizations` runs, which is during config
load. That is early enough for Expo, but it means a `=0` opt-out has to be in the
environment already: a value that only a dotenv file defines is loaded after the
config and is too late. Only an unset flag is changed, so `0` (or any value) that
is already there wins.

### Composing with other wrappers

`withBundleOptimizations` wraps whatever `config.resolver.resolveRequest` is when
it runs, calling it (or `context.resolveRequest`) for every request it does not
answer, and returns a new config with every other key intact. The Sentry and
Reanimated wrappers do the same, so the order does not matter:

```js
module.exports = wrapWithReanimatedMetroConfig(
  withSentryFeedbackResolver(
    withSentryResolver(withBundleOptimizations(config), false),
    false
  )
);
```

If your own `resolveRequest` replaces `config.resolver.resolveRequest` after this
runs, call the previous one from it, as the template's `metro.config.js` does.

### Predicates

The rules are exported so an app with its own resolver can compose them:

```js
const { isZodLocaleBarrelImport } = require("@mrmeg/expo-metro");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    isZodLocaleBarrelImport({
      moduleName,
      originModulePath: context.originModulePath,
      environment: context.customResolverOptions?.environment,
    })
  ) {
    return { type: "empty" };
  }
  return context.resolveRequest(context, moduleName, platform);
};
```

Also exported: `isServerEnvironment(environment)`, `packageOfModulePath(filePath)`
and `TREE_SHAKING_ENV`.

## What tree shaking breaks

Tree shaking drops an export nothing imports, so side effects that depend on an
import being kept can disappear, and the zod stub makes `z.locales.*` empty
(import a language pack from `zod/locales` instead; default English messages are
unaffected). Check a production export, not only `expo start`, when adopting this.
The reasoning and measurements are in
[`docs/bundle-analysis.md`](../../docs/bundle-analysis.md).

## Tests

```sh
bun run pkg metro test           # jest packages/metro
bun run pkg metro typecheck      # tsc -p packages/metro/tsconfig.json
bun run pkg metro consumer-smoke # packs the tarball, installs it in a temp project
```

The tests cover the env flags (set, keep a `0`, `treeShaking: false`), the
resolver (fallback, an existing resolver, composition with the real Sentry and
Reanimated wrappers in several orders) and each side of the zod rule.

## Release

Same path as the other workspace packages, driven by
[`scripts/release-package.mjs`](../../scripts/release-package.mjs):

```sh
bun run pkg metro typecheck
bun run pkg metro test
bun run pkg metro build           # require("./index.js"), the load smoke
bun run pkg metro pack            # bun pm pack --dry-run
bun run pkg metro consumer-smoke
bun run pkg metro release -- --patch --publish
```

Without `--publish`, `release` is a dry run.
[`.github/workflows/publish-packages.yml`](../../.github/workflows/publish-packages.yml)
runs the same release in CI. A push to `main` never makes a package's first
publish, so the first release is a manual run (`package=metro`, `version=0.1.0`)
and needs an `NPM_TOKEN` secret with publish rights; after that, configure npm
trusted publishing with workflow filename `publish-packages.yml`.
