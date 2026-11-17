/**
 * useResources font-loading tests.
 *
 * The interesting seam: a host app that overrides the sans-serif families via
 * `setFonts` owns loading its own faces, so the packaged Allo fetch must be
 * skipped — nothing would reference those files. Without overrides, Allo
 * (sharp, the `"allo"` preset) loads by default; every other sans preset
 * (`"allo-friendly"`, `"allo-round"`, `"geist"`, `"inter"`) is opt-in
 * (`sans` / `loadSansPreset`) and the app passes its native files. Icons are
 * SVG and never touch expo-font.
 *
 * Bundle cost: native registers only the four bundled Allo Sharp weights, and
 * web requires no TTF at all.
 */
import fs from "fs";
import path from "path";
import { renderHook, waitFor } from "@testing-library/react-native";

// One mock shared by every module registry: `jest.isolateModules` below
// re-runs this factory, and each run forwards to the same function.
const mockLoadAsync = jest.fn((_fonts: unknown) => Promise.resolve());
jest.mock("expo-font", () => ({
  loadAsync: (fonts: unknown) => mockLoadAsync(fonts),
}));

import { Platform } from "react-native";
import { loadSansPreset, useResources } from "../useResources";
import { getAlloStylesheetUrl, sansStylesheetIds } from "../../constants/alloWebFonts";
import type { SansPreset } from "../../constants/fonts";
import { alloFonts } from "../../lib/alloFonts";
import { alloFriendlyFonts } from "../../lib/alloFriendlyFonts";
import { alloRoundFonts } from "../../lib/alloRoundFonts";
import { useThemeStore } from "../../state/themeStore";

const GEIST = {
  Geist_400Regular: "geist-400",
  Geist_500Medium: "geist-500",
  Geist_600SemiBold: "geist-600",
  Geist_700Bold: "geist-700",
};

const INTER = {
  Inter_400Regular: "inter-400",
  Inter_500Medium: "inter-500",
  Inter_600SemiBold: "inter-600",
  Inter_700Bold: "inter-700",
};

/** Calls that registered the bundled Allo Sharp map (the default). */
function alloLoadCalls() {
  return mockLoadAsync.mock.calls.filter(([fontMap]) =>
    !!fontMap && typeof fontMap === "object" && "AlloSharp_400Regular" in (fontMap as object),
  );
}

describe("useResources", () => {
  beforeEach(() => {
    mockLoadAsync.mockClear();
  });

  afterEach(() => {
    useThemeStore.getState().setFonts({});
  });

  it("loads the bundled Allo Sharp weights when no font overrides are set", async () => {
    const { result } = await renderHook(() => useResources());

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(alloLoadCalls().length).toBeGreaterThan(0);
    // Allo is the only font the package loads by default: icons are SVG, not a font face.
    expect(mockLoadAsync).toHaveBeenCalledTimes(alloLoadCalls().length);
  });

  it("skips the Allo fetch when sans-serif overrides are set before mount", async () => {
    useThemeStore.getState().setFonts({
      families: { sansSerif: { regular: "Brand_Regular", medium: "Brand_Medium" } },
    });

    const { result } = await renderHook(() => useResources());

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(alloLoadCalls()).toHaveLength(0);
    // With Allo skipped there is nothing left to load.
    expect(mockLoadAsync).not.toHaveBeenCalled();
  });

  it("still loads Allo when only serif/mono are overridden", async () => {
    useThemeStore.getState().setFonts({
      families: { mono: { regular: "JetBrainsMono_400Regular" } },
    });

    const { result } = await renderHook(() => useResources());

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(alloLoadCalls().length).toBeGreaterThan(0);
  });

  it("registers exactly the bundled map: the four static weights the native families name", async () => {
    const { result } = await renderHook(() => useResources());

    await waitFor(() => expect(result.current.loaded).toBe(true));

    const registered = alloLoadCalls()[0][0] as Record<string, unknown>;
    expect(registered).toBe(alloFonts);
    expect(Object.keys(registered).sort()).toEqual([
      "AlloSharp_400Regular",
      "AlloSharp_500Medium",
      "AlloSharp_600SemiBold",
      "AlloSharp_700Bold",
    ]);
  });
});

