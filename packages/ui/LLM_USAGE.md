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
import { globalUIStore, useThemeStore } from "@mrmeg/expo-ui/state";
import { configureExpoUiI18n, hapticLight } from "@mrmeg/expo-ui/lib";
```

The root barrel also exports the public surface:

```tsx
import { Button, UIProvider, colors, useTheme } from "@mrmeg/expo-ui";
```

Use only exported package paths: root, `components`, `components/*`,
`constants`, `constants/*`, `hooks`, `hooks/*`, `state`, and `lib`. Do not
import from `@mrmeg/expo-ui/dist/*` or from a source checkout path.

## Required App Setup

Call `useResources()` once near the Expo app root. Mount `UIProvider` once
near the root when the app uses package feedback or overlay components.
`UIProvider` owns the package `Notification`, `StatusBar`, and default
`@rn-primitives` portal host.

```tsx
import { ThemeProvider } from "@react-navigation/native";
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
- Use `globalUIStore` plus root-mounted `UIProvider` for transient global feedback.
- Keep app monitoring, auth, API, and domain behavior outside this package.

Useful theme tokens include:

```tsx
theme.colors.background;
theme.colors.foreground;
theme.colors.card;
theme.colors.border;
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

## Component Use-Case Index

Use this table before creating a new app-local primitive.

| Component | Use For | Prefer It Instead Of | Common Example Use Cases |
|-----------|---------|----------------------|--------------------------|
| `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` | Multi-section disclosure | Custom FAQ/settings expanders | FAQ lists, grouped settings, help sections |
| `Alert` | Cross-platform imperative alerts | Direct `window.alert` or duplicated RN/web branching | Confirm destructive actions, native alert dialogs |
| `AnimatedView` | Entrance and visibility animation | Hand-rolled Reanimated wrappers | Staggered list rows, revealed panels, animated empty states |
| `Badge` | Short status labels | Custom pill `View` + `Text` | Draft/active states, counts, plan labels, role tags |
| `BottomSheet` | Mobile-first modal sheets | Custom absolute-position sheets | Action pickers, mobile filters, quick edit forms |
| `Button` | Commands and CTAs | Pressable plus custom text styling | Submit, save, cancel, delete, navigation CTAs |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | Framed content groups | Ad hoc bordered panels | List items, pricing plans, settings sections, summaries |
| `Checkbox` | Boolean selection | Custom checkmark controls | Terms consent, checklist items, multi-select filters |
| `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` | One-off disclosure | Local animated height wrappers | Advanced settings, hidden helper text |
| `Dialog`, `AlertDialog` | Modal decisions and custom modal content | Custom modal overlays | Confirm delete, edit profile, invite user |
| `DismissKeyboard` | Tap-away keyboard dismissal | Screen-level keyboard handling | Forms, search screens, sign-in screens |
| `Drawer` | Side panels and drawer navigation | Custom sliding panels | Filter drawer, app navigation drawer, inspector panel |
| `DropdownMenu` | Menus and command lists | Homemade popover menus | Row actions, account menu, sort menu |
| `EmptyState` | No-data or recoverable error regions | One-off empty placeholders | Empty inbox, no search results, failed list load |
| `ErrorBoundary` | React render error fallback | Unhandled screen crashes | Route-level fallback, feature boundary |
| `Icon` | Feather or custom icons with theme tokens | Raw vector icons with hardcoded colors | Button accessories, empty-state icons, menu icons |
| `InputOTP` | Verification code entry | Multiple manually managed text inputs | Email codes, SMS codes, MFA, invite codes |
| `Label` | Accessible form labels | Plain styled text labels | Required labels, disabled labels, field group labels |
| `MaxWidthContainer` | Centered responsive width | Per-screen max-width wrappers | Web pages, tablet layouts, settings forms |
| `Notification` | Global toast surface | Screen-local toast state | Saved/error/sync notifications, bottom-position alerts |
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
import { EmptyState, Progress, SkeletonCard } from "@mrmeg/expo-ui/components";
import { globalUIStore } from "@mrmeg/expo-ui/state";

{isLoading ? <SkeletonCard /> : null}
<Progress value={65} variant="accent" />
<EmptyState icon="inbox" title="No messages" description="New messages will appear here." />

globalUIStore.getState().show({
  type: "success",
  title: "Saved",
  messages: ["Your changes were saved."],
});
```
