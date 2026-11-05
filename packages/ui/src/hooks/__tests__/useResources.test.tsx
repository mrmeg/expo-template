/**
 * useResources font-loading tests.
 *
 * The interesting seam: a host app that overrides the sans-serif families via
 * `setFonts` owns loading its own faces, so the packaged Geist fetch must be
 * skipped — nothing would reference those files. Without overrides, Geist
 * loads by default; Inter is opt-in (`sans: "inter"` / `loadSansPreset`) and
 * the app supplies its files. Icons are SVG and never touch expo-font.
 *
 * Bundle cost: native imports only the four weights it registers, each from
 * its per-weight subpath (the package root `require`s every face, and Metro
 * ships every file a bundle requires), and web imports no TTF at all.
 */
import fs from "fs";
import path from "path";
import { renderHook, waitFor } from "@testing-library/react-native";

jest.mock("expo-font", () => ({
  loadAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("@expo-google-fonts/geist/400Regular", () => ({ Geist_400Regular: "geist-400-asset" }));
jest.mock("@expo-google-fonts/geist/500Medium", () => ({ Geist_500Medium: "geist-500-asset" }));
jest.mock("@expo-google-fonts/geist/600SemiBold", () => ({ Geist_600SemiBold: "geist-600-asset" }));
jest.mock("@expo-google-fonts/geist/700Bold", () => ({ Geist_700Bold: "geist-700-asset" }));
// The root entry requires every weight and italic. Nothing may load it.
jest.mock("@expo-google-fonts/geist", () => {
  throw new Error("@expo-google-fonts/geist root entry imported; use the per-weight subpaths");
});

import * as Font from "expo-font";
import { Platform } from "react-native";
import { loadSansPreset, useResources } from "../useResources";
import { geistFontMap } from "../../lib/geistFonts";
import { useThemeStore } from "../../state/themeStore";

const mockLoadAsync = Font.loadAsync as jest.Mock;

const INTER = {
  Inter_400Regular: "inter-400",
  Inter_500Medium: "inter-500",
  Inter_600SemiBold: "inter-600",
  Inter_700Bold: "inter-700",
};

/** Calls that requested the Geist static-weight map. */
function geistLoadCalls() {
  return mockLoadAsync.mock.calls.filter(([fontMap]) =>
    !!fontMap && typeof fontMap === "object" && "Geist_400Regular" in (fontMap as object),
  );
}

describe("useResources", () => {
  beforeEach(() => {
    mockLoadAsync.mockClear();
  });

  afterEach(() => {
    useThemeStore.getState().setFonts({});
  });

  it("loads the packaged Geist weights when no font overrides are set", async () => {
    const { result } = await renderHook(() => useResources());

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(geistLoadCalls().length).toBeGreaterThan(0);
    // Geist is the only font the package owns: icons are SVG, not a font face.
    expect(mockLoadAsync).toHaveBeenCalledTimes(geistLoadCalls().length);
  });

  it("skips the Geist fetch when sans-serif overrides are set before mount", async () => {
    useThemeStore.getState().setFonts({
      families: { sansSerif: { regular: "Brand_Regular", medium: "Brand_Medium" } },
    });

    const { result } = await renderHook(() => useResources());

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(geistLoadCalls()).toHaveLength(0);
    // With Geist skipped there is nothing left to load.
    expect(mockLoadAsync).not.toHaveBeenCalled();
  });

  it("still loads Geist when only serif/mono are overridden", async () => {
    useThemeStore.getState().setFonts({
      families: { mono: { regular: "JetBrainsMono_400Regular" } },
    });

    const { result } = await renderHook(() => useResources());

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(geistLoadCalls().length).toBeGreaterThan(0);
  });

  it("registers exactly the four static weights the native families name", async () => {
    const { result } = await renderHook(() => useResources());

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(geistLoadCalls()[0][0]).toEqual({
      Geist_400Regular: "geist-400-asset",
      Geist_500Medium: "geist-500-asset",
      Geist_600SemiBold: "geist-600-asset",
      Geist_700Bold: "geist-700-asset",
    });
    expect(geistLoadCalls()[0][0]).toBe(geistFontMap);
  });
});

describe("useResources sans preset", () => {
  beforeEach(() => {
    mockLoadAsync.mockClear();
    useThemeStore.getState().setSansPreset("geist");
  });

  afterEach(() => {
    useThemeStore.getState().setFonts({});
    useThemeStore.getState().setSansPreset("geist");
  });

  it("leaves Geist in place by default: only the Geist files load, preset untouched", async () => {
    const { result } = await renderHook(() => useResources());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(useThemeStore.getState().sansPreset).toBe("geist");
    expect(mockLoadAsync).toHaveBeenCalledTimes(geistLoadCalls().length);
  });

  it("loads the app-supplied Inter files on native, then switches the preset", async () => {
    const { result } = await renderHook(() => useResources({ sans: "inter", sansFonts: INTER }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(mockLoadAsync).toHaveBeenCalledWith(INTER);
    expect(geistLoadCalls().length).toBeGreaterThan(0);
    expect(useThemeStore.getState().sansPreset).toBe("inter");
  });

  it("keeps Geist on native when no Inter files are supplied, and says so", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = await renderHook(() => useResources({ sans: "inter" }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(useThemeStore.getState().sansPreset).toBe("geist");
    expect(mockLoadAsync).toHaveBeenCalledTimes(geistLoadCalls().length);
    expect(warn.mock.calls.some(([message]) => String(message).includes("sansFonts"))).toBe(true);
    warn.mockRestore();
  });

  it("skips the Inter load when the app overrides sans through setFonts", async () => {
    useThemeStore.getState().setFonts({ families: { sansSerif: { regular: "Brand_Regular" } } });
    const { result } = await renderHook(() => useResources({ sans: "inter", sansFonts: INTER }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(mockLoadAsync).not.toHaveBeenCalled();
    expect(useThemeStore.getState().sansPreset).toBe("geist");
  });
});

describe("loadSansPreset on native", () => {
  beforeEach(() => {
    mockLoadAsync.mockClear();
    useThemeStore.getState().setSansPreset("geist");
  });

  afterEach(() => {
    useThemeStore.getState().setFonts({});
    useThemeStore.getState().setSansPreset("geist");
  });

  it("registers the files first, then switches to Inter", async () => {
    let resolveLoad: () => void = () => {};
    mockLoadAsync.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveLoad = resolve; }));

    const pending = loadSansPreset("inter", INTER);
    expect(mockLoadAsync).toHaveBeenCalledWith(INTER);
    expect(useThemeStore.getState().sansPreset).toBe("geist");

    resolveLoad();
    await pending;
    expect(useThemeStore.getState().sansPreset).toBe("inter");
  });

  it("switches back to Geist by registering the bundled Geist files", async () => {
    useThemeStore.getState().setSansPreset("inter");

    await loadSansPreset("geist");

    expect(geistLoadCalls()).toHaveLength(1);
    expect(useThemeStore.getState().sansPreset).toBe("geist");
  });

  it("keeps the current sans when Inter has no files", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    await loadSansPreset("inter", null);

    expect(mockLoadAsync).not.toHaveBeenCalled();
    expect(useThemeStore.getState().sansPreset).toBe("geist");
    warn.mockRestore();
  });

  it("does nothing while a setFonts sansSerif override is set", async () => {
    useThemeStore.getState().setFonts({ families: { sansSerif: { regular: "Brand_Regular" } } });

    await loadSansPreset("inter", INTER);

    expect(mockLoadAsync).not.toHaveBeenCalled();
    expect(useThemeStore.getState().sansPreset).toBe("geist");
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
    expect(mockLoadAsync).toHaveBeenCalledTimes(geistLoadCalls().length);
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
    expect(mockLoadAsync).toHaveBeenCalledTimes(geistLoadCalls().length);
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

  beforeEach(() => {
    mockLoadAsync.mockClear();
    useThemeStore.getState().setSerifPreset("georgia");
    useThemeStore.getState().setSansPreset("geist");
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
    useThemeStore.getState().setSansPreset("geist");
  });

  it("injects the Geist stylesheet by default, once, and no Inter", async () => {
    const first = await renderHook(() => useResources());
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    const second = await renderHook(() => useResources());
    await waitFor(() => expect(second.result.current.loaded).toBe(true));

    const geist = links.filter((link) => link.id === "mrmeg-expo-ui-geist");
    expect(geist).toHaveLength(1);
    expect(geist[0].href).toContain("family=Geist:wght@400;500;600;700");
    expect(links.filter((link) => link.id === "mrmeg-expo-ui-inter")).toHaveLength(0);
    expect(useThemeStore.getState().sansPreset).toBe("geist");
    expect(mockLoadAsync).not.toHaveBeenCalled();
  });

  it("skips the Geist stylesheet when the document already carries its faces", async () => {
    links.push({ id: "mrmeg-expo-ui-geist", rel: "", href: "" });
    const { result } = await renderHook(() => useResources());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(links.filter((link) => link.id === "mrmeg-expo-ui-geist")).toHaveLength(1);
  });

  it("adds the Inter stylesheet with the 400 italic, once, and switches the preset right away", async () => {
    const first = await renderHook(() => useResources({ sans: "inter" }));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    const second = await renderHook(() => useResources({ sans: "inter" }));
    await waitFor(() => expect(second.result.current.loaded).toBe(true));

    const inter = links.filter((link) => link.id === "mrmeg-expo-ui-inter");
    expect(inter).toHaveLength(1);
    expect(inter[0].href).toContain("Inter:ital,wght@0,400;0,500;0,600;0,700;1,400");
    expect(useThemeStore.getState().sansPreset).toBe("inter");
    // No native files on web, supplied or not.
    expect(mockLoadAsync).not.toHaveBeenCalled();
  });

  it("loadSansPreset injects the stylesheet and switches the preset on web", async () => {
    await loadSansPreset("inter");
    expect(links.filter((link) => link.id === "mrmeg-expo-ui-inter")).toHaveLength(1);
    expect(useThemeStore.getState().sansPreset).toBe("inter");

    await loadSansPreset("geist");
    expect(links.filter((link) => link.id === "mrmeg-expo-ui-geist")).toHaveLength(1);
    expect(useThemeStore.getState().sansPreset).toBe("geist");
    expect(mockLoadAsync).not.toHaveBeenCalled();
  });

  it("injects the Newsreader stylesheet and switches the preset right away", async () => {
    const { result } = await renderHook(() => useResources({ serif: "newsreader" }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    const newsreader = links.filter((link) => link.id === "mrmeg-expo-ui-newsreader");
    expect(newsreader).toHaveLength(1);
    expect(newsreader[0].href).toContain("Newsreader:ital,wght@0,400;0,500;0,600;0,700;1,400");
    expect(useThemeStore.getState().serifPreset).toBe("newsreader");
    // No native files on web, supplied or not.
    expect(mockLoadAsync).not.toHaveBeenCalled();
  });
});

describe("Geist font imports", () => {
  const libDir = path.join(__dirname, "..", "..", "lib");
  const read = (file: string) => fs.readFileSync(file, "utf8");
  const importSpecifiers = (source: string) =>
    [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);

  it("imports each native weight from its own subpath, never the package root", () => {
    const specifiers = importSpecifiers(read(path.join(libDir, "geistFonts.native.ts")))
      .filter((specifier) => specifier.startsWith("@expo-google-fonts/"));

    expect(specifiers.sort()).toEqual([
      "@expo-google-fonts/geist/400Regular",
      "@expo-google-fonts/geist/500Medium",
      "@expo-google-fonts/geist/600SemiBold",
      "@expo-google-fonts/geist/700Bold",
    ]);
  });

  it("imports no TTF on web", () => {
    const webSource = read(path.join(libDir, "geistFonts.ts"));

    expect(importSpecifiers(webSource).filter((s) => s.includes("expo-google-fonts"))).toEqual([]);
    expect(webSource).not.toMatch(/require\(/);
    expect(jest.requireActual<typeof import("../../lib/geistFonts")>(path.join(libDir, "geistFonts.ts")).geistFontMap)
      .toBeNull();
  });

  it("keeps useResources off the font package entirely", () => {
    const hookSource = read(path.join(__dirname, "..", "useResources.ts"));

    expect(importSpecifiers(hookSource).filter((s) => s.includes("expo-google-fonts"))).toEqual([]);
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
