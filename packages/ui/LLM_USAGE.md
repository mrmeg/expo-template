# @mrmeg/expo-ui LLM Usage Guide

This file ships in the npm package. In a consumer repo, read it from
`node_modules/@mrmeg/expo-ui/LLM_USAGE.md` before building app UI.

## First Rule

Do not recreate primitives that this package already provides. Import from
`@mrmeg/expo-ui` and compose the exported components in the app.

## Stable Import Paths

```tsx
import { Button, StyledText, UIProvider } from "@mrmeg/expo-ui/components";
import { Button as ButtonDirect } from "@mrmeg/expo-ui/components/Button";
import { colors, spacing, typography } from "@mrmeg/expo-ui/constants";
import { useResources, useTheme } from "@mrmeg/expo-ui/hooks";
import { globalUIStore, notify, useThemeStore } from "@mrmeg/expo-ui/state";
import { configureExpoUiI18n, hapticLight } from "@mrmeg/expo-ui/lib";
```

The root barrel also exports the public surface:

```tsx
import { Button, UIProvider, colors, useTheme } from "@mrmeg/expo-ui";
```

Use only exported package paths: root, `components`, `components/*`,
`constants`, `constants/*`, `hooks`, `hooks/*`, `state`, and `lib`. Do not
import from `@mrmeg/expo-ui/dist/*` or from a source checkout path.

Supported hosts are Expo 56–57, React 19.2, React Native 0.85–0.86, and React
Native Web 0.21. Install the peer versions recommended by the consuming app's
Expo SDK.

## Required App Setup

Call `useResources()` once near the Expo app root. Mount `UIProvider` once
near the root when the app uses package feedback or overlay components.
`UIProvider` owns the package `Notification`, `StatusBar`, and default
`@rn-primitives` portal host.

```tsx
import { ThemeProvider } from "expo-router";
import { UIProvider } from "@mrmeg/expo-ui/components";
import { colors } from "@mrmeg/expo-ui/constants";
import { useResources, useTheme } from "@mrmeg/expo-ui/hooks";

export function RootLayout() {
  const { scheme } = useTheme();
  const { loaded } = useResources();

  if (!loaded) return null;

  return (
    <ThemeProvider
      value={{
        dark: colors[scheme ?? "light"].dark,
        colors: colors[scheme ?? "light"].navigation,
        fonts: colors[scheme ?? "light"].fonts,
      }}
    >
      <UIProvider>
        {/* App navigation goes here. */}
      </UIProvider>
    </ThemeProvider>
  );
}
```

`UIProvider` mounts the default portal host required before using `Dialog`,
`AlertDialog`, `BottomSheet`, `Drawer`, `DropdownMenu`, `Popover`,
`SelectContent`, or `Tooltip`.

On native, `BottomSheet.Content` avoids the soft keyboard by default with
React Native keyboard events. Pass `avoidKeyboard={false}` to opt out for a
specific sheet.

i18n is optional. Do not add app-level i18n setup just to use this package.
Plain children and `text` props work without `i18next` or `react-i18next`.
`tx` props render fallback text when provided and otherwise render the key
until the consumer opts in with a package-local translator. Package-owned
defaults such as notification titles stay human-readable without app i18n:

```tsx
import { configureExpoUiI18n } from "@mrmeg/expo-ui/lib";
import { i18n } from "./i18n";

configureExpoUiI18n((key, options) => i18n.t(key, options));
```

## Theme And Text Rules

- Use `useTheme()` and semantic tokens instead of hardcoded colors.
- Use `StyledText` or its semantic aliases instead of raw `Text` for app UI.
- Use `Button.preset`, not `variant`, for buttons.
- Button visible heights are compact: `sm` 28px, `md` 32px, and `lg` 40px.
- Use `Button size="sm"` for compact popover, tooltip, and toolbar triggers; nested `StyledText` inherits the selected Button size.
- Use `notify` plus root-mounted `UIProvider` for transient global feedback. (`globalUIStore` remains available for reactive subscriptions and tests.)
- Keep app monitoring, auth, API, and domain behavior outside this package.

Useful theme tokens include:

```tsx
theme.colors.background;
theme.colors.foreground;
theme.colors.card;
theme.colors.popover;
theme.colors.border;
theme.colors.input;
theme.colors.ring;
theme.colors.primary;
theme.colors.secondary;
theme.colors.accent;
theme.colors.mutedForeground;
theme.colors.destructive;
theme.colors.success;
theme.colors.warning;
```

Token intent:

- `primary`: neutral action color
- `secondary`: neutral secondary surface
- `accent`: teal highlight color
- `input`: form-control border color
- `ring`: focus outline color
- `popover`: elevated overlay surface

