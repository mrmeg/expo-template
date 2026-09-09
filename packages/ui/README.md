# @mrmeg/expo-ui

Reusable Expo and React Native UI primitives: design tokens, a theme store, and
a universal component library for iOS, Android, and web. MIT licensed.

## For LLMs And Coding Agents

Read `node_modules/@mrmeg/expo-ui/llms.txt` first, then `LLM_USAGE.md` (concise
rules) or `llms-full.md` (expanded contract), before creating app-local UI
primitives. All three ship in the npm tarball.

## Install

```sh
bun add @mrmeg/expo-ui
```

Tested hosts: Expo SDK 56–57, React 19.2, React Native 0.85–0.86, React Native
Web 0.21. Install these peers at the versions your Expo SDK recommends: `expo`,
`@expo/ui`, `expo-font`, `expo-haptics`, `react`, `react-native`,
`react-native-web`, `react-native-gesture-handler`,
`react-native-keyboard-controller`, `react-native-safe-area-context`,
`react-native-screens`, `@react-native-async-storage/async-storage`, `zustand`.

`@rn-primitives/*` and `@expo-google-fonts/inter` are package dependencies, not
peers. Animations use React Native `Animated`. `BottomSheet`, `Slider`, and
`SegmentedControl` render native `@expo/ui` controls. i18n is optional.

## Imports

```tsx
import { Button, StyledText, UIProvider } from "@mrmeg/expo-ui/components";
import { Button as ButtonDirect } from "@mrmeg/expo-ui/components/Button";
import { colors, spacing, typography } from "@mrmeg/expo-ui/constants";
import { colors as colorsDirect } from "@mrmeg/expo-ui/constants/colors";
import { useResources, useStyles, useTheme } from "@mrmeg/expo-ui/hooks";
import { useTheme as useThemeDirect } from "@mrmeg/expo-ui/hooks/useTheme";
import { globalUIStore, notify, ThemeColorScope, useThemeStore } from "@mrmeg/expo-ui/state";
import { configureExpoUiI18n, hapticLight } from "@mrmeg/expo-ui/lib";
// The root barrel re-exports the whole public surface:
import { Button, colors, notify, UIProvider, useTheme } from "@mrmeg/expo-ui";
```

Importable paths: root, `components`, `components/*`, `constants`,
`constants/*`, `hooks`, `hooks/*`, `state`, `state/*`, `lib`. Never import from
`dist/*` or a source checkout path.

## App Startup

Call `useResources()` once near the Expo app root before hiding the splash
screen, and mount `UIProvider` once near the root. On native, mount
`react-native-keyboard-controller`'s `KeyboardProvider` above `UIProvider` so
the package's root keyboard avoidance works.

```tsx
import { ThemeProvider } from "expo-router";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { UIProvider } from "@mrmeg/expo-ui/components";
import { colors } from "@mrmeg/expo-ui/constants";
import { useResources, useTheme } from "@mrmeg/expo-ui/hooks";

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
      <KeyboardProvider>
        <UIProvider>
          {/* App navigation goes here. */}
        </UIProvider>
      </KeyboardProvider>
    </ThemeProvider>
  );
}
```

`UIProvider` is required before `Dialog`, `AlertDialog`, `BottomSheet`,
`Drawer`, `DropdownMenu`, `Popover`, `SelectContent`, `Tooltip`, and package
notifications.

| `UIProvider` prop | Default | Effect |
|---|---|---|
| `notification` | `true` | Mounts the `Notification` renderer for `notify` / `globalUIStore` |
| `portalHost` | `true` | Mounts the default `@rn-primitives` portal host |
| `statusBar` | `true` | Mounts the theme-aware `StatusBar` |
| `keyboardAvoiding` | `true` native, `false` web | Wraps children in `KeyboardAvoidingView` |
| `keyboardAvoidingProps` | — | Forwarded to that root wrapper |

For a subtree with custom keyboard behavior, use `KeyboardAvoidingView`
directly (`behavior`, `automaticOffset`, `contentContainerStyle`,
`keyboardVerticalOffset`).

