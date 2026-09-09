# @mrmeg/expo-ui LLM Usage Guide

Read from `node_modules/@mrmeg/expo-ui/LLM_USAGE.md` before building app UI.

## First Rule

Do not recreate primitives this package already provides. Import from
`@mrmeg/expo-ui` and compose the exported components.

## Stable Import Paths

```tsx
import { Button, StyledText, UIProvider } from "@mrmeg/expo-ui/components";
import { Button as ButtonDirect } from "@mrmeg/expo-ui/components/Button";
import { colors, spacing, typography } from "@mrmeg/expo-ui/constants";
import { useResources, useStyles, useTheme } from "@mrmeg/expo-ui/hooks";
import { globalUIStore, notify, ThemeColorScope, useThemeStore } from "@mrmeg/expo-ui/state";
import { configureExpoUiI18n, hapticLight } from "@mrmeg/expo-ui/lib";
// The root barrel re-exports the whole public surface:
import { Button, colors, UIProvider, useTheme } from "@mrmeg/expo-ui";
```

Importable paths: root, `components`, `components/*`, `constants`,
`constants/*`, `hooks`, `hooks/*`, `state`, `state/*`, `lib`. Never import from
`@mrmeg/expo-ui/dist/*` or a source checkout path.

Hosts: Expo 56–57, React 19.2, React Native 0.85–0.86, React Native Web 0.21.
Install the peer versions recommended by the consuming app's Expo SDK.

## Required App Setup

Call `useResources()` once near the Expo app root. Mount `UIProvider` once near
the root; it owns the package `Notification`, `StatusBar`, the default
`@rn-primitives` portal host, and the native keyboard-avoiding root. It is
required before `Dialog`, `AlertDialog`, `BottomSheet`, `Drawer`,
`DropdownMenu`, `Popover`, `SelectContent`, `Tooltip`, or `notify`.

```tsx
import { ThemeProvider } from "expo-router";
import { KeyboardProvider } from "react-native-keyboard-controller";
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
      <KeyboardProvider>
        <UIProvider>
          {/* App navigation goes here. */}
        </UIProvider>
      </KeyboardProvider>
    </ThemeProvider>
  );
}
```

`UIProvider` props, all opt-out: `notification`, `portalHost`, `statusBar`
(default `true`), `keyboardAvoiding` (default `true` on native, `false` on web),
and `keyboardAvoidingProps` forwarded to the root wrapper. Native keyboard
avoidance is `react-native-keyboard-controller`, so mount its `KeyboardProvider`
above `UIProvider`; use `KeyboardAvoidingView` directly only for a subtree with
custom behavior.

`BottomSheet` renders the platform's native sheet through `@expo/ui` (iOS
SwiftUI `.sheet()`, Android Material3 `ModalBottomSheet`, web `vaul`). The
platform owns gestures and keyboard avoidance: `swipeEnabled`, `avoidKeyboard`,
and `dismissKeyboardOnDrag` are accepted for call-site ergonomics but have no
effect. `Slider` and `SegmentedControl` are also `@expo/ui`-backed.

`BottomSheet.Content` themes the native sheet surface with the card color. Pass
`backgroundStyle={{ backgroundColor: "transparent" }}`, plus a `style` clearing
the content column's card fill, when custom chrome such as a glass backdrop must
show through.

i18n is optional. Do not add app-level i18n setup just to use this package;
plain children and `text` props work without `i18next` or `react-i18next`. `tx`
props render their fallback text when provided, otherwise the key. Package-owned
defaults such as notification titles stay human-readable without app i18n.

```tsx
import { configureExpoUiI18n } from "@mrmeg/expo-ui/lib";
import { i18n } from "./i18n";

configureExpoUiI18n((key, options) => i18n.t(key, options));
```

## Theme And Text Rules

