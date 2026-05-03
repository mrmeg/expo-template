# @mrmeg/expo-ui

Reusable Expo and React Native UI primitives shared by the template and consumer apps. The package does not ship font files; web consumers load Lato from Google Fonts and native consumers use platform sans-serif fallbacks.

This package is public for installability, reuse across MrMeg projects, and
discoverability. It is a personal reusable Expo / React Native design-system
package, not a generally supported open-source UI library. The package is
published as `UNLICENSED`; use outside MrMeg projects requires explicit
permission.

## For LLMs And Coding Agents

When this package is installed from npm, read
`node_modules/@mrmeg/expo-ui/LLM_USAGE.md` before creating app-local UI
primitives. That file is shipped in the npm package and gives the short
component-selection rules, import paths, setup requirements, and examples that
help agents choose existing package components instead of rebuilding them.

## Install

Install from npm after publishing:

```sh
bun add @mrmeg/expo-ui
```

Consumers must also install the peer dependencies listed in `package.json`.
The tested baseline is Expo SDK 55 with React 19.2, React Native 0.83,
React Native Web 0.21, Reanimated 4.2, Worklets 0.7, and
`@rn-primitives/*` 1.4. `@rn-primitives/portal` is package-managed because
`UIProvider` mounts the portal host used by package overlays. `i18next` and
`react-i18next` are runtime peers because `StyledText` and `Notification`
support translated text keys. Start consumer apps from the same Expo SDK
family or update the package and peer ranges deliberately. Keep npm auth tokens
in developer or CI configuration, not in this repository.

## Imports

```tsx
import { Button, StyledText, UIProvider } from "@mrmeg/expo-ui/components";
import { Button as ButtonDirect } from "@mrmeg/expo-ui/components/Button";
import { colors, spacing, typography } from "@mrmeg/expo-ui/constants";
import { colors as colorsDirect } from "@mrmeg/expo-ui/constants/colors";
import { useResources, useTheme } from "@mrmeg/expo-ui/hooks";
import { useTheme as useThemeDirect } from "@mrmeg/expo-ui/hooks/useTheme";
import { globalUIStore, useThemeStore } from "@mrmeg/expo-ui/state";
import { hapticLight } from "@mrmeg/expo-ui/lib";
```

The root barrel also exports the public surface:

