import { Platform } from "react-native";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import Feather from "@expo/vector-icons/Feather";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { NAV_DESTINATIONS } from "@/client/features/navigation/navDestinations";

/**
 * Primary navigation for the main app destinations.
 *
 * A single `<NativeTabs>` navigator renders the platform-native tab bar
 * (`UITabBar` on iOS, `BottomNavigationView` on Android, a CSS fallback on web).
 * Destinations come from the shared `NAV_DESTINATIONS` list and, on native, reuse
 * the app's Feather icon family via `NativeTabs.Trigger.VectorIcon`. The web
 * fallback is labels-only (see the `isWeb` note below).
 *
 * Colors are derived from `useTheme()` inside this component so they re-render on
 * theme toggle — important because `babel-plugin-react-compiler` (via
 * `babel-preset-expo`) can otherwise memoize and freeze the tab bar's colors.
 */
export default function TabLayout() {
  const { theme } = useTheme();

  // The web tab-bar fallback never renders icons, but Native Tabs still resolves
  // a `VectorIcon` through `expo-font.renderToImageAsync`, which throws on web
  // (`UnavailabilityError`). Omit the icon child on web — labels still render.
  const isWeb = Platform.OS === "web";

  // On Android the selected icon is drawn on top of the accent indicator
  // pill, so it must use the accent's *contrast* color — accent-on-accent
  // renders the icon invisible. iOS has no pill; accent is correct there.
  const selectedIconColor =
    Platform.OS === "android"
      ? theme.colors.accentForeground
      : theme.colors.accent;

  return (
    <NativeTabs
      // iOS 26+: collapse the tab bar while scrolling down, re-expand on
      // scroll up. No-op on Android/web, where native tabs stay static.
      minimizeBehavior="onScrollDown"
      iconColor={{
        default: theme.colors.mutedForeground,
        selected: selectedIconColor,
      }}
      labelStyle={{
        default: { color: theme.colors.mutedForeground },
        selected: { color: theme.colors.accent },
      }}
      backgroundColor={theme.colors.card}
      // Android: accent indicator pill + always-visible labels (Material's
      // default "auto" hides unselected labels at 4+ tabs, which reads as
      // missing icons/uneven spacing). Both ignored on other platforms.
      {...(Platform.OS === "android"
        ? {
          indicatorColor: theme.colors.accent,
          labelVisibilityMode: "labeled" as const,
        }
        : null)}
    >
      {NAV_DESTINATIONS.map((destination) => (
        <NativeTabs.Trigger key={destination.name} name={destination.name}>
          <NativeTabs.Trigger.Label>{destination.label}</NativeTabs.Trigger.Label>
          {!isWeb && (
            <NativeTabs.Trigger.Icon
              src={
                <NativeTabs.Trigger.VectorIcon
                  family={Feather}
                  name={destination.icon}
                />
              }
            />
          )}
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
