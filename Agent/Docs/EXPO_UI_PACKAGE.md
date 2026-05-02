# Expo UI Package

> Consumer integration reference for `@mrmeg/expo-ui`.

## Purpose

`@mrmeg/expo-ui` is the private reusable UI package for MrMeg Expo apps. It owns reusable design-system code that should update across apps from one package version instead of being copied into each project.

Package-owned code lives in `packages/ui/src/` in this template. Published consumers install the package from the private npm scope and import from its public export map.

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

After publishing, consumer apps install the package from the private npm scope:

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

Publish from `packages/ui` using the private npm scope configuration:

```sh
bun run --cwd packages/ui build
bun publish --cwd packages/ui --access restricted
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
- Keep package code free of `@/client/*` imports.
- Keep npm auth tokens and publish credentials out of the repo.
- Update this doc when the package export map, startup contract, or font strategy changes.

## Common Mistakes

- Copying `packages/ui/src/components/*` into each app instead of installing the package.
- Adding package assets to fix fonts. Web font loading belongs in Google Fonts links and `useResources()`; native currently uses system fallback.
- Forgetting `PortalHost`, which breaks overlay primitives.
- Importing from `packages/ui/src/*` in consumer apps. Consumers should import from `@mrmeg/expo-ui/*`.
- Treating a local workspace path as the publish contract. `packages/ui/package.json` exports are the source of truth.
