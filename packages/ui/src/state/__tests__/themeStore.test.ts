/**
 * themeStore tests
 *
 * Tests default state, setTheme, and persistence behavior.
 *
 * Persistence is localStorage-only on web (`AsyncStorage` on native). The
 * `document.cookie` recorder below is kept deliberately: the store used to
 * mirror the preference into a `user-theme-preference` cookie for a
 * server-rendered host, and nothing else would notice that write coming back.
 *
 * Platform switching mirrors the onboarding store's tests: mutate `Platform.OS`
 * on the live react-native module rather than re-mocking it, and shim both
 * `window` and `globalThis.localStorage` because the source uses
 * `window.localStorage` only for the typeof check but reads/writes via the
 * bare global.
 */

import { Platform } from "react-native";

import { THEME_STORAGE_KEY, resolveThemePreference, useThemeStore } from "../themeStore";

type WindowShim = { localStorage: typeof localStorage };

// `document.cookie` is a setter that appends in a real browser; jest-expo's
// environment is not guaranteed to be jsdom, so install a minimal recorder and
// read back what was written.
function installDocumentCookie(initial = "") {
  const writes: string[] = [];
  let value = initial;
  const doc = {
    get cookie() {
      return value;
    },
    set cookie(next: string) {
      writes.push(next);
      const [pair] = next.split(";");
      const [name, raw = ""] = pair.split("=");
      const others = value
        .split(";")
        .map((c) => c.trim())
        .filter((c) => c && c.split("=")[0] !== name);
      value = [...others, `${name}=${raw}`].join("; ");
    },
  };
  (globalThis as unknown as { document: typeof doc }).document = doc;
  return { writes, current: () => value };
}

function installLocalStorage(stored: Record<string, string> = {}) {
  const shim = {
    setItem: (k: string, v: string) => {
      stored[k] = v;
    },
    getItem: (k: string) => stored[k] ?? null,
    removeItem: (k: string) => {
      delete stored[k];
    },
    clear: () => {
      for (const k of Object.keys(stored)) delete stored[k];
    },
    length: 0,
    key: () => null,
  } as unknown as Storage;

  (globalThis as unknown as { window: WindowShim }).window = { localStorage: shim };
  (globalThis as unknown as { localStorage: Storage }).localStorage = shim;
  return shim;
}

// Reset store between tests
beforeEach(() => {
  useThemeStore.setState({
    userTheme: "system",
    systemTheme: "light",
    hasLoadedTheme: false,
    colorOverrides: {},
    shapeOverrides: {},
  });
});

