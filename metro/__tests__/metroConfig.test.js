/**
 * @jest-environment node
 */
/* global require, process, __dirname, describe, it, expect, jest, beforeAll, afterAll */
/**
 * `metro.config.js` wiring for the resolver stubs and scoped dedupes: the
 * exported resolver (after the Sentry and Reanimated wrappers) returns the
 * empty module or the collapsed path for the requests `resolverRules.test.js`
 * covers, and leaves everything else to the upstream resolver.
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const APP = fs.realpathSync(REPO_ROOT);

let resolveRequest;
// The resolver reads the env per request; pin a blank DSN whatever the shell has.
const savedDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

beforeAll(() => {
  delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  resolveRequest = require("../../metro.config.js").resolver.resolveRequest;
});

afterAll(() => {
  if (savedDsn === undefined) delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  else process.env.EXPO_PUBLIC_SENTRY_DSN = savedDsn;
});

function resolveWith({ moduleName, originModulePath, platform = "ios", dev = false, environment } = {}) {
  const upstream = jest.fn((_context, name) => ({ type: "sourceFile", filePath: name }));
  const context = {
    originModulePath,
    dev,
    customResolverOptions: environment ? { environment } : {},
    resolveRequest: upstream,
  };
  const result = resolveRequest(context, moduleName, platform);
  return { result, upstream };
}

describe("metro.config.js resolver wiring", () => {
  it("resolves a gated SDK import to the empty module in a blank-env production iOS bundle", () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    const { result, upstream } = resolveWith({
      moduleName: "@sentry/react-native",
      originModulePath: path.join(APP, "client/lib/sentry.ts"),
    });
    expect(result).toEqual({ type: "empty" });
    expect(upstream).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("keeps the SDK in dev bundles and on web", () => {
    for (const request of [{ dev: true }, { platform: "web" }]) {
      const { result } = resolveWith({
        moduleName: "@sentry/react-native",
        originModulePath: path.join(APP, "client/lib/sentry.ts"),
        ...request,
      });
      expect(result).toEqual({ type: "sourceFile", filePath: "@sentry/react-native" });
    }
  });

  it("keeps the SDK once its env is set", () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = "https://key@o0.ingest.sentry.io/0";
    try {
      const { result } = resolveWith({
        moduleName: "@sentry/react-native",
        originModulePath: path.join(APP, "client/lib/sentry.ts"),
      });
      expect(result).toEqual({ type: "sourceFile", filePath: "@sentry/react-native" });
    } finally {
      delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    }
  });

  it("collapses whatwg-url-without-unicode's buffer onto the app-level copy while Amplify ships", () => {
    const request = {
      moduleName: "buffer/",
      originModulePath: path.join(APP, "node_modules/whatwg-url-without-unicode/lib/url-state-machine.js"),
    };
    // Dev bundles keep Amplify, so its buffer copy is in the bundle to collapse onto.
    expect(resolveWith({ ...request, dev: true }).result).toEqual({
      type: "sourceFile",
      filePath: `${fs.realpathSync(path.join(APP, "node_modules/buffer"))}/`,
    });
    // A blank-env production bundle leaves Amplify out: the nested copy stays.
    expect(resolveWith(request).result).toEqual({ type: "sourceFile", filePath: "buffer/" });
  });

  it("strips Sentry User Feedback from web bundles", () => {
    const { result } = resolveWith({
      moduleName: "@sentry/feedback",
      originModulePath: path.join(APP, "node_modules/@sentry/browser/build/npm/esm/prod/index.js"),
      platform: "web",
    });
    expect(result).toEqual({ type: "empty" });
  });

  it("passes other requests through unchanged", () => {
    const { result } = resolveWith({
      moduleName: "zustand",
      originModulePath: path.join(APP, "client/lib/sentry.ts"),
    });
    expect(result).toEqual({ type: "sourceFile", filePath: "zustand" });
  });
});
