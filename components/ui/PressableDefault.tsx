import React, { forwardRef, ForwardedRef } from "react";
import { Pressable, StyleProp, ViewStyle, PressableProps, View } from "react-native";

type Props = {
  children: React.ReactNode;
  disabled?: boolean;
  disabledOpacity?: number;
  hitslop?: number;
  onPress: PressableProps["onPress"];
  pressedOpacity?: number;
  style?: StyleProp<ViewStyle>;
} & Omit<PressableProps, "style">;

export const PressableDefault = forwardRef<View, Props>(({
  children,
  disabled,
  disabledOpacity,
  hitslop,
  onPress,
  pressedOpacity,
  style,
  ...rest
}, ref: ForwardedRef<View>) => {
  const calculateOpacity = (pressed: boolean) => {
    if (disabled) {
      return disabledOpacity;
    } else if (pressed) {
      return pressedOpacity || 0.5;
    } else {
      return 1;
    }
  };

  return (
    <Pressable
      ref={ref}
      disabled={disabled}
      hitSlop={hitslop || 0}
      onPress={onPress}
      style={({ pressed }) => {
        const currentOpacity = calculateOpacity(pressed);
        return [{ opacity: currentOpacity }, style];
      }}
      {...rest}
    >
      {children}
    </Pressable>
  );
});

PressableDefault.displayName = "PressableDefault";