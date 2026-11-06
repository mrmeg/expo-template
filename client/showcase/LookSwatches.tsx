/**
 * A look's palette as a strip of plain Views: background, card, text, accent,
 * primary. Drawn from the resolved reference colors with no look applied, so a
 * tile shows the look it stands for rather than the look the app is wearing.
 * Eager (Explore reads it): no previews, no theme-dependent fills.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "@mrmeg/expo-ui/constants";
import { useTheme } from "@mrmeg/expo-ui/hooks";

import type { Look } from "@mrmeg/expo-ui/state";

import { lookStrip } from "./lookReference";
import type { Scheme } from "./looks";

export function LookSwatchStrip({
  look,
  scheme,
  height = 28,
  testID,
}: {
  look: Look;
  scheme: Scheme;
  height?: number;
  testID?: string;
}) {
  const { theme } = useTheme();
  const colors = lookStrip(look, scheme);

  return (
    <View
      testID={testID}
      style={[styles.strip, { height, borderColor: theme.colors.border }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {colors.map((color, index) => (
        // The background leads and runs wider: it is what the screen looks like.
        <View key={index} style={{ flex: index === 0 ? 2 : 1, backgroundColor: color }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    borderRadius: spacing.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
});