## Theme System

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
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
        { borderWidth: StyleSheet.hairlineWidth, borderRadius: spacing.radiusLg },
        { padding: spacing.cardPadding, gap: spacing.sm },
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
```

`useTheme()` returns the active `theme`, resolved `scheme`, persisted
`currentTheme`, `setTheme`, `toggleTheme`, `getShadowStyle`,
`getFocusRingStyle(offset = 2)`, `getContrastingColor`, `getContrastRatio`,
`getTextColorForBackground`, and `withAlpha`. `getShadowStyle(type)` takes
`base`, `soft`, `sharp`, `subtle`, `elevated`, `glow`, `glass`, `card`,
`cardHover`, or `cardSubtle` and returns a cross-platform `boxShadow` (RN 0.85
and react-native-web 0.21 deprecate the legacy `shadow*` props).

Semantic tokens on `theme.colors`: `surfaceSunken`, `background`, `foreground`,
`card`, `cardForeground`, `popover`, `popoverForeground`, `text`, `textDim`,
`muted`, `mutedForeground`, `border`, `borderStrong`, `input`, `ring`,
`overlay`, `primary`, `secondary`, `accent`, their `*Foreground` pairs,
`destructive`, `success`, `warning`. `primary` is the neutral action color,
`secondary` a neutral secondary surface, `accent` the teal highlight, `input`
the default form-control border, `ring` the focus outline.

Surfaces are layered tiers, not shadow depths: `surfaceSunken` (app chrome such
as the Drawer rail) < `background` (content) < `card`/`popover` (raised panels)
< `muted` (chips, insets). `border` is the hairline on `background`/`card`; use
`borderStrong` on filled surfaces. `textDim`/`mutedForeground` hold at least
7:1 against `background`/`card` and 6:1 against `muted` in both schemes,
enforced by a package test.

When `currentTheme` is `"system"` the package tracks the OS color scheme and
updates every `useTheme()`/`useStyles()` consumer through the theme store. Do
not add app-level `Appearance` or `matchMedia` listeners for package
components. `THEME_STORAGE_KEY` (from `state`) is the persisted-preference key,
for a pre-boot theme script.

`useStyles()` memoizes theme-aware styles; its factory receives
`{ theme, spacing, withAlpha }` and its return also carries the `useTheme()`
helpers.

```tsx
import { useStyles } from "@mrmeg/expo-ui/hooks";

const { styles } = useStyles(({ theme, spacing, withAlpha }) => ({
  card: {
    backgroundColor: withAlpha(theme.colors.primary, 0.08),
    borderRadius: spacing.radiusMd,
    padding: spacing.md,
  },
}));
```

### Web theming is CSS variables

On web every `theme.colors.*` value resolves to a CSS custom property
(`var(--c-<kebab-token>)`), so styles built from the theme — including HTML
shells baked at export time — re-theme purely in CSS when `html[data-theme]`
changes. Native keeps literal values.

Consequence: hex-suffix alpha (`theme.colors.x + "15"`) does not work. Use
`withAlpha(theme.colors.x, 0.08)`, exported standalone from `hooks` as well as
from `useTheme()`.

`constants` exports the escape hatches:

| Export | Use |
|---|---|
| `getThemeCssVariables(overrides?)` | The `--c-*` (and `--c-*-rgb`) definitions per scheme for a global `<style>` in `+html.tsx`; takes per-scheme brand overrides |
| `rawThemeColors.light` / `.dark` | Literal hex/rgba maps on every platform, for sinks that cannot take `var()` (e.g. `<meta name="theme-color">`) |
| `resolveRawColor(color, scheme)` | Maps a `var(--c-*)` color back to that scheme's literal; literals pass through |

The React Navigation maps (`colors.<scheme>.navigation`) stay literal on web
too, because @react-navigation parses them with a color library.

### Spacing and density

`spacing` exposes an 8px base scale (`xxs` 2, `xs` 4, `sm` 8, `smd` 12, `md`
16, `mdl` 20, `lg` 24, `xl` 32, `xxl` 48, `xxxl` 64), radii (`radiusNone` 0,
`radiusXs` 4, `radiusSm` 8, `radiusMd` 12, `radiusLg` 14, `radiusXl` 18,
`radius2xl` 24, `radiusFull` 9999), icon sizes (`iconXs` 12, `iconSm` 16,
`iconMd` 24, `iconLg` 32, `iconXl` 48), and the semantic density tokens package
components read from. Prefer the semantic names so a density tune lands
everywhere at once:

| Token | Value | Use |
|-------|-------|-----|
| `screenPadding` | 16 | Horizontal gutter for screens, scroll content, landing blocks |
| `sectionSpacing` | 24 | Gap between grouped lists, cards, settings groups |
| `cardPadding` | 16 | `Card`, `StatCard`, any bordered panel |
| `dialogPadding` | 20 | `Dialog` and `AlertDialog` content |
| `rowPaddingY` / `rowPaddingX` | 10 / 16 | `Item` rows and hand-rolled list rows |
| `rowGap` | 12 | Gap between row media, content, actions |
| `rowMinHeight` | 40 | Visual row height on web; native rows keep `touchTarget` |
| `formRowMinHeight` | 32 | Checkbox and radio rows on web; native keeps `touchTarget` |
| `touchTarget` | 44 | Minimum native hit area; pair a smaller visual height with `hitSlop` |

Controls size themselves from their own `size` prop and ignore these tokens:
`Button` 28/32/40 (`sm`/`md`/`lg`), `TextInput` and `Select` 32/36/40
(`sm`/`md`/`lg`), `Toggle` 32/36/40 (`sm`/`default`/`lg`), `Tabs` 32/36
(`sm`/`md`).

### Color overrides

Colors resolve in three layers, last wins: package defaults (zinc/teal) →
global brand (`setColors`) → subtree scope (`ThemeColorScope`). Each override is
`{ light?, dark? }` of `Partial<ThemeColors>`, so you only pass the keys you
re-skin. With no override at either layer, `useTheme()` returns the base theme
by reference — no extra allocation.

```tsx
import { ThemeColorScope, useThemeStore } from "@mrmeg/expo-ui/state";

