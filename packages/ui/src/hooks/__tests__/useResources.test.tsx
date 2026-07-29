/**
 * useResources font-loading tests.
 *
 * The interesting seam: a host app that overrides the sans-serif families via
 * `setFonts` owns loading its own faces, so the packaged Inter fetch must be
 * skipped — nothing would reference those files. Without overrides, Inter
 * loads exactly as before. The Feather icon font loads in both cases.
 */
import { renderHook, waitFor } from "@testing-library/react-native";

// The factory creates the jest.fn itself: `useResources` calls
// `Font.loadAsync` at module scope, which runs during import hoisting —
// before any const declared here would be initialised.
jest.mock("expo-font", () => ({
  loadAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("@expo/vector-icons/Feather", () => ({
  __esModule: true,
  default: { font: { Feather: "feather-font-asset" } },
}));

jest.mock("@expo-google-fonts/inter", () => ({
  Inter_400Regular: "inter-400-asset",
  Inter_500Medium: "inter-500-asset",
  Inter_600SemiBold: "inter-600-asset",
  Inter_700Bold: "inter-700-asset",
}));

import * as Font from "expo-font";
import { useResources } from "../useResources";
import { useThemeStore } from "../../state/themeStore";

const mockLoadAsync = Font.loadAsync as jest.Mock;

/** Calls that requested the Inter static-weight map. */
function interLoadCalls() {
  return mockLoadAsync.mock.calls.filter(([fontMap]) =>
    !!fontMap && typeof fontMap === "object" && "Inter_400Regular" in (fontMap as object),
  );
}

function featherLoadCalls() {
  return mockLoadAsync.mock.calls.filter(([fontMap]) =>
    !!fontMap && typeof fontMap === "object" && "Feather" in (fontMap as object),
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
    expect(featherLoadCalls().length).toBeGreaterThan(0);
  });

  it("skips the Inter fetch when sans-serif overrides are set before mount", async () => {
    useThemeStore.getState().setFonts({
      families: { sansSerif: { regular: "Brand_Regular", medium: "Brand_Medium" } },
    });

    const { result } = await renderHook(() => useResources());

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(interLoadCalls()).toHaveLength(0);
    // Feather is package-owned iconography and must load regardless.
    expect(featherLoadCalls().length).toBeGreaterThan(0);
  });

  it("still loads Inter when only serif/mono are overridden", async () => {
    useThemeStore.getState().setFonts({
      families: { mono: { regular: "JetBrainsMono_400Regular" } },
    });

    const { result } = await renderHook(() => useResources());

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(interLoadCalls().length).toBeGreaterThan(0);
  });
});
