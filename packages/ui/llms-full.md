# @mrmeg/expo-ui Full Contract

The package owns the shared design system, tokens, theme store, resource hook,
global notification store, overlay shell, and small interaction helpers. The
consuming app owns routes, screens, feature state, auth, billing, media,
monitoring, API calls, product copy, and app-specific layouts.

## Agent Rules

Do not recreate primitives this package already provides. Import from
`@mrmeg/expo-ui` and compose package components in the app.

Importable paths, and nothing else:

- `@mrmeg/expo-ui`
- `@mrmeg/expo-ui/components`, `@mrmeg/expo-ui/components/*`
- `@mrmeg/expo-ui/constants`, `@mrmeg/expo-ui/constants/*`
- `@mrmeg/expo-ui/hooks`, `@mrmeg/expo-ui/hooks/*`
- `@mrmeg/expo-ui/state`, `@mrmeg/expo-ui/state/*`
- `@mrmeg/expo-ui/lib`

Never import from `@mrmeg/expo-ui/dist/*`, `packages/ui/src/*`, or copied
app-local component files.

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

## App Setup

Call `useResources()` once near the Expo app root; it resolves `{ loaded, error }`
and loads the four static Inter weights (web gets a single Google Fonts Inter
stylesheet). Icons are `lucide-react-native` SVGs, so there is no icon font to load.

Mount `UIProvider` once near the root. It owns the package `Notification`,
`StatusBar`, default `@rn-primitives` portal host, and native keyboard-avoiding
root, and is required before `Dialog`, `AlertDialog`, `BottomSheet`, `Drawer`,
`DropdownMenu`, `Popover`, `SelectContent`, `Tooltip`, or `notify` /
`globalUIStore` notifications.

`UIProvider` props: `notification`, `portalHost`, `statusBar` (default `true`),
`keyboardAvoiding` (default `true` on native, `false` on web), and
`keyboardAvoidingProps` forwarded to the root wrapper. Native keyboard avoidance
uses `react-native-keyboard-controller`, so mount its `KeyboardProvider` above
`UIProvider`; use `KeyboardAvoidingView` directly for a subtree needing custom
behavior.

i18n is optional. Plain children and `text` props work without `i18next` or
`react-i18next`. Use `configureExpoUiI18n()` only when the app wants package
`tx` props translated by its own i18n instance.

## Theme Rules

Use `useTheme()` and `useStyles()` from `@mrmeg/expo-ui/hooks`. Semantic tokens
on `theme.colors`: `surfaceSunken`, `background`, `foreground`, `card`,
`cardForeground`, `popover`, `popoverForeground`, `text`, `textDim`, `muted`,
`mutedForeground`, `border`, `borderStrong`, `input`, `ring`, `overlay`,
`primary`, `secondary`, `accent`, their `*Foreground` pairs, `destructive`,
`success`, `warning`.

Surfaces form a tier ladder rather than a shadow scale: `surfaceSunken` (app
chrome such as the Drawer rail) < `background` (content) < `card`/`popover`
(raised) < `muted` (chips, insets). Use `borderStrong` for hairlines on filled or
raised elements, where `border` would blend into the fill.

On web every theme color resolves to a CSS custom property (`var(--c-*)`) so the
app re-themes in CSS when `html[data-theme]` changes; native keeps literals.
Consequence: hex-suffix alpha (`theme.colors.x + "15"`) does not work — use
`withAlpha(color, alpha)`. `constants` also exports `rawThemeColors.light/.dark`
and `resolveRawColor(color, scheme)` for sinks that cannot take `var()`, and
`getThemeCssVariables(overrides?)` for an app's `+html.tsx`.

Color overrides resolve in three layers, last wins: package defaults → global
brand (`useThemeStore.getState().setColors({ light?, dark? })`) → subtree scope
(`<ThemeColorScope colors={{ light, dark }}>`). Each is a `Partial<ThemeColors>`.
`setFonts` and `setShape({ button: { borderRadius?, withShadow? } })` are the
font and geometry counterparts; per-instance props always win.

Use `StyledText` and semantic text aliases instead of raw `Text`, and package
controls instead of hardcoded Pressable/View/Text combinations.

When the saved theme preference is `system`, the package theme store owns OS
color-scheme sync, including web `prefers-color-scheme`. Apps must not add their
own `Appearance` or `matchMedia` listeners for package components.

## Screen Layout

Screens are flat. On a 390 pt phone each nested inset comes out of the content:
rows boxed in a bordered group inside a padded screen start 33 pt from each edge
(16 + 1 + 16) with 324 pt left for them; the same rows in an `ItemGroup` start
16 pt in with 358 pt.

- One horizontal inset per screen: `spacing.screenPadding` (16). Either a
  container pads or its children do, never both. `Item` rows and `ItemGroup`
  titles and footers carry the 16 themselves, so a scroll view of groups gets
  no horizontal padding; text, forms, and buttons between them pad their own
  wrapper.
