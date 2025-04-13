import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useRouter, Href } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { SansSerifText } from "./StyledText";
import { PressableDefault } from "./PressableDefault";

interface BackButtonProps {
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
  iconColor?: string;
  title?: string;
  route?: Href;
}

export function BackButton({ title, route, style, iconSize = 24, iconColor}: BackButtonProps) {
  const router = useRouter();
  const { theme } = useTheme();

  const handlePress = () => {
    if (route) {
      router.push(route);
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <PressableDefault onPress={handlePress} style={[styles.container, style]}>
      <MaterialIcons name="arrow-back" size={iconSize} color={iconColor} />
      {title ? (
        <View style={styles.titleContainer}>
          <SansSerifText style={{ color: iconColor || theme.colors.text }}>{title}</SansSerifText>
        </View>
      ) : null}
    </PressableDefault>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
    marginLeft: 12,
  },
  titleContainer: {
    marginLeft: 8,
  },
});