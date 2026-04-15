import { Platform, Pressable } from "react-native";
import { router } from "expo-router";
import { Icon } from "@/client/components/ui/Icon";
import { useTheme } from "@/client/hooks/useTheme";
import { canGoBack } from "./backBehavior";
import { blurActiveElementOnWeb } from "./blurActiveElementOnWeb";

/**
 * Back button for web that handles the case where browser refresh
 * loses Stack navigator history. On native, returns null.
 */
export function WebBackButton({ tintColor }: { tintColor?: string }) {
  const { theme } = useTheme();

  if (Platform.OS !== "web") return null;

  const color = tintColor || theme.colors.foreground;

  const handlePress = () => {
    blurActiveElementOnWeb();

    if (canGoBack(router)) {
      router.back();
    } else {
      router.replace("/(main)/(tabs)");
    }
  };

  return (
    <Pressable onPress={handlePress} hitSlop={8} style={{ paddingLeft: 8 }}>
      <Icon name="chevron-left" size={24} color={color} />
    </Pressable>
  );
}
