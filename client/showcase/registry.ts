/**
 * Template registry.
 *
 * Single source of truth for the screen templates, demos, and design-system
 * components the template ships with. Used by the Explore tab to drive
 * grid + list rendering and the component-count badge so adding or
 * removing an asset is a one-place change instead of a multi-file edit.
 *
 * Keep entries small and typed — this is data, not UI. UI lives in
 * `app/(main)/(tabs)/index.tsx` (Explore) and
 * `app/(main)/(demos)/showcase/index.tsx` (component showcase).
 */

import type { IconName } from "@mrmeg/expo-ui/components/Icon";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScreenTemplateEntry {
  /** Stable identifier, used as React key and for tests. */
  id: string;
  /** Route path that Expo Router renders for the demo. */
  route: string;
  /** Display label in the Explore grid. */
  label: string;
  /** One-line description shown beneath the label. */
  description: string;
  /** Feather icon name from `@mrmeg/expo-ui/components/Icon`. */
  icon: IconName;
}

export interface DemoEntry {
  id: string;
  route: string;
  label: string;
  icon: IconName;
}

export interface ComponentEntry {
  /** Stable identifier (PascalCase by convention). */
  id: string;
  /** Module path under `@mrmeg/expo-ui/components/`. */
  importPath: string;
  /** Loose grouping for future filtering — keeps the registry expressive without dictating UI. */
  category: ComponentCategory;
}

export type ComponentCategory =
  | "form"
  | "feedback"
  | "navigation"
  | "overlay"
  | "layout"
  | "typography";

// ---------------------------------------------------------------------------
// Screen templates — drive the Explore grid
// ---------------------------------------------------------------------------

export const SCREEN_TEMPLATES: ScreenTemplateEntry[] = [
  { id: "settings", route: "/(main)/(demos)/screen-settings", icon: "sliders", label: "Settings", description: "Grouped lists & toggles" },
  { id: "profile", route: "/(main)/(demos)/screen-profile", icon: "user", label: "Profile", description: "Avatar, stats, sections" },
  { id: "list", route: "/(main)/(demos)/screen-list", icon: "list", label: "List", description: "Search & pull to refresh" },
  { id: "pricing", route: "/(main)/(demos)/screen-pricing", icon: "credit-card", label: "Pricing", description: "Plans & comparison" },
  { id: "welcome", route: "/(main)/(demos)/screen-welcome", icon: "log-in", label: "Welcome", description: "Landing & social login" },
  { id: "card-grid", route: "/(main)/(demos)/screen-card-grid", icon: "grid", label: "Card Grid", description: "Filterable card layout" },
  { id: "chat", route: "/(main)/(demos)/screen-chat", icon: "message-circle", label: "Chat", description: "Messaging conversation" },
  { id: "dashboard", route: "/(main)/(demos)/screen-dashboard", icon: "bar-chart-2", label: "Dashboard", description: "Metrics & activity feed" },
  { id: "form", route: "/(main)/(demos)/screen-form", icon: "edit-3", label: "Form", description: "Multi-step wizard" },
  { id: "notifications", route: "/(main)/(demos)/screen-notifications", icon: "bell", label: "Notifications", description: "Grouped notification list" },
  { id: "search", route: "/(main)/(demos)/screen-search", icon: "search", label: "Search", description: "Filtered search results" },
  { id: "error", route: "/(main)/(demos)/screen-error", icon: "alert-triangle", label: "Error", description: "Error state variants" },
  { id: "detail-hero", route: "/(main)/(demos)/detail-hero", icon: "layout", label: "Detail / Hero", description: "Hero image detail view" },
];

// ---------------------------------------------------------------------------
// Demos & tools — drive the Explore "Demos & Tools" section
// ---------------------------------------------------------------------------

export const DEMOS: DemoEntry[] = [
  { id: "form-validation", route: "/(main)/(demos)/form-demo", icon: "edit-3", label: "Form Validation" },
  { id: "auth", route: "/(main)/(demos)/auth-demo", icon: "shield", label: "Auth Demo" },
  { id: "server-alpha", route: "/(main)/(demos)/server-alpha", icon: "server", label: "Server Alpha" },
  { id: "developer", route: "/(main)/(demos)/developer", icon: "terminal", label: "Developer Tools" },
  { id: "onboarding", route: "/(main)/(demos)/onboarding", icon: "navigation", label: "Onboarding" },
];

