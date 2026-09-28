/**
 * useAnimatedValue — the package's stand-in for React Native's hook, which
 * react-native-web 0.21 does not export. It replaces
 * `useRef(new Animated.Value(x)).current`, so it must keep that contract: one
 * value for the component's lifetime, seeded from the first render only.
 */
import { Animated } from "react-native";
import { renderHook } from "@testing-library/react-native";
import { useAnimatedValue } from "../useAnimatedValue";

describe("useAnimatedValue", () => {
  it("returns one Animated.Value for the component's lifetime", async () => {
    const { result, rerender } = await renderHook(
      ({ initial }: { initial: number }) => useAnimatedValue(initial),
      { initialProps: { initial: 0.4 } }
    );
    const first = result.current;

    expect(first).toBeInstanceOf(Animated.Value);
    expect((first as unknown as { __getValue(): number }).__getValue()).toBe(0.4);

    await rerender({ initial: 1 });

    expect(result.current).toBe(first);
    // Like the ref it replaces, a later initial value is ignored.
    expect((result.current as unknown as { __getValue(): number }).__getValue()).toBe(0.4);
  });
});
