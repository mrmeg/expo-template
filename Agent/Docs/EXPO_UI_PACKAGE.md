# Expo UI Package

> Consumer integration reference for `@mrmeg/expo-ui`.

## Purpose

`@mrmeg/expo-ui` is the reusable UI package for MrMeg Expo apps. It owns reusable design-system code that should update across apps from one package version instead of being copied into each project.

Package-owned code lives in `packages/ui/src/` in this template. Published consumers install the package from npm and import from its public export map.

## Ownership Boundary

Package-owned:

- UI primitives in `packages/ui/src/components/`
- design tokens in `packages/ui/src/constants/`
- theme, resource, dimension, motion, and reduce-motion hooks in `packages/ui/src/hooks/`
- theme and global notification stores in `packages/ui/src/state/`
- haptics, animation helpers, and Sentry bridge in `packages/ui/src/lib/`

App-owned:

- app routes, screens, and feature modules
- provider composition in `app/_layout.tsx`
- web document head configuration in `app/+html.tsx`
- app identity, environment, auth, billing, media, and other domain behavior
- npm auth tokens and CI publishing credentials

Package source must stay portable. Do not import `@/client/*` from `packages/ui/src/*`.

## Install

After publishing, consumer apps install the package from npm:

```sh
bun add @mrmeg/expo-ui
```

Consumers must also install the peer dependencies listed in `packages/ui/package.json`. Keep npm auth tokens in developer, CI, or package-manager configuration. Do not commit tokens.

## Public Imports

The package export map supports these stable import paths:

```tsx
import { Button, StyledText } from "@mrmeg/expo-ui/components";
import { Button as ButtonDirect } from "@mrmeg/expo-ui/components/Button";
import { colors, spacing, typography, type Theme } from "@mrmeg/expo-ui/constants";
import { useResources, useTheme } from "@mrmeg/expo-ui/hooks";
import { globalUIStore, useThemeStore } from "@mrmeg/expo-ui/state";
import { hapticLight, setupSentry } from "@mrmeg/expo-ui/lib";
```

The root barrel also exports the package surface:

```tsx
import { Button, colors, useTheme } from "@mrmeg/expo-ui";
```

Prefer subpath imports when an app only needs one package area. Use direct component subpaths such as `@mrmeg/expo-ui/components/Button` when that keeps an app's imports clearer.

## App Startup

Call `useResources()` once near the app root and feed its `loaded` value into the app startup gate. In this template, `app/_layout.tsx` does this before hiding the splash screen.

```tsx
import { ThemeProvider } from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import { colors } from "@mrmeg/expo-ui/constants";
import { useResources, useTheme } from "@mrmeg/expo-ui/hooks";
import { ErrorBoundary, Notification, StatusBar } from "@mrmeg/expo-ui/components";
import { PortalHost } from "@rn-primitives/portal";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { scheme } = useTheme();
  const { loaded: resourcesLoaded } = useResources();

  if (!resourcesLoaded) {
    return null;
  }

  return (
    <ThemeProvider
      value={{
        dark: colors[scheme ?? "light"].dark,
        colors: colors[scheme ?? "light"].navigation,
        fonts: colors[scheme ?? "light"].fonts,
      }}
    >
      <ErrorBoundary>
        {/* App navigation goes here. */}
      </ErrorBoundary>
      <Notification />
      <PortalHost />
      <StatusBar />
    </ThemeProvider>
  );
}
```

`Notification` reads the global notification store from the package. `PortalHost` is required by `@rn-primitives` overlays such as dialogs, popovers, tooltips, and dropdown menus.

## Theme System

Use `useTheme()` from `@mrmeg/expo-ui/hooks` in app screens and app-local components that need theme-aware styles.

```tsx
import { StyleSheet, View } from "react-native";
import { StyledText } from "@mrmeg/expo-ui/components";
import { spacing } from "@mrmeg/expo-ui/constants";
import { useTheme } from "@mrmeg/expo-ui/hooks";

export function AccountCard() {
  const { theme, getShadowStyle } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
        getShadowStyle("subtle"),
      ]}
    >
      <StyledText semantic="heading">Account</StyledText>
      <StyledText semantic="body" style={{ color: theme.colors.mutedForeground }}>
        Billing, profile, and notification settings.
      </StyledText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: spacing.radiusLg,
    padding: spacing.cardPadding,
    gap: spacing.sm,
  },
});
```

`useTheme()` returns:

