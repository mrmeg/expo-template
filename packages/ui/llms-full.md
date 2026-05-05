# @mrmeg/expo-ui Full Contract

`@mrmeg/expo-ui` packages reusable Expo and React Native UI primitives for
MrMeg apps. It owns the shared design system, tokens, package theme store,
resource hook, global notification store, overlay shell, and small interaction
helpers. The consuming app owns routes, screens, feature state, auth, billing,
media, monitoring, API calls, product copy, and app-specific layouts.

## Agent Rules

Do not recreate primitives that this package already provides. Import from
`@mrmeg/expo-ui` and compose package components in the app.

Use only exported package paths:

- `@mrmeg/expo-ui`
- `@mrmeg/expo-ui/components`
- `@mrmeg/expo-ui/components/*`
- `@mrmeg/expo-ui/constants`
- `@mrmeg/expo-ui/constants/*`
- `@mrmeg/expo-ui/hooks`
- `@mrmeg/expo-ui/hooks/*`
- `@mrmeg/expo-ui/state`
- `@mrmeg/expo-ui/lib`

Do not import from `@mrmeg/expo-ui/dist/*`, `packages/ui/src/*`, or copied
app-local component files.

## App Setup

Call `useResources()` once near the Expo app root. Mount `UIProvider` once near
the root when the app uses package feedback or overlay components.

`UIProvider` owns the package `Notification`, `StatusBar`, and default
`@rn-primitives` portal host. Mount it before using `Dialog`, `AlertDialog`,
`BottomSheet`, `Drawer`, `DropdownMenu`, `Popover`, `SelectContent`,
`Tooltip`, or `globalUIStore` notifications.

i18n is optional. Plain children and `text` props work without `i18next` or
`react-i18next`. Use `configureExpoUiI18n()` only when a consuming app wants
package `tx` props translated by its app-owned i18n instance.

## Theme Rules

Use `useTheme()` and `useStyles()` from `@mrmeg/expo-ui/hooks`. Use semantic
tokens such as `background`, `foreground`, `card`, `popover`, `border`,
`input`, `ring`, `primary`, `secondary`, `accent`, `mutedForeground`,
`destructive`, `success`, and `warning`.

Use `StyledText` and semantic text aliases instead of raw `Text` for app UI.
Use package controls instead of hardcoded Pressable/View/Text combinations.

When the saved theme preference is `system`, the package theme store owns OS
color-scheme sync, including web `prefers-color-scheme`. Apps should not add
their own `Appearance` or `matchMedia` listeners just to make package
components follow system light/dark changes.

## Import Examples

```tsx
import { Button, StyledText, UIProvider } from "@mrmeg/expo-ui/components";
import { Button as ButtonDirect } from "@mrmeg/expo-ui/components/Button";
import { colors, spacing, typography } from "@mrmeg/expo-ui/constants";
import { useResources, useTheme } from "@mrmeg/expo-ui/hooks";
import { globalUIStore, useThemeStore } from "@mrmeg/expo-ui/state";
import { configureExpoUiI18n, hapticLight } from "@mrmeg/expo-ui/lib";
```

The root barrel also exports the public surface:

```tsx
import { Button, UIProvider, colors, useTheme } from "@mrmeg/expo-ui";
```

## Component Catalog

Use this catalog before creating a new app-local primitive.

