/**
 * themeStore tests
 *
 * Tests default state, setTheme, and persistence behavior.
 *
 * Since the SSR theme cookie (docs/ssr-hydration.md §5) the web writes are a
 * DUAL write — localStorage plus a `user-theme-preference` cookie the server
 * reads to decide which scheme to render. Those assertions matter because a
 * missing cookie write silently reverts every dark-mode visitor to a
 * light-themed server render that recolors after hydration, which no
 * client-side test would notice.
 *
 * The same applies to `system-color-scheme`, which persists the *resolved* OS
 * scheme. It is the only server-visible scheme channel on Safari and Firefox
 * (they never send `Sec-CH-Prefers-Color-Scheme`), so a missing write there
 * silently returns every `system` visitor — i.e. the default — to a light server
 * render on those browsers.
 *
 * Platform switching mirrors the onboarding store's tests: mutate `Platform.OS`
 * on the live react-native module rather than re-mocking it, and shim both
 * `window` and `globalThis.localStorage` because the source uses
 * `window.localStorage` only for the typeof check but reads/writes via the
 * bare global.
 */

import { Platform } from "react-native";

import {
  SYSTEM_SCHEME_COOKIE_NAME,
  THEME_COOKIE_NAME,
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

/**
 * Give the existing `window` shim a `matchMedia`, so `getSystemTheme()` takes its
 * web branch. Without this it falls through to `Appearance`, and
 * `setTheme("system")` would resolve whatever the native mock reports rather than
 * the scheme under test.
 */
function installMatchMedia(prefersDark: boolean) {
  const matchMedia = jest.fn(() => ({ matches: prefersDark }));
  const win = (globalThis as unknown as { window?: Record<string, unknown> }).window ?? {};
  win.matchMedia = matchMedia;
  (globalThis as unknown as { window: Record<string, unknown> }).window = win;
  return matchMedia;
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

  describe("SSR theme cookie (web)", () => {
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

    it("uses the same name as the localStorage key", () => {
      expect(THEME_COOKIE_NAME).toBe("user-theme-preference");
    });

    it("setTheme dual-writes localStorage and the SSR cookie", () => {
      installLocalStorage();
      const cookies = installDocumentCookie();
      const setItemSpy = jest.spyOn(globalThis.localStorage, "setItem");

      useThemeStore.getState().setTheme("dark");

      expect(setItemSpy).toHaveBeenCalledWith(THEME_COOKIE_NAME, "dark");
      expect(cookies.writes).toHaveLength(1);
      expect(cookies.writes[0]).toContain(`${THEME_COOKIE_NAME}=dark`);
      expect(cookies.writes[0]).toContain("path=/");
      expect(cookies.writes[0]).toContain("SameSite=Lax");
      expect(cookies.writes[0]).toMatch(/max-age=31536000/);
      expect(cookies.writes[0]).not.toContain("domain=");
      expect(cookies.current()).toContain(`${THEME_COOKIE_NAME}=dark`);
    });

    it("setTheme writes every preference value the server can parse", () => {
      installLocalStorage();
      const cookies = installDocumentCookie();

      useThemeStore.getState().setTheme("light");
      expect(cookies.current()).toContain(`${THEME_COOKIE_NAME}=light`);

      useThemeStore.getState().setTheme("system");
      expect(cookies.current()).toContain(`${THEME_COOKIE_NAME}=system`);
    });

    it("setTheme marks the theme loaded so renders stop trusting the SSR seed", () => {
      installLocalStorage();
      installDocumentCookie();

      expect(useThemeStore.getState().hasLoadedTheme).toBe(false);
      useThemeStore.getState().setTheme("dark");
      expect(useThemeStore.getState().hasLoadedTheme).toBe(true);
    });

    it("loadTheme backfills the cookie from localStorage for pre-existing users", () => {
      installLocalStorage({ [THEME_COOKIE_NAME]: "dark" });
      const cookies = installDocumentCookie();

      useThemeStore.getState().loadTheme();

      expect(useThemeStore.getState().userTheme).toBe("dark");
      expect(cookies.current()).toContain(`${THEME_COOKIE_NAME}=dark`);
    });

    it("loadTheme overwrites a cookie that drifted from localStorage", () => {
      installLocalStorage({ [THEME_COOKIE_NAME]: "light" });
      const cookies = installDocumentCookie(`${THEME_COOKIE_NAME}=dark`);

      // localStorage is the source of truth; the cookie is only a render hint.
      useThemeStore.getState().loadTheme();

      expect(useThemeStore.getState().userTheme).toBe("light");
      expect(cookies.current()).toContain(`${THEME_COOKIE_NAME}=light`);
      expect(cookies.current()).not.toContain(`${THEME_COOKIE_NAME}=dark`);
    });

    it("loadTheme clears a stale cookie when nothing is persisted", () => {
      installLocalStorage();
      const cookies = installDocumentCookie(`${THEME_COOKIE_NAME}=dark`);

      useThemeStore.getState().loadTheme();

      expect(useThemeStore.getState().userTheme).toBe("system");
      expect(cookies.current()).toContain(`${THEME_COOKIE_NAME}=system`);
    });

    it("loadTheme ignores a persisted value the store would never write", () => {
      installLocalStorage({ [THEME_COOKIE_NAME]: "sepia" });
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

  describe("SSR resolved-scheme cookie (web)", () => {
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

    it("uses a name distinct from the preference cookie", () => {
      // server/lib/ssrTheme.ts declares the same literal independently (the
      // package can't import from the app's server layer) and pins the equality.
      expect(SYSTEM_SCHEME_COOKIE_NAME).toBe("system-color-scheme");
      expect(SYSTEM_SCHEME_COOKIE_NAME).not.toBe(THEME_COOKIE_NAME);
    });

    it("setSystemTheme writes the resolved scheme with the same cookie attributes", () => {
      const cookies = installDocumentCookie();

      useThemeStore.getState().setSystemTheme("dark");

      expect(cookies.writes).toHaveLength(1);
      expect(cookies.writes[0]).toContain(`${SYSTEM_SCHEME_COOKIE_NAME}=dark`);
      expect(cookies.writes[0]).toContain("path=/");
      expect(cookies.writes[0]).toContain("SameSite=Lax");
      expect(cookies.writes[0]).toMatch(/max-age=31536000/);
      expect(cookies.writes[0]).not.toContain("domain=");
      expect(cookies.current()).toContain(`${SYSTEM_SCHEME_COOKIE_NAME}=dark`);
    });

    it("setSystemTheme writes both resolved values", () => {
      const cookies = installDocumentCookie();

      useThemeStore.getState().setSystemTheme("light");
      expect(cookies.current()).toContain(`${SYSTEM_SCHEME_COOKIE_NAME}=light`);

      // The live matchMedia listener funnels here, so an OS flip has to overwrite.
      useThemeStore.getState().setSystemTheme("dark");
      expect(cookies.current()).toContain(`${SYSTEM_SCHEME_COOKIE_NAME}=dark`);
      expect(cookies.current()).not.toContain(`${SYSTEM_SCHEME_COOKIE_NAME}=light`);
    });

    it("setSystemTheme never writes a value the server would reject", () => {
      const cookies = installDocumentCookie();

      // An untyped JS caller must not be able to persist a preference value into
      // a resolved-scheme slot — the server stamps this straight into <html>.
      (useThemeStore.getState().setSystemTheme as (v: string) => void)("system");

      expect(cookies.writes).toHaveLength(0);
    });

    it("setTheme(\"system\") writes the cookie too, despite bypassing setSystemTheme", () => {
      // This branch re-derives systemTheme with a direct `set()`, so the write has
      // to be duplicated there or switching back to `system` leaves the server
      // reading a scheme resolved before the switch.
      installLocalStorage();
      const cookies = installDocumentCookie();
      const matchMedia = installMatchMedia(true);

      useThemeStore.getState().setTheme("system");

      expect(matchMedia).toHaveBeenCalled();
      expect(useThemeStore.getState().systemTheme).toBe("dark");
      expect(cookies.current()).toContain(`${THEME_COOKIE_NAME}=system`);
      expect(cookies.current()).toContain(`${SYSTEM_SCHEME_COOKIE_NAME}=dark`);
    });

    it("setTheme(\"system\") records a light OS as light", () => {
      installLocalStorage();
      const cookies = installDocumentCookie();
      installMatchMedia(false);

      useThemeStore.getState().setTheme("system");

      expect(cookies.current()).toContain(`${SYSTEM_SCHEME_COOKIE_NAME}=light`);
    });

    it("an explicit setTheme does not touch the resolved-scheme cookie", () => {
      // `light`/`dark` are preferences, not OS readings — overwriting the resolved
      // scheme here would corrupt the value a later switch back to `system` needs.
      installLocalStorage();
      const cookies = installDocumentCookie(`${SYSTEM_SCHEME_COOKIE_NAME}=dark`);
      installMatchMedia(true);

      useThemeStore.getState().setTheme("light");

      expect(cookies.current()).toContain(`${SYSTEM_SCHEME_COOKIE_NAME}=dark`);
      expect(cookies.writes.every((w) => !w.startsWith(SYSTEM_SCHEME_COOKIE_NAME))).toBe(true);
    });
  });

  describe("SSR theme cookie (native)", () => {
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

    it("does not write the resolved-scheme cookie on native", () => {
      // `setSystemTheme` is reached from the native `Appearance` listener on every
      // OS theme change, so the platform guard is what keeps this web-only.
      const cookies = installDocumentCookie();

      useThemeStore.getState().setSystemTheme("dark");

      expect(useThemeStore.getState().systemTheme).toBe("dark");
      expect(cookies.writes).toHaveLength(0);
    });

    it("does not write the resolved-scheme cookie from setTheme(\"system\") on native", () => {
      const cookies = installDocumentCookie();

      useThemeStore.getState().setTheme("system");

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