| Field | Purpose |
|-------|---------|
| `theme` | Active light/dark theme object from `colors` |
| `scheme` | Resolved `"light"` or `"dark"` scheme |
| `currentTheme` | User preference: `"system"`, `"light"`, or `"dark"` |
| `setTheme(mode)` | Persist the theme preference |
| `toggleTheme()` | Cycle `light -> dark -> system -> light` |
| `getShadowStyle(type)` | Native shadow style for `base`, `soft`, `sharp`, or `subtle`; returns `{}` on web |
| `getContrastingColor(bg, color1?, color2?)` | Pick the most readable color for a background |
| `getTextColorForBackground(bg)` | Return `"light"` or `"dark"` for a background |
| `withAlpha(color, alpha)` | Convert a color to an alpha-adjusted value |
| `getContrastRatio(a, b)` | Numeric WCAG contrast ratio helper |

Use semantic tokens instead of hardcoded colors:

```tsx
theme.colors.background;
theme.colors.foreground;
theme.colors.card;
theme.colors.cardForeground;
theme.colors.primary;
theme.colors.primaryForeground;
theme.colors.secondary;
theme.colors.secondaryForeground;
theme.colors.muted;
theme.colors.mutedForeground;
theme.colors.accent;
theme.colors.accentForeground;
theme.colors.destructive;
theme.colors.destructiveForeground;
theme.colors.success;
theme.colors.warning;
theme.colors.border;
theme.colors.overlay;
```

Theme preference is stored by `useThemeStore` from `@mrmeg/expo-ui/state` using AsyncStorage on native and localStorage on web:

```tsx
import { Button } from "@mrmeg/expo-ui/components";
import { useTheme } from "@mrmeg/expo-ui/hooks";

export function ThemeModeButton() {
  const { currentTheme, setTheme, toggleTheme } = useTheme();

  return (
    <>
      <Button preset="outline" onPress={toggleTheme}>
        Current: {currentTheme}
      </Button>
      <Button preset="ghost" onPress={() => setTheme("system")}>
        Use system
      </Button>
    </>
  );
}
```

Use `colors[scheme].navigation` and `colors[scheme].fonts` when wiring React Navigation's `ThemeProvider`.

## Typography

Use `StyledText` for new package-aware text. It applies theme text color, font family, sizing, line-height, i18n lookup, and nested text color context used by buttons and toggle controls.

```tsx
import {
  StyledText,
  TitleText,
  HeadingText,
  BodyText,
  CaptionText,
} from "@mrmeg/expo-ui/components";

<TitleText>Screen title</TitleText>
<HeadingText>Section heading</HeadingText>
<BodyText>Body copy</BodyText>
<CaptionText>Secondary helper text</CaptionText>

<StyledText semantic="label">Email</StyledText>
<StyledText semantic="caption" tx="common.required" />
<StyledText size="lg" fontWeight="semibold" align="center">
  Custom text
</StyledText>
```

Text options:

| Prop | Values |
|------|--------|
| `semantic` | `title`, `heading`, `subheading`, `body`, `caption`, `label` |
| `size` | `xs`, `sm`, `base`, `body`, `lg`, `xl`, `xxl`, `display` |
| `fontWeight` | `light`, `regular`, `medium`, `semibold`, `bold` |
| `variant` | `sansSerif`, `serif` |
| `align` | `left`, `center`, `right`, `justify`, `auto` |
| `tx`, `txOptions` | i18n key and interpolation options |

Package font strategy still applies: Lato on web via Google Fonts, platform sans-serif on native, Georgia/system serif fallback for serif text.

## Component Reference

All components are exported from `@mrmeg/expo-ui/components`; direct component subpaths such as `@mrmeg/expo-ui/components/Button` are also supported.

### Layout

| Component | Use For | Notes |
|-----------|---------|-------|
| `AnimatedView` | Entrance/visibility animation wrapper | Uses Reanimated and package motion helpers |
| `Card` | Framed content groups | `variant`: `default`, `outline`, `ghost`; compound parts include `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` |
| `MaxWidthContainer` | Centered responsive page content | Use for web/tablet width constraints |
| `Separator` | Horizontal or vertical dividers | Theme-aware border color |
| `DismissKeyboard` | Tapping outside inputs on native | Wrap form screens |

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@mrmeg/expo-ui/components";

<Card variant="outline">
  <CardHeader>
    <CardTitle>Project</CardTitle>
  </CardHeader>
  <CardContent>
    <BodyText>Shared UI is installed from @mrmeg/expo-ui.</BodyText>
  </CardContent>