- No boxes as layout: no bordered, shadowed, or tinted rounded panel (or `Card`)
  around a section, a form, or a group of rows. Separate sections with a header,
  `spacing.sectionSpacing` (24), or a hairline (`Separator`).
- Lists and settings are `ItemGroup` + `Item`: full-width rows and touch
  targets, hairlines inset under the title, no card per row, no border around
  the group. Rows are direct children; the group separates them.
- Forms: fields span the column, grouped under section headers, not cards.
- Primary content (photos, video, maps, QR codes, charts) sizes to the column
  width, never a fixed size floating in whitespace.
- Wide screens cap and centre the column (`width: "100%", maxWidth: 640,
  alignSelf: "center"` on the scroll content; 960 for dense grids) instead of
  boxing it.
- `Card` is for one item in a collection (feed entry, grid tile, carousel slide)
  or a single tappable object; `StatCard` likewise (a scrolling metrics rail, a
  tappable metric). Never nest them.
- Dialog, sheet, and popover chrome keep their surfaces.

```tsx
<ScrollView contentContainerStyle={{ width: "100%", maxWidth: 640, alignSelf: "center", paddingVertical: spacing.md, gap: spacing.sectionSpacing }}>
  <ItemGroup title="Account" footer="Signed in as jane@example.com">
    <Item onPress={openProfile}>
      <ItemMedia icon="user" />
      <ItemContent><ItemTitle>Edit profile</ItemTitle></ItemContent>
      <ItemActions><Icon name="chevron-right" size={18} color="mutedForeground" /></ItemActions>
    </Item>
    <Item>
      <ItemMedia icon="bell" />
      <ItemContent><ItemTitle>Notifications</ItemTitle></ItemContent>
      <ItemActions><Switch checked={enabled} onCheckedChange={setEnabled} /></ItemActions>
    </Item>
  </ItemGroup>
</ScrollView>
```

## Component Catalog

Every component is exported from `@mrmeg/expo-ui/components`, and from
`@mrmeg/expo-ui/components/<Name>` for a direct import. Check this catalog
before creating a new app-local primitive.

| Component | Use When | Gotchas |
|-----------|----------|---------|
| `Accordion` | Multi-section disclosure such as FAQ or grouped settings | Use the compound parts instead of custom expanders. |
| `Alert` | Cross-platform imperative alerts | Avoid `window.alert` and duplicated native/web branching. |
| `AnimatedView` | Entrance and visibility animation | Keep simple reveal effects in this wrapper. |
| `Avatar`, `AvatarGroup` | Profile images with initials/icon fallback | Pass both `source` and `name`; set `size`/`shape` on the group, not per child. |
| `Badge` | Short status labels | Prefer over custom pill views. |
| `BottomSheet` | Mobile-first modal sheets | Requires root `UIProvider`. Native sheet via `@expo/ui`; `swipeEnabled`, `avoidKeyboard`, `dismissKeyboardOnDrag` are accepted but ignored (the iOS sheet presentation and Android Material3 keep content above the keyboard; never nest a `KeyboardAvoidingView` in a sheet). |
| `Button` | Commands and CTAs | Use `preset`, not `variant`; heights are 28/32/40. |
| `Card` | One item in a collection (feed entry, grid tile, carousel slide) or a single tappable object | Not a layout box: never around a section, form, or row group; never nested. Parts pad `spacing.cardPadding`. |
| `Carousel` | Small known set of horizontally snapping slides | Renders every child (no virtualization); fractional `itemWidth` measures the viewport until first layout. |
| `Checkbox` | Boolean selection in forms or lists | Prefer over custom checkmark controls. |
| `Collapsible` | One-off disclosure | Use for advanced settings or helper sections. |
| `Dialog`, `AlertDialog` | Blocking modal content or decisions | Requires root `UIProvider` portal host. |
| `DismissKeyboard` | Tap-away keyboard dismissal | Prefer over screen-level keyboard wrappers. |
| `Drawer` | Side panels and drawer navigation | `Drawer.Content` owns safe-area top/bottom padding; do not duplicate it in children. |
| `DropdownMenu` | Menus and command lists | Requires root `UIProvider` portal host. |
| `EmptyState` | No-data or recoverable error regions | Props: `icon`, `title`, `description`, `actionLabel`, `onAction`, `actionPreset`. |
| `ErrorBoundary` | React render error fallback | Use for route or feature boundaries. |
| `Icon` | Lucide or custom icons with theme tokens | `color` takes a theme color name; pass `decorative` to hide from a11y. |
| `InputOTP` | Verification code entry | Prefer over manually managed text input groups. |
| `Item` | List / settings rows | Applies the row density tokens and a 44px native hit area (40px on web). |
| `ItemGroup` | A titled group of full-width `Item` rows | Props: `title`, `description`, `footer`, `style`, `testID`. Draws inset hairlines between rows; no border, fill, or horizontal padding, so the parent must not pad either. |
| `KeyboardAvoidingView` | Native keyboard-aware roots, composer footers, form-heavy subtrees | `UIProvider` already mounts one root; use directly only for custom subtrees. |
| `Label` | Accessible form labels | Two distinct ids: `nativeID` is the label's, `htmlFor` is the input's `nativeID`. Never reuse one id for both. |
| `MaxWidthContainer` | Centered responsive width | Use for web and tablet constrained layouts. |
| `Notification` | Global toast surface | Trigger through `notify` (or `globalUIStore` for subscriptions/tests) with root `UIProvider`; actions dismiss after press. |
| `Popover` | Anchored contextual content | Requires root `UIProvider` portal host. |
| `Progress` | Determinate or indeterminate progress | Omit `value` for indeterminate. Prefer over layout-shifting spinners. |
| `RadioGroup` | Small mutually exclusive choices | Use `Select` for longer option sets. |
| `SectionHeader` | Eyebrow / title / description section intro | Prefer over stacked ad hoc heading text. |
| `SegmentedControl` | Native segmented picker | Backed by `@expo/ui`; the platform owns its look. |
| `Select` | Option menus | `SelectContent` requires root `UIProvider` portal host; `label` drives default item text. |
| `Separator` | Horizontal or vertical dividers | Prefer over border-only spacer views. |
| `Skeleton` | Loading placeholders | Use stable dimensions to avoid layout shift. |
| `Slider` | Numeric value selection | Backed by `@expo/ui`; prefer over custom pan gesture tracks. |
| `StatCard` | Metric tile in a collection, or one tappable metric | Props: `label`, `value`, `unit`, `change` (`{ value, direction }`), `icon`, `onPress`. A Card, so the same rule applies. |
| `StatusBar` | Theme-aware native status bar | Usually mounted through `UIProvider`. |
| `StyledText` | Theme-aware typography | Prefer semantic aliases over raw `Text`. |
| `Switch` | Binary settings | Prefer over custom toggles for on/off state. |
| `Tabs` | In-page tabbed views | Sizes are `sm`/`md` only. |
| `TextInput` | Text entry | Owns label, helper/error text, clear button, password reveal, numeric filtering, left/right elements. |
| `Toggle` | One pressed/unpressed control | Sizes are `sm`/`default`/`lg`. Use `Button` for commands, `Switch` for settings. |
| `ToggleGroup` | Related pressed states | Use for segmented controls, formatting, and filter chips. |
| `Tooltip` | Short hover/focus help | Requires root `UIProvider` portal host. |

