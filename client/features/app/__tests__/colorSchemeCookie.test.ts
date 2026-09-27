/**
 * The `color-scheme` cookie writers. Platform is mocked to web; `document` is
 * a minimal stub that records `cookie` assignments.
 */
import { Platform } from "react-native";
import { useThemeStore } from "@mrmeg/expo-ui/state";

import {
  readColorSchemeCookie,
  startColorSchemeCookieSync,
  writeColorSchemeCookie,
} from "../colorSchemeCookie";

const writes: string[] = [];
let cookieJar = "";

beforeAll(() => {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get cookie() {
        return cookieJar;
      },
      set cookie(value: string) {
        writes.push(value);
        cookieJar = value.split(";")[0];
      },
    },
  });
});

afterAll(() => {
  // @ts-expect-error test stub
  delete globalThis.document;
});

const originalOS = Platform.OS;
beforeEach(() => {
  Platform.OS = "web";
  writes.length = 0;
  cookieJar = "";
  useThemeStore.setState({ userTheme: "system", systemTheme: "light", hasLoadedTheme: false });
});
afterEach(() => {
  Platform.OS = originalOS;
});

describe("writeColorSchemeCookie", () => {
  it("writes a path-wide Lax cookie under the shared name", () => {
    writeColorSchemeCookie("dark");
    expect(writes).toEqual([expect.stringMatching(/^color-scheme=dark; path=\/; max-age=\d+; SameSite=Lax$/)]);
  });

  it("does nothing off web", () => {
    Platform.OS = "ios";
    writeColorSchemeCookie("dark");
    expect(writes).toEqual([]);
  });
});

describe("startColorSchemeCookieSync", () => {
  it("waits for the persisted preference, then mirrors every resolved-scheme change once", () => {
    const stop = startColorSchemeCookieSync();
    expect(writes).toEqual([]); // boot default, not the visitor's scheme

    useThemeStore.setState({ hasLoadedTheme: true, userTheme: "dark" });
    useThemeStore.setState({ colorOverrides: {} }); // unrelated change: no rewrite
    useThemeStore.setState({ userTheme: "system", systemTheme: "dark" }); // same resolved scheme: no rewrite
    useThemeStore.setState({ systemTheme: "light" });
    stop();
    useThemeStore.setState({ userTheme: "dark" }); // after stop: nothing

    expect(writes.map((w) => w.split(";")[0])).toEqual(["color-scheme=dark", "color-scheme=light"]);
  });
});

describe("readColorSchemeCookie", () => {
  it("reads document.cookie on the client", () => {
    cookieJar = "color-scheme=dark";
    expect(readColorSchemeCookie()).toBe("dark");
  });

  it("is undefined with no cookie, and off web", () => {
    expect(readColorSchemeCookie()).toBeUndefined();
    Platform.OS = "ios";
    cookieJar = "color-scheme=dark";
    expect(readColorSchemeCookie()).toBeUndefined();
  });
});
