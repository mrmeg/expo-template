/**
 * @jest-environment node
 */
/* global require, process, __dirname, describe, it, expect, jest, beforeEach, afterEach */
/**
 * The public surface of `@mrmeg/expo-metro`: the env flags, the resolver wrapper
 * and how it composes with other resolver wrappers, and the pure predicates. A
 * stub that fires when it should not removes code the app runs, so the zod rule
 * is pinned from both sides: when it applies, and each condition that keeps the
 * real module.
 */

const fs = require("fs");
const path = require("path");

const {
  TREE_SHAKING_ENV,
  isServerEnvironment,
  isZodLocaleBarrelImport,
  packageOfModulePath,
  withBundleOptimizations,
} = require("..");

const ROOT = "/repo";
const NM = `${ROOT}/node_modules`;
const ZOD_CORE = `${NM}/zod/v4/core/index.js`;
const BARREL = "../locales/index.js";

describe("tree shaking flags", () => {
  const saved = {};

  beforeEach(() => {
    for (const name of TREE_SHAKING_ENV) {
      saved[name] = process.env[name];
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const name of TREE_SHAKING_ENV) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  it("names the two flags Expo reads", () => {
    expect(TREE_SHAKING_ENV).toEqual(["EXPO_UNSTABLE_TREE_SHAKING", "EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH"]);
  });

  it("sets both when unset", () => {
    withBundleOptimizations({});
    expect(process.env.EXPO_UNSTABLE_TREE_SHAKING).toBe("1");
    expect(process.env.EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH).toBe("1");
  });

  it("keeps a value already in the environment, so =0 opts out", () => {
    process.env.EXPO_UNSTABLE_TREE_SHAKING = "0";
    process.env.EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH = "0";
    withBundleOptimizations({});
    expect(process.env.EXPO_UNSTABLE_TREE_SHAKING).toBe("0");
    expect(process.env.EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH).toBe("0");
  });

  it("sets only the flag that is unset", () => {
    process.env.EXPO_UNSTABLE_TREE_SHAKING = "0";
    withBundleOptimizations({});
    expect(process.env.EXPO_UNSTABLE_TREE_SHAKING).toBe("0");
    expect(process.env.EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH).toBe("1");
  });

  it("leaves both alone with treeShaking: false", () => {
    withBundleOptimizations({}, { treeShaking: false });
    expect(process.env.EXPO_UNSTABLE_TREE_SHAKING).toBeUndefined();
    expect(process.env.EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH).toBeUndefined();
  });

  it("sets them even when the zod stub is off", () => {
    withBundleOptimizations({}, { zodLocaleStub: false });
    expect(process.env.EXPO_UNSTABLE_TREE_SHAKING).toBe("1");
  });
});

describe("withBundleOptimizations resolver", () => {
  const options = { treeShaking: false };
  const zodRequest = { moduleName: BARREL, originModulePath: ZOD_CORE };

  function resolve(config, { moduleName, originModulePath, environment, platform = "ios" }) {
    const fallback = jest.fn((_context, name) => ({ type: "sourceFile", filePath: name }));
    const context = {
      originModulePath,
      customResolverOptions: environment ? { environment } : {},
      resolveRequest: fallback,
    };
    const result = config.resolver.resolveRequest(context, moduleName, platform);
    return { result, fallback };
  }

  it("resolves zod's locale barrel to the empty module without asking the fallback", () => {
    const { result, fallback } = resolve(withBundleOptimizations({}, options), zodRequest);
    expect(result).toEqual({ type: "empty" });
    expect(fallback).not.toHaveBeenCalled();
  });

  it("falls back to context.resolveRequest for everything else", () => {
    const config = withBundleOptimizations({}, options);
    for (const request of [
      { moduleName: "react", originModulePath: `${ROOT}/client/a.ts` },
      { moduleName: "../locales/en.js", originModulePath: ZOD_CORE },
      { ...zodRequest, environment: "node" },
    ]) {
      const { result, fallback } = resolve(config, request);
      expect(fallback).toHaveBeenCalledWith(expect.anything(), request.moduleName, "ios");
      expect(result).toEqual({ type: "sourceFile", filePath: request.moduleName });
    }
  });

  it("calls an existing resolver instead of context.resolveRequest", () => {
    const existing = jest.fn(() => ({ type: "sourceFile", filePath: "/existing.js" }));
    const config = withBundleOptimizations({ resolver: { resolveRequest: existing } }, options);
    const { result, fallback } = resolve(config, { moduleName: "react", originModulePath: `${ROOT}/a.ts` });
    expect(result).toEqual({ type: "sourceFile", filePath: "/existing.js" });
    expect(existing).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("answers the zod barrel before an existing resolver", () => {
    const existing = jest.fn();
    const config = withBundleOptimizations({ resolver: { resolveRequest: existing } }, options);
    expect(resolve(config, zodRequest).result).toEqual({ type: "empty" });
    expect(existing).not.toHaveBeenCalled();
  });

  it("passes the context through untouched, so a wrapper's rewritten context reaches the resolver", () => {
    const existing = jest.fn(() => ({ type: "empty" }));
    const config = withBundleOptimizations({ resolver: { resolveRequest: existing } }, options);
    const context = { originModulePath: `${ROOT}/a.ts`, resolveRequest: jest.fn(), preferNativePlatform: false };
    config.resolver.resolveRequest(context, "react", "ios");
    expect(existing).toHaveBeenCalledWith(context, "react", "ios");
  });

  it("does not install a resolver with zodLocaleStub: false", () => {
    const existing = jest.fn();
    const config = { resolver: { resolveRequest: existing } };
    expect(withBundleOptimizations(config, { ...options, zodLocaleStub: false })).toBe(config);
    expect(withBundleOptimizations({}, { ...options, zodLocaleStub: false })).toEqual({});
  });

  it("returns a new config and keeps every other key", () => {
    const transformer = { getTransformOptions: jest.fn() };
    const config = {
      transformer,
      watchFolders: ["/a"],
      resolver: { sourceExts: ["ts"], unstable_conditionNames: ["x"] },
    };
    const wrapped = withBundleOptimizations(config, options);
    expect(wrapped).not.toBe(config);
    expect(config.resolver.resolveRequest).toBeUndefined();
    expect(wrapped.transformer).toBe(transformer);
    expect(wrapped.watchFolders).toBe(config.watchFolders);
    expect(wrapped.resolver.sourceExts).toBe(config.resolver.sourceExts);
    expect(wrapped.resolver.unstable_conditionNames).toBe(config.resolver.unstable_conditionNames);
    expect(typeof wrapped.resolver.resolveRequest).toBe("function");
  });

  it("rejects bad input", () => {
    expect(() => withBundleOptimizations(undefined)).toThrow(TypeError);
    expect(() => withBundleOptimizations({}, null)).toThrow(TypeError);
    expect(() => withBundleOptimizations({}, { treeShake: true })).toThrow(/unknown option "treeShake"/);
    expect(() => withBundleOptimizations({}, { treeShaking: "0" })).toThrow(/must be a boolean/);
  });

  describe("composition with other resolver wrappers", () => {
    const { wrapWithReanimatedMetroConfig } = require("react-native-reanimated/metro-config");
    const { withSentryFeedbackResolver, withSentryResolver } = require("@sentry/react-native/metro");

    const wrappers = {
      reanimated: (config) => wrapWithReanimatedMetroConfig(config),
      sentry: (config) => withSentryFeedbackResolver(withSentryResolver(config, false), false),
    };
    const orders = [
      ["optimizations, sentry, reanimated", ["self", "sentry", "reanimated"]],
      ["reanimated, sentry, optimizations", ["reanimated", "sentry", "self"]],
      ["sentry, optimizations, reanimated", ["sentry", "self", "reanimated"]],
    ];

    it.each(orders)("%s", (_label, order) => {
      let config = { resolver: {}, serializer: { marker: true } };
      for (const step of order) {
        config = step === "self" ? withBundleOptimizations(config, options) : wrappers[step](config);
      }

      const zod = resolve(config, zodRequest);
      expect(zod.result).toEqual({ type: "empty" });

      const other = resolve(config, { moduleName: "react", originModulePath: `${ROOT}/a.ts` });
      expect(other.fallback).toHaveBeenCalledTimes(1);
      expect(other.result).toEqual({ type: "sourceFile", filePath: "react" });
      expect(config.serializer).toEqual({ marker: true });
    });
  });
});

describe("isZodLocaleBarrelImport", () => {
  it("stubs zod's own barrel import, ESM and CJS, in every client bundle", () => {
    for (const moduleName of ["../locales/index.js", "../locales/index.cjs"]) {
      expect(isZodLocaleBarrelImport({ moduleName, originModulePath: ZOD_CORE })).toBe(true);
    }
    expect(
      isZodLocaleBarrelImport({
        moduleName: BARREL,
        originModulePath: `${NM}/zod/v4/mini/external.js`,
        environment: "client",
      })
    ).toBe(true);
  });

  it("keeps the English pack classic zod loads for its default messages", () => {
    expect(isZodLocaleBarrelImport({ moduleName: "../locales/en.js", originModulePath: ZOD_CORE })).toBe(false);
  });

  it("keeps the barrel for other packages, app code, and server bundles", () => {
    expect(isZodLocaleBarrelImport({ moduleName: BARREL, originModulePath: `${ROOT}/client/i18n/x.ts` })).toBe(false);
    expect(
      isZodLocaleBarrelImport({ moduleName: BARREL, originModulePath: `${NM}/other/core/index.js` })
    ).toBe(false);
    expect(isZodLocaleBarrelImport({ moduleName: BARREL, originModulePath: ZOD_CORE, environment: "node" })).toBe(false);
    expect(
      isZodLocaleBarrelImport({ moduleName: BARREL, originModulePath: ZOD_CORE, environment: "react-server" })
    ).toBe(false);
    expect(isZodLocaleBarrelImport({ moduleName: BARREL })).toBe(false);
  });

  it("keeps a bare or deeper locales import", () => {
    for (const moduleName of ["zod/locales", "../locales/index", "./locales/index.js", "../locales/index.js/x"]) {
      expect(isZodLocaleBarrelImport({ moduleName, originModulePath: ZOD_CORE })).toBe(false);
    }
  });
});

describe("helpers", () => {
  it.each([
    [`${NM}/whatwg-url-without-unicode/lib/url-state-machine.js`, "whatwg-url-without-unicode"],
    [`${NM}/@clerk/clerk-expo/dist/polyfills/index.js`, "@clerk/clerk-expo"],
    [`${NM}/@clerk/clerk-expo/node_modules/react-native-url-polyfill/auto.js`, "react-native-url-polyfill"],
    ["C:\\repo\\node_modules\\zod\\v4\\core\\index.js", "zod"],
    [`${NM}/react-native-web/dist/exports/processColor/index.js`, "react-native-web"],
    [`${ROOT}/client/lib/sentry.ts`, null],
    [`${NM}/@scope`, null],
  ])("packageOfModulePath(%s) is %s", (file, expected) => {
    expect(packageOfModulePath(file)).toBe(expected);
  });

  it("isServerEnvironment is true for node and react-server only", () => {
    expect(isServerEnvironment("node")).toBe(true);
    expect(isServerEnvironment("react-server")).toBe(true);
    expect(isServerEnvironment("client")).toBe(false);
    expect(isServerEnvironment(undefined)).toBe(false);
  });
});

describe("package boundaries", () => {
  const repoRoot = path.resolve(__dirname, "../../..");

  function sourceFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(file);
      return /\.[cm]?[jt]sx?$/.test(entry.name) ? [file] : [];
    });
  }

  it("is not imported by anything an app bundle includes", () => {
    const importers = ["app", "client", "shared"]
      .flatMap((dir) => sourceFiles(path.join(repoRoot, dir)))
      .filter((file) => fs.readFileSync(file, "utf8").includes("@mrmeg/expo-metro"));
    expect(importers).toEqual([]);
  });

  it("requires no module at load time", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");
    expect(source).not.toMatch(/\brequire\(/);
  });
});
