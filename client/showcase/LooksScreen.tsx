import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Link } from "expo-router";
import { Badge } from "@mrmeg/expo-ui/components/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@mrmeg/expo-ui/components/Card";
import { SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { spacing, type Theme } from "@mrmeg/expo-ui/constants";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import { refinedLook } from "@mrmeg/expo-ui/state";

import { Seo } from "@/client/components/Seo";
import { blurActiveElementOnWeb } from "@/client/features/navigation/blurActiveElementOnWeb";
import { linkPressableStyle } from "@/client/features/navigation/linkPressableStyle";
import { lookRoute } from "./filters";
import { DEMO_LOOKS } from "./looks";
import { LookSwatchStrip } from "./LookSwatches";

/**
 * Looks, the index
 *
 * Style references for the base design system. Each tile shows the look's own
 * palette (drawn from its colors, light and dark) and opens its detail page,
 * which is where the look is applied. This screen applies nothing: it stays in
 * whatever look the app has, the package default (Refined).
 */

const COLUMN_MAX_WIDTH = 960;
/** Two tiles per row from this column width up. */
const TWO_UP_FROM = 560;

export default function LooksScreen() {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const [columnWidth, setColumnWidth] = useState(0);
  const twoUp = columnWidth >= TWO_UP_FROM;
  // Two tiles and the gap fill the row; an odd last tile sits at the start.
  const tileStyle = twoUp ? { width: (columnWidth - spacing.md) / 2 } : styles.tile;

  const onLayout = (event: LayoutChangeEvent) => setColumnWidth(event.nativeEvent.layout.width);

  return (
    <>
      <Seo
        title="Looks - Expo Template"
        description="Style references for the @mrmeg/expo-ui base design system: Refined (the default), Classic, Strand, Glass and Editorial, each with colors, type, shape and a copyable snippet."
      />
      <ScrollView
        testID="looks-gallery"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column} onLayout={onLayout}>
          <SansSerifText size="base" style={styles.intro}>
            Style references for the base design system. Refined is the default. Open one to
            preview it across the app.
          </SansSerifText>

          <View style={styles.grid} testID="looks-grid">
            {DEMO_LOOKS.map(({ look }) => (
              <Link key={look.id} href={lookRoute(look.id) as never} asChild>
                <Pressable
                  onPressIn={blurActiveElementOnWeb}
                  accessibilityRole="link"
                  accessibilityLabel={`${look.name}, ${look.description ?? ""}`}
                  testID={`look-${look.id}`}
                  style={linkPressableStyle(tileStyle)}
                >
                  <Card>
                    <CardHeader>
                      <View style={styles.nameRow}>
                        <CardTitle>{look.name}</CardTitle>
                        {look.id === refinedLook.id && <Badge variant="secondary">Default</Badge>}
                      </View>
                      {!!look.description && <CardDescription>{look.description}</CardDescription>}
                    </CardHeader>
                    <CardContent style={styles.swatches}>
                      <LookSwatchStrip look={look} scheme="light" />
                      <LookSwatchStrip look={look} scheme="dark" />
                    </CardContent>
                  </Card>
                </Pressable>
              </Link>
            ))}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.colors.background },
  intro: { color: theme.colors.mutedForeground },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  column: {
    width: "100%",
    maxWidth: COLUMN_MAX_WIDTH,
    alignSelf: "center",
    gap: spacing.sectionSpacing,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  tile: { width: "100%" },
  swatches: { gap: spacing.xs, paddingTop: spacing.sm },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});

const themedStyles = createThemedStyles(createStyles);
