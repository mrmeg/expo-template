/* global require, __dirname, describe, it, expect */
/**
 * Selection logic for the resolver stubs and scoped dedupes in
 * `metro.config.js` (implemented in `metro/resolverRules.js`).
 *
 * A stub that fires when it should not removes code the app runs, so every
 * rule is pinned from both sides: when it applies, and each condition that
 * keeps the real module. The bundle effect itself only shows in a full
 * `expo export`; docs/bundle-analysis.md records the measured savings.
 */

const fs = require("fs");
const path = require("path");

const {
  OPTIONAL_NATIVE_INTEGRATIONS,
  describeOmittedIntegration,
  getOmittedIntegrations,
  getOmittedIntegrationFor,
} = require("../resolverRules");

const REPO_ROOT = path.resolve(__dirname, "../..");
const ROOT = "/repo";

const FULL_ENV = {
  EXPO_PUBLIC_SENTRY_DSN: "https://key@o0.ingest.sentry.io/0",
  EXPO_PUBLIC_USER_POOL_ID: "us-east-1_example",
  EXPO_PUBLIC_USER_POOL_CLIENT_ID: "exampleclientid",
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
};

const names = (integrations) => integrations.map((integration) => integration.name);

function request(overrides = {}) {
  return {
    moduleName: "@sentry/react-native",
    originModulePath: `${ROOT}/client/lib/sentry.ts`,
    platform: "ios",
    dev: false,
    environment: undefined,
    env: {},
    projectRoots: [ROOT],
    ...overrides,
  };
}

