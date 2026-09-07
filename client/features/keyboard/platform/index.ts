/**
 * Web: no-op replacements for react-native-keyboard-controller
 * to avoid bundling it on web where it's not needed.
 */
import React from "react";
import { ScrollView, View, type ScrollViewProps, type ViewStyle } from "react-native";

/**
 * No-op KeyboardProvider for web - just renders children
 */
export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  return children as React.ReactElement;
}

/**
 * On web, KeyboardAwareScrollView is just a regular ScrollView
 */
export const KeyboardAwareScrollView = ScrollView as React.ComponentType<ScrollViewProps & { [key: string]: any }>;

/**
 * On web there is no software keyboard to dismiss, so the overlay renders nothing.
 */
export function DismissKeyboardOverlay() {
  return null;
}

export function KeyboardDismissBoundary({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return React.createElement(View, { style }, children);
}

/**
 * Web has no software keyboard to track, so the tab bar never needs to hide.
 * Keeping this a plain function (no hook calls) keeps it safe from any call
 * site, and keeps react-native-keyboard-controller out of the web bundle.
 */
export function useKeyboardVisible(): boolean {
  return false;
}