describe("themeStore", () => {
  it("has default theme of system", () => {
    const state = useThemeStore.getState();
    expect(state.userTheme).toBe("system");
    expect(["light", "dark"]).toContain(state.systemTheme);
  });

  it("setTheme updates to light", () => {
    useThemeStore.getState().setTheme("light");
    expect(useThemeStore.getState().userTheme).toBe("light");
  });

  it("setTheme updates to dark", () => {
    useThemeStore.getState().setTheme("dark");
    expect(useThemeStore.getState().userTheme).toBe("dark");
  });

  it("setTheme updates back to system", () => {
    useThemeStore.getState().setTheme("dark");
    useThemeStore.getState().setTheme("system");
    expect(useThemeStore.getState().userTheme).toBe("system");
  });

  it("loadTheme is a function", () => {
    const state = useThemeStore.getState();
    expect(typeof state.loadTheme).toBe("function");
  });

  it("updates systemTheme independently from the user preference", () => {
    useThemeStore.getState().setSystemTheme("dark");

    expect(useThemeStore.getState().userTheme).toBe("system");
    expect(useThemeStore.getState().systemTheme).toBe("dark");
  });

  it("resolves system preference to the current system theme", () => {
    expect(resolveThemePreference("system", "dark")).toBe("dark");
    expect(resolveThemePreference("system", "light")).toBe("light");
    expect(resolveThemePreference("dark", "light")).toBe("dark");
    expect(resolveThemePreference("light", "dark")).toBe("light");
  });

  describe("colorOverrides", () => {
    it("defaults to an empty override map", () => {
      expect(useThemeStore.getState().colorOverrides).toEqual({});
    });

    it("setColors stores per-scheme overrides", () => {
      useThemeStore.getState().setColors({
        light: { primary: "#7575eb" },
        dark: { primary: "#7575eb", primaryForeground: "#FFFFFF" },
      });

      const { colorOverrides } = useThemeStore.getState();
      expect(colorOverrides.light).toEqual({ primary: "#7575eb" });
      expect(colorOverrides.dark).toEqual({ primary: "#7575eb", primaryForeground: "#FFFFFF" });
    });

    it("setColors with an empty object clears overrides", () => {
      useThemeStore.getState().setColors({ dark: { primary: "#7575eb" } });
      useThemeStore.getState().setColors({});

      expect(useThemeStore.getState().colorOverrides).toEqual({});
    });

    it("setColors does not disturb the theme preference or system scheme", () => {
      useThemeStore.setState({ userTheme: "dark", systemTheme: "dark" });
      useThemeStore.getState().setColors({ dark: { primary: "#7575eb" } });

      expect(useThemeStore.getState().userTheme).toBe("dark");
      expect(useThemeStore.getState().systemTheme).toBe("dark");
    });
  });

  describe("persistence (web)", () => {
    const originalOS = Platform.OS;
    const originalDocument = (globalThis as unknown as { document?: unknown }).document;

    beforeEach(() => {
      (Platform as { OS: string }).OS = "web";
    });

    afterEach(() => {
      (Platform as { OS: string }).OS = originalOS;
      delete (globalThis as unknown as { window?: unknown }).window;
      delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
      if (originalDocument === undefined) {
        delete (globalThis as unknown as { document?: unknown }).document;
      } else {
        (globalThis as unknown as { document: unknown }).document = originalDocument;
      }
    });

    it("exposes the storage key it reads and writes", () => {
      expect(THEME_STORAGE_KEY).toBe("user-theme-preference");
    });

    it("setTheme persists to localStorage and writes no cookie", () => {
      installLocalStorage();
      const cookies = installDocumentCookie();
      const setItemSpy = jest.spyOn(globalThis.localStorage, "setItem");

      useThemeStore.getState().setTheme("dark");

      expect(setItemSpy).toHaveBeenCalledWith(THEME_STORAGE_KEY, "dark");
      expect(cookies.writes).toHaveLength(0);
    });

    it("setTheme marks the theme loaded", () => {
      installLocalStorage();
      installDocumentCookie();

      expect(useThemeStore.getState().hasLoadedTheme).toBe(false);
      useThemeStore.getState().setTheme("dark");
      expect(useThemeStore.getState().hasLoadedTheme).toBe(true);
    });

    it("loadTheme restores the persisted preference", () => {
      installLocalStorage({ [THEME_STORAGE_KEY]: "dark" });
      const cookies = installDocumentCookie();

      useThemeStore.getState().loadTheme();

      expect(useThemeStore.getState().userTheme).toBe("dark");
      expect(cookies.writes).toHaveLength(0);
    });

    it("loadTheme ignores a persisted value the store would never write", () => {
      installLocalStorage({ [THEME_STORAGE_KEY]: "sepia" });
      installDocumentCookie();

      useThemeStore.getState().loadTheme();

      expect(useThemeStore.getState().userTheme).toBe("system");
    });

    it("loadTheme marks the theme loaded on web", () => {
      installLocalStorage();
      installDocumentCookie();

      expect(useThemeStore.getState().hasLoadedTheme).toBe(false);
      useThemeStore.getState().loadTheme();
      expect(useThemeStore.getState().hasLoadedTheme).toBe(true);
    });
  });

  describe("persistence (native)", () => {
    const originalDocument = (globalThis as unknown as { document?: unknown }).document;

    afterEach(() => {
      if (originalDocument === undefined) {
        delete (globalThis as unknown as { document?: unknown }).document;
      } else {
        (globalThis as unknown as { document: unknown }).document = originalDocument;
      }
    });

    it("does not write a cookie on native", async () => {
      const cookies = installDocumentCookie();

      useThemeStore.getState().setTheme("dark");
      await Promise.resolve();

      expect(cookies.writes).toHaveLength(0);
    });

    it("marks the theme loaded once loadTheme resolves on native", async () => {
      useThemeStore.getState().loadTheme();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(useThemeStore.getState().hasLoadedTheme).toBe(true);
    });
  });

  describe("shapeOverrides", () => {
    it("defaults to an empty override map", () => {
      expect(useThemeStore.getState().shapeOverrides).toEqual({});
    });

    it("setShape stores per-component overrides", () => {
      useThemeStore.getState().setShape({
        button: { borderRadius: 9999, withShadow: false },
      });

      expect(useThemeStore.getState().shapeOverrides.button).toEqual({
        borderRadius: 9999,
        withShadow: false,
      });
    });

    it("setShape with an empty object clears overrides", () => {
      useThemeStore.getState().setShape({ button: { borderRadius: 0 } });
      useThemeStore.getState().setShape({});

      expect(useThemeStore.getState().shapeOverrides).toEqual({});
    });
  });
});

/**
 * `syncThemeFromEnvironment()` / `startSystemThemeListener()` share one OS
 * listener between every caller and hand each caller its own release. Each
 * test loads a fresh copy of the store (and of react-native, whose platform
 * the store reads at module load) so the listener bookkeeping starts clean.
 */