describe("optional native integrations", () => {
  describe("getOmittedIntegrations", () => {
    it("omits every integration when the env is blank", () => {
      expect(names(getOmittedIntegrations({}))).toEqual([
        "Sentry",
        "AWS Amplify (Cognito)",
        "Clerk",
      ]);
    });

    it("keeps every integration when its env is set", () => {
      expect(getOmittedIntegrations(FULL_ENV)).toEqual([]);
    });

    it("treats an empty string as blank", () => {
      expect(names(getOmittedIntegrations({ ...FULL_ENV, EXPO_PUBLIC_SENTRY_DSN: "" }))).toEqual([
        "Sentry",
      ]);
    });

    it("omits Cognito while either user-pool var is missing (the gate needs both)", () => {
      expect(
        names(getOmittedIntegrations({ ...FULL_ENV, EXPO_PUBLIC_USER_POOL_CLIENT_ID: undefined }))
      ).toEqual(["AWS Amplify (Cognito)"]);
      expect(names(getOmittedIntegrations({ ...FULL_ENV, EXPO_PUBLIC_USER_POOL_ID: "" }))).toEqual([
        "AWS Amplify (Cognito)",
      ]);
    });

    it("decides each integration on its own env", () => {
      expect(names(getOmittedIntegrations({ EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk" }))).toEqual([
        "Sentry",
        "AWS Amplify (Cognito)",
      ]);
    });

    it("keeps the SDK for a whitespace-only value, erring toward shipping it", () => {
      // The Sentry gate treats " " as a DSN; stubbing it would break that path.
      expect(names(getOmittedIntegrations({ ...FULL_ENV, EXPO_PUBLIC_SENTRY_DSN: " " }))).toEqual([]);
    });
  });

  describe("getOmittedIntegrationFor", () => {
    it("stubs the Sentry SDK in the native wrapper on iOS and Android", () => {
      expect(getOmittedIntegrationFor(request())?.name).toBe("Sentry");
      expect(getOmittedIntegrationFor(request({ platform: "android" }))?.name).toBe("Sentry");
    });

    it("stubs Amplify entry points in the Cognito barrel", () => {
      for (const moduleName of ["aws-amplify", "aws-amplify/utils", "aws-amplify/auth"]) {
        expect(
          getOmittedIntegrationFor(
            request({
              moduleName,
              originModulePath: `${ROOT}/client/features/auth/provider/cognitoSdk.ts`,
            })
          )?.name
        ).toBe("AWS Amplify (Cognito)");
      }
    });

    it("stubs Clerk imports, including subpaths, in both Clerk modules", () => {
      expect(
        getOmittedIntegrationFor(
          request({
            moduleName: "@clerk/clerk-expo",
            originModulePath: `${ROOT}/client/features/auth/provider/clerkClient.ts`,
          })
        )?.name
      ).toBe("Clerk");
      expect(
        getOmittedIntegrationFor(
          request({
            moduleName: "@clerk/clerk-expo/token-cache",
            originModulePath: `${ROOT}/client/features/auth/provider/ClerkProviderBoundary.tsx`,
          })
        )?.name
      ).toBe("Clerk");
    });

    it("keeps the SDK when its env is set", () => {
      expect(getOmittedIntegrationFor(request({ env: FULL_ENV }))).toBeNull();
      expect(
        getOmittedIntegrationFor(
          request({ env: { EXPO_PUBLIC_SENTRY_DSN: FULL_ENV.EXPO_PUBLIC_SENTRY_DSN } })
        )
      ).toBeNull();
    });

    it("keeps web's lazy chunks", () => {
      expect(getOmittedIntegrationFor(request({ platform: "web" }))).toBeNull();
    });

    it("keeps dev bundles unchanged so .env edits apply without a Metro restart", () => {
      expect(getOmittedIntegrationFor(request({ dev: true }))).toBeNull();
    });

    it("never touches server bundles", () => {
      expect(getOmittedIntegrationFor(request({ environment: "node" }))).toBeNull();
      expect(getOmittedIntegrationFor(request({ environment: "react-server" }))).toBeNull();
    });

    it("keeps the real SDK for any importer outside the env gate", () => {
      // e.g. a fork calling Sentry.wrap() in the root layout.
      expect(
        getOmittedIntegrationFor(request({ originModulePath: `${ROOT}/app/_layout.tsx` }))
      ).toBeNull();
      expect(
        getOmittedIntegrationFor(
          request({ originModulePath: `${ROOT}/node_modules/some-lib/client/lib/sentry.ts` })
        )
      ).toBeNull();
    });

    it("only matches the SDK package itself, not other imports of the gated module", () => {
      expect(getOmittedIntegrationFor(request({ moduleName: "react" }))).toBeNull();
      expect(getOmittedIntegrationFor(request({ moduleName: "@sentry/react-native-extra" }))).toBeNull();
      expect(getOmittedIntegrationFor(request({ moduleName: "@sentry/core" }))).toBeNull();
    });

    it("matches importers under any of the project roots (path and realpath)", () => {
      expect(
        getOmittedIntegrationFor(
          request({
            originModulePath: "/private/repo/client/lib/sentry.ts",
            projectRoots: [ROOT, "/private/repo"],
          })
        )?.name
      ).toBe("Sentry");
    });

    it("ignores resolutions without an origin (Metro's own empty-module lookup)", () => {
      expect(getOmittedIntegrationFor(request({ originModulePath: "", platform: null }))).toBeNull();
    });
  });

  it("names the blank variables in the build log", () => {
    const [sentry, cognito] = OPTIONAL_NATIVE_INTEGRATIONS;
    expect(describeOmittedIntegration(sentry, "ios", {})).toBe(
      "› Sentry left out of the ios bundle: EXPO_PUBLIC_SENTRY_DSN is blank"
    );
    expect(
      describeOmittedIntegration(cognito, "android", { EXPO_PUBLIC_USER_POOL_ID: "x" })
    ).toBe(
      "› AWS Amplify (Cognito) left out of the android bundle: EXPO_PUBLIC_USER_POOL_CLIENT_ID is blank"
    );
  });

  describe("source: SDK imports stay in the gated modules", () => {
    const stripComments = (source) =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");

    /** Specifiers of runtime imports; type-only imports create no module edge. */
    function runtimeImports(source) {
      const code = stripComments(source);
      const specifiers = [
        ...code.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^;]*?\bfrom\s+["']([^"']+)["']/gm),
        ...code.matchAll(/^\s*import\s+["']([^"']+)["']/gm),
        ...code.matchAll(/(?<!typeof\s)\bimport\(\s*["']([^"']+)["']\s*\)/g),
        ...code.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g),
      ];
      return specifiers.map((match) => match[1]);
    }

    function sourceFiles(dir) {
      return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          return entry.name === "__tests__" || entry.name === "node_modules" ? [] : sourceFiles(full);
        }
        return /\.[jt]sx?$/.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name) ? [full] : [];
      });
    }

    const appFiles = ["app", "client", "shared"].flatMap((dir) =>
      sourceFiles(path.join(REPO_ROOT, dir))
    );

    it.each(OPTIONAL_NATIVE_INTEGRATIONS.map((integration) => [integration.name, integration]))(
      "%s: every listed importer exists and imports the SDK",
      (_name, integration) => {
        // A moved or renamed import leaves the stub pointing at nothing, and the
        // SDK silently ships in every native bundle again.
        for (const importer of integration.importers) {
          const source = fs.readFileSync(path.join(REPO_ROOT, importer), "utf8");
          const imported = runtimeImports(source).some((specifier) =>
            integration.packages.some(
              (packageName) => specifier === packageName || specifier.startsWith(`${packageName}/`)
            )
          );
          expect({ importer, imported }).toEqual({ importer, imported: true });
        }
      }
    );

    it.each(OPTIONAL_NATIVE_INTEGRATIONS.map((integration) => [integration.name, integration]))(
      "%s: no other app module imports the SDK",
      (_name, integration) => {
        // Another importer is not stubbed (it may run outside the env gate), so
        // it would bring the whole SDK back into every native bundle. Route it
        // through the gated module, or accept the size and list it here.
        const importers = appFiles
          .filter((file) =>
            runtimeImports(fs.readFileSync(file, "utf8")).some((specifier) =>
              integration.packages.some(
                (packageName) => specifier === packageName || specifier.startsWith(`${packageName}/`)
              )
            )
          )
          .map((file) => path.relative(REPO_ROOT, file).split(path.sep).join("/"))
          .sort();
        expect(importers).toEqual([...integration.importers].sort());
      }
    );
  });
});
