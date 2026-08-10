import type { ComponentProps } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { WebBackButton } from "@/client/features/navigation/WebBackButton";

const isWeb = Platform.OS === "web";
const webHeaderLeft = isWeb
  ? { headerLeft: () => <WebBackButton /> }
  : {};

type StackScreenOptions = ComponentProps<typeof Stack.Screen>["options"];

export interface MainStackScreen {
  name: string;
  options: StackScreenOptions;
}

/**
 * The `(main)` stack's screen list, shared by the native layout
 * (`MainLayout.tsx`) and the web drawer-shell layout (`WebMainLayout.tsx`).
 * One source of truth so a screen added for native can't silently miss the
 * web stack (or vice versa) — the two layouts differ only in the chrome they
 * wrap around this list, never in the list itself.
 */
export const MAIN_STACK_SCREENS: readonly MainStackScreen[] = [
  /* The `(tabs)` group uses a native tab bar (see (tabs)/_layout.tsx), so the
     stack header is the only top chrome and shows at every width. */
  { name: "(tabs)", options: { headerShown: true, title: "Explore", headerBackTitle: " " } },
  /* Three-scale galleries. `components/[id]` sets its own title from the
     component's registry id, so it only declares the web back button. */
  { name: "(demos)/components/index", options: { title: "Components", ...webHeaderLeft } },
  { name: "(demos)/components/[id]", options: { ...webHeaderLeft } },
  { name: "(demos)/blocks/index", options: { title: "Blocks", ...webHeaderLeft } },
  { name: "(demos)/templates/index", options: { title: "Screen Templates", ...webHeaderLeft } },
  { name: "(demos)/showcase/index", options: { title: "UI Components", ...webHeaderLeft } },
  { name: "(demos)/themed-showcase", options: { title: "Themed Showcase", ...webHeaderLeft } },
  { name: "(demos)/developer", options: { title: "Developer Tools", ...webHeaderLeft } },
  { name: "(demos)/server-alpha", options: { title: "Server Alpha", ...webHeaderLeft } },
  { name: "(demos)/server-alpha/[example]", options: { title: "Server Pattern", ...webHeaderLeft } },
  { name: "(demos)/form-demo", options: { title: "Form Validation", ...webHeaderLeft } },
  { name: "(demos)/auth-demo", options: { title: "Auth Demo", ...webHeaderLeft } },
  { name: "(demos)/onboarding", options: { headerShown: false } },
  { name: "(demos)/detail-hero", options: { headerShown: false } },
  { name: "(demos)/screen-settings", options: { title: "Settings Screen", ...webHeaderLeft } },
  { name: "(demos)/screen-profile", options: { title: "Profile Screen", ...webHeaderLeft } },
  { name: "(demos)/screen-list", options: { title: "List Screen", ...webHeaderLeft } },
  { name: "(demos)/screen-pricing", options: { title: "Pricing Screen", ...webHeaderLeft } },
  { name: "(demos)/screen-welcome", options: { headerShown: false } },
  { name: "(demos)/screen-card-grid", options: { title: "Card Grid Screen", ...webHeaderLeft } },
  { name: "(demos)/screen-chat", options: { title: "Chat Screen", ...webHeaderLeft } },
  { name: "(demos)/screen-dashboard", options: { title: "Dashboard Screen", ...webHeaderLeft } },
  { name: "(demos)/screen-form", options: { title: "Form Screen", ...webHeaderLeft } },
  { name: "(demos)/screen-notifications", options: { title: "Notifications Screen", ...webHeaderLeft } },
  { name: "(demos)/screen-search", options: { title: "Search Results Screen", ...webHeaderLeft } },
  { name: "(demos)/screen-error", options: { title: "Error Screen", ...webHeaderLeft } },
] as const;

/**
 * Screens whose stack header the web drawer shell replaces.
 *
 * These are exactly the drawer's own destinations (mockups 01–04 render them
 * with no top bar — the drawer IS their chrome). `(tabs)` loses its header at
 * every web width: on desktop the rail replaces it, and below the breakpoint
 * the shell's own top bar (hamburger + wordmark) already occupies that slot.
 * The three gallery indexes keep their header below the breakpoint, where it
 * is the only thing carrying the page title and the back affordance.
 * Everything deeper (component detail, demo screens) keeps its header at all
 * widths — the drawer doesn't link there, so the header's back button is the
 * only way home that isn't the browser's.
 */
export const WEB_SHELL_RAIL_HEADERLESS = new Set<string>([
  "(demos)/components/index",
  "(demos)/blocks/index",
  "(demos)/templates/index",
]);

export const WEB_SHELL_ALWAYS_HEADERLESS = new Set<string>(["(tabs)"]);
