/**
 * Horizontal category filter chips, shared by all three galleries.
 *
 * The chip row is the mobile stand-in for the desktop mockups' category rail
 * (mockups/02-components.html sidebar → mockups/05-mobile.html `chip-row`), so
 * it's one component rather than three near-copies. Counts are optional: the
 * templates gallery labels its "All" chip "All 17" per mockup 04, while the
 * blocks gallery uses bare labels per mockup 03.
 */

import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { spacing } from "@mrmeg/expo-ui/constants";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

import { blurActiveElementOnWeb } from "@/client/features/navigation/blurActiveElementOnWeb";
import { ALL_CATEGORIES, type CategoryFilter } from "./filters";

export interface GalleryChip<C extends string> {
  /** The filter this chip applies. `"all"` for the leading chip. */
  value: CategoryFilter<C>;
  /** Display label. */
  label: string;
  /** Optional trailing count, rendered dimmer than the label. */
  count?: number;
}

interface GalleryChipsProps<C extends string> {
  chips: GalleryChip<C>[];
  selected: CategoryFilter<C>;
  onSelect: (value: CategoryFilter<C>) => void;
  /** Accessibility label for the group, e.g. "Filter components by category". */
  label: string;
  testID?: string;
}

export function GalleryChips<C extends string>({
  chips,
  selected,
  onSelect,
  label,
  testID,
}: GalleryChipsProps<C>) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
      accessibilityLabel={label}
      testID={testID}
    >
      {chips.map((chip) => {
        const active = chip.value === selected;
        return (
          <Pressable
            key={chip.value}
            onPress={() => onSelect(chip.value)}
            onPressIn={blurActiveElementOnWeb}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            testID={testID ? `${testID}-${chip.value}` : undefined}
            style={[
              styles.chip,
              active ? styles.chipActive : styles.chipInactive,
              Platform.OS === "web" ? { cursor: "pointer" as never } : null,
            ]}
          >
            <SansSerifText
              style={active ? styles.chipTextActive : styles.chipTextInactive}
            >
              {chip.label}
            </SansSerifText>
            {chip.count !== undefined && (
              <View style={active ? styles.countActive : styles.countInactive}>
                <SansSerifText
                  style={active ? styles.countTextActive : styles.countTextInactive}
                >
                  {chip.count}
                </SansSerifText>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * Chip list for a category table: the "All" chip, then one chip per category
 * that has a label. Counts come from `countByCategory`, so a category with no
 * entries still renders (showing 0) rather than shifting the row.
 */
export function buildCategoryChips<C extends string>(
  categories: readonly C[],
  labels: Record<C, string>,
  counts: Record<C, number>,
  allLabel: string,
  allCount?: number,
): GalleryChip<C>[] {
  return [
    { value: ALL_CATEGORIES, label: allLabel, count: allCount },
    ...categories.map((category) => ({
      value: category,
      label: labels[category],
      count: counts[category],
    })),
  ];
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingVertical: spacing.xxs,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.sm + 4,
      borderRadius: spacing.radiusFull,
      borderWidth: 1,
    },
    chipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    chipInactive: {
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.border,
    },
    chipTextActive: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.colors.primaryForeground,
    },
    chipTextInactive: {
      fontSize: 13,
      color: theme.colors.textDim,
    },
    countActive: {
      paddingHorizontal: spacing.xs + 1,
      borderRadius: spacing.radiusFull,
      backgroundColor: theme.colors.background,
    },
    countInactive: {
      paddingHorizontal: spacing.xs + 1,
      borderRadius: spacing.radiusFull,
      backgroundColor: theme.colors.muted,
    },
    countTextActive: {
      fontSize: 11,
      color: theme.colors.foreground,
    },
    countTextInactive: {
      fontSize: 11,
      color: theme.colors.mutedForeground,
    },
  });

const themedStyles = createThemedStyles(createStyles);
