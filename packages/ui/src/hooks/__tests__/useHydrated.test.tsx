import { renderHook } from "@testing-library/react-native";
import { useHydrated } from "../useHydrated";

describe("useHydrated", () => {
  it("is true in a live client tree (jest renders without hydration)", async () => {
    const { result } = await renderHook(() => useHydrated());
    expect(result.current).toBe(true);
  });
});
