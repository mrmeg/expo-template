import { useState } from "react";
import { Animated } from "react-native";

/**
 * An `Animated.Value` created once, on the first render, and stable for the
 * component's lifetime — React Native's `useAnimatedValue`, which
 * react-native-web 0.21 does not export.
 *
 * Replaces `useRef(new Animated.Value(x)).current`, which built and discarded
 * a value on every render and read a ref during render, so the React Compiler
 * skipped the whole component. A lazy state initializer is allocated once and
 * returns a plain value the compiler can reason about. Like the ref version,
 * only the first render's `initialValue` is used.
 *
 * Private to the package: not re-exported from `lib/index.ts`.
 */
export function useAnimatedValue(initialValue: number): Animated.Value {
  const [value] = useState(() => new Animated.Value(initialValue));
  return value;
}
