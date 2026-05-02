# @mrmeg/expo-ui

Reusable Expo and React Native UI primitives shared by the template and consumer apps. The package does not ship font files; web consumers load Lato from Google Fonts and native consumers use platform sans-serif fallbacks.

## Install

Install from the private npm scope after publishing:

```sh
bun add @mrmeg/expo-ui
```

Consumers must also install the peer dependencies listed in `package.json`. Keep npm auth tokens in developer or CI configuration, not in this repository.

## Imports

```tsx
import { Button, StyledText } from "@mrmeg/expo-ui/components";
import { Button as ButtonDirect } from "@mrmeg/expo-ui/components/Button";
import { colors, spacing, typography } from "@mrmeg/expo-ui/constants";
import { useResources, useTheme } from "@mrmeg/expo-ui/hooks";
import { globalUIStore, useThemeStore } from "@mrmeg/expo-ui/state";
import { hapticLight, setupSentry } from "@mrmeg/expo-ui/lib";
```

The root barrel also exports the public surface:

```tsx
import { Button, colors, useTheme } from "@mrmeg/expo-ui";
```

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