- Use `useTheme()` and semantic tokens instead of hardcoded colors.
- Use `StyledText` or its semantic aliases instead of raw `Text` for app UI.
- Use `Button.preset`, not `variant`.
- Button visible heights: `sm` 28, `md` 32, `lg` 40. `TextInput`/`Select`: 32/36/40. `Toggle` sizes are `sm`/`default`/`lg` (32/36/40). `Tabs`: `sm`/`md` (32/36).
- Use `Button size="sm"` for compact popover, tooltip, and toolbar triggers; nested `StyledText` inherits the Button size.
- Use `notify` plus a root `UIProvider` for transient global feedback. (`globalUIStore` stays available for reactive subscriptions and tests.)
- Keep app monitoring, auth, API, and domain behavior outside this package.

Semantic color tokens on `theme.colors`: `surfaceSunken`, `background`,
`foreground`, `card`, `popover`, `muted`, `mutedForeground`, `border`,
`borderStrong`, `input`, `ring`, `primary`, `secondary`, `accent`,
`destructive`, `success`, `warning`.

Token intent:

- `primary`: neutral action color; `secondary`: neutral secondary surface
- `accent`: teal highlight color
- `input`: form-control border; `ring`: focus outline
- `popover`: elevated overlay surface
- `surfaceSunken`: app-chrome surface one tier below `background`
- `borderStrong`: hairline for elements on filled surfaces, where `border` blends in

Elevation is a surface-tier ladder, not shadow depth: `surfaceSunken` (chrome) <
`background` (content) < `card`/`popover` (raised) < `muted` (chips, insets).

On web every `theme.colors.*` value is a CSS custom property (`var(--c-*)`), so
themes swap in CSS when `html[data-theme]` changes; native keeps literals. Hex
alpha concatenation (`theme.colors.x + "15"`) does **not** work — use
`withAlpha(theme.colors.x, 0.08)`, exported standalone from `hooks` and from
`useTheme()`. For sinks that cannot take `var()` (e.g. `<meta name="theme-color">`)
use `rawThemeColors.light/.dark` or `resolveRawColor(color, scheme)`;
`getThemeCssVariables(overrides?)` emits the `--c-*` definitions for an app's
`+html.tsx`. All three come from `@mrmeg/expo-ui/constants`.

Use `getShadowStyle(type)` for elevation — `base`, `soft`, `sharp`, `subtle`,
`elevated`, `glow`, `glass`, `card`, `cardHover`, `cardSubtle` — returning a
cross-platform `boxShadow` (RN 0.85 + react-native-web 0.21 deprecate the legacy
`shadow*` props). Use `getFocusRingStyle(offset?)` for web focus styling. Keep
web controls compact; package controls already provide native hit slop or 44px
touch rows.

Use `useStyles()` for memoized theme-aware local styles. Its factory receives
`{ theme, spacing, withAlpha }`:

```tsx
const { styles } = useStyles(({ theme, spacing, withAlpha }) => ({
  card: {
    backgroundColor: withAlpha(theme.colors.primary, 0.08),
    padding: spacing.cardPadding,
  },
}));
```

Layout spacing uses semantic density tokens, not raw scale steps:
`spacing.screenPadding` (16) for screen and block gutters, `spacing.cardPadding`
(16) for bordered panels, `spacing.sectionSpacing` (24) between grouped lists,
`spacing.dialogPadding` (20) for dialogs, and `spacing.rowPaddingY`/`rowPaddingX`
(10/16) with `spacing.rowGap` (12) for list rows. `Item` already applies the row
tokens and keeps a 44px hit area on native while rendering 40px on web.

When the saved theme preference is `system`, the package theme store owns the OS
color-scheme subscription, including web `prefers-color-scheme`. Do not add
app-local Appearance or `matchMedia` listeners. `THEME_STORAGE_KEY` (from
`state`) is the persisted-preference key, for a pre-boot theme script.

`useTheme()` resolves colors in three layers, last wins: package defaults →
global brand (`useThemeStore.getState().setColors(overrides)`) → scoped override
(`ThemeColorScope`). Each override is `{ light?, dark? }` of
`Partial<ThemeColors>`; only the keys you pass are replaced. Call `setColors`
once to forward the app's brand palette globally. Wrap a subtree in
`<ThemeColorScope colors={{ light, dark }}>` for transient per-subtree theming
(user-created palettes, previews, embeds) that must not leak globally — it is
React context, scoped keys win over the global brand inside it, and nested
scopes merge (inner wins, outer fills in). With no override at either layer,
`useTheme()` returns the base theme by reference.

