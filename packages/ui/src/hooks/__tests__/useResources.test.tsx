/**
 * useResources font-loading tests.
 *
 * The interesting seam: a host app that overrides the sans-serif families via
 * `setFonts` owns loading its own faces, so the packaged Inter fetch must be
 * skipped — nothing would reference those files. Without overrides, Inter
 * loads exactly as before. Icons are SVG and never touch expo-font.
 *
 * Bundle cost: native imports only the four weights it registers, each from
 * its per-weight subpath (the package root `require`s all 18 faces, and Metro
 * ships every file a bundle requires), and web imports no TTF at all.
 */
import fs from "fs";
import path from "path";
import { renderHook, waitFor } from "@testing-library/react-native";

jest.mock("expo-font", () => ({
  loadAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("@expo-google-fonts/inter/400Regular", () => ({ Inter_400Regular: "inter-400-asset" }));
jest.mock("@expo-google-fonts/inter/500Medium", () => ({ Inter_500Medium: "inter-500-asset" }));
jest.mock("@expo-google-fonts/inter/600SemiBold", () => ({ Inter_600SemiBold: "inter-600-asset" }));
jest.mock("@expo-google-fonts/inter/700Bold", () => ({ Inter_700Bold: "inter-700-asset" }));
// The root entry requires every weight and italic. Nothing may load it.
jest.mock("@expo-google-fonts/inter", () => {
  throw new Error("@expo-google-fonts/inter root entry imported; use the per-weight subpaths");
});

import * as Font from "expo-font";
import { Platform } from "react-native";
import { useResources } from "../useResources";
import { interFontMap } from "../../lib/interFonts";
import { useThemeStore } from "../../state/themeStore";

const mockLoadAsync = Font.loadAsync as jest.Mock;

/** Calls that requested the Inter static-weight map. */
function interLoadCalls() {
  return mockLoadAsync.mock.calls.filter(([fontMap]) =>
    !!fontMap && typeof fontMap === "object" && "Inter_400Regular" in (fontMap as object),
  );
}

describe("useResources", () => {
  beforeEach(() => {
    mockLoadAsync.mockClear();
  });

  afterEach(() => {
    useThemeStore.getState().setFonts({});
  });

  it("loads the packaged Inter weights when no font overrides are set", async () => {
    const { result } = await renderHook(() => useResources());

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(interLoadCalls().length).toBeGreaterThan(0);
    // Inter is the only font the package owns: icons are SVG, not a font face.
    expect(mockLoadAsync).toHaveBeenCalledTimes(interLoadCalls().length);
  });

  it("skips the Inter fetch when sans-serif overrides are set before mount", async () => {
    useThemeStore.getState().setFonts({
      families: { sansSerif: { regular: "Brand_Regular", medium: "Brand_Medium" } },
    });

    const { result } = await renderHook(() => useResources());

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(interLoadCalls()).toHaveLength(0);
    // With Inter skipped there is nothing left to load.
    expect(mockLoadAsync).not.toHaveBeenCalled();
  });

  it("still loads Inter when only serif/mono are overridden", async () => {
    useThemeStore.getState().setFonts({
      families: { mono: { regular: "JetBrainsMono_400Regular" } },
    });

    const { result } = await renderHook(() => useResources());

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(interLoadCalls().length).toBeGreaterThan(0);
  });

  it("registers exactly the four static weights the native families name", async () => {
    const { result } = await renderHook(() => useResources());

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(interLoadCalls()[0][0]).toEqual({
      Inter_400Regular: "inter-400-asset",
      Inter_500Medium: "inter-500-asset",
      Inter_600SemiBold: "inter-600-asset",
      Inter_700Bold: "inter-700-asset",
    });
    expect(interLoadCalls()[0][0]).toBe(interFontMap);
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
    expect(mockLoadAsync).toHaveBeenCalledTimes(interLoadCalls().length);
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
    expect(mockLoadAsync).toHaveBeenCalledTimes(interLoadCalls().length);
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
  });

  it("injects the Inter stylesheet with the 400 italic, once", async () => {
    const first = await renderHook(() => useResources());
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    const second = await renderHook(() => useResources());
    await waitFor(() => expect(second.result.current.loaded).toBe(true));

    const inter = links.filter((link) => link.id === "mrmeg-expo-ui-inter");
    expect(inter).toHaveLength(1);
    expect(inter[0].href).toContain("Inter:ital,wght@0,400;0,500;0,600;0,700;1,400");
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

describe("Inter font imports", () => {
  const libDir = path.join(__dirname, "..", "..", "lib");
  const read = (file: string) => fs.readFileSync(file, "utf8");
  const importSpecifiers = (source: string) =>
    [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);

  it("imports each native weight from its own subpath, never the package root", () => {
    const specifiers = importSpecifiers(read(path.join(libDir, "interFonts.native.ts")))
      .filter((specifier) => specifier.startsWith("@expo-google-fonts/"));

    expect(specifiers.sort()).toEqual([
      "@expo-google-fonts/inter/400Regular",
      "@expo-google-fonts/inter/500Medium",
      "@expo-google-fonts/inter/600SemiBold",
      "@expo-google-fonts/inter/700Bold",
    ]);
  });

  it("imports no TTF on web", () => {
    const webSource = read(path.join(libDir, "interFonts.ts"));

    expect(importSpecifiers(webSource).filter((s) => s.includes("expo-google-fonts"))).toEqual([]);
    expect(webSource).not.toMatch(/require\(/);
    expect(jest.requireActual<typeof import("../../lib/interFonts")>(path.join(libDir, "interFonts.ts")).interFontMap)
      .toBeNull();
  });

  it("keeps useResources off the font package entirely", () => {
    const hookSource = read(path.join(__dirname, "..", "useResources.ts"));

    expect(importSpecifiers(hookSource).filter((s) => s.includes("expo-google-fonts"))).toEqual([]);
  });
});