```tsx
import { Button, UIProvider, colors, useTheme } from "@mrmeg/expo-ui";
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

All components are exported from `@mrmeg/expo-ui/components`; direct imports such as `@mrmeg/expo-ui/components/Button` are supported. Use this table as the first stop before building a new primitive in a consumer app.

### LLM Component Use-Case Index

| Component | Use For | Prefer It Instead Of | Common Example Use Cases |
|-----------|---------|----------------------|--------------------------|
| `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` | Multi-section disclosure | Custom FAQ/settings expanders | FAQ lists, grouped settings, help sections, dense detail pages |
| `Alert` | Cross-platform imperative alerts | Direct `window.alert` or duplicated RN/web branching | Confirm destructive actions, native alert dialogs, simple blocking messages |
| `AnimatedView` | Entrance and visibility animation | Hand-rolled Reanimated wrappers | Staggered list rows, revealed panels, animated empty states |
| `Badge` | Short status labels | Custom pill `View` + `Text` | Draft/active states, counts, plan labels, role tags |
| `BottomSheet` | Mobile-first modal sheets | Custom absolute-position sheets | Action pickers, mobile filters, quick edit forms, contextual details |
| `Button` | Commands and CTAs | Pressable plus custom text styling | Submit, save, cancel, delete, navigation CTAs, icon-accessory buttons |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | Framed content groups | Ad hoc bordered panels | List items, pricing plans, settings sections, summaries, dashboards |
| `Checkbox` | Boolean selection | Custom checkmark controls | Terms consent, checklist items, multi-select filters, notification opt-ins |
| `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` | One-off disclosure | Local animated height wrappers | Advanced settings, hidden helper text, optional details |
| `Dialog`, `AlertDialog` | Modal decisions and custom modal content | Custom modal overlays | Confirm delete, edit profile, invite user, blocking warnings |
| `DismissKeyboard` | Tap-away keyboard dismissal | Screen-level keyboard handling | Forms, search screens, sign-in screens |
| `Drawer` | Side panels and drawer navigation | Custom sliding panels | Filter drawer, app navigation drawer, inspector panel |
| `DropdownMenu` | Menus and command lists | Homemade popover menus | Row actions, account menu, sort menu, checkbox/radio menu groups |
| `EmptyState` | No-data or recoverable error regions | One-off empty placeholders | Empty inbox, no search results, missing permissions, failed list load |
| `ErrorBoundary` | React render error fallback | Unhandled screen crashes | Route-level fallback, feature boundary, recoverable widget crashes |
| `Icon` | Feather or custom icons with theme tokens | Raw vector icons with hardcoded colors | Button accessories, empty-state icons, menu icons, status glyphs |
| `InputOTP` | Verification code entry | Multiple manually managed text inputs | Email codes, SMS codes, MFA, invite codes |
| `Label` | Accessible form labels | Plain styled text labels | Required labels, disabled labels, field group labels |
| `MaxWidthContainer` | Centered responsive width | Per-screen max-width wrappers | Web pages, tablet layouts, settings forms, auth panels |
| `Notification` | Global toast surface | Screen-local toast state | Saved/error/sync notifications, loading toast, bottom-position alerts |
| `Popover` | Anchored contextual content | Custom anchored views | Inline help, quick previews, contextual controls, small forms |
| `Progress` | Determinate or indeterminate progress | Layout-shifting spinners for progress regions | Upload progress, onboarding completion, long-running task state |
| `RadioGroup`, `RadioGroupItem` | Mutually exclusive choices | Custom radio rows | Plan interval, visibility choice, survey answer, preference setting |
| `Select` | Option menus | Custom dropdowns | Country picker, category selector, status selector, compact form choice |
| `Separator` | Horizontal or vertical dividers | Border-only spacer views | Menu dividers, section dividers, card dividers |
| `Skeleton`, `SkeletonText`, `SkeletonAvatar`, `SkeletonCard` | Loading placeholders | Blank space or generic spinners | List loading, profile card loading, dashboard placeholders |
| `Slider` | Numeric value selection | Custom pan gesture track | Volume, percentage, rating, threshold, range-like settings |
| `StatusBar` | Theme-aware native status bar | Per-screen status-bar duplication | Root layout status styling, dark/light mode updates |
| `StyledText` and text aliases | Theme-aware typography | Raw `Text` with hardcoded styles | Titles, headings, labels, body copy, captions, translated text |
| `Switch` | Binary settings | Custom toggle switches | Enable notifications, privacy setting, feature toggles |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | In-page tabbed views | Custom segmented/tab controls | Profile sections, report views, settings categories |
| `TextInput` | Text entry | Raw `TextInput` with repeated label/error code | Email/password, search, numeric input, multiline notes |
| `Toggle`, `ToggleIcon` | Pressed/unpressed control | Button with local selected styling | Favorite, mute, bold/italic, view mode button |
| `ToggleGroup`, `ToggleGroupItem`, `ToggleGroupIcon` | Single or multi toggle groups | Custom segmented controls | Alignment, formatting toolbar, filter chips, view mode switcher |
| `Tooltip` | Short hover/focus help | Persistent helper text or custom hover cards | Icon button labels, field hints, disabled action explanations |

### Compound Parts And Aliases

Most compound components support both direct named imports and dot notation on the root component. Prefer the named exports when code completion or LLM context benefits from explicit names.

| Root | Exported Parts |
|------|----------------|
| `Accordion` | `AccordionItem`, `AccordionTrigger`, `AccordionContent` |
| `AlertDialog` | `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel` |
| `BottomSheet` | `BottomSheetTrigger`, `BottomSheetContent`, `BottomSheetHandle`, `BottomSheetHeader`, `BottomSheetBody`, `BottomSheetFooter`, `BottomSheetClose` |
| `Card` | `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` |
| `Collapsible` | `CollapsibleTrigger`, `CollapsibleContent` |
| `Dialog` | `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose` |
| `Drawer` | `DrawerTrigger`, `DrawerContent`, `DrawerHeader`, `DrawerBody`, `DrawerFooter`, `DrawerClose` |
| `DropdownMenu` | `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuGroup`, `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuShortcut`, `DropdownMenuPortal`, `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent` |
| `Popover` | `PopoverTrigger`, `PopoverContent`, `PopoverHeader`, `PopoverBody`, `PopoverFooter` |
| `RadioGroup` | `RadioGroupItem` |
| `Select` | `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`, `SelectSeparator` |
| `Skeleton` | `SkeletonText`, `SkeletonAvatar`, `SkeletonCard` |
| `Tabs` | `TabsList`, `TabsTrigger`, `TabsContent` |
| `Toggle` | `ToggleIcon` |
| `ToggleGroup` | `ToggleGroupItem`, `ToggleGroupIcon` |
| `Tooltip` | `TooltipTrigger`, `TooltipContent`, `TooltipBody` |

Text aliases are exported for common semantic typography: `SerifText`, `SansSerifText`, `SerifBoldText`, `SansSerifBoldText`, `DisplayText`, `TitleText`, `HeadingText`, `SubheadingText`, `BodyText`, `CaptionText`, and `LabelText`. `TextClassContext` and `TextColorContext` are advanced context exports used by package controls to pass nested text styling.

### Common Patterns

Use `Button.preset`, not `variant`. `default` is the neutral primary action, `secondary` is a neutral secondary surface, `outline` is for lower-emphasis actions, `ghost` is for compact toolbars, `link` is for text-like commands, and `destructive` is for dangerous actions.

Use `StyledText` or its aliases instead of raw `Text` whenever the text is part of app UI. Use `TextInput` for labeled fields because it already owns label, helper text, error text, clear buttons, password visibility, numeric filtering, and left/right elements.

Mount `UIProvider` once near the root before using `Dialog`, `AlertDialog`, `BottomSheet`, `Drawer`, `DropdownMenu`, `Popover`, `SelectContent`, `Tooltip`, or package notifications. Trigger transient feedback from `globalUIStore`.

Use `Skeleton` components for loading content with stable dimensions, `EmptyState` for no-data/recoverable errors, `Alert` for blocking confirm/alert dialogs, and `Notification` for transient global feedback.

Use `Toggle` for one pressed state, `ToggleGroup` for a related set of pressed states, `Switch` for binary settings, `RadioGroup` for small mutually exclusive choices, and `Select` for longer option sets.

### Quick Examples

Card, badge, and CTA:

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

Form controls:

```tsx
import { Button, TextInput, Switch } from "@mrmeg/expo-ui/components";

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

