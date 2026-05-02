# @mrmeg/expo-ui

Reusable Expo and React Native UI primitives shared by the template and consumer apps. The package does not ship font files; web consumers load Lato from Google Fonts and native consumers use platform sans-serif fallbacks.

This package is public for installability, reuse across MrMeg projects, and
discoverability. It is a personal reusable Expo / React Native design-system
package, not a generally supported open-source UI library. The package is
published as `UNLICENSED`; use outside MrMeg projects requires explicit
permission.

## Install

Install from npm after publishing:

```sh
bun add @mrmeg/expo-ui
```

Consumers must also install the peer dependencies listed in `package.json`.
The tested baseline is Expo SDK 55 with React 19.2, React Native 0.83,
React Native Web 0.21, Reanimated 4.2, Worklets 0.7, and
`@rn-primitives/*` 1.4. Start consumer apps from the same Expo SDK family
or update the package and peer ranges deliberately. Keep npm auth tokens in
developer or CI configuration, not in this repository.

## Imports

```tsx
import { Button, StyledText } from "@mrmeg/expo-ui/components";
import { Button as ButtonDirect } from "@mrmeg/expo-ui/components/Button";
import { colors, spacing, typography } from "@mrmeg/expo-ui/constants";
import { useResources, useTheme } from "@mrmeg/expo-ui/hooks";
import { globalUIStore, useThemeStore } from "@mrmeg/expo-ui/state";
import { hapticLight } from "@mrmeg/expo-ui/lib";
```

The root barrel also exports the public surface:

```tsx
import { Button, colors, useTheme } from "@mrmeg/expo-ui";
```

## Theme System

Use `useTheme()` for theme-aware app styles:

```tsx
import { StyleSheet, View } from "react-native";
import { StyledText } from "@mrmeg/expo-ui/components";
import { spacing } from "@mrmeg/expo-ui/constants";
import { useTheme } from "@mrmeg/expo-ui/hooks";

export function Panel() {
  const { theme, getShadowStyle } = useTheme();

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
        getShadowStyle("subtle"),
      ]}
    >
      <StyledText semantic="heading">Theme-aware panel</StyledText>
      <StyledText semantic="body" style={{ color: theme.colors.mutedForeground }}>
        Uses package tokens instead of hardcoded colors.
      </StyledText>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: spacing.radiusLg,
    padding: spacing.cardPadding,
    gap: spacing.sm,
  },
});
```

`useTheme()` returns the active `theme`, resolved `scheme`, persisted `currentTheme`, `setTheme`, `toggleTheme`, shadow helpers, contrast helpers, and `withAlpha`. Use semantic tokens such as `theme.colors.background`, `foreground`, `card`, `border`, `primary`, `secondary`, `accent`, `mutedForeground`, `destructive`, `success`, and `warning`. `primary` is the neutral action color, `secondary` is a neutral secondary surface, and `accent` is the teal highlight color.

Use `StyledText` for theme-aware text:

```tsx
import { BodyText, CaptionText, HeadingText, StyledText } from "@mrmeg/expo-ui/components";

<HeadingText>Settings</HeadingText>
<BodyText>Manage your account.</BodyText>
<CaptionText>Changes sync automatically.</CaptionText>
<StyledText semantic="label" tx="common.email" />
```

Useful `StyledText` props:

- `semantic`: `title`, `heading`, `subheading`, `body`, `caption`, `label`
- `size`: `xs`, `sm`, `base`, `body`, `lg`, `xl`, `xxl`, `display`
- `fontWeight`: `light`, `regular`, `medium`, `semibold`, `bold`
- `variant`: `sansSerif`, `serif`
- `align`, `tx`, `txOptions`

## Component Guide

All components are exported from `@mrmeg/expo-ui/components`; direct imports such as `@mrmeg/expo-ui/components/Button` are supported.

Layout:

- `AnimatedView` - Reanimated visibility/entrance wrapper.
- `Card` - Framed content with `variant`: `default`, `outline`, `ghost`; includes `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
- `MaxWidthContainer` - Centered responsive content width.
- `Separator` - Theme-aware divider.
- `DismissKeyboard` - Tap-away keyboard dismissal wrapper.

Forms and actions:

- `Button` - Commands with `preset`: `default` for primary neutral actions, `secondary` for neutral secondary actions, plus `outline`, `ghost`, `link`, and `destructive`; `size`: `sm`, `md`, `lg`; supports `loading`, `fullWidth`, accessories, and shadows.
- `TextInput` - Inputs with `variant`: `outline`, `filled`, `underlined`; `size`: `sm`, `md`, `lg`; supports labels, helper/error text, clear/password affordances, and left/right elements.
- `Checkbox`, `RadioGroup`, `Select`, `Switch`, `Toggle`, `ToggleGroup`, `InputOTP`, `Slider`, `Label` - Form controls built on package tokens and `@rn-primitives` where applicable.

Feedback:

- `Alert`, `Badge`, `Notification`, `Progress`, `Skeleton`, `SkeletonText`, `SkeletonAvatar`, `SkeletonCard`, `EmptyState`, `StatusBar`.
- Mount `Notification` once near the app root; trigger it with `globalUIStore`.

Overlays and navigation:

- `Dialog`, `BottomSheet`, `Drawer`, `DropdownMenu`, `Popover`, `Tooltip` require `PortalHost` near the app root.
- `Tabs`, `Accordion`, and `Collapsible` cover in-page navigation and disclosure.

Example:

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

LLM rules:

- Prefer `StyledText` semantic variants over raw `Text`.
- Use `useTheme()` and semantic tokens instead of hardcoded colors.
- Use `Button.preset`, not `variant`, for buttons.
- Mount `PortalHost` before using overlays, menus, select content, popovers, or tooltips.
- Import from package exports, not `packages/ui/src/*`.

## App Startup

Call `useResources()` once near the Expo app root before hiding the splash screen:

```tsx
import { ThemeProvider } from "@react-navigation/native";
import { colors } from "@mrmeg/expo-ui/constants";
import { useResources, useTheme } from "@mrmeg/expo-ui/hooks";
import { Notification, StatusBar } from "@mrmeg/expo-ui/components";
import { PortalHost } from "@rn-primitives/portal";

export default function RootLayout() {
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
      {/* App navigation goes here. */}
      <Notification />
      <PortalHost />
      <StatusBar />
    </ThemeProvider>
  );
}
```

## Fonts

This package does not ship Lato `.ttf` files or other font binaries.

On web, `useResources()` injects the Google Fonts Lato stylesheet after hydration if the app has not already added it. For better first paint in Expo Router web apps, add the links in app-owned `app/+html.tsx`:

```tsx
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link
  id="mrmeg-expo-ui-lato"
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap"
/>
```

On native, the package uses platform sans-serif fallbacks. `useResources()` still loads `Feather.font` from the consumer app's `@expo/vector-icons` peer dependency for icon rendering.

## Package Checks

Run these before publishing:

```sh
bun run ui:typecheck
bun run ui:test
bun run ui:build
bun run ui:pack
bun run ui:consumer-smoke
```

`bun run ui:pack` runs a dry pack so the published file list and package size can be inspected before release.
`bun run ui:consumer-smoke` installs the packed tarball into a clean fixture,
checks the documented export-map files, type-checks all public package
entrypoints, and verifies that `@mrmeg/expo-ui/constants` can be imported
by plain Node ESM for token inspection.
