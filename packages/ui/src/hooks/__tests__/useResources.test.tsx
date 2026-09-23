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
