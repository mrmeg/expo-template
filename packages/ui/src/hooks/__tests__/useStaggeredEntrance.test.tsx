/**
 * useStaggeredEntrance hook tests
 *
 * Tests entrance animation hook returns valid animated styles
 * for each animation type.
 */

import { renderHook } from "@testing-library/react-native";
import { useStaggeredEntrance } from "../useStaggeredEntrance";

describe("useStaggeredEntrance", () => {
  it("returns an animated style object for fade type", async () => {
    const { result } = await renderHook(() =>
      useStaggeredEntrance({ type: "fade" })
    );

    expect(result.current).toBeDefined();
    expect(typeof result.current).toBe("object");
  });

  it("returns opacity for fade type", async () => {
    const { result } = await renderHook(() =>
      useStaggeredEntrance({ type: "fade" })
    );

    // The hook returns a React Native Animated style object.
    expect(result.current).toHaveProperty("opacity");
  });

  it("returns opacity and transform for fadeSlideUp type", async () => {
    const { result } = await renderHook(() =>
      useStaggeredEntrance({ type: "fadeSlideUp" })
    );

    expect(result.current).toHaveProperty("opacity");
    expect(result.current).toHaveProperty("transform");
  });

  it("returns opacity and transform for fadeSlideDown type", async () => {
    const { result } = await renderHook(() =>
      useStaggeredEntrance({ type: "fadeSlideDown" })
    );

    expect(result.current).toHaveProperty("opacity");
    expect(result.current).toHaveProperty("transform");
  });

  it("returns opacity and transform for scale type", async () => {
    const { result } = await renderHook(() =>
      useStaggeredEntrance({ type: "scale" })
    );

    expect(result.current).toHaveProperty("opacity");
    expect(result.current).toHaveProperty("transform");
  });

  it("uses default type fadeSlideUp when no options given", async () => {
    const { result } = await renderHook(() => useStaggeredEntrance());

    expect(result.current).toHaveProperty("opacity");
    expect(result.current).toHaveProperty("transform");
  });
});