Fonts and shape have matching global injection points. `setFonts({ families: {
sansSerif?, serif?, mono? }, webWeightStrategy? })` replaces the bundled faces
(Inter / Georgia / system-mono) everywhere text renders; groups and weights are
partial, missing weights fall back to that group's `regular`, and an overridden
`sansSerif` makes `useResources` skip downloading Inter (call `setFonts` before
mount for the skip). Use `webWeightStrategy: "family"` when loading per-weight
faces through `expo-font` / `@expo-google-fonts`, `"numeric"` (default) for one
multi-weight CSS family. `setShape({ button: { borderRadius?, withShadow? } })`
re-shapes Buttons globally. Per-instance props and caller `style` always win.

## Component Use-Case Index

Check this before creating a new app-local primitive. All components come from
`@mrmeg/expo-ui/components`; `@mrmeg/expo-ui/components/<Name>` also works.

| Component | Use for | Instead of |
|-----------|---------|------------|
| `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` | Multi-section disclosure | Custom FAQ/settings expanders |
| `Alert` | Cross-platform imperative alerts | `window.alert` or duplicated RN/web branching |
| `AnimatedView` | Entrance and visibility animation | Hand-rolled one-off Animated wrappers |
| `Avatar`, `AvatarGroup` | Profile images with initials/icon fallback | Circles with a nested `Image` plus initials `Text` |
| `Badge` | Short status labels | Custom pill `View` + `Text` |
| `BottomSheet` | Mobile-first modal sheets | Custom absolute-position sheets |
| `Button` | Commands and CTAs | Pressable plus custom text styling |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | Framed content groups | Ad hoc bordered panels |
| `Carousel` | Horizontally snapping slide row with pressable dots | Snap `ScrollView` plus manual offset math |
| `Checkbox` | Boolean selection | Custom checkmark controls |
| `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` | One-off disclosure | Local animated height wrappers |
| `Dialog`, `AlertDialog` | Modal decisions and custom modal content | Custom modal overlays |
| `DismissKeyboard` | Tap-away keyboard dismissal | Screen-level keyboard handling |
| `Drawer` | Side panels and drawer navigation | Custom sliding panels |
| `DropdownMenu` | Menus and command lists | Homemade popover menus |
| `EmptyState` | No-data or recoverable error regions | One-off empty placeholders |
| `ErrorBoundary` | React render error fallback | Unhandled screen crashes |
| `Icon` | Feather or custom icons with theme tokens | Raw vector icons with hardcoded colors |
| `InputOTP` | Verification code entry | Several manually managed text inputs |
| `Item`, `ItemMedia`, `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions` | List / settings rows with density tokens | Hand-rolled row `View`s |
| `KeyboardAvoidingView` | Native keyboard-aware layout root | Repeated app-local keyboard wrappers |
| `Label` | Accessible form labels | Plain styled text labels |
| `MaxWidthContainer` | Centered responsive width | Per-screen max-width wrappers |
| `Notification` | Global toast surface | Screen-local toast state |
| `Popover` | Anchored contextual content | Custom anchored views |
| `Progress` | Determinate or indeterminate progress | Layout-shifting spinners |
| `RadioGroup`, `RadioGroupItem` | Mutually exclusive choices | Custom radio rows |
| `SectionHeader` | Eyebrow / title / description section intro | Stacked ad hoc heading text |
| `SegmentedControl` | Native segmented picker (`@expo/ui`) | Custom segmented views |
| `Select` | Option menus | Custom dropdowns |
| `Separator` | Horizontal or vertical dividers | Border-only spacer views |
| `Skeleton`, `SkeletonText`, `SkeletonAvatar`, `SkeletonCard` | Loading placeholders | Blank space or generic spinners |
| `Slider` | Numeric value selection (`@expo/ui`) | Custom pan gesture track |
| `StatCard` | Metric tile with label, value, unit, change | Hand-rolled dashboard cards |
| `StatusBar` | Theme-aware native status bar | Per-screen status-bar duplication |
| `StyledText` and text aliases | Theme-aware typography | Raw `Text` with hardcoded styles |
| `Switch` | Binary settings | Custom toggle switches |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | In-page tabbed views | Custom segmented/tab controls |
| `TextInput` | Text entry with label, helper/error text, clear, password reveal | Raw `TextInput` plus repeated label/error code |
| `Toggle`, `ToggleIcon` | Pressed/unpressed control | Button with local selected styling |
| `ToggleGroup`, `ToggleGroupItem`, `ToggleGroupIcon` | Single or multi toggle groups | Custom segmented controls |
| `Tooltip` | Short hover/focus help | Persistent helper text or custom hover cards |

