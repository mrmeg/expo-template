/**
 * `@mrmeg/expo-metro` — the generic Metro bundle optimizations Expo apps keep
 * copying, as one tested package.
 *
 * Node only: it runs while `metro.config.js` loads. Nothing in an app bundle
 * imports it, and it has no dependencies — it never requires `metro` or `expo`,
 * it only sets the env flags Expo reads and wraps the resolver Metro calls.
 */

/**
 * The env flags Expo's CLI reads after it has loaded `metro.config.js`, so they
 * take effect in `expo start`, `expo export`, and `export:embed` (Xcode, Gradle)
 * with no `.env` entry. Setting either to `0` before the config loads opts out.
 */
const TREE_SHAKING_ENV = ["EXPO_UNSTABLE_TREE_SHAKING", "EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH"];

const OPTION_NAMES = ["treeShaking", "zodLocaleStub"];

/** An environment whose bundle is built for Node (API routes, server rendering, RSC). */
function isServerEnvironment(environment) {
  return environment === "node" || environment === "react-server";
}

/** The package a module path belongs to: the segment after its last `node_modules`. */
function packageOfModulePath(filePath) {
  const segments = filePath.split(/[\\/]/);
  const index = segments.lastIndexOf("node_modules");
  const name = index === -1 ? undefined : segments[index + 1];
  if (!name) return null;
  if (!name.startsWith("@")) return name;
  const scopedName = segments[index + 2];
  return scopedName ? `${name}/${scopedName}` : null;
}

/**
 * Zod's own `../locales/index` import, in client bundles.
 *
 * `export * as locales` in zod's core, mini and classic entries keeps every
 * language pack (~280 kB of ~490 kB on web) however the app imports zod: tree
 * shaking cannot see through a namespace re-export. Default English messages are
 * unaffected, because classic zod imports `../locales/en` directly. The app-level
 * `zod/locales` subpath also resolves normally; only `z.locales.*` is empty.
 * Server bundles (`node`, `react-server`) keep the barrel.
 *
 * @param {{ moduleName: string, originModulePath?: string, environment?: string }} request
 */
function isZodLocaleBarrelImport({ moduleName, originModulePath, environment }) {
  if (isServerEnvironment(environment) || !originModulePath) return false;
  return (
    /^\.\.\/locales\/index\.c?js$/.test(moduleName) &&
    packageOfModulePath(originModulePath) === "zod"
  );
}

/**
 * Turns on Expo's tree shaking and graph optimization and stubs zod's locale
 * barrel. Returns a new config; the one passed in is not modified, and every
 * other key — and any resolver already installed — is kept.
 *
 * The resolver wraps whatever `config.resolver.resolveRequest` is when this runs
 * (falling back to `context.resolveRequest`), so it composes with the Sentry and
 * Reanimated wrappers in either order.
 *
 * The env flags are set when this function runs, i.e. during config load, which
 * is before Expo reads them. A `=0` opt-out must therefore already be in the
 * process environment (a dotenv file Expo loads later is too late).
 *
 * @template {object} T
 * @param {T} config a Metro config, usually from `getDefaultConfig`
 * @param {{ treeShaking?: boolean, zodLocaleStub?: boolean }} [options]
 * @returns {T}
 */
function withBundleOptimizations(config, options = {}) {
  if (config === null || typeof config !== "object") {
    throw new TypeError("withBundleOptimizations: expected a Metro config object");
  }
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("withBundleOptimizations: options must be an object");
  }
  for (const [name, value] of Object.entries(options)) {
    if (!OPTION_NAMES.includes(name)) {
      throw new TypeError(
        `withBundleOptimizations: unknown option "${name}". Expected: ${OPTION_NAMES.join(", ")}`
      );
    }
    if (value !== undefined && typeof value !== "boolean") {
      throw new TypeError(`withBundleOptimizations: option "${name}" must be a boolean`);
    }
  }

  const { treeShaking = true, zodLocaleStub = true } = options;

  if (treeShaking) {
    for (const name of TREE_SHAKING_ENV) process.env[name] ??= "1";
  }
  if (!zodLocaleStub) return config;

  const upstream = config.resolver?.resolveRequest;
  const resolveRequest = (context, moduleName, platform) => {
    if (
      isZodLocaleBarrelImport({
        moduleName,
        originModulePath: context.originModulePath,
        environment: context.customResolverOptions?.environment,
      })
    ) {
      return { type: "empty" };
    }
    return (upstream || context.resolveRequest)(context, moduleName, platform);
  };

  return { ...config, resolver: { ...config.resolver, resolveRequest } };
}

module.exports = {
  TREE_SHAKING_ENV,
  isServerEnvironment,
  isZodLocaleBarrelImport,
  packageOfModulePath,
  withBundleOptimizations,
};