| Component | Import | Use When | Gotchas |
|-----------|--------|----------|---------|
| `Accordion` | `@mrmeg/expo-ui/components` | Multi-section disclosure such as FAQ or grouped settings | Use compound parts instead of custom expanders. |
| `Alert` | `@mrmeg/expo-ui/components` | Cross-platform imperative alerts | Avoid direct `window.alert` and duplicated native/web branching. |
| `AnimatedView` | `@mrmeg/expo-ui/components` | Entrance and visibility animation | Keep simple reveal effects in the package wrapper. |
| `Badge` | `@mrmeg/expo-ui/components` | Short status labels | Prefer over custom pill views. |
| `BottomSheet` | `@mrmeg/expo-ui/components` | Mobile-first modal sheets | Requires root `UIProvider` portal setup. |
| `Button` | `@mrmeg/expo-ui/components` | Commands and CTAs | Use `preset`, not `variant`; visible heights are compact. |
| `Card` | `@mrmeg/expo-ui/components` | Individual framed content groups | Do not wrap whole page sections in cards. |
| `Checkbox` | `@mrmeg/expo-ui/components` | Boolean selection in forms or lists | Prefer over custom checkmark controls. |
| `Collapsible` | `@mrmeg/expo-ui/components` | One-off disclosure | Use for advanced settings or helper sections. |
| `Dialog`, `AlertDialog` | `@mrmeg/expo-ui/components` | Blocking modal content or decisions | Requires root `UIProvider` portal setup. |
| `DismissKeyboard` | `@mrmeg/expo-ui/components` | Tap-away keyboard dismissal | Prefer over screen-level keyboard wrappers. |
| `Drawer` | `@mrmeg/expo-ui/components` | Side panels and drawer navigation | `Drawer.Content` owns safe-area top/bottom padding; do not duplicate it in children. |
| `DropdownMenu` | `@mrmeg/expo-ui/components` | Menus and command lists | Requires root `UIProvider` portal setup. |
| `EmptyState` | `@mrmeg/expo-ui/components` | No-data or recoverable error regions | Prefer over one-off empty placeholders. |
| `ErrorBoundary` | `@mrmeg/expo-ui/components` | React render error fallback | Use for route or feature boundaries. |
| `Icon` | `@mrmeg/expo-ui/components` | Feather or custom icons with theme tokens | Avoid raw vector icons with hardcoded colors. |
| `InputOTP` | `@mrmeg/expo-ui/components` | Verification code entry | Prefer over manually managed text input groups. |
| `Label` | `@mrmeg/expo-ui/components` | Accessible form labels | Use with package form controls. |
| `MaxWidthContainer` | `@mrmeg/expo-ui/components` | Centered responsive width | Use for web and tablet constrained layouts. |
| `Notification` | `@mrmeg/expo-ui/components` | Global toast surface | Trigger through `globalUIStore` with root `UIProvider`. |
| `Popover` | `@mrmeg/expo-ui/components` | Anchored contextual content | Requires root `UIProvider` portal setup. |
| `Progress` | `@mrmeg/expo-ui/components` | Determinate or indeterminate progress | Prefer over layout-shifting spinners for progress regions. |
| `RadioGroup` | `@mrmeg/expo-ui/components` | Small mutually exclusive choices | Use `Select` for longer option sets. |
| `Select` | `@mrmeg/expo-ui/components` | Option menus | `SelectContent` requires root `UIProvider` portal setup. |
| `Separator` | `@mrmeg/expo-ui/components` | Horizontal or vertical dividers | Prefer over border-only spacer views. |
| `Skeleton` | `@mrmeg/expo-ui/components` | Loading placeholders | Use stable dimensions to avoid layout shift. |
| `Slider` | `@mrmeg/expo-ui/components` | Numeric value selection | Prefer over custom pan gesture tracks. |
| `StatusBar` | `@mrmeg/expo-ui/components` | Theme-aware native status bar | Usually mounted through `UIProvider`. |
| `StyledText` | `@mrmeg/expo-ui/components` | Theme-aware typography | Prefer semantic aliases over raw `Text`. |
| `Switch` | `@mrmeg/expo-ui/components` | Binary settings | Prefer over custom toggles for on/off state. |
| `Tabs` | `@mrmeg/expo-ui/components` | In-page tabbed views | Use for profile sections, report views, and settings categories. |
| `TextInput` | `@mrmeg/expo-ui/components` | Text entry | Use built-in label and error text support. |
| `Toggle` | `@mrmeg/expo-ui/components` | One pressed/unpressed control | Use `Button` for commands and `Switch` for settings. |
| `ToggleGroup` | `@mrmeg/expo-ui/components` | Related pressed states | Use for segmented controls, formatting, and filter chips. |
| `Tooltip` | `@mrmeg/expo-ui/components` | Short hover/focus help | Requires root `UIProvider` portal setup. |

## Selection Rules

Use `Button` for commands, `Toggle` for one pressed state, `ToggleGroup` for
related pressed states, and `Switch` for binary settings.

Use `RadioGroup` for small mutually exclusive choices and `Select` for longer
option sets.

Use `Dialog` for blocking decisions, `Popover` for contextual controls,
`Tooltip` for short explanations, and `DropdownMenu` for action lists.

Use `Card` for individual repeated or framed items, not as a wrapper around
full page sections. Use `EmptyState` for no-data or recoverable error regions,
`Skeleton` for loading content with stable layout, and `Progress` for real
progress or indeterminate long-running work.

## Validation

Run the UI package gates when changing package code or shipped docs:

```sh
bun run ui:typecheck
bun run ui:test
bun run ui:build
bun run ui:pack
bun run ui:consumer-smoke
```

For documentation-only package surface changes, `bun run ui:pack` is the
minimum check that proves the new docs are included in the npm tarball.
