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

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  CONTRAST_STORAGE_KEY,
  THEME_STORAGE_KEY,
  resolveContrastPreference,
  resolveThemePreference,
  useThemeStore,
} from "../themeStore";

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
    userContrast: "system",
    systemContrast: "standard",
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

  function freshStore(os: "web" | "ios" | "android",setup: (rn: ReactNativeModule) => void = () => {}): StoreModule {
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
    // Scheme listeners are counted separately from the contrast ones.
    let addEventListener: jest.Mock;
    let removeEventListener: jest.Mock;
    let changeListeners: Set<() => void>;
    let prefersDark: boolean;
    let contrastAdd: jest.Mock;
    let contrastRemove: jest.Mock;
    let contrastListeners: Set<() => void>;
    let prefersMoreContrast: boolean;

    beforeEach(() => {
      // The store reads the platform at call time too, and jest-expo resets
      // `Platform.OS` when an isolated registry is left.
      (Platform as { OS: string }).OS = "web";
      changeListeners = new Set();
      prefersDark = false;
      contrastListeners = new Set();
      prefersMoreContrast = false;
      addEventListener = jest.fn((_: string, listener: () => void) => changeListeners.add(listener));
      removeEventListener = jest.fn((_: string, listener: () => void) => changeListeners.delete(listener));
      contrastAdd = jest.fn((_: string, listener: () => void) => contrastListeners.add(listener));
      contrastRemove = jest.fn((_: string, listener: () => void) => contrastListeners.delete(listener));
      const mediaQuery = {
        get matches() {
          return prefersDark;
        },
        addEventListener,
        removeEventListener,
      };
      const contrastQuery = {
        get matches() {
          return prefersMoreContrast;
        },
        addEventListener: contrastAdd,
        removeEventListener: contrastRemove,
      };
      installLocalStorage();
      (globalThis as unknown as { window: Record<string, unknown> }).window.matchMedia = (query: string) =>
        query.includes("prefers-contrast") ? contrastQuery : mediaQuery;
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

    function emitContrastChange(more: boolean) {
      prefersMoreContrast = more;
      for (const listener of [...contrastListeners]) listener();
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

    it("follows prefers-contrast alongside the scheme under one hold", () => {
      const store = freshStore("web");
      prefersMoreContrast = true;

      const releaseA = store.syncThemeFromEnvironment();
      const releaseB = store.startSystemThemeListener();

      expect(store.useThemeStore.getState().systemContrast).toBe("more");
      expect(contrastAdd).toHaveBeenCalledTimes(1);
      expect(contrastListeners.size).toBe(1);

      emitContrastChange(false);
      expect(store.useThemeStore.getState().systemContrast).toBe("standard");
      emitContrastChange(true);
      expect(store.useThemeStore.getState().systemContrast).toBe("more");
      // A contrast change leaves the scheme alone, and vice versa.
      expect(store.useThemeStore.getState().systemTheme).toBe("light");
      emitSchemeChange(true);
      expect(store.useThemeStore.getState().systemContrast).toBe("more");

      releaseA();
      expect(contrastRemove).not.toHaveBeenCalled();
      releaseB();
      releaseB();
      expect(contrastRemove).toHaveBeenCalledTimes(1);
      expect(removeEventListener).toHaveBeenCalledTimes(1);
      expect(contrastListeners.size).toBe(0);
    });

    it("restores the persisted contrast preference with the theme", () => {
      const store = freshStore("web");
      localStorage.setItem(CONTRAST_STORAGE_KEY, "more");

      const release = store.syncThemeFromEnvironment();

      expect(store.useThemeStore.getState().userContrast).toBe("more");
      release();
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

    describe.each([
      ["ios", "isDarkerSystemColorsEnabled", "darkerSystemColorsChanged"],
      ["android", "isHighTextContrastEnabled", "highTextContrastChanged"],
    ] as const)("system contrast on %s", (os, readName, eventName) => {
      let handlers: Record<string, (enabled: boolean) => void>;
      let removeContrast: jest.Mock;
      let read: jest.Mock;

      function loadStore(enabled: boolean | Error) {
        handlers = {};
        removeContrast = jest.fn();
        read = jest.fn(() => (enabled instanceof Error ? Promise.reject(enabled) : Promise.resolve(enabled)));
        return freshStore(os, (rn) => {
          const info = rn.AccessibilityInfo as unknown as Record<string, unknown>;
          info[readName] = read;
          info.addEventListener = jest.fn((event: string, handler: (enabled: boolean) => void) => {
            handlers[event] = handler;
            return { remove: removeContrast };
          });
          jest.spyOn(rn.Appearance, "addChangeListener").mockImplementation(
            () => ({ remove: jest.fn() }) as unknown as ReturnType<ReactNativeModule["Appearance"]["addChangeListener"]>
          );
        });
      }

      afterEach(() => {
        (Platform as { OS: string }).OS = "ios";
      });

      it("reads the OS setting at module load and follows its change event", async () => {
        const store = loadStore(true);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(read).toHaveBeenCalled();
        expect(store.useThemeStore.getState().systemContrast).toBe("more");

        handlers[eventName](false);
        expect(store.useThemeStore.getState().systemContrast).toBe("standard");
        handlers[eventName](true);
        expect(store.useThemeStore.getState().systemContrast).toBe("more");
      });

      it("keeps the OS contrast listener when an app releases its call", () => {
        const store = loadStore(false);
        const release = store.syncThemeFromEnvironment();
        release();
        release();
        expect(removeContrast).not.toHaveBeenCalled();
      });

      it("swallows a rejected OS read and stays standard", async () => {
        const store = loadStore(new Error("unavailable"));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(store.useThemeStore.getState().systemContrast).toBe("standard");
      });

      it("re-reads the OS setting when the preference returns to system", async () => {
        const store = loadStore(false);
        await new Promise((resolve) => setTimeout(resolve, 0));
        read.mockImplementation(() => Promise.resolve(true));

        store.useThemeStore.getState().setContrast("system");
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(store.useThemeStore.getState().systemContrast).toBe("more");
      });
    });

    it("tolerates a platform without the accessibility-info functions", () => {
      const store = freshStore("ios", (rn) => {
        const info = rn.AccessibilityInfo as unknown as Record<string, unknown>;
        info.isDarkerSystemColorsEnabled = undefined;
        info.addEventListener = undefined;
      });
      expect(store.useThemeStore.getState().systemContrast).toBe("standard");
    });
  });
});

describe("contrast preference", () => {
  it("defaults to following the system at standard", () => {
    const state = useThemeStore.getState();
    expect(state.userContrast).toBe("system");
    expect(state.systemContrast).toBe("standard");
  });

  it("setContrast changes the preference without touching the theme", () => {
    useThemeStore.getState().setContrast("more");
    expect(useThemeStore.getState().userContrast).toBe("more");
    expect(useThemeStore.getState().userTheme).toBe("system");
    useThemeStore.getState().setContrast("standard");
    expect(useThemeStore.getState().userContrast).toBe("standard");
  });

  it("updates systemContrast independently from the user preference", () => {
    useThemeStore.getState().setSystemContrast("more");
    expect(useThemeStore.getState().userContrast).toBe("system");
    expect(useThemeStore.getState().systemContrast).toBe("more");
  });

  it("resolves system to the OS level and explicit values to themselves", () => {
    expect(resolveContrastPreference("system", "more")).toBe("more");
    expect(resolveContrastPreference("system", "standard")).toBe("standard");
    expect(resolveContrastPreference("more", "standard")).toBe("more");
    expect(resolveContrastPreference("standard", "more")).toBe("standard");
  });

  describe("persistence (web)", () => {
    const originalOS = Platform.OS;

    beforeEach(() => {
      (Platform as { OS: string }).OS = "web";
    });

    afterEach(() => {
      (Platform as { OS: string }).OS = originalOS;
      delete (globalThis as unknown as { window?: unknown }).window;
      delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    });

    it("exposes the storage key it reads and writes", () => {
      expect(CONTRAST_STORAGE_KEY).toBe("user-contrast-preference");
    });

    it("setContrast persists to localStorage", () => {
      installLocalStorage();
      const setItemSpy = jest.spyOn(globalThis.localStorage, "setItem");

      useThemeStore.getState().setContrast("more");

      expect(setItemSpy).toHaveBeenCalledWith(CONTRAST_STORAGE_KEY, "more");
    });

    it("setContrast(system) re-reads the OS contrast", () => {
      installLocalStorage();
      (globalThis as unknown as { window: Record<string, unknown> }).window.matchMedia = (query: string) => ({
        matches: query.includes("prefers-contrast"),
      });

      useThemeStore.getState().setContrast("system");

      expect(useThemeStore.getState().systemContrast).toBe("more");
    });

    it("loadTheme restores the persisted contrast", () => {
      installLocalStorage({ [CONTRAST_STORAGE_KEY]: "more" });
      useThemeStore.getState().loadTheme();
      expect(useThemeStore.getState().userContrast).toBe("more");
    });

    it("loadTheme ignores a persisted contrast the store would never write", () => {
      installLocalStorage({ [CONTRAST_STORAGE_KEY]: "extreme" });
      useThemeStore.getState().loadTheme();
      expect(useThemeStore.getState().userContrast).toBe("system");
    });
  });

  describe("persistence (native)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("setContrast writes AsyncStorage", async () => {
      const setItem = jest.spyOn(AsyncStorage, "setItem");
      useThemeStore.getState().setContrast("standard");
      await Promise.resolve();
      expect(setItem).toHaveBeenCalledWith(CONTRAST_STORAGE_KEY, "standard");
    });

    it("loadTheme restores the persisted contrast before marking the theme loaded", async () => {
      jest.spyOn(AsyncStorage, "getItem").mockImplementation(async (key: string) =>
        key === CONTRAST_STORAGE_KEY ? "more" : null
      );

      useThemeStore.getState().loadTheme();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(useThemeStore.getState().userContrast).toBe("more");
      expect(useThemeStore.getState().hasLoadedTheme).toBe(true);
    });

    it("loadTheme rejects junk values", async () => {
      jest.spyOn(AsyncStorage, "getItem").mockImplementation(async (key: string) =>
        key === CONTRAST_STORAGE_KEY ? "loud" : null
      );

      useThemeStore.getState().loadTheme();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(useThemeStore.getState().userContrast).toBe("system");
    });
  });
});
