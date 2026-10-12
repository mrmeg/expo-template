import { Platform } from "react-native";
import { NativeTabs } from "expo-router/native-tabs";
import { useNotificationOffset, useTheme } from "@mrmeg/expo-ui/hooks";
import { NAV_DESTINATIONS } from "@/client/features/navigation/navDestinations";
import { TAB_ICONS } from "@/client/tabIcons.generated";
import { useNativeTabBarOffset } from "@/client/features/navigation/tabBarMetrics";
import { useKeyboardVisible } from "@/client/features/keyboard/platform";

/**
 * Primary navigation for the main app destinations, on iOS and Android.
 *
 * A single `<NativeTabs>` navigator renders the platform-native tab bar
 * (`UITabBar` on iOS, `BottomNavigationView` on Android). Web never loads this
 * file: the `.native` extension makes Expo Router pick the sibling `_layout.tsx`
 * there (a plain stack inside the drawer shell), and `metro.config.js` resolves
 * it to an empty module in web bundles, so NativeTabs' web implementation (Radix
 * Tabs), the tab PNGs, and its stylesheet stay out of the web export.
 *
 * Destinations come from the shared `NAV_DESTINATIONS` list. Each icon is a
 * template PNG rasterized from the same Lucide glyph `Icon` draws in the rail
 * (`tabIcons` in `client/icons.json`, `bun run icons:tabs`), so both surfaces
 * show identical geometry. The platform tints it: iOS renders `src` as a
 * template image, and Android applies the default and selected `iconColor`.
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

  // Bottom toasts (`notify(..., { position: "bottom" })`) render in the root
  // layout, above this navigator, so tell them where the tab bar ends. While
  // the bar is hidden behind the keyboard the toast returns to the inset.
  const tabBarOffset = useNativeTabBarOffset();
  useNotificationOffset(keyboardVisible ? null : { bottom: tabBarOffset });

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
          <NativeTabs.Trigger.Icon src={TAB_ICONS[destination.icon]} renderingMode="template" />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
