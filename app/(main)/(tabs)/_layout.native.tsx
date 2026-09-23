import { Platform } from "react-native";
import { NativeTabs } from "expo-router/native-tabs";
import Feather from "@expo/vector-icons/Feather";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { NAV_DESTINATIONS } from "@/client/features/navigation/navDestinations";
import { useKeyboardVisible } from "@/client/features/keyboard/platform";

/**
 * Primary navigation for the main app destinations, on iOS and Android.
 *
 * A single `<NativeTabs>` navigator renders the platform-native tab bar
 * (`UITabBar` on iOS, `BottomNavigationView` on Android). Web never loads this
 * file: the `.native` extension makes Expo Router pick the sibling `_layout.tsx`
 * there (a plain stack inside the drawer shell), and `metro.config.js` resolves
 * it to an empty module in web bundles, so NativeTabs' web implementation (Radix
 * Tabs), the Feather glyph map, and its stylesheet stay out of the web export.
 *
 * Destinations come from the shared `NAV_DESTINATIONS` list and draw their icons
 * through `NativeTabs.Trigger.VectorIcon`. `VectorIcon` needs an icon-font
 * family, so the tab bar stays on `@expo/vector-icons/Feather` (a root
 * dependency) while `Icon` elsewhere renders `lucide-react-native` SVGs; Lucide
 * is a superset of Feather in the same 24px, 2px-stroke style, so the two match.
 * Destination icon names must therefore exist in both sets.
 *
 * Colors are derived from `useTheme()` inside this component so they re-render on
 * theme toggle — important because `babel-plugin-react-compiler` (via
 * `babel-preset-expo`) can otherwise memoize and freeze the tab bar's colors.
 */
export default function TabLayout() {
  const { theme } = useTheme();

  // Hide the tab bar while the keyboard is open. On iOS 26 the floating tab
  // bar otherwise rides above the keyboard and collides with the autofill
  // accessory; on Android the resize keyboard mode pushes it up the same way.
  // Reveal only after keyboard dismissal completes: a transient hide/show
  // during input focus handoff must not trigger tab-bar layout mid-transition.
  const keyboardVisible = useKeyboardVisible();

  // On Android the selected icon is drawn on top of the accent indicator
  // pill, so it must use the accent's *contrast* color — accent-on-accent
  // renders the icon invisible. iOS has no pill; accent is correct there.
  const selectedIconColor =
    Platform.OS === "android"
      ? theme.colors.accentForeground
      : theme.colors.accent;

  return (
    <NativeTabs
      hidden={keyboardVisible}
      // iOS 26+: collapse the tab bar while scrolling down, re-expand on
      // scroll up. No-op on Android, where native tabs stay static.
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
          <NativeTabs.Trigger.Icon
            src={
              <NativeTabs.Trigger.VectorIcon
                family={Feather}
                name={destination.icon}
              />
            }
          />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