Feedback:

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

LLM rules:

- Prefer `StyledText` semantic variants over raw `Text`.
- Use `useTheme()` and semantic tokens instead of hardcoded colors.
- Use `Button.preset`, not `variant`, for buttons.
- Mount `UIProvider` before using overlays, menus, select content, popovers, tooltips, or package notifications.
- Import from package exports, not `packages/ui/src/*`.

## App Startup

Call `useResources()` once near the Expo app root before hiding the splash screen:

```tsx
import { ThemeProvider } from "@react-navigation/native";
import { colors } from "@mrmeg/expo-ui/constants";
import { useResources, useTheme } from "@mrmeg/expo-ui/hooks";
import { UIProvider } from "@mrmeg/expo-ui/components";

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
      <UIProvider>
        {/* App navigation goes here. */}
      </UIProvider>
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

For a one-command release from the repo root, use:

```sh
bun run ui:release -- --patch --publish
```

Replace `--patch` with `--minor`, `--major`, or an exact version such as `0.2.0`.
The command updates `packages/ui/package.json` and `bun.lock`, runs all package
gates, then publishes with `npm publish --access public` only when `--publish`
is present. Without `--publish`, it performs the same version bump and gates as
a dry run.

The release command requires a clean working tree by default. Commit current
changes first, or pass `--allow-dirty` when you intentionally want to release
from uncommitted local changes.

If npm login email is unavailable, publish through GitHub Actions trusted
publishing instead:

1. In npm package settings for `@mrmeg/expo-ui`, add a trusted publisher:
   GitHub Actions, owner `mrmeg`, repository `expo-template`, workflow
   filename `publish-ui.yml`.
2. Bump `packages/ui/package.json` in a commit and push it to `main`.

The workflow uses npm OIDC, not a checked-in token or local npm login. On push,
it reads the committed package version, skips cleanly if that version is already
published, otherwise runs the package gates and publishes from `packages/ui`.
The workflow can also be run manually with `version=patch` and `ref=main`; manual
runs bump the package version, update `bun.lock`, run the package gates, commit
the version bump, and publish.

Keep `repository.url` in `package.json` as
`git+https://github.com/mrmeg/expo-template.git`. npm trusted publishing checks
that metadata during publish, and publish-time URL normalization can block OIDC
auth.

If npm trusted publishing is blocked by package settings, add an npm automation
or granular publish token to GitHub Actions secrets as `NPM_TOKEN` and rerun the
same workflow. The token is used only for the publish step.

If the manual workflow fails after the version is already bumped, rerun it with
the exact current package version, for example `version=0.1.3`. Exact-version
reruns do not bump again.

Manual package checks:

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
entrypoints, verifies that `@mrmeg/expo-ui/constants` can be imported by
plain Node ESM for token inspection, and runs an Expo SDK 55 iOS export
against the packed package without a custom Metro config.
