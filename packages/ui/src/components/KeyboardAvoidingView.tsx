import React, { createContext, useContext } from "react";
import {
  Platform,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { NativeKeyboardAvoidingView } from "./keyboardController";

type KeyboardAvoidingBehavior = "height" | "padding" | "position" | "translate-with-padding";

export interface KeyboardAvoidingViewProps extends ViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  behavior?: KeyboardAvoidingBehavior;
  contentContainerStyle?: ViewProps["style"];
  keyboardVerticalOffset?: number;
  automaticOffset?: boolean;
}

const KeyboardAvoidanceContext = createContext(false);

export function useKeyboardAvoidance() {
  return useContext(KeyboardAvoidanceContext);
}

/**
 * Package-level keyboard avoiding wrapper.
 *
 * Native uses `react-native-keyboard-controller` (through the platform-split
 * `./keyboardController` module, which keeps the package out of the web bundle)
 * so screens can avoid the soft keyboard with `automaticOffset`; web renders a
 * plain `View`.
 */
export function KeyboardAvoidingView({
  children,
  style,
  behavior: behaviorProp,
  automaticOffset = true,
  contentContainerStyle,
  keyboardVerticalOffset,
  ...props
}: KeyboardAvoidingViewProps) {
  // Resolved in the body rather than as a default parameter: the React
  // Compiler can't reorder a computed default, and skipped the component.
  const behavior = behaviorProp === undefined ? (Platform.OS === "ios" ? "padding" : "height") : behaviorProp;

  if (Platform.OS === "web") {
    return (
      <KeyboardAvoidanceContext.Provider value>
        <View style={style} {...props}>
          {children}
        </View>
      </KeyboardAvoidanceContext.Provider>
    );
  }

  return (
    <KeyboardAvoidanceContext.Provider value>
      <NativeKeyboardAvoidingView
        style={style}
        behavior={behavior}
        automaticOffset={automaticOffset}
        contentContainerStyle={contentContainerStyle}
        keyboardVerticalOffset={keyboardVerticalOffset}
        {...props}
      >
        {children}
      </NativeKeyboardAvoidingView>
    </KeyboardAvoidanceContext.Provider>
  );
}
