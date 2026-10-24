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

Hosts: Expo 56–58 (58 in beta), React 19.2, React Native 0.85–0.88, React
Native Web 0.21.
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

Web setup, two more steps (every web theme color is a `var(--c-*)`, and the
theme store boots at `"system"`/light so the first client render matches the
server or exported HTML):

1. `app/+html.tsx`: put `getThemeCssVariables()` (from `constants`) in the
   global `<style>`, with the same overrides passed to `setColors` if the app
   re-brands; without it every theme color is unset. Optionally add a blocking
   inline script that sets `document.documentElement.dataset.theme` from
   `localStorage[THEME_STORAGE_KEY]` (from `state`) or `prefers-color-scheme`,
   so the first frame paints in the visitor's scheme.
2. Root layout: `useEffect(() => syncThemeFromEnvironment(), []);`
   (`syncThemeFromEnvironment` from `state`). It reads the persisted preference
   and follows the OS color scheme, and returns its cleanup. Never call it
   during render or at module scope. Safe to call more than once: calls share
   one OS listener and each cleanup releases only its own call. `UIProvider`
   does not call it; without it a web app stays on the boot default until the
   user picks a theme. Optional on native, which loads the preference at
   startup.

`DismissKeyboard` owns tap dismissal; its ScrollView uses
`keyboardShouldPersistTaps="always"` so RN cannot independently blur a hosted
field after a non-scrolling drag. Use `always` for your own scroll view inside
that boundary too. Dead-space taps dismiss on release; movement and multitouch
cancel. Actual scrolling retains platform-specific dismissal. Submit handlers
call `dismissKeyboard()` explicitly.

