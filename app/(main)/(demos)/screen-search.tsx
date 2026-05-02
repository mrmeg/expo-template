import React, { useState, useCallback } from "react";
import { View, Pressable, StyleSheet, Platform } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { Badge } from "@mrmeg/expo-ui/components/Badge";
import {
  SearchResultsScreen,
  type SearchFilter,
} from "@/client/screens/SearchResultsScreen";
import type { Theme } from "@mrmeg/expo-ui/constants";

interface SearchItem {
  id: string;
  title: string;
  description: string;
  type: "article" | "product";
  tag: string;
}

const ALL_ITEMS: SearchItem[] = [
  { id: "1", title: "Getting Started with React Native", description: "A beginner-friendly guide covering setup, components, and navigation.", type: "article", tag: "Guide" },
  { id: "2", title: "Wireless Earbuds Pro", description: "Noise-cancelling earbuds with 8-hour battery life.", type: "product", tag: "$129.99" },
  { id: "3", title: "State Management Patterns", description: "Comparing Zustand, Redux, and Jotai for React Native apps.", type: "article", tag: "Tutorial" },
  { id: "4", title: "Ergonomic Keyboard", description: "Split mechanical keyboard with programmable keys.", type: "product", tag: "$179.99" },
  { id: "5", title: "Building Accessible Apps", description: "Best practices for screen readers, color contrast, and touch targets.", type: "article", tag: "Guide" },
  { id: "6", title: "USB-C Monitor Stand", description: "Aluminum stand with built-in hub and 100W charging.", type: "product", tag: "$89.99" },
  { id: "7", title: "Expo Router Deep Dive", description: "File-based routing, layouts, and typed routes explained.", type: "article", tag: "Tutorial" },
  { id: "8", title: "Minimalist Desk Mat", description: "Felt desk mat in charcoal gray, 900 x 400 mm.", type: "product", tag: "$34.99" },
  { id: "9", title: "Animation Performance Tips", description: "How to keep animations at 60fps with Reanimated.", type: "article", tag: "Guide" },
  { id: "10", title: "Portable Charger 20K", description: "Compact power bank with dual USB-C ports.", type: "product", tag: "$49.99" },
];

const INITIAL_FILTERS: SearchFilter[] = [
  { key: "all", label: "All", active: true },
  { key: "article", label: "Articles", active: false },
  { key: "product", label: "Products", active: false },
];

export default function ScreenSearchDemo() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const activeFilterKey = filters.find((f) => f.active)?.key ?? "all";

  const filteredItems = ALL_ITEMS.filter((item) => {
    const matchesQuery =
      !query ||
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase());
    const matchesFilter =
      activeFilterKey === "all" || item.type === activeFilterKey;
    return matchesQuery && matchesFilter;
  });

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
  }, []);

  const handleFilterPress = useCallback((pressed: SearchFilter) => {
    setFilters((prev) =>
      prev.map((f) => ({ ...f, active: f.key === pressed.key }))
    );
  }, []);

  const renderItem = (item: SearchItem) => (
    <Pressable
      style={
        Platform.OS === "web"
          ? { ...styles.row, cursor: "pointer" as any }
          : styles.row
      }
    >
      <View style={styles.iconCircle}>
        <Icon
          name={item.type === "article" ? "file-text" : "package"}
          size={18}
          color={theme.colors.foreground}
        />
      </View>
      <View style={styles.rowContent}>
        <SansSerifBoldText style={styles.rowTitle} numberOfLines={1}>
          {item.title}
        </SansSerifBoldText>
        <SansSerifText style={styles.rowDescription} numberOfLines={2}>
          {item.description}
        </SansSerifText>
      </View>
      <Badge variant={item.type === "article" ? "secondary" : "outline"}>
        {item.tag}
      </Badge>
    </Pressable>
  );

  return (
    <SearchResultsScreen
      data={filteredItems}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      searchPlaceholder="Search articles & products..."
      onSearch={handleSearch}
      filters={filters}
      onFilterPress={handleFilterPress}
      resultCount={filteredItems.length}
      resultLabel="results"
      emptyIcon="search"
      emptyTitle="No results found"
      emptyDescription="Try a different search term or adjust your filters."
      emptySuggestions={["React Native", "Keyboard", "Charger"]}
    />
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: spacing.md,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: spacing.radiusMd,
      backgroundColor: theme.colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    rowContent: {
      flex: 1,
      gap: spacing.xxs,
    },
    rowTitle: {
      fontSize: 15,
      color: theme.colors.foreground,
    },
    rowDescription: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
      lineHeight: 18,
    },
  });