`StyledText` props: `semantic` (`title`, `heading`, `subheading`, `body`,
`caption`, `label`, `eyebrow`), `size` (`xs`, `sm`, `base`, `body`, `lg`, `xl`,
`xxl`, `display`), `fontWeight` (`light`–`bold`), `variant` (`sansSerif`,
`serif`, `mono`), `align`, `text`, `tx`, `txOptions`, `selectable` (default
`true`). Aliases: `DisplayText`, `TitleText`, `HeadingText`, `SubheadingText`,
`BodyText`, `CaptionText`, `LabelText`, `EyebrowText`, `MonoText`, `SerifText`,
`SansSerifText`, `SerifBoldText`, `SansSerifBoldText`.

## Component Selection Rules

- `Button` commands · `Toggle` one pressed state · `ToggleGroup` a related set · `Switch` binary settings · `RadioGroup` few exclusive choices · `Select` longer option sets.
- `Dialog` blocking decisions · `Popover` contextual controls · `Tooltip` short explanations · `DropdownMenu` action lists.
- `Card` individual repeated or framed items, never a wrapper around full page sections · `EmptyState` no-data or recoverable errors · `Skeleton` loading content with stable layout · `Progress` real or indeterminate progress.
- `Carousel` for a horizontal snap row of a known, small set of slides. It renders every child (no virtualization), so slides survive into the exported HTML shell and the first client frame; use `FlatList` for large or unbounded data. Dots are pressable and jump to their slide. A fractional `itemWidth` (default `0.85`) measures the viewport until the first layout, so pass absolute pixels (`> 1`) when the parent is narrower than the window and the first frame matters.
- `Avatar` with both `source` and `name` whenever both exist: `name` supplies the initials shown when the image is absent, still loading, or failed, plus the default accessibility label. Inside `AvatarGroup`, set `size`/`shape` on the group — children inherit them and gain the ring; the group's count is a hidden summary node, so each member stays individually announceable and the group needs no `accessible` wrapper.
- Pair a standalone `Label` with its control using two DISTINCT ids: `nativeID` is the label's own id, `htmlFor` is the input's id (`<Label nativeID="email-label" htmlFor="email-input">` + `<TextInput nativeID="email-input" />`). One id on both renders duplicate ids on web and associates nothing. Prefer `TextInput`'s own `label` prop when no separate label element is needed.
- `Drawer.Header` takes `icon`, `title`, and `action` slots for a compact app-brand row; put `Drawer.ToggleCollapse` in `action` for a trailing rail control. `Drawer.Content` owns safe-area top/bottom padding — do not duplicate it in children.

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

notify.success("Saved", { messages: ["Your changes were saved."] });
notify.error("Upload failed");
notify.warning("Connection slow");
notify.info("Copied to clipboard");

// Loading spinner — no auto-dismiss; stays until replaced or hidden
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

Notifications auto-dismiss after 4s (`DEFAULT_NOTIFICATION_DURATION`) unless a
`duration` is passed; `duration: 0` keeps one up until dismissed. `position` is
`"top"` (default) or `"bottom"`.