`BottomSheet` renders the platform's native sheet through `@expo/ui` (iOS
SwiftUI `.sheet()`, Android Material3 `ModalBottomSheet`, web `vaul`). The
platform owns gestures and keyboard avoidance: `swipeEnabled`, `avoidKeyboard`,
and `dismissKeyboardOnDrag` are accepted for call-site ergonomics but have no
effect. On iOS the sheet presentation lifts or shrinks the hosted content so
`Footer` and the tail of `Body` end at the keyboard's top (device-verified);
on Android Material3 shrinks the sheet and `@expo/ui`'s `RNHostView` re-reports
its size to the shadow tree, which needs the app built against
`expo-modules-core` >= 57.0.4 (expo/expo#47778) — below that the column keeps
its detent height and `Footer` sits under the keyboard; the sheet warns once in
dev on Android, and the fix is `npx expo install --fix` plus a rebuild, never
padding in app code. Do not nest a `KeyboardAvoidingView` inside a
sheet. `BottomSheet.Content` mounts the tap-away keyboard-dismiss boundary on
its column, and `BottomSheet.Body` sets `keyboardShouldPersistTaps="always"` on
its ScrollView so that boundary owns dismissal; do not pass `never`. Sheet
content stays in the screen's React tree although it is drawn in another
window, so a ScrollView *around* a `BottomSheet` on the default
`keyboardShouldPersistTaps="never"` claims the first tap on any sheet control
(`Footer` included) while a sheet field is focused and blurs the field instead:
give scroll views that contain a sheet `keyboardShouldPersistTaps="always"` (or
`"handled"`), or use `DismissKeyboard`; the sheet warns once in dev on Android
when it sees such a tap. `Slider` and `SegmentedControl` are also
`@expo/ui`-backed.

`BottomSheet` `onDismissed` fires once per close after the sheet is fully gone
on every platform (iOS: `@expo/ui`'s native SwiftUI `onDismiss` event, after
the transition; Android: `@expo/ui`'s post-animation close callback; web: the
HTML `<dialog>` `close` event at the end of the exit animation). Open the next
modal — a `Dialog`, a native stack modal — from `onDismissed`, never from
`onOpenChange(false)` or a timer: on iOS the sheet is still dismissing when
`onOpenChange` fires and a `Modal` presented then is rejected.

`BottomSheet.Content` themes the native sheet surface with the card color. Pass
`backgroundStyle={{ backgroundColor: "transparent" }}`, plus a `style` clearing
the content column's card fill, when custom chrome such as a glass backdrop must
show through.

`Dialog` and `AlertDialog` present their content through React Native's `Modal`
on iOS, rendered inline where the dialog sits (transparent, `overFullScreen`,
unanimated; the package fade/scale run inside), so it stacks above whatever
screen, native stack modal or sheet contains it; `portalHost` is honored on
Android and web only. `@expo/ui`-hosted controls (`TextInput`, `Slider`,
`SegmentedControl`) need a view controller above them and render as empty,
unfocusable boxes inside react-native-screens' `FullWindowOverlay`, which
`Drawer`, `Popover`, `Select`, `DropdownMenu` and `Tooltip` still use on iOS —
keep hosted controls out of those, and do not place a `Dialog` inside their
content (no view controller to present from; render it at screen level and open
it from the item's `onPress`). The dialog owns keyboard avoidance on iOS and
Android (its content sits outside `UIProvider`'s root avoidance on both: the iOS
Modal and the Android portal host): the centered container is a package
`KeyboardAvoidingView` (`behavior="padding"`), the card recenters above the
keyboard with fields and footer visible, and `useKeyboardAvoidance()` is `true`
in dialog content; do not wrap dialog content in another `KeyboardAvoidingView`.
Web has no software keyboard and no avoidance owner. Dialog content owns tap-away
keyboard dismissal on iOS and Android (the same boundary as `DismissKeyboard`,
on the `Dialog` card itself and on the `AlertDialog` centered container:
dead-space taps hide the keyboard on release, a `Dialog` backdrop tap closes the
dialog and the keyboard with it, controls and fields fire on the first tap); do
not wrap dialog content in `DismissKeyboard` for that. Android and web render dialog content inline into
the portal host.

`PopoverContent` treats `side` as a preference: on iOS and Android it opens on
the other side when the content does not fit and there is more room there,
caps its height to the room and scrolls the children (pass `scrollable={false}`
for content with its own `FlatList`; it then stays on `side`). `insets` default
to the safe area, and a `style` merges over the themed surface rather than
replacing it. A `PopoverTrigger` ref (`PopoverTriggerRef`) has `open()` / `close()`.

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
- `disabled` blocks the press (no `onPress`, no scale/haptic, out of the web tab order). To keep a button focusable and pressable while announced and dimmed as disabled — so the press can explain why — use `aria-disabled` (or `accessibilityState={{ disabled: true }}`), never a hand-rolled opacity style.
- Button visible heights: `sm` 28, `md` 32, `lg` 40. `TextInput`/`Select`: 32/36/40. `Toggle` sizes are `sm`/`default`/`lg` (32/36/40). `Tabs`: `sm`/`md` (32/36). `SegmentedControl` `md` ≈32 (iOS, web) / 40 (Android) / `lg` 44.
- Use `Button size="sm"` for compact popover, tooltip, and toolbar triggers; nested `StyledText` inherits the Button size.
- Web SSR paints the visitor's scheme: wrap the root layout in `<InitialSchemeProvider scheme>` (`@mrmeg/expo-ui/state`) with the `"light"`/`"dark"` value read from a cookie on both server and client (template: `shared/ssrColorScheme.ts`, written by `+html.tsx` and `client/features/app/colorSchemeCookie.ts`); `useTheme()` uses it until `hasLoadedTheme`. Never read `localStorage` for the first render.
- A Radix-backed component (`Tabs`, `Accordion`, `Collapsible`, `Select`, `DropdownMenu`, `Popover`) on a server-rendered web route logs a `useId` hydration mismatch (Expo Router hydrates `#root`, the server rendered `+html.tsx`). Wrap that subtree — not the page — in `<Hydrated fallback={…}>` (`@mrmeg/expo-ui/components`) with a fallback that holds its height; never branch on `typeof window`. Content that must be in the server HTML stays outside the gate.
- Web console hygiene: animate with `useNativeDriver: shouldUseNativeDriver` (`@mrmeg/expo-ui/lib`), never `true`; set `pointerEvents` in `style`, never as a prop (react-native-web deprecates the prop, and its lazy warning module has overflowed the first SSR render of deep routes). `AnimatedView` folds a `pointerEvents` prop into style for you.
- Haptics are one setting: `<UIProvider haptics="off" | "selection" | "all">` (default `"selection"`: Switch/Checkbox/Toggle/ToggleGroup/SegmentedControl/ThemeSelector tap on change; `"all"` adds a light tap on press for Button, pressable Card and Item). Do not call `expo-haptics` per control; force one Button with `haptic`. Pressed/disabled looks come from `interaction.pressedOpacity` / `interaction.disabledOpacity` in `@mrmeg/expo-ui/constants`.
- Bottom toasts must clear the tab bar: the layout that owns a bar calls `useNotificationOffset({ bottom })` (`@mrmeg/expo-ui/hooks`) with the bar's distance from the window edge, inset included — `useBottomTabBarHeight()` for a JS `<Tabs>` layout, platform bar height + `useWindowInsets().bottom` for `NativeTabs` — and `null` while the bar is hidden. Never position a toast yourself.
- Use `notify` plus a root `UIProvider` for transient global feedback. (`globalUIStore` stays available for reactive subscriptions and tests. In a component, read it with zustand's `useStore(globalUIStore, selector)`, never `globalUIStore()`: the React Compiler only treats `use*` calls as hooks, caches the bare call, and the next render crashes with React error #311.)
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

Elevation is a surface-tier ladder plus, in dark, an edge highlight:
`surfaceSunken` (chrome) < `background` (content) < `card`/`popover` (raised) <
`muted` (chips, insets). `getShadowStyle` is scheme-aware: in dark the raised
presets (`subtle`, `soft`, `elevated`, `card`, `cardSubtle`, `cardHover`,
`glass`) start with a 1px inset white top highlight and use black shadows at
real alpha; in light it is the shadow alone, at about twice the old alpha. A
fork that overrides `background`, `card`, or `popover` should re-check against
the template's `/surface-lab`.

On web every `theme.colors.*` value is a CSS custom property (`var(--c-*)`), so
themes swap in CSS when `html[data-theme]` changes; native keeps literals. Both
web schemes share one `colors` object (`colors.light.colors ===
colors.dark.colors`); re-brand with `setColors`, never by mutating it. Hex
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
  content: {
    paddingVertical: spacing.md,
    gap: spacing.sectionSpacing,
  },
  selectedIcon: {
    backgroundColor: withAlpha(theme.colors.primary, 0.12),
  },
}));
```

Layout spacing uses semantic density tokens, not raw scale steps:
`spacing.screenPadding` (16) for the one horizontal inset of a screen or block,
`spacing.sectionSpacing` (24) between sections and `ItemGroup`s,
`spacing.dialogPadding` (20) for dialogs, and `spacing.rowPaddingY`/`rowPaddingX`
(10/16) with `spacing.rowGap` (12) for list rows. `Item` already applies the row
tokens and keeps a 44px hit area on native while rendering 40px on web.
`spacing.cardPadding` (16) is the inner padding of `Card` and `StatCard` tiles,
not a layout inset. See Screen Layout below.

A settings screen picks the theme with one row: `ThemeSelector` in the row's
`ItemActions`, with translated `labels`. It reads and writes `useThemeStore`, so
it needs no state of its own. Describe the resolved scheme under the title only
while the preference is `system`.

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
mount for the skip). Each group also takes `italic: { weight: face }`; `<StyledText
italic>` (or `useFontStyle(weight, variant, { italic: true })`) uses that face,
else the group's italic `regular`, else `fontStyle: "italic"` on the upright face.
`useResources({ serif: "newsreader", serifFonts })` swaps Georgia for the
Newsreader preset (four weights + a 400 italic): the app depends on
`@expo-google-fonts/newsreader` and passes the five per-weight faces on native;
web gets one stylesheet (`id="mrmeg-expo-ui-newsreader"`). A `setFonts` serif
override still wins. Use `webWeightStrategy: "family"` when loading per-weight
faces through `expo-font` / `@expo-google-fonts`, `"numeric"` (default) for one
multi-weight CSS family. `setShape({ button?, input?, card?, sheet?, badge?,
dialog? })` re-shapes a slot globally (`{ borderRadius }`; `button` also takes
`withShadow`): `input` reaches TextInput, Select and InputOTP; `card` reaches
Card, StatCard, bordered EmptyState and SkeletonCard; `sheet` the BottomSheet's
top corners; `dialog` Dialog and AlertDialog. Per-instance props and caller
`style` always win. Extra color tokens are declared once by augmenting
`ThemeColorExtensions` (`declare module "@mrmeg/expo-ui/constants" { interface
ThemeColorExtensions { brandGold: string } }`); they then type through
`setColors`, `ThemeColorScope`, `theme.colors`, and `getThemeCssVariables`
emits `--c-brand-gold` when the overrides name it. Provide every extension key
in both schemes.

Enforce these rules mechanically with `@mrmeg/eslint-plugin-expo-ui`
(`bun add -d @mrmeg/eslint-plugin-expo-ui`), which reports raw colors, off-scale
spacing and radius, appearance overrides on package components, and raw
primitives as ESLint diagnostics. It reads this package's
`design-system.json` manifest out of `node_modules`, so the messages quote the
tokens, presets and sizes of the installed release. The plugin's first npm release is
still pending, and only `@mrmeg/expo-ui` releases built after the manifest was
added ship one: the installed release has it when
`node_modules/@mrmeg/expo-ui/dist/design-system.json` exists. Config block and
settings:
https://raw.githubusercontent.com/mrmeg/expo-template/main/packages/lint/README.md

## Screen Layout

Build screens flat. On a 390 pt phone every nested inset comes out of the
content: a settings group boxed inside a padded screen puts its rows 33 pt from
each edge (16 screen + 1 border + 16 row) and leaves 324 pt for them; the same
rows in an `ItemGroup` sit 16 pt in and get 358 pt.

- **Every screen root is `Screen`, with explicit `edges`.** `<Screen
  edges={["bottom"]} scroll>` under a Stack header; `edges={["top"]}` above a
  tab bar; `["top", "bottom"]` for a headerless screen or a modal; `[]` when the
  navigator insets both. Never pad `insets.top` under a header or
  `insets.bottom` above a tab bar (double padding), and never leave a headerless
  screen without `"top"` (content under the Dynamic Island). `scroll` puts the
  insets on the content container; `padded={false}` for full-bleed `ItemGroup`
  rows; `contentContainerStyle` padding adds to the insets. Read insets with
  `useWindowInsets()` (works inside modals and native sheets too), not
  `useSafeAreaInsets()`.
- **One horizontal inset per screen: `spacing.screenPadding` (16).** Either a
  container pads or its children do, never both. `Item` rows, and `ItemGroup`
  titles and footers, carry the 16 themselves, so a scroll view of
  `ItemGroup`s gets no horizontal padding; text, forms, and buttons between the
  groups pad their own wrapper.
- **No boxes as layout.** Never wrap a section, a form, or a group of rows in a
  bordered, shadowed, or tinted rounded `View`, or in a `Card`. Separate
  sections with a header (an `ItemGroup` title, `SectionHeader`),
  `spacing.sectionSpacing`, or a hairline (`Separator`).
- **Lists and settings: `ItemGroup` + `Item`.** Full-width rows and touch
  targets, hairlines inset under the title, no card per row, no border around
  the group. Pass the rows as direct children (a mapped array works; a
  Fragment counts as one row) and leave `separator` off: the group draws the
  line under every row but the last. A `Switch`, `Checkbox` or `Toggle` in
  `ItemActions` is named by the row's `ItemTitle` automatically (its text as
  `accessibilityLabel` / `aria-label`; a composed title links by id after
  hydration); pass `accessibilityLabel` only when the title is not the right
  name.
- **Forms:** fields span the column, grouped under section headers, not cards.
- **Primary content fills the width.** QR codes, photos, maps, media, and
  charts size to the column (`width: "100%"` with `aspectRatio`, or a size
  computed from the column width), never a fixed size floating in whitespace.
  A photo library is a grid of width-sized tiles, not rows of 56 pt thumbnails.
- **Wide screens:** cap and centre the column instead of boxing it: `width:
  "100%", maxWidth: 640, alignSelf: "center"` on the scroll view's
  `contentContainerStyle` (960 for dense grids and dashboards).
- **When a `Card` is right:** one item in a collection (a feed entry, a grid
  tile, a carousel slide) or a single tappable object. Its parts pad
  `spacing.cardPadding`, a tile's inner padding. Never nest Cards or put one in
  a padded panel. `StatCard` follows the same rule (tiles in a scrolling
  metrics rail, or one tappable metric); a summary of numbers is flat text on
  the gutter.
- Dialog, sheet, and popover chrome keep their own surfaces; these rules are
  for screen content.

The first Minimal Example below is a complete flat screen.

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
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | One item in a collection (feed entry, grid tile, carousel slide) or a single tappable object | Hand-rolled bordered tiles; never a box around a section, form, or row group |
| `Carousel` | Horizontally snapping slide row with pressable dots | Snap `ScrollView` plus manual offset math |
| `Checkbox` | Boolean selection | Custom checkmark controls |
| `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` | One-off disclosure | Local animated height wrappers |
| `Dialog`, `AlertDialog` | Modal decisions and custom modal content | Custom modal overlays |
| `DismissKeyboard` | Tap-away keyboard dismissal | Screen-level keyboard handling |
| `Drawer` | Side panels and drawer navigation | Custom sliding panels |
| `DropdownMenu` | Menus and command lists | Homemade popover menus |
| `EmptyState` | No-data or recoverable error regions | One-off empty placeholders |
| `ErrorBoundary` | React render error fallback | Unhandled screen crashes |
| `Icon` | Registered Lucide glyphs or custom art with theme tokens | Raw vector icons with hardcoded colors |
| `IconButton` | Icon-only command; `accessibilityLabel` required; ≥44 pt hit area; adjacent `sm` IconButtons need a ≥16 pt gap (hit slop extends 8 pt) | `Button` with only an `Icon` child, or a raw `Pressable` + `Icon` |
| `InputOTP` | Verification code entry | Several manually managed text inputs |
| `Item`, `ItemMedia`, `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions` | List / settings rows with density tokens; a pressable row takes `accessibilityLabel` / `Hint` / `accessibilityActions`, `testID`, `ref` | Hand-rolled row `View`s |
| `ItemGroup` | A titled group of full-width `Item` rows with inset hairlines and an optional footer | Bordered or shadowed boxes around rows, a `Card` per row, hand-drawn dividers |
| `KeyboardAvoidingView` | Native keyboard-aware layout root | Repeated app-local keyboard wrappers |
| `Label` | Accessible form labels | Plain styled text labels |
| `MaxWidthContainer` | Centered responsive width | Per-screen max-width wrappers |
| `Notification` | Global toast surface | Screen-local toast state |
| `Screen` | Page container with required safe-area `edges`, one horizontal inset, optional scroll | Hand-rolled `useSafeAreaInsets` padding, `SafeAreaView` per screen |
| `Popover` | Anchored contextual content | Custom anchored views |
| `Progress` | Determinate or indeterminate progress | Layout-shifting spinners |
| `RadioGroup`, `RadioGroupItem` | Mutually exclusive choices | Custom radio rows |
| `SectionHeader` | Eyebrow / title / description section intro | Stacked ad hoc heading text |
| `SegmentedControl` | Native segmented picker (`@expo/ui`); `size="lg"` = 44 pt drawn control; a value not in `values` selects none | Custom segmented views |
| `Select` | Option menus | Custom dropdowns |
| `Separator` | Horizontal or vertical dividers | Border-only spacer views |
| `Skeleton`, `SkeletonText`, `SkeletonAvatar`, `SkeletonCard` | Loading placeholders | Blank space or generic spinners |
| `Slider` | Numeric value selection (`@expo/ui`) | Custom pan gesture track |
| `StatCard` | Metric tile in a collection (a scrolling KPI rail) or one tappable metric | Hand-rolled dashboard tiles |
| `StatusBar` | Theme-aware native status bar | Per-screen status-bar duplication |
| `StyledText` and text aliases | Theme-aware typography | Raw `Text` with hardcoded styles |
| `Switch` | Binary settings | Custom toggle switches |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | In-page tabbed views | Custom segmented/tab controls |
| `TextInput` | Text entry with label, helper/error text, clear, password reveal | Raw `TextInput` plus repeated label/error code |
| `ThemeSelector` | System / Light / Dark switch wired to the theme store; icon-only fits an `ItemActions` slot, `showLabels` stretches | Three radio rows or a hand-rolled theme picker |
| `Toggle`, `ToggleIcon` | Pressed/unpressed control; an `iconOnly` toggle needs `accessibilityLabel` (dev warns once) | Button with local selected styling |
| `ToggleGroup`, `ToggleGroupItem`, `ToggleGroupIcon` | Single or multi toggle groups | Custom segmented controls |
| `Tooltip` | Short hover/focus help | Persistent helper text or custom hover cards |

`StyledText` props: `semantic` (`title`, `heading`, `subheading`, `body`,
`caption`, `label`, `eyebrow`), `size` (`xs`, `sm`, `base`, `body`, `lg`, `xl`,
`xxl`, `display`), `fontWeight` (`light`–`bold`), `variant` (`sansSerif`,
`serif`, `mono`), `align`, `text`, `tx`, `txOptions`, `selectable` (default
`true` on iOS and web, `false` on Android since 0.27.0). Aliases: `DisplayText`, `TitleText`, `HeadingText`, `SubheadingText`,
`BodyText`, `CaptionText`, `LabelText`, `EyebrowText`, `MonoText`, `SerifText`,
`SansSerifText`, `SerifBoldText`, `SansSerifBoldText`.

Set `selectable={false}` on text labels inside app-owned `Pressable`s on every
platform (control chrome shows no selection cursor). On Android `StyledText` is
non-selectable by default because a selectable `Text` takes input focus and hides
the keyboard; pass `selectable` to opt copyable content in. Package controls
already scope label selectability; ordinary iOS/web text stays selectable.

## Component Selection Rules

- `Button` commands · `IconButton` an icon-only command · `Toggle` one pressed state · `ToggleGroup` a related set · `Switch` binary settings · `RadioGroup` few exclusive choices · `Select` longer option sets.
- `Dialog` blocking decisions · `Popover` contextual controls · `Tooltip` short explanations · `DropdownMenu` action lists.
- `ItemGroup` + `Item` lists and settings · `Card` one item in a collection or one tappable object, never a wrapper around a section, form, or row group, never nested · `EmptyState` no-data or recoverable errors · `Skeleton` loading content with stable layout · `Progress` real or indeterminate progress.
- `Carousel` for a horizontal snap row of a known, small set of slides. It renders every child (no virtualization), so slides survive into the exported HTML shell and the first client frame; use `FlatList` for large or unbounded data. Dots are pressable and jump to their slide. A fractional `itemWidth` (default `0.85`) measures the viewport until the first layout, so pass absolute pixels (`> 1`) when the parent is narrower than the window and the first frame matters.
- `Avatar` with both `source` and `name` whenever both exist: `name` supplies the initials shown when the image is absent, still loading, or failed, plus the default accessibility label. Inside `AvatarGroup`, set `size`/`shape` on the group — children inherit them and gain the ring; the group's count is a hidden summary node, so each member stays individually announceable and the group needs no `accessible` wrapper.
- Pair a standalone `Label` with its control using two DISTINCT ids: `nativeID` is the label's own id, `htmlFor` is the input's id (`<Label nativeID="email-label" htmlFor="email-input">` + `<TextInput nativeID="email-input" />`). One id on both renders duplicate ids on web and associates nothing. Prefer `TextInput`'s own `label` prop when no separate label element is needed.
- A plain `View` whose `opacity`/`pointerEvents` follows state must be `collapsable={false}` on Android (Fabric re-parents its children on the flip; a flip racing a navigation pop crashes). Package surfaces are pinned; spread `stateSurfaceProps()` from `@mrmeg/expo-ui/lib` on app-owned ones. `Pressable` already pins itself.
- `TextInput` `onBlur` fires only after a real focus on Android (the native field's first-composition blur is dropped in the package); validate on blur directly and do not add a touched-fields guard in app code.
- `Drawer.Header` takes `icon`, `title`, and `action` slots for a compact app-brand row; put `Drawer.ToggleCollapse` in `action` for a trailing rail control. `Drawer.Content` owns safe-area top/bottom padding — do not duplicate it in children.
- `Icon` and `Button.Icon` take `name` (a kebab-case Lucide name typed `IconName`: the package builtins plus the names the app lists in `client/icons.json`, compiled with `bunx expo-ui-icons` and registered once with `registerIcons(appIcons)` at module scope in the root layout) or `component` (an `IconComponent` taking `size` and `color`, for art that is not a Lucide icon). Both are sized, colored with theme tokens, and hidden from assistive tech unless `accessibilityLabel` names a standalone icon (`decorative` only silences a labelled one); `Button.Icon` inherits the button's label color and is decorative by default. A missing name is a type error: run `bunx expo-ui-icons add <name>` (it maps an alias such as `home` to `house`) rather than importing an icon library. Check a name that arrives at runtime with `isIconName`.

## Media

Media components are subpath-only. Import `Image`, `Video`, `AudioPlayer` and
`MediaViewer` from `@mrmeg/expo-ui/components/Image`, `components/Video`,
`components/AudioPlayer` and `components/MediaViewer`, never from the
`components` barrel or the root: the barrel stays free of media modules, so an
app that never renders media installs nothing new. A test
(`src/__tests__/mediaPeers.test.ts`) fails if anything reachable from the root
barrel imports a media peer.

Each media module is an optional peer; install only what you import, at the
version your Expo SDK recommends (`npx expo install <name>`):

- `expo-image` for `Image`.
- `expo-video` for `Video`.
- `expo-audio` for `AudioPlayer`. It adds native code, so a dev client built
  before you installed it needs a fresh build.
- `MediaViewer` needs the peers of the media it shows.

Components (each entry is filled in when the component ships):

- `Image` (`components/Image`, needs `expo-image`): a picture that sizes itself
  from an aspect ratio instead of fixed pixels. A muted frame shows while it
  loads and when it fails (an `image-off` icon, or your `fallback`), then goes
  transparent, so a transparent PNG, WebP, SVG or AVIF shows the surface behind
  it in both themes.

  ```tsx
  import { Image } from "@mrmeg/expo-ui/components/Image";

  <Image source={photo.url} alt={photo.title} aspectRatio={{ width: photo.width, height: photo.height }} radius="md" />
  <Image source={cover} alt="" aspectRatio="16:9" maxHeight={240} position="top" />
  <Image source={{ uri, cacheKey: key }} alt="" style={{ width: 96, height: 96 }} recyclingKey={key} />
  ```

  - Pick one sizing mode. `aspectRatio` (`16 / 9`, `"16:9"` or
    `{ width, height }`, for example from upload metadata) draws full width of
    the parent at that ratio, capped by `maxWidth` / `maxHeight` and centered;
    prefer it whenever the size is known, since the box is pure style and a
    server-rendered page already carries the final layout. `aspectRatio="auto"`
    starts at `fallbackAspectRatio` (default 1) and moves to the picture's own
    ratio once it loads: one layout shift, once per mount (change `key` to
    re-measure for a new picture). `fill` absolutely fills a positioned parent
    you size. With none of these, size the frame with `style` (width, height,
    flex), as with a raw `expo-image`. `maxHeight` is enforced through the
    width, so a tall picture in a wide column stays centered instead of
    letterboxed.
  - `fit` is `cover` by default; `contain`, `fill`, `none` and `scale-down`
    follow CSS `object-fit`, and `position` (`"top"`, `{ top: "20%", left: 0 }`)
    is the focal point of a `cover` or `none` crop. Letterboxing is
    transparent. `radius` takes the `spacing.radius*` names and is applied to
    the frame and the image.
  - `alt` is required. Describe the picture; pass `alt=""` for a decorative one
    (a thumbnail inside a pressable that is already named), which hides it from
    assistive tech. A JS caller that omits it gets a development warning and
    the image is treated as decorative.
  - In a recycled list (FlashList, FlatList cells) set
    `recyclingKey={item.id}`, so a reused cell shows a blank frame instead of
    the previous picture. Pass `source={{ uri, cacheKey }}` when the URL changes
    but the picture does not (re-signed URLs), so the cache hits.
  - `placeholder` takes a blurhash or thumbhash string (bare, or with a
    `blurhash:/` / `thumbhash:/` prefix) or a low-resolution URL or `{ uri }`;
    there is no spinner. `transition` (ms, default 200) is forced to 0 under
    reduced motion. `onLoad({ width, height })` reports the natural size and
    `onError` the failure; a new `source` clears an error. A `null` source keeps
    the frame in its loading look and calls nothing.
  - Web: `expo-image` adds its `<img>` after mount, so the server HTML carries
    the sized, muted frame but not the `<img>` (a low-resolution `placeholder`
    URL is the exception). The `<img>` has `alt`, `loading="lazy"` and, from
    `priority`, `fetchpriority`.
- `Video` (`components/Video`, needs `expo-video`): a video that sizes itself
  from its own aspect ratio, with the platform's controls, themed controls that
  look the same everywhere, or none. The frame is black and sized like `Image`.

  ```tsx
  import { Video } from "@mrmeg/expo-ui/components/Video";

  <Video source={clip.url} controls="custom" aspectRatio={{ width: clip.width, height: clip.height }} poster={clip.poster} />
  <Video source={{ uri }} aspectRatio="9:16" maxHeight={480} />
  <Video source={clip.url} controls="none" aspectRatio="16:9" autoPlay muted loop />
  <Video player={player} controls="custom" aspectRatio="16:9" />
  ```

  - Choose `controls`. `"native"` (the default) is the platform's own (AVKit,
    the Media3 player UI, the browser's): the one mode that lets people pick
    among several subtitle tracks or audio tracks, and the one with Picture in
    Picture buttons. `"custom"` draws a center play button and a bottom bar
    (play, scrubber with buffered fill, time, mute, captions, fullscreen) that
    fades 3 s after the last interaction while playing and returns on hover,
    focus and tap. On web it answers Space/K (play), ←/→ (±5 s), ↑/↓ (volume),
    M, F and Esc while the frame is focused, and only then. `"none"` is bare
    playback: no chrome and no tap handling, for a muted loop or controls of
    your own (pass a `player`).
  - Sizing is `Image`'s: `aspectRatio` (`16 / 9`, `"16:9"`, `{ width, height }`)
    fills the parent's width at that ratio, capped by `maxWidth` / `maxHeight`
    and centered; `fill` fills a positioned parent. `"auto"` (the default) draws
    at 16:9 until the video reports its size, then moves once. Prefer an
    explicit `aspectRatio` whenever you know it (upload metadata): the box is
    pure style, so a server-rendered page carries the final layout and nothing
    shifts. On native `"auto"` uses the size expo-video reports for the video
    track, which is the coded size: AVFoundation's `naturalSize` and Media3's
    `Format` both ignore a display-rotation flag, so a file that is landscape
    with a "rotate 90" flag (how some phones record portrait) can draw a
    landscape frame with the picture letterboxed inside it. On web it uses the
    `<video>`'s own `videoWidth` and `videoHeight`, which the browser reports
    after rotation. An explicit ratio avoids the question.
  - `fit` is `contain` by default; `cover` and `fill` follow CSS `object-fit`
    (expo-video has no `none` or `scale-down`, so `VideoFit` is narrower than
    `ImageFit`). `radius` takes the `spacing.radius*` names.
  - Fullscreen, per mode. `"native"`: the platform's control, which always shows
    the platform's controls, as expo-video does in fullscreen. `"custom"`: on web
    the frame itself goes fullscreen (the Fullscreen API), so the custom chrome
    stays and Esc leaves; iPhone Safari cannot fullscreen an element, so there
    the `<video>` goes fullscreen with the browser's controls. On iOS and Android
    a full-screen `Modal` takes the same player with the same chrome, and the
    inline view is unmounted while it is open so the player is attached to one
    view at a time; close it with the minimize button or Android back.
    `"none"`: none. `allowsFullscreen={false}` removes the control in every mode.
  - Picture in Picture follows `allowsPictureInPicture` (default `true`) and
    shows in the platform's controls. It needs the expo-video config plugin in
    the app's config, `["expo-video", { supportsPictureInPicture: true }]`, then a
    new native build; without it the prop does nothing. Firefox has no web PiP.
  - `autoPlay` asks for playback on mount. Browsers only allow it when the video
    is `muted`, so pass both for an inline loop. `loop` and `muted` are initial
    values read when `Video` creates its player; with your own `player`, set
    them on it. Changing `source` replaces it in place; on web a reload, Retry
    included, starts playing.
  - HLS: expo-video on web puts the URL in `<video src>` and ships no hls.js, so
    an `.m3u8` plays natively in Safari only, though iOS and Android play HLS
    natively. `Video` does not add a loader; serve an MP4 or WebM for the other
    browsers.
  - Captions: `"custom"` shows a captions button only when the player reports
    subtitle tracks, and it toggles one track (the device's language, else the
    first). To choose among tracks, or to choose an audio track, use `"native"`.
    expo-video's web player reports no subtitle tracks, so the button never
    appears in a browser: use `"native"` there. An audio-only file keeps the fallback ratio
    and its poster (or black) and the controls keep working.
  - A live stream (`isLive`, or an infinite duration) reads "Live" and the
    scrubber is disabled; the readout of a long clip is `h:mm:ss` for both
    numbers.
  - States are part of the frame: a white spinner over the poster or black while
    loading, and on failure a muted message with a retry button (`rotate-ccw`)
    that reloads `source`, plus `onError(message)`. Retry needs `source`: give it
    alongside your own `player` to get one. `poster` shows until playback first
    starts (under `"native"` it carries a play glyph, since a poster would hide
    the platform's own button), and is dropped if it fails to load.
  - Lifecycle: it pauses on unmount, and releases the player it created; a
    `player` you pass is only paused. Pausing when the screen loses focus is the
    app's job, because the kit has no router: pause your own player from
    expo-router's `useIsFocused()`.
  - Accessibility under `"custom"` on iOS and Android: the frame is one element
    named by `title`, else `accessibilityLabel`, else "Video", whose value is
    the position in words. Its actions are activate (play or pause, also the iOS
    two-finger magic tap), increment and decrement (seek 10 s), and custom
    actions for mute, captions and fullscreen, because the children of an
    accessible element are not separate stops on iOS. The chrome never
    auto-hides while a screen reader is on. On web the frame is a focusable
    group and its buttons are ordinary tab stops; focusing one brings the chrome
    back. react-native-web cannot detect a screen reader, so web relies on focus
    and hover instead.
  - It server-renders: the first HTML carries the black sized frame, the
    `<video>` and the controls, and every timer starts after mount. Many players
    on one screen are heavy (one decoder each): mount a `Video` when the user taps
    a thumbnail, as the Media Lab does.
  - Codec, container and stream support is the platform decoder's, not the
    component's. The Media Lab's Video section (`/media-lab`) runs every
    fixture (H.264, HEVC and 10-bit HEVC, VP9, AV1, `.mov`, 60 fps, 4K,
    non-faststart and fragmented MP4, audio-only, a 1 h 05 m clip, rotation
    flags, HLS, DASH, live streams, broken files) through `Video` under each
    controls mode and lists, per fixture, what each surface did; check it, not
    memory, before promising a format. Observed on 2026-10-23 (Chrome 156,
    Playwright WebKit 26.6, iOS 27 simulator):

    | Case | Chrome | WebKit | iOS |
    |---|---|---|---|
    | H.264, HEVC (+10-bit), `.mov`, 60 fps, 4K, fragmented, moov-at-end | plays | plays | plays |
    | VP9 / AV1 in WebM | plays | VP9 plays; AV1 hangs, no error | "Cannot Open" |
    | AV1 in MP4 | plays | error | plays |
    | HLS VOD | some streams | plays | plays |
    | DASH | error | error | error |
    | Rotation flag, `aspectRatio="auto"` | portrait frame | portrait frame | landscape frame (pre-rotation size) |
    | Captions toggle (`"custom"`) | never shown | never shown | not checked |

    For rotated phone video, pass an explicit `aspectRatio`. For captions on
    web, use `controls="native"`.
- `AudioPlayer`: not shipped yet.
- `MediaViewer` (`components/MediaViewer`, needs `expo-image` and `expo-video`):
  a full-screen lightbox for a list of images and videos, on iOS, Android and
  web. Build `items` from your whole list so swiping spans the library, and open
  it at the one that was tapped.

  ```tsx
  import { MediaViewer, type MediaViewerItem } from "@mrmeg/expo-ui/components/MediaViewer";

  const items: MediaViewerItem[] = media.map((m) =>
    m.kind === "video"
      ? { type: "video", key: m.id, source: m.url, poster: m.thumbnail, title: m.name }
      : { type: "image", key: m.id, source: { uri: m.url, cacheKey: m.id }, alt: m.description, title: m.name },
  );
  const [open, setOpen] = useState<number | null>(null);

  <MediaViewer items={items} visible={open !== null} initialIndex={open ?? 0} onClose={() => setOpen(null)} />
  <MediaViewer items={items} visible index={index} onIndexChange={setIndex} onClose={close} videoControls="native" maxZoom={6} />
  ```

  - Items. `type: "image"` takes `source` (a URL, a `require()`d asset or an
    `expo-image` source with `cacheKey`), a required `alt` (`""` for a
    decorative picture), an optional `title` and a `placeholder` (blurhash,
    thumbhash or low-resolution URL). `type: "video"` takes `source` (an
    `expo-video` source), an optional `title` and a `poster`. `key` must be
    unique and stable (an object key or id): it is how the viewer follows an
    item. An empty list renders nothing.
  - Position. Uncontrolled by default: `initialIndex` is read once per open
    (the viewer remounts each time `visible` turns true). Pass `index` and
    `onIndexChange` to control it. An index past the list is clamped, and
    `onIndexChange` reports the clamp. If `items` changes while the viewer is
    open (an item deleted elsewhere), it stays on the same `key` if it is still
    there, otherwise it clamps, and `onIndexChange` reports the move. A video
    whose `source` changes restarts (`Video` replaces a source in place), so
    with signed URLs that a refetch re-signs, snapshot `items` when you open the
    viewer and pass the snapshot while it is open, as the template's media tab
    does.
  - Paging is a horizontal swipe, the arrow keys, or the edge buttons. The
    buttons show on web always (hidden on the first and last item) and on native
    only while a screen reader is on, since swipe is the touch affordance. The
    counter ("3 of 5", `media.counter`) is hidden for a single item. Only the
    shown page and its two neighbors are mounted, so a list of hundreds stays
    light. Only the shown page mounts a `Video`; the other video pages show their
    `poster` (or black) and a play glyph, so paging away stops playback and a
    long list never holds many decoders.
  - Zoom is for images (`zoom={false}` turns it off): pinch, double-tap
    (`doubleTapZoom`, default 2.5) or double-click, `Ctrl`/`Cmd` + wheel around
    the cursor (a trackpad pinch on Chrome, Edge and Firefox arrives that way;
    Safari's own pinch event is not handled), and `+` `-` `0`, up to `maxZoom`
    (default 4). One finger or the mouse pans a zoomed image, never past its
    edge. Paging is off while zoomed, and a page change resets zoom. A tap on an
    image toggles the chrome; a video page keeps its top bar and the video's own
    controls (`videoControls`: `"custom"` by default, or the platform's).
  - Closing: the close button, Esc, Android back, and on a touch screen a swipe
    down (or up) past 120 pt or faster than 1 pt/ms, which fades the backdrop
    with the drag (`swipeToDismiss={false}` turns it off). Esc leaves zoom first
    and closes on the second press. There is no swipe-to-dismiss with a mouse.
  - Web keys, on the viewer's root: ←/→ page, `+` `=` `-` `0` zoom, `F` toggles
    browser fullscreen of the viewer. A custom video that has focus keeps its own
    ←/→ for seeking. `Video` is told `allowsFullscreen={false}` inside the
    viewer, since the viewer is already full-window.
  - Accessibility: focus lands on the close button when it opens, each page
    change is announced ("Title, 2 of 5"), the root is a modal view, and an image
    page is one element named by its `alt`. On native an image page offers
    `increment` and `decrement` (next and previous) and `escape` (close, iOS
    two-finger Z); a video page leaves increment and decrement to the video's
    own controls, so a screen reader pages with the edge buttons there. Copy goes
    through `translateText`: `media.close`, `media.counter` (with `n` and
    `total`), `media.previous`, `media.next` and `media.imageError`.
  - It is a transparent `Modal` that fades (no animation under reduced motion),
    black in both themes, with a light status bar, and it supports every
    orientation. It reads the safe area with the `initialWindowMetrics` fallback
    a `Modal` outside `SafeAreaProvider` needs. Gestures are RN `PanResponder`
    plus `Animated`; the kit does not use reanimated or gesture-handler.
  - In an app, keep it out of the first download. `MediaViewer` imports `Video`
    and `Image`, so a static import from two lazy chunks hoists `expo-video`
    into the shared bundle. The template loads it through
    `client/components/LazyMediaViewer.tsx` (one `import()` of
    `client/components/mediaChunk.ts`, shared with `LazyVideo`), and a test
    fails on any other import. The Media Lab's Viewer section (`/media-lab`) opens
    the viewer on a mixed set (extreme aspects, a 48 MP picture, EXIF
    orientation, alpha PNG, animated GIF, a rotation-flagged video, HLS with
    captions, broken files), the 60-thumbnail scale set, and one item; check it,
    not memory, on each surface.

For custom media UI, build on the shared primitives, none of which import a
media module:

- `MediaControlButton` from `components/MediaControlButton`: an icon-only
  control for chrome drawn over video or images (white glyph on a translucent
  black circle that reads over any frame, at least 44 pt to hit). On a themed
  surface use `IconButton` (`preset="ghost"`, `shape="circle"`) instead.
  `accessibilityLabel` is required; `selected` sets the toggle state for mute.
- `MediaScrubber` from `components/MediaScrubber`: a seek bar with
  `onScrubStart`, `onScrubChange(seconds)` and `onScrubEnd(seconds)`,
  `tone="overlay"` over video or `"default"` on a themed surface, a buffered
  fill, screen-reader increment and decrement by `step`, and ←/→/Home/End on
  web. It is not `Slider`, which has no sliding start or end events.
- `useMediaKeyboard` from `hooks`: spread its result on a focusable container
  for Space/`k`, arrows, `m`, `f`, Esc and zoom keys on web. It acts only on
  keys you pass a handler for, and only inside that container.
- `formatMediaTime`, `mediaTimeA11y`, `mediaFrameStyle`, `parseAspectRatio` and
  `useMediaAspectRatio` from `lib`: `m:ss` or `h:mm:ss` readouts and their
  spoken form, a full-width ratio frame capped by `maxHeight`, and the ratio an
  `aspectRatio="auto"` prop resolves.

Built-in icons for media controls: `play`, `pause`, `volume-2`, `volume-x`,
`maximize`, `minimize`, `rotate-ccw`, `chevron-left`, `chevron-right`, `x`,
`image-off`, `captions`.

## Minimal Examples

A flat settings screen: groups of full-width rows, one 16 pt inset, a capped
column on wide screens, no boxes.

```tsx
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Icon,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  Switch,
} from "@mrmeg/expo-ui/components";
import { spacing } from "@mrmeg/expo-ui/constants";