</Card>
```

### Typography And Icons

| Component | Use For | Notes |
|-----------|---------|-------|
| `StyledText` | Theme-aware text | Prefer semantic props over raw font sizes |
| `Icon` | Feather icons | Requires `useResources()` so `Feather.font` is loaded |
| `Label` | Form labels | `size`: `sm`, `md`, `lg`; supports required/disabled styling |

### Actions And Forms

| Component | Use For | Notes |
|-----------|---------|-------|
| `Button` | Primary and secondary actions | `preset`: `default`, `outline`, `ghost`, `link`, `destructive`, `secondary`; `size`: `sm`, `md`, `lg`; supports `loading`, `fullWidth`, `withShadow`, `LeftAccessory`, `RightAccessory` |
| `TextInput` | Text entry | `variant`: `outline`, `filled`, `underlined`; `size`: `sm`, `md`, `lg`; supports labels, helper/error text, clear/password affordances, left/right elements |
| `Checkbox` | Boolean selection | `size`: `sm`, `md`, `lg`; supports error state |
| `RadioGroup` | Single choice | Root controls value; `RadioGroupItem` must be inside `RadioGroup`; `size`: `sm`, `md`, `lg` |
| `Select` | Option menus | Compound primitives: `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`, `SelectSeparator` |
| `Switch` | Binary setting | `variant`: `default`, `ios`, `material`; accepts custom track/thumb sizes |
| `Toggle` | Pressed/unpressed control | `variant`: `default`, `outline`; `size`: `sm`, `default`, `lg`; supports loading and icon |
| `ToggleGroup` | Single or multi toggle groups | `variant`: `default`, `outline`; `size`: `sm`, `default`, `lg` |
| `InputOTP` | One-time-code entry | Supports length, grouping, validation, complete callback |
| `Slider` | Numeric range selection | `size`: `sm`, `md`, `lg` |

```tsx
import { Button, TextInput } from "@mrmeg/expo-ui/components";

<TextInput
  label="Email"
  placeholder="you@example.com"
  autoCapitalize="none"
  keyboardType="email-address"
/>

<Button preset="default" size="lg" fullWidth loading={isSubmitting}>
  Continue
</Button>
```

### Feedback

| Component | Use For | Notes |
|-----------|---------|-------|
| `Alert` | Inline status messages | Compound alert primitives |
| `Badge` | Short status labels | `variant`: `default`, `secondary`, `outline`, `destructive` |
| `Notification` | Global toast surface | Mount once near the root; driven by `globalUIStore` |
| `Progress` | Determinate or indeterminate progress | `variant`: `default`, `accent`, `destructive`; `size`: `sm`, `md`, `lg` |
| `Skeleton`, `SkeletonText`, `SkeletonAvatar`, `SkeletonCard` | Loading placeholders | Use instead of layout-shifting spinners for content regions |
| `EmptyState` | Empty/error content blocks | Supports icon, title, description, and optional action |
| `StatusBar` | Theme-aware native status bar | Reads `scheme` from `useTheme()` |

```tsx
import { Badge, EmptyState, Progress } from "@mrmeg/expo-ui/components";
import { globalUIStore } from "@mrmeg/expo-ui/state";

<Badge variant="outline">Draft</Badge>
<Progress value={65} variant="accent" />
<EmptyState icon="inbox" title="No messages" description="New messages will appear here." />