Use `getShadowStyle()` for package surfaces that need elevation. It supports
`base`, `soft`, `sharp`, `subtle`, `elevated`, `glow`, `glass`, `card`,
`cardHover`, and `cardSubtle`, returning a cross-platform `boxShadow` value
(RN 0.85 + react-native-web 0.21 deprecate the legacy `shadow*` props). Use
`getFocusRingStyle()` for web focus styling. Keep
web controls compact, but preserve mobile tap comfort with package controls
that already provide native hit slop or 44px touch rows.

Use `useStyles()` for memoized theme-aware local styles. Its factory receives
`{ theme, spacing, withAlpha }`, so components can derive alpha-adjusted
semantic colors without destructuring `withAlpha` outside the factory:

```tsx
const { styles } = useStyles(({ theme, spacing, withAlpha }) => ({
  card: {
    backgroundColor: withAlpha(theme.colors.primary, 0.08),
    padding: spacing.md,
  },
}));
```

When the saved theme preference is `system`, the package theme store owns the
OS color-scheme subscription, including web `prefers-color-scheme`. Do not add
app-local Appearance or `matchMedia` listeners for package components; import
`useTheme()`, `useStyles()`, and `useThemeStore` from `@mrmeg/expo-ui`.

`useTheme()` resolves colors in three layers, last wins: package defaults →
global brand (`useThemeStore.getState().setColors(overrides)`) → scoped
override (`ThemeColorScope`). Each override is `{ light?, dark? }` of
`Partial<ThemeColors>`; only the keys you pass are replaced. Call `setColors`
once to forward the app's brand palette globally. Wrap a subtree in
`<ThemeColorScope colors={{ light, dark }}>` for transient per-subtree theming
(user-created palettes, previews, embeds) that must not leak globally — it is
React context, scoped keys win over the global brand inside it, and nested
scopes merge (inner wins, outer fills in). With no override at either layer,
`useTheme()` returns the base theme by reference.

## Component Use-Case Index

Use this table before creating a new app-local primitive.

| Component | Use For | Prefer It Instead Of | Common Example Use Cases |
|-----------|---------|----------------------|--------------------------|
| `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` | Multi-section disclosure | Custom FAQ/settings expanders | FAQ lists, grouped settings, help sections |
| `Alert` | Cross-platform imperative alerts | Direct `window.alert` or duplicated RN/web branching | Confirm destructive actions, native alert dialogs |
| `AnimatedView` | Entrance and visibility animation | Hand-rolled one-off Animated wrappers | Staggered list rows, revealed panels, animated empty states |
| `Badge` | Short status labels | Custom pill `View` + `Text` | Draft/active states, counts, plan labels, role tags |
| `BottomSheet` | Mobile-first modal sheets | Custom absolute-position sheets | Action pickers, mobile filters, keyboard-aware quick edit forms |
| `Button` | Commands and CTAs | Pressable plus custom text styling | Submit, save, cancel, delete, navigation CTAs |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | Framed content groups | Ad hoc bordered panels | List items, pricing plans, settings sections, summaries |
| `Checkbox` | Boolean selection | Custom checkmark controls | Terms consent, checklist items, multi-select filters |
| `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` | One-off disclosure | Local animated height wrappers | Advanced settings, hidden helper text |
| `Dialog`, `AlertDialog` | Modal decisions and custom modal content | Custom modal overlays | Confirm delete, edit profile, invite user |
| `DismissKeyboard` | Tap-away keyboard dismissal | Screen-level keyboard handling | Forms, search screens, sign-in screens |
| `KeyboardAvoidingView` | Native keyboard-aware layout root | Repeated app-local keyboard wrappers | Screen roots, composer footers, form-heavy subtrees |
| `Drawer` | Side panels and drawer navigation | Custom sliding panels | Filter drawer, app navigation drawer, inspector panel |
| `DropdownMenu` | Menus and command lists | Homemade popover menus | Row actions, account menu, sort menu |
| `EmptyState` | No-data or recoverable error regions | One-off empty placeholders | Empty inbox, no search results, failed list load |
| `ErrorBoundary` | React render error fallback | Unhandled screen crashes | Route-level fallback, feature boundary |
| `Icon` | Feather or custom icons with theme tokens | Raw vector icons with hardcoded colors | Button accessories, empty-state icons, menu icons |
| `InputOTP` | Verification code entry | Multiple manually managed text inputs | Email codes, SMS codes, MFA, invite codes |
| `Label` | Accessible form labels | Plain styled text labels | Required labels, disabled labels, field group labels |
| `MaxWidthContainer` | Centered responsive width | Per-screen max-width wrappers | Web pages, tablet layouts, settings forms |
| `Notification` | Global toast surface | Screen-local toast state | Saved/error/sync notifications, action toasts, bottom-position alerts |
| `Popover` | Anchored contextual content | Custom anchored views | Inline help, quick previews, contextual controls |
| `Progress` | Determinate or indeterminate progress | Layout-shifting spinners for progress regions | Upload progress, onboarding completion |
| `RadioGroup`, `RadioGroupItem` | Mutually exclusive choices | Custom radio rows | Plan interval, visibility choice, survey answer |
| `Select` | Option menus | Custom dropdowns | Country picker, category selector, status selector |
| `Separator` | Horizontal or vertical dividers | Border-only spacer views | Menu dividers, section dividers, card dividers |
| `Skeleton`, `SkeletonText`, `SkeletonAvatar`, `SkeletonCard` | Loading placeholders | Blank space or generic spinners | List loading, profile card loading, dashboard placeholders |
| `Slider` | Numeric value selection | Custom pan gesture track | Volume, percentage, rating, threshold settings |
| `StatusBar` | Theme-aware native status bar | Per-screen status-bar duplication | Root layout status styling |
| `StyledText` and text aliases | Theme-aware typography | Raw `Text` with hardcoded styles | Titles, headings, labels, body copy, captions |
| `Switch` | Binary settings | Custom toggle switches | Enable notifications, privacy setting, feature toggles |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | In-page tabbed views | Custom segmented/tab controls | Profile sections, report views, settings categories |
| `TextInput` | Text entry | Raw `TextInput` with repeated label/error code | Email/password, search, numeric input, multiline notes |
| `Toggle`, `ToggleIcon` | Pressed/unpressed control | Button with local selected styling | Favorite, mute, bold/italic, view mode button |
| `ToggleGroup`, `ToggleGroupItem`, `ToggleGroupIcon` | Single or multi toggle groups | Custom segmented controls | Alignment, formatting toolbar, filter chips |
| `Tooltip` | Short hover/focus help | Persistent helper text or custom hover cards | Icon button labels, field hints, disabled action explanations |