// ---------------------------------------------------------------------------
// Components — drive the Explore featured-card badge count
// ---------------------------------------------------------------------------

/**
 * UI components from `@mrmeg/expo-ui/components/` that the showcase exposes.
 * Excludes infrastructure pieces like `ErrorBoundary`, `StatusBar`,
 * `MaxWidthContainer`, `DismissKeyboard`, and `Notification` — those are
 * mounted by the shell, not browsed by adopters.
 */
export const COMPONENTS: ComponentEntry[] = [
  { id: "Accordion", importPath: "@mrmeg/expo-ui/components/Accordion", category: "navigation" },
  { id: "Alert", importPath: "@mrmeg/expo-ui/components/Alert", category: "feedback" },
  { id: "AnimatedView", importPath: "@mrmeg/expo-ui/components/AnimatedView", category: "layout" },
  { id: "Badge", importPath: "@mrmeg/expo-ui/components/Badge", category: "feedback" },
  { id: "BottomSheet", importPath: "@mrmeg/expo-ui/components/BottomSheet", category: "overlay" },
  { id: "Button", importPath: "@mrmeg/expo-ui/components/Button", category: "form" },
  { id: "Card", importPath: "@mrmeg/expo-ui/components/Card", category: "layout" },
  { id: "Checkbox", importPath: "@mrmeg/expo-ui/components/Checkbox", category: "form" },
  { id: "Collapsible", importPath: "@mrmeg/expo-ui/components/Collapsible", category: "navigation" },
  { id: "Dialog", importPath: "@mrmeg/expo-ui/components/Dialog", category: "overlay" },
  { id: "Drawer", importPath: "@mrmeg/expo-ui/components/Drawer", category: "overlay" },
  { id: "DropdownMenu", importPath: "@mrmeg/expo-ui/components/DropdownMenu", category: "overlay" },
  { id: "EmptyState", importPath: "@mrmeg/expo-ui/components/EmptyState", category: "feedback" },
  { id: "Icon", importPath: "@mrmeg/expo-ui/components/Icon", category: "typography" },
  { id: "InputOTP", importPath: "@mrmeg/expo-ui/components/InputOTP", category: "form" },
  { id: "Label", importPath: "@mrmeg/expo-ui/components/Label", category: "form" },
  { id: "Popover", importPath: "@mrmeg/expo-ui/components/Popover", category: "overlay" },
  { id: "Progress", importPath: "@mrmeg/expo-ui/components/Progress", category: "feedback" },
  { id: "RadioGroup", importPath: "@mrmeg/expo-ui/components/RadioGroup", category: "form" },
  { id: "Select", importPath: "@mrmeg/expo-ui/components/Select", category: "form" },
  { id: "Separator", importPath: "@mrmeg/expo-ui/components/Separator", category: "layout" },
  { id: "Skeleton", importPath: "@mrmeg/expo-ui/components/Skeleton", category: "feedback" },
  { id: "Slider", importPath: "@mrmeg/expo-ui/components/Slider", category: "form" },
  { id: "StyledText", importPath: "@mrmeg/expo-ui/components/StyledText", category: "typography" },
  { id: "Switch", importPath: "@mrmeg/expo-ui/components/Switch", category: "form" },
  { id: "Tabs", importPath: "@mrmeg/expo-ui/components/Tabs", category: "navigation" },
  { id: "TextInput", importPath: "@mrmeg/expo-ui/components/TextInput", category: "form" },
  { id: "Toggle", importPath: "@mrmeg/expo-ui/components/Toggle", category: "form" },
  { id: "ToggleGroup", importPath: "@mrmeg/expo-ui/components/ToggleGroup", category: "form" },
  { id: "Tooltip", importPath: "@mrmeg/expo-ui/components/Tooltip", category: "overlay" },
];

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

export function getComponentCount(): number {
  return COMPONENTS.length;
}