describe("useResources sans preset", () => {
  beforeEach(() => {
    mockLoadAsync.mockClear();
    useThemeStore.getState().setSansPreset("allo");
  });

  afterEach(() => {
    useThemeStore.getState().setFonts({});
    useThemeStore.getState().setSansPreset("allo");
  });

  it("leaves Allo in place by default: only the Allo files load, preset untouched", async () => {
    const { result } = await renderHook(() => useResources());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(useThemeStore.getState().sansPreset).toBe("allo");
    expect(mockLoadAsync).toHaveBeenCalledTimes(alloLoadCalls().length);
  });

  it("treats an explicit sans: \"allo\" as the default: nothing extra loads", async () => {
    const { result } = await renderHook(() => useResources({ sans: "allo", sansFonts: INTER }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(useThemeStore.getState().sansPreset).toBe("allo");
    expect(mockLoadAsync).not.toHaveBeenCalledWith(INTER);
    expect(mockLoadAsync).toHaveBeenCalledTimes(alloLoadCalls().length);
  });

  it.each<[SansPreset, Record<string, number | string>]>([
    ["allo-friendly", alloFriendlyFonts],
    ["allo-round", alloRoundFonts],
    ["geist", GEIST],
    ["inter", INTER],
  ])("loads the %s files passed as sansFonts on native, then switches the preset", async (preset, fonts) => {
    const { result } = await renderHook(() => useResources({ sans: preset, sansFonts: fonts }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(mockLoadAsync).toHaveBeenCalledWith(fonts);
    // The default still registers alongside: it backs any text before the switch.
    expect(alloLoadCalls().length).toBeGreaterThan(0);
    expect(useThemeStore.getState().sansPreset).toBe(preset);
  });

  it("keeps Allo on native when no files are supplied", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = await renderHook(() => useResources({ sans: "inter" }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(useThemeStore.getState().sansPreset).toBe("allo");
    expect(mockLoadAsync).toHaveBeenCalledTimes(alloLoadCalls().length);
    warn.mockRestore();
  });

  it("skips every sans load when the app overrides sans through setFonts", async () => {
    useThemeStore.getState().setFonts({ families: { sansSerif: { regular: "Brand_Regular" } } });
    const { result } = await renderHook(() => useResources({ sans: "inter", sansFonts: INTER }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(mockLoadAsync).not.toHaveBeenCalled();
    expect(useThemeStore.getState().sansPreset).toBe("allo");
  });
});

describe("loadSansPreset on native", () => {
  beforeEach(() => {
    mockLoadAsync.mockClear();
    useThemeStore.getState().setSansPreset("allo");
  });

  afterEach(() => {
    useThemeStore.getState().setFonts({});
    useThemeStore.getState().setSansPreset("allo");
  });

  it("registers the files first, then switches to the preset", async () => {
    let resolveLoad: () => void = () => {};
    mockLoadAsync.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveLoad = resolve; }));

    const pending = loadSansPreset("inter", INTER);
    expect(mockLoadAsync).toHaveBeenCalledWith(INTER);
    expect(useThemeStore.getState().sansPreset).toBe("allo");

    resolveLoad();
    await pending;
    expect(useThemeStore.getState().sansPreset).toBe("inter");
  });

  it("switches back to Allo by registering the bundled Allo files, no map needed", async () => {
    useThemeStore.getState().setSansPreset("allo-round");

    await loadSansPreset("allo");

    expect(alloLoadCalls()).toHaveLength(1);
    expect(alloLoadCalls()[0][0]).toBe(alloFonts);
    expect(useThemeStore.getState().sansPreset).toBe("allo");
  });

  it("keeps the current sans when the preset has no files", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    await loadSansPreset("allo-friendly", null);

    expect(mockLoadAsync).not.toHaveBeenCalled();
    expect(useThemeStore.getState().sansPreset).toBe("allo");
    warn.mockRestore();
  });

  it("warns once per preset when a preset's native map is missing", () => {
    // The warned set is module state: a fresh registry keeps other tests'
    // warnings from using it up.
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    return new Promise<void>((resolve, reject) => {
      jest.isolateModules(() => {
        const fresh = require("../useResources") as typeof import("../useResources");
        const store = (require("../../state/themeStore") as typeof import("../../state/themeStore")).useThemeStore;
        (async () => {
          await fresh.loadSansPreset("geist");
          await fresh.loadSansPreset("geist", null);
          await fresh.loadSansPreset("allo-round");

          const messages = warn.mock.calls.map(([message]) => String(message));
          expect(messages).toHaveLength(2);
          expect(messages[0]).toContain("\"geist\" sans preset");
          expect(messages[0]).toContain("sansFonts");
          expect(messages[1]).toContain("\"allo-round\" sans preset");
          expect(messages[1]).toContain("@mrmeg/expo-ui/fonts/allo-round");
          expect(store.getState().sansPreset).toBe("allo");
          expect(mockLoadAsync).not.toHaveBeenCalled();
        })().then(resolve, reject);
      });
    }).finally(() => warn.mockRestore());
  });

  it("does nothing while a setFonts sansSerif override is set", async () => {
    useThemeStore.getState().setFonts({ families: { sansSerif: { regular: "Brand_Regular" } } });

    await loadSansPreset("inter", INTER);
    await loadSansPreset("allo");

    expect(mockLoadAsync).not.toHaveBeenCalled();
    expect(useThemeStore.getState().sansPreset).toBe("allo");
  });
});

describe("useResources serif preset", () => {
  const NEWSREADER = {
    Newsreader_400Regular: "nr-400",
    Newsreader_500Medium: "nr-500",
    Newsreader_600SemiBold: "nr-600",
    Newsreader_700Bold: "nr-700",
    Newsreader_400Regular_Italic: "nr-400i",
  };

  beforeEach(() => {
    mockLoadAsync.mockClear();
    useThemeStore.getState().setSerifPreset("georgia");
  });

  afterEach(() => {
    useThemeStore.getState().setFonts({});
    useThemeStore.getState().setSerifPreset("georgia");
  });

  it("leaves Georgia in place by default: no extra load, preset untouched", async () => {
    const { result } = await renderHook(() => useResources());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(useThemeStore.getState().serifPreset).toBe("georgia");
    expect(mockLoadAsync).toHaveBeenCalledTimes(alloLoadCalls().length);
  });

  it("loads the app-supplied Newsreader files on native, then switches the preset", async () => {
    const { result } = await renderHook(() => useResources({ serif: "newsreader", serifFonts: NEWSREADER }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(mockLoadAsync).toHaveBeenCalledWith(NEWSREADER);
    expect(useThemeStore.getState().serifPreset).toBe("newsreader");
  });

  it("keeps Georgia on native when no files are supplied, and says so", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = await renderHook(() => useResources({ serif: "newsreader" }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(useThemeStore.getState().serifPreset).toBe("georgia");
    expect(mockLoadAsync).toHaveBeenCalledTimes(alloLoadCalls().length);
    expect(warn.mock.calls.some(([message]) => String(message).includes("serifFonts"))).toBe(true);
    warn.mockRestore();
  });

  it("skips the Newsreader load when the app overrides serif through setFonts", async () => {
    useThemeStore.getState().setFonts({ families: { serif: { regular: "Brand_Serif" } } });
    const { result } = await renderHook(() => useResources({ serif: "newsreader", serifFonts: NEWSREADER }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(mockLoadAsync).not.toHaveBeenCalledWith(NEWSREADER);
    expect(useThemeStore.getState().serifPreset).toBe("georgia");
  });
});

describe("useResources on web", () => {
  const originalOS = Platform.OS;
  type FakeLink = { id: string; rel: string; href: string; onload?: () => void; onerror?: () => void };
  let links: FakeLink[];
  const linksWithId = (id: string) => links.filter((link) => link.id === id);

  beforeEach(() => {
    mockLoadAsync.mockClear();
    useThemeStore.getState().setSerifPreset("georgia");
    useThemeStore.getState().setSansPreset("allo");
    links = [];
    (Platform as { OS: string }).OS = "web";
    (globalThis as unknown as { document: unknown }).document = {
      getElementById: (id: string) => links.find((link) => link.id === id) ?? null,
      createElement: () => ({ id: "", rel: "", href: "" }) as FakeLink,
      head: {
        appendChild: (link: FakeLink) => {
          links.push(link);
          link.onload?.();
        },
      },
    };
  });

  afterEach(() => {
    (Platform as { OS: string }).OS = originalOS;
    delete (globalThis as unknown as { document?: unknown }).document;
    useThemeStore.getState().setFonts({});
    useThemeStore.getState().setSerifPreset("georgia");
    useThemeStore.getState().setSansPreset("allo");
  });

  it("injects the Allo stylesheet by default, once, and no other sans", async () => {
    const first = await renderHook(() => useResources());
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    const second = await renderHook(() => useResources());
    await waitFor(() => expect(second.result.current.loaded).toBe(true));

    const allo = linksWithId(sansStylesheetIds.allo);
    expect(allo).toHaveLength(1);
    expect(allo[0].href).toBe(getAlloStylesheetUrl("allo"));
    expect(allo[0].rel).toBe("stylesheet");
    expect(links).toHaveLength(1);
    expect(useThemeStore.getState().sansPreset).toBe("allo");
    expect(mockLoadAsync).not.toHaveBeenCalled();
  });

  it("skips the Allo stylesheet when the document already carries its faces", async () => {
    links.push({ id: sansStylesheetIds.allo, rel: "", href: "" });
    const { result } = await renderHook(() => useResources());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(linksWithId(sansStylesheetIds.allo)).toHaveLength(1);
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe("");
  });

  it("injects nothing for sans when the app overrides it through setFonts", async () => {
    useThemeStore.getState().setFonts({ families: { sansSerif: { regular: "Brand" } } });
    const { result } = await renderHook(() => useResources({ sans: "allo-round" }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(links).toHaveLength(0);
    expect(useThemeStore.getState().sansPreset).toBe("allo");
  });

  it.each<["allo-friendly" | "allo-round"]>([["allo-friendly"], ["allo-round"]])(
    "adds the %s stylesheet from the package, once, and switches the preset right away",
    async (preset) => {
      const first = await renderHook(() => useResources({ sans: preset }));
      await waitFor(() => expect(first.result.current.loaded).toBe(true));
      const second = await renderHook(() => useResources({ sans: preset }));
      await waitFor(() => expect(second.result.current.loaded).toBe(true));

      const sheet = linksWithId(sansStylesheetIds[preset]);
      expect(sheet).toHaveLength(1);
      expect(sheet[0].href).toBe(getAlloStylesheetUrl(preset));
      // The default sheet loads too: it backs text until the switch.
      expect(linksWithId(sansStylesheetIds.allo)).toHaveLength(1);
      expect(useThemeStore.getState().sansPreset).toBe(preset);
      // No native files on web, supplied or not.
      expect(mockLoadAsync).not.toHaveBeenCalled();
    },
  );

  it("adds the Geist stylesheet from Google Fonts and switches the preset", async () => {
    const { result } = await renderHook(() => useResources({ sans: "geist", sansFonts: GEIST }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    const geist = linksWithId(sansStylesheetIds.geist);
    expect(geist).toHaveLength(1);
    expect(geist[0].href).toContain("family=Geist:wght@400;500;600;700");
    expect(useThemeStore.getState().sansPreset).toBe("geist");
    expect(mockLoadAsync).not.toHaveBeenCalled();
  });

  it("adds the Inter stylesheet with the 400 italic, once, and switches the preset right away", async () => {
    const first = await renderHook(() => useResources({ sans: "inter" }));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    const second = await renderHook(() => useResources({ sans: "inter" }));
    await waitFor(() => expect(second.result.current.loaded).toBe(true));

    const inter = linksWithId(sansStylesheetIds.inter);
    expect(inter).toHaveLength(1);
    expect(inter[0].href).toContain("Inter:ital,wght@0,400;0,500;0,600;0,700;1,400");
    expect(useThemeStore.getState().sansPreset).toBe("inter");
    // No native files on web, supplied or not.
    expect(mockLoadAsync).not.toHaveBeenCalled();
  });

  it("loadSansPreset injects the stylesheet and switches the preset on web", async () => {
    await loadSansPreset("inter");
    expect(linksWithId(sansStylesheetIds.inter)).toHaveLength(1);
    expect(useThemeStore.getState().sansPreset).toBe("inter");

    await loadSansPreset("allo");
    expect(linksWithId(sansStylesheetIds.allo)).toHaveLength(1);
    expect(useThemeStore.getState().sansPreset).toBe("allo");
    expect(mockLoadAsync).not.toHaveBeenCalled();
  });

  it("injects the Newsreader stylesheet and switches the preset right away", async () => {
    const { result } = await renderHook(() => useResources({ serif: "newsreader" }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    const newsreader = linksWithId("mrmeg-expo-ui-newsreader");
    expect(newsreader).toHaveLength(1);
    expect(newsreader[0].href).toContain("Newsreader:ital,wght@0,400;0,500;0,600;0,700;1,400");
    expect(useThemeStore.getState().serifPreset).toBe("newsreader");
    // No native files on web, supplied or not.
    expect(mockLoadAsync).not.toHaveBeenCalled();
  });
});

describe("Allo font imports", () => {
  const libDir = path.join(__dirname, "..", "..", "lib");
  const read = (file: string) => fs.readFileSync(file, "utf8");
  const importSpecifiers = (source: string) =>
    [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);

  it("requires no TTF on web: the web font maps hold no require", () => {
    for (const file of ["alloFonts.ts", "alloFriendlyFonts.ts", "alloRoundFonts.ts"]) {
      expect(read(path.join(libDir, file))).not.toMatch(/require\(/);
    }
  });

  it("keeps useResources off the opt-in font maps and the Google font packages", () => {
    const hookSource = read(path.join(__dirname, "..", "useResources.ts"));
    const specifiers = importSpecifiers(hookSource);

    expect(specifiers.filter((s) => s.includes("expo-google-fonts"))).toEqual([]);
    // Only the default map: an app that never opts in ships no other cut.
    expect(specifiers.filter((s) => /\/(lib|fonts)\/allo/.test(s))).toEqual(["../lib/alloFonts"]);
  });

  it("keeps expo-font out of the web graph", () => {
    const hookSource = read(path.join(__dirname, "..", "useResources.ts"));
    const webLoader = read(path.join(libDir, "loadNativeFonts.ts"));
    const nativeLoader = read(path.join(libDir, "loadNativeFonts.native.ts"));

    expect(importSpecifiers(hookSource)).not.toContain("expo-font");
    expect(importSpecifiers(webLoader)).toEqual([]);
    expect(importSpecifiers(nativeLoader)).toContain("expo-font");
  });
});