// One app-wide brand palette.
useThemeStore.getState().setColors({
  light: { primary: "#7c3aed", accent: "#14b8a6" },
  dark: { primary: "#a78bfa", accent: "#2dd4bf" },
});

// Per-subtree palette that must not leak globally: user-created themes,
// preview panes, embeds.
<ThemeColorScope colors={{ light: surveyColors, dark: surveyColors }}>
  <SurveyScreen />
</ThemeColorScope>
```

`ThemeColorScope` is React context: it applies only inside the provider and
unwinds when that subtree unmounts. Nested scopes compose (inner keys win,
outer fill in), and a scoped key beats the global brand inside it.

### Shape overrides

`setShape` is the geometry counterpart, grouped per component. It currently
covers Button:

```tsx
useThemeStore.getState().setShape({
  button: {
    borderRadius: 9999, // pill buttons everywhere; package default is 12
    withShadow: false,  // flatten the `default` preset; package default is true
  },
});
```

Precedence is caller-wins: a per-instance `style={{ borderRadius }}` or
`withShadow` prop beats the global override, which beats the package default.
`setShape({})` clears back to the defaults.

## Typography

```tsx
import { BodyText, CaptionText, HeadingText, StyledText } from "@mrmeg/expo-ui/components";

<HeadingText>Settings</HeadingText>
<BodyText>Manage your account.</BodyText>
<CaptionText>Changes sync automatically.</CaptionText>
<StyledText semantic="label" tx="common.email" />
```

`StyledText` props:

- `semantic`: `title`, `heading`, `subheading`, `body`, `caption`, `label`, `eyebrow`
- `size`: `xs`, `sm`, `base`, `body`, `lg`, `xl`, `xxl`, `display`
- `fontWeight`: `light`, `regular`, `medium`, `semibold`, `bold`
- `variant`: `sansSerif`, `serif`, `mono`
- `align`, `text`, `tx`, `txOptions`
- `selectable`: defaults to `true`; package controls disable it for labels and
  interactive chrome where accidental drag selection would feel broken.

Aliases: `DisplayText`, `TitleText`, `HeadingText`, `SubheadingText`,
`BodyText`, `CaptionText`, `LabelText`, `EyebrowText`, `MonoText` (code, IDs,
tabular figures), `SerifText`, `SansSerifText`, `SerifBoldText`,
`SansSerifBoldText`. `TextClassContext`, `TextColorContext`,
`TextStyleContext`, and `TextSelectabilityContext` are advanced exports package
controls use to pass nested text styling and control-label selectability.

`tx` is opt-in. Without a configured translator it renders its fallback text if
provided, otherwise the key; package-owned defaults such as notification titles
use readable fallbacks. Connect an existing i18n setup once at startup:

```tsx
import { configureExpoUiI18n } from "@mrmeg/expo-ui/lib";
import { i18n } from "./i18n";