## Component Selection Rules

- Use `Button` for commands, `Toggle` for one pressed state, `ToggleGroup` for related pressed states, and `Switch` for binary settings.
- Use `RadioGroup` for small mutually exclusive choices and `Select` for longer option sets.
- Use `Dialog` for blocking decisions, `Popover` for contextual controls, `Tooltip` for short explanations, and `DropdownMenu` for action lists.
- Use `Card` for individual repeated or framed items, not as a wrapper around full page sections.
- Use `EmptyState` for no-data or recoverable error regions.
- Use `Skeleton` for loading content with stable layout.
- Use `Progress` for real progress or indeterminate long-running work.
- Use `Drawer.Header` with `icon`, `title`, and `action` for a compact app-brand row; place `Drawer.ToggleCollapse` in `action` for a trailing rail control.

## Minimal Examples

```tsx
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@mrmeg/expo-ui/components";

<Card variant="outline">
  <CardHeader>
    <CardTitle>Subscription</CardTitle>
    <Badge variant="secondary">Active</Badge>
  </CardHeader>
  <CardContent>
    <Button preset="default" fullWidth>
      Manage billing
    </Button>
  </CardContent>
</Card>
```

```tsx
import { Button, Switch, TextInput } from "@mrmeg/expo-ui/components";

<TextInput
  label="Email"
  placeholder="you@example.com"
  autoCapitalize="none"
  keyboardType="email-address"
  errorText={emailError}
/>

<Switch checked={enabled} onCheckedChange={setEnabled} variant="ios" />

<Button preset="default" size="lg" fullWidth loading={isSubmitting}>
  Continue
</Button>
```

```tsx
import { Drawer, Icon } from "@mrmeg/expo-ui/components";

<Drawer.Header
  icon={<Icon name="hexagon" color="accent" />}
  title="Acme"
  action={
    <Drawer.ToggleCollapse>
      <Icon name="sidebar" decorative />
    </Drawer.ToggleCollapse>
  }
/>
```

```tsx
import { EmptyState, Progress, SkeletonCard } from "@mrmeg/expo-ui/components";
import { notify } from "@mrmeg/expo-ui/state";

{isLoading ? <SkeletonCard /> : null}
<Progress value={65} variant="accent" />
<EmptyState icon="inbox" title="No messages" description="New messages will appear here." />

// Convenience helpers
notify.success("Saved", { messages: ["Your changes were saved."] });
notify.error("Upload failed");
notify.warning("Connection slow");
notify.info("Copied to clipboard");

// Loading spinner — stays until replaced or hidden (no auto-dismiss)
notify.loading("Uploading…");
notify.hide();

// Full control (same payload as globalUIStore show())
notify({ type: "success", title: "Saved", action: { label: "View", onPress: openSavedItem } });

// Loading → success/error around a promise
await notify.promise(saveProfile(), {
  loading: "Saving…",
  success: "Profile saved",          // or (value) => `Saved ${value.name}`
  error: "Could not save profile",   // or (err) => err.message
});
```
