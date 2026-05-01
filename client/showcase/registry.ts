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

import type { IconName } from "@/client/components/ui/Icon";

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
  /** Feather icon name from `@/client/components/ui/Icon`. */
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
  /** Module path under `@/client/components/ui/`. */
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
  { id: "developer", route: "/(main)/(demos)/developer", icon: "terminal", label: "Developer Tools" },
  { id: "onboarding", route: "/(main)/(demos)/onboarding", icon: "navigation", label: "Onboarding" },
];

// ---------------------------------------------------------------------------
// Components — drive the Explore featured-card badge count
// ---------------------------------------------------------------------------

/**
 * UI components from `@/client/components/ui/` that the showcase exposes.
 * Excludes infrastructure pieces like `ErrorBoundary`, `StatusBar`,
 * `MaxWidthContainer`, `DismissKeyboard`, and `Notification` — those are
 * mounted by the shell, not browsed by adopters.
 */
export const COMPONENTS: ComponentEntry[] = [
  { id: "Accordion", importPath: "@/client/components/ui/Accordion", category: "navigation" },
  { id: "Alert", importPath: "@/client/components/ui/Alert", category: "feedback" },
  { id: "AnimatedView", importPath: "@/client/components/ui/AnimatedView", category: "layout" },
  { id: "Badge", importPath: "@/client/components/ui/Badge", category: "feedback" },
  { id: "BottomSheet", importPath: "@/client/components/ui/BottomSheet", category: "overlay" },
  { id: "Button", importPath: "@/client/components/ui/Button", category: "form" },
  { id: "Card", importPath: "@/client/components/ui/Card", category: "layout" },
  { id: "Checkbox", importPath: "@/client/components/ui/Checkbox", category: "form" },
  { id: "Collapsible", importPath: "@/client/components/ui/Collapsible", category: "navigation" },
  { id: "Dialog", importPath: "@/client/components/ui/Dialog", category: "overlay" },
  { id: "Drawer", importPath: "@/client/components/ui/Drawer", category: "overlay" },
  { id: "DropdownMenu", importPath: "@/client/components/ui/DropdownMenu", category: "overlay" },
  { id: "EmptyState", importPath: "@/client/components/ui/EmptyState", category: "feedback" },
  { id: "Icon", importPath: "@/client/components/ui/Icon", category: "typography" },
  { id: "InputOTP", importPath: "@/client/components/ui/InputOTP", category: "form" },
  { id: "Label", importPath: "@/client/components/ui/Label", category: "form" },
  { id: "Popover", importPath: "@/client/components/ui/Popover", category: "overlay" },
  { id: "Progress", importPath: "@/client/components/ui/Progress", category: "feedback" },
  { id: "RadioGroup", importPath: "@/client/components/ui/RadioGroup", category: "form" },
  { id: "Select", importPath: "@/client/components/ui/Select", category: "form" },
  { id: "Separator", importPath: "@/client/components/ui/Separator", category: "layout" },
  { id: "Skeleton", importPath: "@/client/components/ui/Skeleton", category: "feedback" },
  { id: "Slider", importPath: "@/client/components/ui/Slider", category: "form" },
  { id: "StyledText", importPath: "@/client/components/ui/StyledText", category: "typography" },
  { id: "Switch", importPath: "@/client/components/ui/Switch", category: "form" },
  { id: "Tabs", importPath: "@/client/components/ui/Tabs", category: "navigation" },
  { id: "TextInput", importPath: "@/client/components/ui/TextInput", category: "form" },
  { id: "Toggle", importPath: "@/client/components/ui/Toggle", category: "form" },
  { id: "ToggleGroup", importPath: "@/client/components/ui/ToggleGroup", category: "form" },
  { id: "Tooltip", importPath: "@/client/components/ui/Tooltip", category: "overlay" },
];

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

export function getComponentCount(): number {
  return COMPONENTS.length;
}