configureExpoUiI18n((key, options) => i18n.t(key, options));
```

### Bundled fonts

Inter is the sans face on every platform, in four static weights
(`Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold`)
from the bundled `@expo-google-fonts/inter`. Serif is Georgia; mono is the
platform system monospace.

`useResources()` loads those four weights plus `Feather.font` (from the
package-managed `@expo/vector-icons`) on native, so `StyledText`'s
`light`–`bold` range resolves to real files instead of a faked OS bold. On web
it injects one Google Fonts Inter stylesheet (all four weights) after hydration
unless the app already added it; web weight differentiation then comes from a
numeric `fontWeight` on the shared `"Inter"` family. For better first paint in
Expo Router web apps, add the links to app-owned `app/+html.tsx`:

```tsx
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link
  id="mrmeg-expo-ui-inter"
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
/>
```

### Font overrides

Forward your own faces with `setFonts`, once at startup after they are
registered:

```tsx
useThemeStore.getState().setFonts({
  families: {
    sansSerif: {
      regular: "HankenGrotesk_400Regular",
      medium: "HankenGrotesk_500Medium",
      semibold: "HankenGrotesk_600SemiBold",
      bold: "HankenGrotesk_700Bold",
    },
    serif: { regular: "Newsreader_400Regular", semibold: "Newsreader_600SemiBold" },
    mono: { regular: "JetBrainsMono_400Regular", medium: "JetBrainsMono_500Medium" },
  },
  webWeightStrategy: "family",
});
```

Overrides are partial at both levels: pass `sansSerif` alone and `serif`/`mono`
keep the package defaults, and within an overridden group any weight you omit
falls back to that group's `regular` (never to a package face), so Regular +
Medium is enough. `setFonts({})` clears back to the defaults.

When `sansSerif` is overridden, `useResources` skips downloading the packaged
Inter faces entirely (native `.ttf`s and the web stylesheet). For the skip to
apply, call `setFonts` before the hook mounts (module scope, or ahead of
rendering the root); a later call still re-skins all text, it just doesn't
prevent the download. Feather always loads.

| `webWeightStrategy` | Use when | Effect |
|---|---|---|
| `"numeric"` (default) | You ship **one multi-weight CSS family** (a variable font, or Google Fonts' single `"Inter"` family) | A numeric `fontWeight` selects the `@font-face` variant |
| `"family"` | You load **per-weight faces via `expo-font`** | The family name alone carries the weight; the numeric `fontWeight` is suppressed |

`expo-font` registers each weight as its own single-face family on web as well
as native, so emitting a numeric weight on top makes the browser synthesise a
*second* bold layer over an already-bold face. Native always behaves as
`"family"`.

> Prefer `setFonts` over patching `node_modules`. Bun keys
> `patchedDependencies` to an exact `name@version`, so a font patch silently
> stops applying the next time you bump the package.

## Component Guide

Every component is exported from `@mrmeg/expo-ui/components`, and from
`@mrmeg/expo-ui/components/<Name>` for a direct import. Check this table before
building a new primitive.

| Component | Use For | Examples |
|-----------|---------|----------|
| `Accordion` | Multi-section disclosure | FAQ lists, grouped settings, help sections |
| `Alert` | Cross-platform imperative alerts | Destructive confirms, blocking messages |
| `AnimatedView` | Entrance and visibility animation | Staggered rows, revealed panels |
| `Avatar`, `AvatarGroup` | Profile images with initials/icon fallback | Account menu, comment authors, overlapping team stacks |
| `Badge` | Short status labels | Draft/active state, counts, plan and role tags |
| `BottomSheet` | Mobile-first modal sheets | Action pickers, mobile filters, quick edit forms |
| `Button` | Commands and CTAs | Submit, save, delete, navigation CTAs; loading state keeps the resting width |
| `Card` | Framed content groups | List items, pricing plans, settings sections, dashboards |
| `Carousel` | Horizontally snapping slides with pressable dots | Testimonials, onboarding pages, image galleries |
| `Checkbox` | Boolean selection | Terms consent, checklists, multi-select filters |
| `Collapsible` | One-off disclosure | Advanced settings, hidden helper text |
| `Dialog`, `AlertDialog` | Modal decisions and custom modal content | Confirm delete, edit profile, blocking warnings |
| `DismissKeyboard` | Tap-away keyboard dismissal | Forms, search and sign-in screens |
| `Drawer` | Side panels and drawer navigation | Filter drawer, app navigation, inspector panel |
| `DropdownMenu` | Menus and command lists | Row actions, account menu, sort menu, checkbox/radio groups |
| `EmptyState` | No-data or recoverable error regions | Empty inbox, no results, failed list load |
| `ErrorBoundary` | React render error fallback | Route-level and feature-level fallbacks |
| `Icon` | Feather or custom icons on theme tokens | Button accessories, menu icons, status glyphs |
| `InputOTP` | Verification code entry | Email/SMS codes, MFA, invite codes |
| `Item` | List and settings rows on the density tokens | Settings lists, inbox rows, pickers, detail rows |
| `KeyboardAvoidingView` | Native keyboard-aware layout | Screen roots, composer footers, form-heavy subtrees |
| `Label` | Accessible form labels | Required, disabled, and group labels |
| `MaxWidthContainer` | Centered responsive width | Web pages, tablet layouts, auth panels |
| `Notification` | Global toast surface | Saved/error/sync toasts, action toasts, loading toast |
| `Popover` | Anchored contextual content | Inline help, quick previews, small forms |
| `Progress` | Determinate or indeterminate progress | Upload progress, onboarding completion |
| `RadioGroup` | Mutually exclusive choices | Plan interval, visibility choice, survey answer |
| `SectionHeader` | Eyebrow / title / description section intro | Landing sections, settings groups, report headers |
| `SegmentedControl` | Native segmented picker (`@expo/ui`) | Platform-native view switchers, iOS-style filters |
| `Select` | Option menus | Country, category, status pickers; `label` drives default item text |
| `Separator` | Horizontal or vertical dividers | Menu, section, and card dividers |
| `Skeleton` | Loading placeholders | List, profile card, dashboard loading |
| `Slider` | Numeric value selection (`@expo/ui`) | Volume, percentage, rating, threshold |
| `StatCard` | Metric tile: `label`, `value`, `unit`, `change`, `icon`, `onPress` | KPI rows, analytics summaries, usage meters |
| `StatusBar` | Theme-aware native status bar | Root layout status styling |
| `StyledText` and aliases | Theme-aware typography | Titles, labels, body copy, captions, translated text |
| `Switch` | Binary settings | Notification, privacy, and feature toggles |
| `Tabs` | In-page tabbed views | Profile sections, report views, settings categories |
| `TextInput` | Text entry with label, helper/error text, clear button, password reveal, numeric filtering, left/right elements | Email/password, search, multiline notes |
| `Toggle` | Pressed/unpressed control | Favorite, mute, bold/italic, view mode |
| `ToggleGroup` | Single or multi toggle groups | Alignment, formatting toolbar, filter chips |
| `Tooltip` | Short hover/focus help | Icon button labels, field hints, disabled-action reasons |

### Compound Parts

| Root | Exported Parts |
|------|----------------|
| `Accordion` | `AccordionItem`, `AccordionTrigger`, `AccordionContent` |
| `AlertDialog` | `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel`, plus `DialogHeader`/`DialogFooter` (as `AlertDialog.Header`/`.Footer`) |
| `Avatar` | `AvatarGroup`, `getAvatarInitials` |
| `BottomSheet` | `BottomSheetTrigger`, `BottomSheetContent`, `BottomSheetHandle`, `BottomSheetHeader`, `BottomSheetBody`, `BottomSheetFooter`, `BottomSheetClose` |
| `Button` | `ButtonText`, `ButtonIcon` |
| `Card` | `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` |
| `Collapsible` | `CollapsibleTrigger`, `CollapsibleContent` |
| `Dialog` | `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose` |
| `Drawer` | `DrawerTrigger`, `DrawerContent`, `DrawerHeader`, `DrawerBody`, `DrawerFooter`, `DrawerClose`, `DrawerToggleCollapse` |
| `DropdownMenu` | `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuGroup`, `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuShortcut`, `DropdownMenuPortal`, `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent` |
| `Item` | `ItemMedia`, `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions` |
| `Popover` | `PopoverTrigger`, `PopoverContent`, `PopoverHeader`, `PopoverBody`, `PopoverFooter` |
| `RadioGroup` | `RadioGroupItem` |
| `Select` | `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`, `SelectSeparator` |
| `Skeleton` | `SkeletonText`, `SkeletonAvatar`, `SkeletonCard` |
| `Tabs` | `TabsList`, `TabsTrigger`, `TabsContent`, `TabsTriggerText` (`Tabs.Trigger.Text`) |
| `Toggle` | `ToggleIcon` |
| `ToggleGroup` | `ToggleGroupItem`, `ToggleGroupIcon` |
| `Tooltip` | `TooltipTrigger`, `TooltipContent`, `TooltipBody` |

Every part above has a named export. Dot notation on the root exists only for
`AlertDialog`, `BottomSheet`, `Button`, `Dialog`, `Drawer`, `Popover`,
`RadioGroup`, `Select`, `Tabs`, and `Tooltip`; `Accordion`, `Avatar`, `Card`,
`Collapsible`, `DropdownMenu`, `Item`, `Skeleton`, `Toggle`, and `ToggleGroup`
are named exports only.

### Hooks

| Hook | Returns |
|------|---------|
| `useResources()` | `{ loaded, error }` — loads Feather plus the Inter faces |
| `useTheme()` | Active theme, scheme helpers, shadow/contrast/alpha helpers |
| `useStyles(factory)` | Memoized theme-aware styles plus the `useTheme()` helpers |
| `useDimensions()` | `{ width, height, orientation, isSmallScreen, isMediumScreen, isLargeScreen }` against `SCREEN_SIZES` (768 / 1000 / 1200) |
| `useFontStyle(weight?, variant?)` | `{ fontFamily, fontWeight? }` resolved through `setFonts` overrides |
| `useReducedMotion()` | `true` when the OS asks for reduced motion |
| `useScalePress(options?)` | Animated style plus `onPressIn`/`onPressOut` for a `Pressable` (`scaleTo`, `haptic`, `disabled`) |
| `useStaggeredEntrance(options?)` | Entrance animated style for list rows (`delay`; `STAGGER_DELAY` is 30) |

`SsrViewportContext` (from `state`) supplies the first-render viewport width on
web, where the window cannot be read during export or hydration.

### Patterns And Gotchas

- Use `Button.preset`, not `variant`: `default` is the neutral primary action,
  `secondary` a neutral secondary surface, `outline` lower emphasis, `ghost`
  compact toolbars, `link` text-like commands, `destructive` dangerous actions.
  Native targets add computed hit slop up to 44px. Nested `StyledText` inherits
  the Button size, so use `size="sm"` for popover, tooltip, and toolbar
  triggers.
- Pair a standalone `Label` with its control using two DISTINCT ids: `nativeID`
  is the label's own id, `htmlFor` is the input's id (`<Label
  nativeID="email-label" htmlFor="email-input">` + `<TextInput
  nativeID="email-input" />`). One id on both renders duplicate ids on web and
  associates nothing. Prefer `TextInput`'s own `label` prop when no separate
  label element is needed.
- `BottomSheet` renders the platform's native sheet through `@expo/ui`: iOS
  SwiftUI `.sheet()`, Android Material3 `ModalBottomSheet`, web `vaul`. The
  platform owns gestures and keyboard avoidance, so `swipeEnabled`,
  `avoidKeyboard`, and `dismissKeyboardOnDrag` are accepted for call-site
  ergonomics but have no effect; `BottomSheet.Content` does mount its own
  tap-away keyboard-dismiss overlay while a field is focused. Android has only
  two snap states (partial / expanded) and maps extra snap points to the
  nearest. `BottomSheet.Content` also takes `backgroundStyle`, merged over the
  themed card default on the native sheet surface (web panel, Android
  `containerColor`, iOS `presentationBackground`) — pass
  `{ backgroundColor: "transparent" }`, plus a `style` clearing the content
  column's card fill, to let custom chrome such as a glass backdrop show
  through.
- `Carousel` renders every child (no virtualization), so slides survive into
  the exported HTML shell and the first client frame; use `FlatList` for large
  or unbounded data. An `itemWidth` below 1 (default `0.85`) is a fraction of
  the carousel width so the next slide peeks, but that fraction measures the
  viewport until first layout — pass absolute pixels (`> 1`) inside a
  constrained parent.
- Pass `Avatar` both a `source` and a `name` whenever you have them: `name`
  supplies the initials shown while the image is missing, loading, or failed,
  plus the default accessibility label. `SkeletonAvatar` is the loading
  placeholder, not a substitute. Inside `AvatarGroup`, children inherit the
  group's `size`/`shape` and gain the ring, so set those on the group; the
  group announces its count as a hidden summary and leaves each member
  individually announceable, so do not wrap it in your own `accessible`
  container.
- `Drawer.Header` takes `icon`, `title`, and `action` slots for a compact
  app-brand row; a string `title` uses the package typography, and
  `Drawer.ToggleCollapse` in `action` gives a trailing rail control.
  `Drawer.Content` owns safe-area top/bottom padding — do not duplicate it in
  children.
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

### Quick Examples

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
import { notify } from "@mrmeg/expo-ui/state";

{isLoading ? <SkeletonCard /> : null}
<Progress value={65} variant="accent" />
<EmptyState icon="inbox" title="No messages" description="New messages will appear here." />

notify.success("Saved", {
  messages: ["Your changes were saved."],
  action: { label: "View", onPress: openSavedItem },
});
```

