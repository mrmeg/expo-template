import React, { useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { CardGridScreen, type CardGridCategory } from "@/client/screens/CardGridScreen";
import type { Theme } from "@mrmeg/expo-ui/constants";

interface Product {
  id: string;
  title: string;
  price: string;
  category: string;
}

const ALL_PRODUCTS: Product[] = [
  { id: "1", title: "Wireless Headphones", price: "$79.99", category: "electronics" },
  { id: "2", title: "Cotton T-Shirt", price: "$24.99", category: "clothing" },
  { id: "3", title: "Ceramic Vase", price: "$34.99", category: "home" },
  { id: "4", title: "Bluetooth Speaker", price: "$49.99", category: "electronics" },
  { id: "5", title: "Linen Pants", price: "$59.99", category: "clothing" },
  { id: "6", title: "Desk Lamp", price: "$42.99", category: "home" },
  { id: "7", title: "USB-C Hub", price: "$29.99", category: "electronics" },
  { id: "8", title: "Wool Sweater", price: "$89.99", category: "clothing" },
];

const CATEGORIES: CardGridCategory[] = [
  { key: "all", label: "All" },
  { key: "electronics", label: "Electronics" },
  { key: "clothing", label: "Clothing" },
  { key: "home", label: "Home" },
];

export default function ScreenCardGridDemo() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const filteredProducts =
    selectedCategory === "all"
      ? ALL_PRODUCTS
      : ALL_PRODUCTS.filter((p) => p.category === selectedCategory);

  const handleCategoryChange = useCallback((key: string) => {
    setSelectedCategory(key);
  }, []);

  const renderCard = (item: Product) => (
    <View style={styles.card}>
      <View style={styles.cardImage}>
        <Icon name="package" size={28} color={theme.colors.mutedForeground} />
      </View>
      <View style={styles.cardBody}>
        <SansSerifText style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </SansSerifText>
        <SansSerifBoldText style={styles.cardPrice}>
          {item.price}
        </SansSerifBoldText>
      </View>
    </View>
  );

  return (
    <CardGridScreen
      data={filteredProducts}
      renderCard={renderCard}
      keyExtractor={(item) => item.id}
      categories={CATEGORIES}
      selectedCategory={selectedCategory}
      onCategoryChange={handleCategoryChange}
      columns={2}
      emptyIcon="package"
      emptyTitle="No products"
      emptyDescription="No products found in this category."
    />
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: spacing.radiusLg,
      backgroundColor: theme.colors.card,
      overflow: "hidden",
    },
    cardImage: {
      height: 100,
      backgroundColor: theme.colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    cardBody: {
      padding: spacing.sm,
      gap: spacing.xxs,
    },
    cardTitle: {
      fontSize: 14,
      color: theme.colors.foreground,
    },
    cardPrice: {
      fontSize: 15,
      color: theme.colors.foreground,
    },
  });