describe("system theme listener sharing", () => {
  type StoreModule = typeof import("../themeStore");
  type ReactNativeModule = typeof import("react-native");

  function freshStore(os: "web" | "ios", setup: (rn: ReactNativeModule) => void = () => {}): StoreModule {
    let store: StoreModule | undefined;
    jest.isolateModules(() => {
      const rn = require("react-native") as ReactNativeModule;
      (rn.Platform as { OS: string }).OS = os;
      setup(rn);
      store = require("../themeStore") as StoreModule;
    });
    return store!;
  }

  describe("web", () => {
    const originalOS = Platform.OS;
    const originalWindow = (globalThis as { window?: unknown }).window;
    const originalLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;
    let addEventListener: jest.Mock;
    let removeEventListener: jest.Mock;
    let changeListeners: Set<() => void>;
    let prefersDark: boolean;

    beforeEach(() => {
      // The store reads the platform at call time too, and jest-expo resets
      // `Platform.OS` when an isolated registry is left.
      (Platform as { OS: string }).OS = "web";
      changeListeners = new Set();
      prefersDark = false;
      addEventListener = jest.fn((_: string, listener: () => void) => changeListeners.add(listener));
      removeEventListener = jest.fn((_: string, listener: () => void) => changeListeners.delete(listener));
      const mediaQuery = {
        get matches() {
          return prefersDark;
        },
        addEventListener,
        removeEventListener,
      };
      installLocalStorage();
      (globalThis as unknown as { window: Record<string, unknown> }).window.matchMedia = () => mediaQuery;
    });

    afterEach(() => {
      (Platform as { OS: string }).OS = originalOS;
      (globalThis as { window?: unknown }).window = originalWindow;
      (globalThis as { localStorage?: unknown }).localStorage = originalLocalStorage;
    });

    function emitSchemeChange(dark: boolean) {
      prefersDark = dark;
      for (const listener of [...changeListeners]) listener();
    }

    it("attaches one listener however many times it is called", () => {
      const store = freshStore("web");

      const releaseA = store.syncThemeFromEnvironment();
      const releaseB = store.syncThemeFromEnvironment();
      const releaseC = store.startSystemThemeListener();

      expect(addEventListener).toHaveBeenCalledTimes(1);
      expect(changeListeners.size).toBe(1);

      releaseA();
      releaseB();
      releaseC();
      expect(removeEventListener).toHaveBeenCalledTimes(1);
      expect(changeListeners.size).toBe(0);
    });

    it("keeps following the OS for the callers still holding it", () => {
      const store = freshStore("web");

      const releaseA = store.syncThemeFromEnvironment();
      const releaseB = store.syncThemeFromEnvironment();

      releaseA();
      expect(removeEventListener).not.toHaveBeenCalled();

      emitSchemeChange(true);
      expect(store.useThemeStore.getState().systemTheme).toBe("dark");

      releaseB();
      expect(removeEventListener).toHaveBeenCalledTimes(1);
    });

    it("ignores a release called twice instead of dropping another caller's hold", () => {
      const store = freshStore("web");

      const releaseA = store.syncThemeFromEnvironment();
      releaseA();
      const releaseB = store.syncThemeFromEnvironment();
      expect(addEventListener).toHaveBeenCalledTimes(2);

      // A StrictMode-style double cleanup of the first call.
      releaseA();
      expect(changeListeners.size).toBe(1);

      // The next caller shares B's listener rather than stacking a second one.
      const releaseC = store.syncThemeFromEnvironment();
      expect(addEventListener).toHaveBeenCalledTimes(2);

      releaseB();
      releaseC();
      expect(changeListeners.size).toBe(0);
    });

    it("reads the OS scheme and the persisted preference on every call", () => {
      const store = freshStore("web");
      prefersDark = true;
      localStorage.setItem(THEME_STORAGE_KEY, "light");

      const release = store.syncThemeFromEnvironment();

      expect(store.useThemeStore.getState()).toEqual(
        expect.objectContaining({ systemTheme: "dark", userTheme: "light", hasLoadedTheme: true })
      );

      localStorage.setItem(THEME_STORAGE_KEY, "dark");
      const releaseAgain = store.syncThemeFromEnvironment();
      expect(store.useThemeStore.getState().userTheme).toBe("dark");

      release();
      releaseAgain();
    });
  });

  describe("native", () => {
    it("keeps the package's own OS listener when an app releases its call", () => {
      const remove = jest.fn();
      let addChangeListener: jest.SpyInstance | undefined;
      const store = freshStore("ios", (rn) => {
        addChangeListener = jest
          .spyOn(rn.Appearance, "addChangeListener")
          .mockImplementation(
            () => ({ remove }) as unknown as ReturnType<ReactNativeModule["Appearance"]["addChangeListener"]>
          );
      });

      // The module-load init already holds the listener.
      expect(addChangeListener).toHaveBeenCalledTimes(1);

      const release = store.syncThemeFromEnvironment();
      expect(addChangeListener).toHaveBeenCalledTimes(1);

      release();
      release();
      expect(remove).not.toHaveBeenCalled();
    });
  });
});