export function SettingsScreen({ onEditProfile, onSignOut }: { onEditProfile: () => void; onSignOut: () => void }) {
  const [push, setPush] = useState(true);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ItemGroup title="Account">
        <Item onPress={onEditProfile}>
          <ItemMedia icon="user" />
          <ItemContent>
            <ItemTitle>Edit profile</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Icon name="chevron-right" size={18} color="mutedForeground" />
          </ItemActions>
        </Item>
        <Item>
          <ItemMedia icon="bell" />
          <ItemContent>
            <ItemTitle>Push notifications</ItemTitle>
            <ItemDescription>Replies and mentions</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Switch checked={push} onCheckedChange={setPush} />
          </ItemActions>
        </Item>
      </ItemGroup>

      <ItemGroup title="About" footer="Version 1.4.0">
        <Item>
          <ItemContent>
            <ItemTitle>Build</ItemTitle>
          </ItemContent>
          <ItemActions>
            <ItemDescription>2026.09.25</ItemDescription>
          </ItemActions>
        </Item>
      </ItemGroup>

      {/* Not rows, so it pads its own wrapper to the same 16 pt gutter. */}
      <View style={styles.gutter}>
        <Button preset="destructive" fullWidth text="Sign out" onPress={onSignOut} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // No horizontal padding: the rows carry the screen's inset.
  content: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingVertical: spacing.md,
    gap: spacing.sectionSpacing,
  },
  gutter: {
    paddingHorizontal: spacing.screenPadding,
  },
});
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
      <Icon name="panel-left" decorative />
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
