/* global require, module */
/**
 * Resolver rules behind the stub and dedupe blocks in `metro.config.js`.
 *
 * Plain functions over the values Metro hands a resolver (module name, origin
 * path, platform, `dev`, environment), so the selection logic is unit-tested in
 * `metro/__tests__/resolverRules.test.js` without starting Metro. Every rule
 * errs toward shipping code: when a condition is not certain, the module
 * resolves normally. See docs/bundle-analysis.md ("Resolver Stubs and
 * Dedupes") for what each rule saves.
 */

const path = require("path");

function matchesPackage(moduleName, packageName) {
  return moduleName === packageName || moduleName.startsWith(`${packageName}/`);
}

function isServerEnvironment(environment) {
  return environment === "node" || environment === "react-server";
}

/** `filePath` relative to each project root, POSIX-style (roots: the path and its realpath). */
function toProjectPaths(projectRoots, filePath) {
  return new Set(
    projectRoots.map((root) => path.relative(root, filePath).split(path.sep).join("/"))
  );
}

// ---------------------------------------------------------------------------
// Optional native integrations
// ---------------------------------------------------------------------------

/**
 * Optional SDKs that iOS/Android production bundles leave out while their env
 * is blank.
 *
 * On web each SDK sits behind one `import()` and ships as a lazy chunk that
 * loads only when the env selects it. Native bundles have no code splitting,
 * so Metro inlines the `import()` target and every native build carried all
 * three SDKs, although the runtime gate never loads them without their env.
 *
 * `env` is what the runtime gate reads; the SDK is left out when any of those
 * variables is unset or empty (the gate would not load it). `importers` are the
 * app modules that import the SDK, each reachable only through that gate. Only
 * their imports are stubbed: the SDK imported from anywhere else resolves
 * normally, so code outside the gate (`Sentry.wrap`, `Amplify.configure` at
 * module scope, …) keeps the real SDK instead of an empty module.
 *
 * Whitespace-only values keep the SDK even where the gate trims them (auth), so
 * the stub can never disagree with a gate that would load it.
 */
const OPTIONAL_NATIVE_INTEGRATIONS = [
  {
    name: "Sentry",
    // client/lib/sentry.ts: loadSentry() imports the SDK only for a truthy DSN.
    env: ["EXPO_PUBLIC_SENTRY_DSN"],
    packages: ["@sentry/react-native"],
    importers: ["client/lib/sentry.ts"],
  },
  {
    name: "AWS Amplify (Cognito)",
    // getAuthProvider() selects Cognito only when both user-pool vars are set;
    // cognitoClient.ts reaches the SDK only through `import("./cognitoSdk")`.
    env: ["EXPO_PUBLIC_USER_POOL_ID", "EXPO_PUBLIC_USER_POOL_CLIENT_ID"],
    packages: ["aws-amplify"],
    importers: ["client/features/auth/provider/cognitoSdk.ts"],
  },
  {
    name: "Clerk",
    // getAuthProvider() selects Clerk only with a publishable key; both files
    // are reached only through `import("./clerkClient")`.
    env: ["EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY"],
    packages: ["@clerk/clerk-expo"],
    importers: [
      "client/features/auth/provider/clerkClient.ts",
      "client/features/auth/provider/ClerkProviderBoundary.tsx",
    ],
  },
];

function isBlankEnv(value) {
  return value === undefined || value === "";
}

/** Integrations whose env keeps the runtime gate closed. */
function getOmittedIntegrations(env, integrations = OPTIONAL_NATIVE_INTEGRATIONS) {
  return integrations.filter((integration) =>
    integration.env.some((name) => isBlankEnv(env[name]))
  );
}

/** One build-log line naming the SDK a bundle left out and the blank env behind it. */
function describeOmittedIntegration(integration, platform, env) {
  const blank = integration.env.filter((name) => isBlankEnv(env[name]));
  return `› ${integration.name} left out of the ${platform} bundle: ${blank.join(", ")} ${
    blank.length === 1 ? "is" : "are"
  } blank`;
}

/**
 * Integrations the bundle leaves out. Production iOS/Android client bundles
 * only: dev bundles keep the SDKs so a `.env` edit still takes effect without
 * restarting Metro, web keeps its lazy chunks, and server bundles never contain
 * these SDKs.
 */
function getOmittedIntegrationsForBundle(
  { platform, dev, environment, env },
  integrations = OPTIONAL_NATIVE_INTEGRATIONS
) {
  if (dev || (platform !== "ios" && platform !== "android")) return [];
  if (isServerEnvironment(environment)) return [];
  return getOmittedIntegrations(env, integrations);
}

/** The integration whose SDK import should resolve to an empty module, or null. */
function getOmittedIntegrationFor(request, integrations = OPTIONAL_NATIVE_INTEGRATIONS) {
  const { moduleName, originModulePath, projectRoots } = request;
  if (!originModulePath) return null;

  const origin = toProjectPaths(projectRoots, originModulePath);
  return (
    getOmittedIntegrationsForBundle(request, integrations).find(
      (integration) =>
        integration.importers.some((importer) => origin.has(importer)) &&
        integration.packages.some((packageName) => matchesPackage(moduleName, packageName))
    ) ?? null
  );
}

module.exports = {
  OPTIONAL_NATIVE_INTEGRATIONS,
  describeOmittedIntegration,
  getOmittedIntegrations,
  getOmittedIntegrationFor,
  getOmittedIntegrationsForBundle,
};