Every compound part has a named export (`CardHeader`, `AccordionItem`,
`SelectContent`, …). Dot notation exists only on `AlertDialog`, `BottomSheet`,
`Button`, `Dialog`, `Drawer`, `Popover`, `RadioGroup`, `Select`, `Tabs`, and
`Tooltip` — `Card`, `Accordion`, `Collapsible`, `DropdownMenu`, `Item`,
`Skeleton`, `Toggle`, and `ToggleGroup` are named exports only.

## Selection Rules

`Button` commands · `Toggle` one pressed state · `ToggleGroup` a related set ·
`Switch` binary settings · `RadioGroup` few exclusive choices · `Select` longer
option sets.

`Dialog` blocking decisions · `Popover` contextual controls · `Tooltip` short
explanations · `DropdownMenu` action lists.

`ItemGroup` + `Item` lists and settings · `Card` one item in a collection or one
tappable object, never a wrapper around a section, form, or row group, never
nested · `EmptyState` no-data or recoverable errors · `Skeleton` loading content
with stable layout · `Progress` real or indeterminate progress.

## Notifications

`notify` (from `@mrmeg/expo-ui/state`, also on the root barrel) is the imperative
API for the `Notification` component. Notifications auto-dismiss after 4s
(`DEFAULT_NOTIFICATION_DURATION`) unless a `duration` is given; `duration: 0`
keeps one up until dismissed, and `notify.loading` never auto-dismisses.
`position` is `"top"` (default) or `"bottom"`.

```ts
import { notify } from "@mrmeg/expo-ui/state";

notify.success("Saved", { messages: ["Your changes were saved."] });
notify.error("Upload failed");
notify.warning("Connection slow");
notify.info("Copied to clipboard");

notify.loading("Uploading…");
notify.hide();

// Full control (same payload as globalUIStore show())
notify({ type: "success", title: "Saved", duration: 3000, position: "bottom" });

// Loading → success/error around a promise; rethrows on rejection
await notify.promise(saveProfile(), {
  loading: "Saving…",
  success: "Profile saved",          // or (value) => `Saved ${value.name}`
  error: "Could not save profile",   // or (err) => err.message
});
```

`globalUIStore` (the underlying zustand store) stays available for reactive
selectors and tests. Use `notify` for imperative triggers in app code.

## Validation

Changing package code or shipped docs? Run the gates from the monorepo root:
`typecheck`, `test`, `build`, `pack`, `consumer-smoke` (`bun run pkg ui <gate>`).
Docs-only changes need at least `bun run pkg ui pack`, which proves the new docs
land in the npm tarball.