globalUIStore.getState().show({
  type: "success",
  title: "Saved",
  messages: ["Your changes were saved."],
});
```

### Overlays And Menus

These components require `PortalHost` from `@rn-primitives/portal` mounted near the app root.

| Component | Use For | Notes |
|-----------|---------|-------|
| `Dialog` | Modal decisions and custom modal content | Compound primitives include trigger/content/header/body/footer/title/description/close patterns |
| `BottomSheet` | Mobile-first modal sheets | Compound parts include trigger, content, header, body, footer, handle, close |
| `Drawer` | Side panels and navigation drawers | Compound parts include trigger, content, header, body, footer, close |
| `DropdownMenu` | Menus and command lists | Supports submenus, checkbox/radio items, labels, separators, shortcuts |
| `Popover` | Anchored contextual content | Compound header/body/footer support |
| `Tooltip` | Short hover/focus help | `variant`: `default`, `dark`, `light` |

Use `StyleSheet.flatten()` when passing composed style arrays to `@rn-primitives` internals or wrappers; raw nested style arrays can crash React Native Web.

### Navigation And Disclosure

| Component | Use For | Notes |
|-----------|---------|-------|
| `Tabs` | In-page tabbed views | `variant`: `underline`, `pill`; `size`: `sm`, `md`, `lg`; compound parts: `TabsList`, `TabsTrigger`, `TabsContent` |
| `Accordion` | Expand/collapse sections | Supports single and multiple mode |
| `Collapsible` | Simple controlled disclosure | Use for one-off expandable regions |

## Choosing Components

- Use `Button` for commands, `Toggle`/`ToggleGroup` for persistent pressed state, and `Switch` for binary settings.
- Use `RadioGroup` for small mutually exclusive choices and `Select` for longer option sets.
- Use `Dialog` for blocking decisions, `Popover` for contextual controls, `Tooltip` for short explanations, and `DropdownMenu` for action lists.
- Use `Card` for individual repeated or framed items, not as a wrapper around full page sections.
- Use `EmptyState` for no-data or recoverable error regions; use `Alert` for inline messages near the affected control.
- Use `Skeleton` for loading content with stable layout; use `Progress` for real progress or indeterminate long-running work.

## Fonts

The package does not ship Lato `.ttf` files or any other font binaries.

Web:

- `useResources()` injects this stylesheet after hydration if it is not already present:
  `https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap`
- `app/+html.tsx` should add preconnect and stylesheet links for better first paint.
- Font tokens use `"Lato", system-ui, ...` as the web stack.

Native:

- Lato is not loaded on iOS or Android.
- Font tokens use platform sans-serif fallbacks.
- A future change to remote native font loading needs its own spec because package size is a constraint.

Icons:

- `useResources()` still loads `Feather.font` from `@expo/vector-icons`.
- That icon font comes from the consumer app's peer dependency, not from bundled files inside `@mrmeg/expo-ui`.

Recommended Expo web head setup:

```tsx
// app/+html.tsx
import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          id="mrmeg-expo-ui-lato"
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap"
        />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

If a web app skips these head links, `useResources()` still injects the stylesheet on the client. The tradeoff is that first paint can briefly use the fallback stack.

## Adding Package Components

Reusable primitives belong in `packages/ui/src/components/` and must be exported from `packages/ui/src/components/index.ts`.

Use the generator from the template when possible:

```sh
bun run generate component ComponentName
```

When adding package code:

- keep imports inside `packages/ui/src/*` relative or from package peers
- do not import app-local `@/client/*`
- update `packages/ui/src/components/index.ts`
- add focused tests next to the package source
- run the package gates:

```sh
bun run ui:typecheck
bun run ui:test
bun run ui:build
bun run ui:pack
bun run ui:consumer-smoke
```

## Publish And Update Flow

Before publishing a package update:

```sh
bun run ui:typecheck
bun run ui:test
bun run ui:build
bun run ui:pack
bun run ui:consumer-smoke
```

Publish from `packages/ui` using public npm access:

```sh
bun run --cwd packages/ui build
npm publish --access public
```

Consumer apps update with the package manager after a new version is published:

```sh
bun update @mrmeg/expo-ui
```

For workspace development inside this template, the root dependency is `@mrmeg/expo-ui: workspace:*`. Published apps should depend on a version range appropriate for their release process.

## LLM Rules

- Import reusable UI from `@mrmeg/expo-ui`, not copied app-local files.
- Use exported subpaths only: root, `components`, `components/*`, `constants`, `hooks`, `state`, and `lib`.
- Do not add `.ttf` files to the package for Lato.
- On web, use `useResources()` plus app-owned `+html.tsx` preload links.
- On native, rely on system sans-serif unless a future spec explicitly adds remote native font support.
- Use `useTheme()` and semantic theme tokens instead of hardcoded colors.
- Use `StyledText` semantic variants instead of raw `Text` when building UI with this library.
- Mount `PortalHost` before using dialogs, drawers, popovers, dropdown menus, tooltips, or select content.
- Keep package code free of `@/client/*` imports.
- Keep npm auth tokens and publish credentials out of the repo.
- Update this doc when the package export map, startup contract, or font strategy changes.

## Common Mistakes

- Copying `packages/ui/src/components/*` into each app instead of installing the package.
- Adding package assets to fix fonts. Web font loading belongs in Google Fonts links and `useResources()`; native currently uses system fallback.
- Forgetting `PortalHost`, which breaks overlay primitives.
- Importing from `packages/ui/src/*` in consumer apps. Consumers should import from `@mrmeg/expo-ui/*`.
- Treating a local workspace path as the publish contract. `packages/ui/package.json` exports are the source of truth.