`notify` also exposes `error`, `warning`, `info`, `loading`, `hide`, and
`promise(promise, { loading, success, error })`. Notifications auto-dismiss
after 4s (`DEFAULT_NOTIFICATION_DURATION`) unless a `duration` is given;
`duration: 0` keeps one up until dismissed and `notify.loading` never
auto-dismisses. `position` is `"top"` (default) or `"bottom"`. `globalUIStore`
stays available for reactive selectors and tests.

## Package Release

```sh
bun run ui:release -- --patch --publish
```

Use `--patch`, `--minor`, `--major`, or an exact version such as `0.2.0`. The
command updates `packages/ui/package.json` and `bun.lock`, runs
`bun run packages:peer-check` then the `ui:typecheck`, `ui:test`, `ui:build`,
`ui:pack`, and `ui:consumer-smoke` gates, and publishes with
`npm publish --access public` only when `--publish` is present (which also
requires a working `npm whoami`). Without `--publish` it is the same bump and
gate run as a dry run.

A clean working tree is required; commit first or pass `--allow-dirty`.

CI also installs and exports packed consumers against Expo 56 and 57
(`.github/workflows/package-compatibility.yml`).

### GitHub Publishing

If npm login email is unavailable, publish through GitHub Actions trusted
publishing:

1. In npm package settings for `@mrmeg/expo-ui`, add a trusted publisher:
   GitHub Actions, owner `mrmeg`, repository `expo-template`, workflow filename
   `publish-ui.yml`.
