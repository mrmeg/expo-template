import React from "react";
import { ScrollView, type ScrollViewProps } from "react-native";

export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  return children as React.ReactElement;
}

export const KeyboardAwareScrollView = ScrollView as React.ComponentType<ScrollViewProps & { [key: string]: any }>;
