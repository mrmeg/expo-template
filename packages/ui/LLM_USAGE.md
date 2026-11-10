# @mrmeg/expo-ui LLM Usage Guide

Read from `node_modules/@mrmeg/expo-ui/LLM_USAGE.md` before building app UI.

Run `bunx expo-ui-agents` in the app root so `AGENTS.md` carries these rules
without a read: it writes a marked section with the compact index and
version-matched doc paths of each installed `@mrmeg` package. Rerun it after
upgrading a package; `bunx expo-ui-agents --check` in CI fails when the section
is stale.

Component rules live in `docs/components/<Family>.md`; open only the families you use.

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
`@mrmeg/expo-ui/dist/*`, a source checkout path, or copied app-local component files.

Hosts: Expo 56–58 (58 in beta), React 19.2, React Native 0.85–0.88, React
Native Web 0.21.
Install the peer versions recommended by the consuming app's Expo SDK.

## Required App Setup

Call `useResources()` once near the Expo app root; it resolves `{ loaded, error }`
and loads the four static Geist weights on native (web gets a single Google Fonts
Geist stylesheet). Mount `UIProvider` once near the root; it owns the package
`Notification`, `StatusBar`, the default `@rn-primitives` portal host, and the
native keyboard-avoiding root. It is required before `Dialog`, `AlertDialog`,
`BottomSheet`, `Drawer`, `DropdownMenu`, `Popover`, `SelectContent`, `Tooltip`,
or `notify`.

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
   inline script that sets `documentElement.dataset.theme` and `.contrast` from
   `localStorage[THEME_STORAGE_KEY]` / `[CONTRAST_STORAGE_KEY]` (from `state`)
   or the OS media queries, so the first frame paints right.
2. Root layout: `useEffect(() => syncThemeFromEnvironment(), []);`
   (`syncThemeFromEnvironment` from `state`). It reads the persisted preference
   and follows the OS color scheme, and returns its cleanup. Never call it
   during render or at module scope. Safe to call more than once: calls share
   one OS listener and each cleanup releases only its own call. `UIProvider`
   does not call it; without it a web app stays on the boot default until the
   user picks a theme. Optional on native, which loads the preference at
   startup.

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
- Button visible heights: `sm` 28, `md` 32, `lg` 40. `TextInput`/`Select`: 32/36/40. `Toggle` sizes are `sm`/`default`/`lg` (32/36/40). `Tabs`: `sm`/`md` (32/36). `SegmentedControl` `md` ≈32 (iOS, web) / 40 (Android) / `lg` 44.
- Web SSR paints the visitor's scheme: wrap the root layout in `<InitialSchemeProvider scheme>` (`@mrmeg/expo-ui/state`) with the `"light"`/`"dark"` value read from a cookie on both server and client (template: `shared/ssrColorScheme.ts`, written by `+html.tsx` and `client/features/app/colorSchemeCookie.ts`); `useTheme()` uses it until `hasLoadedTheme`. Never read `localStorage` for the first render.
- Web console hygiene: animate with `useNativeDriver: shouldUseNativeDriver` (`@mrmeg/expo-ui/lib`), never `true`; set `pointerEvents` in `style`, never as a prop (react-native-web deprecates the prop, and its lazy warning module has overflowed the first SSR render of deep routes). `AnimatedView` folds a `pointerEvents` prop into style for you.
- Haptics are one setting: `<UIProvider haptics="off" | "selection" | "all">` (default `"selection"`: Switch/Checkbox/Toggle/ToggleGroup/SegmentedControl/ThemeSelector tap on change; `"all"` adds a light tap on press for Button, pressable Card and Item). Do not call `expo-haptics` per control; force one Button with `haptic`. Pressed/disabled looks come from `interaction.pressedOpacity` / `interaction.disabledOpacity` in `@mrmeg/expo-ui/constants`.
- Keep app monitoring, auth, API, and domain behavior outside this package.

Semantic color tokens on `theme.colors`: `surfaceSunken`, `background`,
`foreground`, `card`, `cardForeground`, `popover`, `popoverForeground`, `text`,
`textDim`, `muted`, `mutedForeground`, `border`, `borderStrong`, `input`, `ring`,
`overlay`, `primary`, `primaryForeground`, `secondary`, `secondaryForeground`,
`accent`, `accentForeground`, `link`, `destructive`, `destructiveForeground`,
`success`, `warning`.

Token intent:

- `primary`: neutral action color; `secondary`: neutral secondary surface
- `accent`: teal dot and fills; `link`: link text
- `input`: form-control border; `ring`: focus outline
- `popover`: elevated overlay surface
- `surfaceSunken`: app-chrome surface one tier below `background`
- `borderStrong`: hairline for elements on filled surfaces, where `border` blends in

