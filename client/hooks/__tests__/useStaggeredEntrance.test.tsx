/**
 * useStaggeredEntrance hook tests
 *
 * Tests entrance animation hook returns valid animated styles
 * for each animation type.
 */

import { renderHook } from "@testing-library/react-native";
import { useStaggeredEntrance } from "../useStaggeredEntrance";

describe("useStaggeredEntrance", () => {
  it("returns an animated style object for fade type", () => {
    const { result } = renderHook(() =>
      useStaggeredEntrance({ type: "fade" })
    );

    expect(result.current).toBeDefined();
    expect(typeof result.current).toBe("object");
  });

  it("returns opacity for fade type", () => {
    const { result } = renderHook(() =>
      useStaggeredEntrance({ type: "fade" })
    );

    // With mocked Reanimated, useAnimatedStyle returns the fn result
    expect(result.current).toHaveProperty("opacity");
  });

  it("returns opacity and transform for fadeSlideUp type", () => {
    const { result } = renderHook(() =>
      useStaggeredEntrance({ type: "fadeSlideUp" })
    );

    expect(result.current).toHaveProperty("opacity");
    expect(result.current).toHaveProperty("transform");
  });

  it("returns opacity and transform for fadeSlideDown type", () => {
    const { result } = renderHook(() =>
      useStaggeredEntrance({ type: "fadeSlideDown" })
    );

    expect(result.current).toHaveProperty("opacity");
    expect(result.current).toHaveProperty("transform");
  });

  it("returns opacity and transform for scale type", () => {
    const { result } = renderHook(() =>
      useStaggeredEntrance({ type: "scale" })
    );

    expect(result.current).toHaveProperty("opacity");
    expect(result.current).toHaveProperty("transform");
  });

  it("uses default type fadeSlideUp when no options given", () => {
    const { result } = renderHook(() => useStaggeredEntrance());

    expect(result.current).toHaveProperty("opacity");
    expect(result.current).toHaveProperty("transform");
  });
});
