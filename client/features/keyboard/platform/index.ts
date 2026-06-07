/**
 * Web: no-op replacements for react-native-keyboard-controller
 * to avoid bundling it on web where it's not needed.
 */
import React from "react";
import { ScrollView, type ScrollViewProps } from "react-native";

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