2. Bump `packages/ui/package.json` in a commit and push it to `main`.

`publish-ui.yml` runs on a push to `main` touching `packages/ui/package.json`
and on `workflow_dispatch`, using npm OIDC rather than a checked-in token or
local npm login. On push it reads the committed version, skips cleanly if that
version is already published, otherwise runs the gates and publishes from
`packages/ui`. Manual runs take `version` (`patch`, `minor`, `major`, or exact
`x.y.z`) and `ref` (default `main`); they bump the version, update `bun.lock`,
run the gates, publish, then commit and push the bump. If a manual run fails
after the bump landed, rerun it with the exact current version (e.g.
`version=0.1.3`) — exact versions do not bump again.

Keep `repository.url` in `package.json` as
`git+https://github.com/mrmeg/expo-template.git`: npm trusted publishing checks
that metadata, and publish-time URL normalization can block OIDC auth.

If package settings block trusted publishing, add an npm automation or granular
publish token to GitHub Actions secrets as `NPM_TOKEN` and rerun the same
workflow; it is used only for the publish step. Keep npm tokens in developer or
CI configuration, never in the repository.

## Package Checks

```sh
bun run packages:peer-check
bun run ui:typecheck
bun run ui:test
bun run ui:build
bun run ui:pack
bun run ui:consumer-smoke
```

`ui:pack` is a dry pack, so the published file list and package size can be
inspected before release. `ui:consumer-smoke` installs the packed tarball into
a clean fixture, checks every documented export-map target resolves,
type-checks all public entrypoints, and runs an iOS `expo export` against the
packed package at the workspace's Expo version, without a custom Metro config.