Elevation is a surface-tier ladder plus a hairline `border`: `surfaceSunken`
(chrome) < `background` < `card`/`popover` < `muted`. In dark, `getShadowStyle`
presets other than `subtle` add a 1px inset top highlight; `subtle` (Button,
Card) is a 1px light shadow and none in dark unless `elevation: "layered"`. A
fork that overrides `background`, `card`, or `popover` should
re-check against the template's `/looks/surface-lab`.

Defaults are the Refined look; `applyLook(classicLook)` restores the pre-0.35 look. See README "Looks and treatments".

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

When the saved theme preference is `system`, the package theme store owns the OS
color-scheme and contrast subscription (web included). Do not add app-local
Appearance or `matchMedia` listeners. `THEME_STORAGE_KEY` (from
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
(Geist / Georgia / system-mono) everywhere text renders; groups and weights are
partial, missing weights fall back to that group's `regular`, and an overridden
`sansSerif` makes `useResources` skip downloading Geist (call `setFonts` before
mount for the skip). Each group also takes `italic: { weight: face }`; `<StyledText
italic>` (or `useFontStyle(weight, variant, { italic: true })`) uses that face,
else the group's italic `regular`, else `fontStyle: "italic"` on the upright face.
`useResources({ serif: "newsreader", serifFonts })` swaps Georgia for the
Newsreader preset (four weights + a 400 italic): the app depends on
`@expo-google-fonts/newsreader` and passes the five per-weight faces on native;
web gets one stylesheet (`id="mrmeg-expo-ui-newsreader"`). A `setFonts` serif
override still wins. `useResources({ sans: "inter", sansFonts })` opts into Inter. Use
`webWeightStrategy: "family"` when loading per-weight
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

The complete flat screen is the Minimal Example in
[`docs/components/Item.md`](docs/components/Item.md#minimal-examples).

## Component Use-Case Index

Check this before creating a new app-local primitive. All components come from
`@mrmeg/expo-ui/components`; `@mrmeg/expo-ui/components/<Name>` also works.

<!-- component-index:start -->
| Component | Use for |
|---|---|
| [Accordion](docs/components/Accordion.md) | Multi-section disclosure |
| [Alert](docs/components/Alert.md) | Cross-platform imperative alerts |
| [AnimatedView](docs/components/AnimatedView.md) | Entrance and visibility animation |
| [AudioPlayer](docs/components/AudioPlayer.md) | Audio with themed controls |
| [Avatar](docs/components/Avatar.md), `AvatarGroup` | Profile images with initials/icon fallback |
| [Badge](docs/components/Badge.md) | Short status labels |
| [BottomSheet](docs/components/BottomSheet.md) | Mobile-first modal sheets |
| [Button](docs/components/Button.md) | Commands and CTAs |
| [Card](docs/components/Card.md) | One item in a collection (feed entry, grid tile, carousel slide) or a single tappable object |
| [Carousel](docs/components/Carousel.md) | Horizontally snapping slide row with pressable dots |
| [Checkbox](docs/components/Checkbox.md) | Boolean selection |
| [Collapsible](docs/components/Collapsible.md) | One-off disclosure |
| [Dialog](docs/components/Dialog.md), `AlertDialog` | Modal decisions and custom modal content |
| [DismissKeyboard](docs/components/DismissKeyboard.md) | Tap-away keyboard dismissal |
| [Drawer](docs/components/Drawer.md) | Side panels and drawer navigation |
| [DropdownMenu](docs/components/DropdownMenu.md) | Menus and command lists |
| [EmptyState](docs/components/EmptyState.md) | No-data or recoverable error regions |
| [ErrorBoundary](docs/components/ErrorBoundary.md) | React render error fallback |
| [Hydrated](docs/components/Hydrated.md) | Holding a Radix-backed subtree on a server-rendered web route until hydration, to avoid a `useId` mismatch |
| [Icon](docs/components/Icon.md) | Registered Lucide glyphs or custom art with theme tokens |
| [IconButton](docs/components/IconButton.md) | Icon-only command; `accessibilityLabel` required; ≥44 pt hit area; adjacent `sm` IconButtons need a ≥16 pt gap (hit slop extends 8 pt) |
| [Image](docs/components/Image.md) | Any picture |
| [InputOTP](docs/components/InputOTP.md) | Verification code entry |
| [Item](docs/components/Item.md), `ItemGroup` | List / settings rows with density tokens; a pressable row takes `accessibilityLabel` / `Hint` / `accessibilityActions`, `testID`, `ref`; `ItemGroup`: A titled group of full-width `Item` rows with inset hairlines and an optional footer |
| [KeyboardAvoidingView](docs/components/KeyboardAvoidingView.md) | Native keyboard-aware layout root |
| [Label](docs/components/Label.md) | Accessible form labels |
| [MaxWidthContainer](docs/components/MaxWidthContainer.md) | Centered responsive width |
| [Media](docs/components/Media.md), `MediaControlButton`, `MediaScrubber` | Icon control over video or images; seek bar |
| [MediaLibrary](docs/components/MediaLibrary.md), `MediaTile`, `MediaGrid`, `MediaSelectionBar`, `UploadQueue` | One square tile of a media library; a grid of square tiles; select-all, count, Clear, Delete (N) over a grid; uploads in progress |
| [MediaViewer](docs/components/MediaViewer.md) | Full-screen lightbox over images and videos |
| [Notification](docs/components/Notification.md) | Global toast surface |
| [Popover](docs/components/Popover.md) | Anchored contextual content |
| [Progress](docs/components/Progress.md) | Determinate or indeterminate progress |
| [RadioGroup](docs/components/RadioGroup.md) | Mutually exclusive choices |
| [Screen](docs/components/Screen.md) | Page container with required safe-area `edges`, one horizontal inset, optional scroll |
| [SectionHeader](docs/components/SectionHeader.md) | Eyebrow / title / description section intro |
| [SegmentedControl](docs/components/SegmentedControl.md) | Native segmented picker (`@expo/ui`); `size="lg"` = 44 pt drawn control; a value not in `values` selects none |
| [Select](docs/components/Select.md) | Option menus |
| [Separator](docs/components/Separator.md) | Horizontal or vertical dividers |
| [Skeleton](docs/components/Skeleton.md), `SkeletonText`, `SkeletonAvatar`, `SkeletonCard` | Loading placeholders |
| [Slider](docs/components/Slider.md) | Numeric value selection (`@expo/ui`) |
| [StatCard](docs/components/StatCard.md) | Metric tile in a collection (a scrolling KPI rail) or one tappable metric |
| [StatusBar](docs/components/StatusBar.md) | Theme-aware native status bar |
| [StyledText](docs/components/StyledText.md) | Theme-aware typography |
| [Switch](docs/components/Switch.md) | Binary settings |
| [Tabs](docs/components/Tabs.md) | In-page tabbed views |
| [TextInput](docs/components/TextInput.md) | Text entry with label, helper/error text, clear, password reveal |
| [ThemeSelector](docs/components/ThemeSelector.md) | System / Light / Dark switch wired to the theme store; icon-only fits an `ItemActions` slot, `showLabels` stretches |
| [Toggle](docs/components/Toggle.md), `ToggleIcon` | Pressed/unpressed control; an `iconOnly` toggle needs `accessibilityLabel` (dev warns once) |
| [ToggleGroup](docs/components/ToggleGroup.md) | Single or multi toggle groups |
| [Tooltip](docs/components/Tooltip.md) | Short hover/focus help |
| [Video](docs/components/Video.md) | Inline video |
<!-- component-index:end -->

## Component Selection Rules

- `Button` commands · `IconButton` an icon-only command · `Toggle` one pressed state · `ToggleGroup` a related set · `Switch` binary settings · `RadioGroup` few exclusive choices · `Select` longer option sets.
- `Dialog` blocking decisions · `Popover` contextual controls · `Tooltip` short explanations · `DropdownMenu` action lists.
- `ItemGroup` + `Item` lists and settings · `Card` one item in a collection or one tappable object, never a wrapper around a section, form, or row group, never nested · `EmptyState` no-data or recoverable errors · `Skeleton` loading content with stable layout · `Progress` real or indeterminate progress.
- A plain `View` whose `opacity`/`pointerEvents` follows state must be `collapsable={false}` on Android (Fabric re-parents its children on the flip; a flip racing a navigation pop crashes). Package surfaces are pinned; spread `stateSurfaceProps()` from `@mrmeg/expo-ui/lib` on app-owned ones. `Pressable` already pins itself.

Every compound part has a named export (`CardHeader`, `AccordionItem`,
`SelectContent`, …). Dot notation exists only on `AlertDialog`, `BottomSheet`,
`Button`, `Dialog`, `Drawer`, `Popover`, `RadioGroup`, `Select`, `Tabs`, and
`Tooltip` — `Card`, `Accordion`, `Collapsible`, `DropdownMenu`, `Item`,
`Skeleton`, `Toggle`, and `ToggleGroup` are named exports only.

## Media

Media components are subpath-only. Import `Image`, `Video`, `AudioPlayer` and
`MediaViewer` from `@mrmeg/expo-ui/components/Image`, `components/Video`,
`components/AudioPlayer` and `components/MediaViewer`, never from the
`components` barrel or the root: the barrel stays free of media modules, so an
app that never renders media installs nothing new. A test
(`src/__tests__/mediaPeers.test.ts`) fails if anything reachable from the root
barrel imports a media peer.

Media peers and the iOS 26 swipe-back note: [`docs/components/Media.md`](docs/components/Media.md).

## Validation

Changing package code or shipped docs? Run the gates from the monorepo root:
`typecheck`, `test`, `build`, `pack`, `consumer-smoke` (`bun run pkg ui <gate>`).
Docs-only changes need at least `bun run pkg ui pack`, which proves the new docs
land in the npm tarball.
