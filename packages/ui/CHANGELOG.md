# Changelog

All notable changes to `@mrmeg/expo-ui` are documented here. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.22.0]

### Added

- **CSS-variable theming on web.** On web, every semantic theme color
  (`theme.colors.*`) now resolves to a CSS custom property
  (`var(--c-<kebab-token>)`) instead of a literal hex string, so styles built
  from the theme — including the HTML shells baked at export time — re-theme
  purely in CSS when `html[data-theme]` changes. Native platforms keep
  literal values. New exports from `constants`:
  - `getThemeCssVariables(overrides?)` — the `--c-*` (and companion
    `--c-*-rgb` triplet) definitions per scheme, for embedding in an app's
    `+html.tsx` global `<style>`. Accepts per-scheme brand-color overrides.
  - `rawThemeColors.light/.dark` — the literal hex/rgba maps on every
    platform, for sinks that cannot take `var()` (e.g.
    `<meta name="theme-color">`).
  - `resolveRawColor(color, scheme)` — maps a `var(--c-*)` theme color back
    to the given scheme's literal value; literal inputs pass through.
- **`withAlpha` is exported standalone** (in addition to the `useTheme`
  return) so module-scope style factories can import it. It understands
  `var(--c-*)` inputs and rewrites them onto the `--c-*-rgb` triplet
  (`var(--c-unset, rgba(var(--c-x-rgb), a))` — the never-defined outer
  variable makes react-native-web's compiler pass the value through), staying
  pure CSS that re-themes with the variable. Hex-suffix alpha concatenation
  (`theme.colors.x + "15"`) does not work with `var()` colors — use
  `withAlpha(theme.colors.x, 0.08)`.

### Changed

- The contrast helpers from `useTheme` (`getContrastingColor`,
  `getContrastRatio`, `getTextColorForBackground`) resolve `var(--c-*)`
  inputs to the active scheme's literal value before parsing, and
  `getContrastingColor` returns the winning candidate as originally passed
  (a `var()` input stays a `var()` output).
- The React Navigation theme maps (`colors.<scheme>.navigation`) stay
  literal on web as well as native: @react-navigation internals parse their
  theme colors with a color library, which cannot take `var()` references.

## [0.21.1]

### Fixed

- **Exported web HTML renders icon glyphs, fixing React hydration error
  #418 on every cold load.** `useResources` registers the Feather icon font
  per render scope during `expo export`'s Node rendering
  (`ensureIconFontRegistered`), so the static shell emits the glyph and its
  font styles. Previously the shell contained an empty icon text node while
  the client's first render (font pre-loaded at module scope) contained the
  glyph — React 19 threw #418 and regenerated the tree on every cold load.
  The same mechanism existed during the request-time SSR era and was removed
  with it; static export needs it too.

## [0.21.0]

### Added

- **`Carousel` dots are pressable and scroll to their slide.** Each dot is a
  `Pressable` that jumps the scroller to its page (animated) and reports the
  new index through `onIndexChange`. The `tablist`/`tab` roles and `selected`
  state the dots already carried are now honest: a screen reader that
  announced N activatable tabs can finally focus and activate them, and on web
  each dot is a keyboard tab-stop.

  The visible dot stays 8px. The press target is a 24px wrapper plus vertical
  `hitSlop` (44px total), and the row's `gap` moved into that wrapper so
  neighboring targets sit flush with no dead strip between them. The slop is
  vertical-only so a tap can't be ambiguous between two dots.

  The selected dot also sets `aria-selected` explicitly: react-native-web
  never maps `accessibilityState` to the DOM, so on web the tabs previously
  exposed no selected state at all. Native maps `aria-selected` back into
  `accessibilityState`, so the two props agree.

- **`Label` accepts `htmlFor`.** `@rn-primitives/label`'s web build only emits a
  real `<label for="…">` — the thing that actually associates a label with an
  input and makes clicking the label focus it — when `htmlFor` is passed, and
  `Label` never forwarded it. No consumer could produce an associated label.
  `htmlFor` now reaches the primitive's `Text`, which is where the prop is
  declared and where the web build consumes it. Native ignores it, matching the
  primitive.

  Association takes **two distinct ids**:

  ```tsx
  <Label nativeID="email-label" htmlFor="email-input">Email</Label>
  <TextInput nativeID="email-input" />
  ```

  `nativeID` is the label's own id (react-native-web maps it to `id`; on native
  it's what a control's `accessibilityLabelledBy` points at). `htmlFor` is the
  input's id.

### Changed

- **`Carousel` re-clamps its active index when `children` shrink.** The index
  was seeded once, so removing slides while a late page was active left the
  page announcement reading e.g. "5 of 3" with no active dot until the next
  scroll. It now clamps to the last slide, reports the clamped value through
  `onIndexChange`, and scrolls back to that page — the scroller was sitting
  past the new content width.

- **`Carousel` index tracking is split by platform.** Native subscribes to
  `onMomentumScrollEnd` — plus a velocity-gated `onScrollEndDrag`, for a drag
  that releases at rest and so is never followed by a momentum event — and no
  longer subscribes to `onScroll` at all, so a drag costs no per-frame JS
  callback to compute a page the settle reports anyway. A drag past a slide
  midpoint that snaps back to the starting page now reports nothing instead of
  firing the intermediate page and then the original. Web keeps the throttled
  `onScroll` path, which remains the only channel there — react-native-web
  emits no momentum events.

  The `onIndexChange` doc no longer claims "once per settle" unconditionally.
  That now holds on native; on web (wheel/trackpad) it still fires once per
  page *crossed*, and only consecutive duplicate indices are suppressed.

- **New `Carousel` testID: `<testID>-dot-<i>-indicator`.** `-dot-<i>` is now
  the pressable wrapper; the visible dot — and therefore its
  `backgroundColor` — is the `-indicator` node inside it. Tests asserting on a
  dot's color need the new suffix.

- **`useDimensions` seeds from a constant, not context.** The first web render
  uses the new `DEFAULT_VIEWPORT_WIDTH` / `DEFAULT_VIEWPORT_HEIGHT` exports
  (1280×800, the previous context defaults) and switches to real dimensions
  after mount. The hook no longer reads a context or writes an `mrmeg-vw`
  cookie.

- **Theme persistence key is exported as `THEME_STORAGE_KEY`** (value
  unchanged: `user-theme-preference`), replacing `THEME_COOKIE_NAME` as the
  name callers reference.

### Removed

- **Server-rendering support surface.** The template that hosts this package
  no longer server-renders web routes (routes are client-rendered from an
  HTML shell), so the per-request plumbing that existed only to make a server
  render and the browser's first render agree is gone:

  - `SsrThemeSeedContext`, `SsrThemeSeed`, `SSR_THEME_SEED_DEFAULT`, and
    `useSsrThemeSeed` (added in 0.20.0).
  - `SsrViewportContext`, `SSR_VIEWPORT_DEFAULT_WIDTH`, and
    `SSR_VIEWPORT_DEFAULT_HEIGHT`.
  - `THEME_COOKIE_NAME`, and the `document.cookie` write `setTheme` performed
    alongside its persisted write on web.

  Hosts that server-render can keep doing so, but they now own the seeding
  themselves; `useTheme` resolves from the store only.

### Fixed

- **`Label`'s documented pairing pattern produced duplicate DOM ids.** The usage
  docs recommended the *same* `nativeID` on the `Label` and its `TextInput`.
  react-native-web maps `nativeID` to `id`, so that renders two elements sharing
  one id — invalid HTML, and no association either way. The docs now show the
  two-id pattern above.

- **`Avatar` renders image sources that carry no `uri`.** The internal source
  key — which exists so a failure flag survives the fresh `{ uri }` object that
  an inline literal allocates every render — returned `null` for any object
  without a truthy `uri`, and `null` means "no image at all". An iOS
  `{ bundle }` source, or a resolved asset object, therefore silently degraded
  to initials and the image was never attempted. Every shape React Native
  accepts is now keyed (numbers as `asset:<n>`, uri strings as themselves,
  anything else by a stable serialization of its fields); `null` is reserved
  for a missing, empty-object, or empty-array source. Retry-on-change and
  keep-the-failure-on-re-render behavior now applies to those shapes too.

- **`AvatarGroup` members are announceable again (accessibility change).** The
  group wrapper was `accessible` with `accessibilityRole="image"` and an
  `"<n> avatars"` label, which is a leaf role on the web and swallows
  descendants on iOS — so no member's name could be reached inside a group. The
  wrapper is now a plain container with no accessibility semantics of its own,
  and the count rides along as a visually clipped text node ahead of the
  members, so a screen reader reads the summary and then each avatar. Passing
  `accessibilityLabel` still replaces the count text. Apps that asserted on the
  group by its accessibility label (`getByLabelText("3 avatars")`) should query
  the text instead (`getByText("3 avatars")`).

- **`AvatarGroup`'s `max` is clamped to a whole count ≥ 0.** A negative `max`
  reached `slice(0, max)`, which reads a negative end as an offset from the end
  — `max={-3}` on three children rendered all of them, silently disabling the
  clamp — and a fractional `max` truncated arbitrarily. `max` is now
  `Math.max(0, Math.floor(max))`, so `max={0}` renders only the `+N` tile.

- **`Avatar` shows its initials/icon fallback while the image loads.** A slow
  or large image left a bare `muted` tile for the whole request. The fallback
  now stays mounted until the image reports `onLoad`, with the image layered
  over it, so an avatar is never a blank circle in flight.

- **`Avatar`'s image carries its own corner radius.** Rounding relied solely on
  the wrapper's `overflow: "hidden"`, which Android drops for a child image in
  several cases, leaving square corners on a circular avatar.

### Documentation

- **`Carousel`'s `itemWidth` caveat.** A fractional `itemWidth` measures
  against the viewport until the first `onLayout`, so a carousel inside a
  horizontally constrained parent (a padded column, a `MaxWidthContainer`, a
  sidebar pane) renders its first frame — and the exported HTML shell — with
  slides sized to the window. Documented on the prop, with the workaround:
  pass an absolute `itemWidth` (`> 1`) when the parent is narrower than the
  viewport and that first frame matters.

## [0.20.0]

### Added

- **`surfaceSunken` semantic token.** The app-chrome tier below `background`,
  so sidebars, rails, and side panels read as a layer *beneath* the content
  pane instead of the same surface. Dark `#050506` (below zinc-950), light
  `#FAFAFA` (zinc-50). Elevation is now a surface-tier ladder rather than a
  shadow scale: `surfaceSunken` < `background` < `card`/`popover` < `muted`.

- **`borderStrong` semantic token.** A hairline for elements sitting on a
  filled surface — chips on `muted`, raised panels — one visible step above
  the fill, where `border` shares `muted`'s hex and disappears. Dark
  `#3F3F46` (zinc-700), light `#D4D4D8` (zinc-300). `border` stays the
  hairline for elements on `background`/`card`.

- **SSR theme seeding (`SsrThemeSeedContext`).** On a server-rendered web app,
  `useTheme`/`useStyles` had no way to know the visitor's theme during the
  server render, so every SSR page shipped a fully light-themed tree that
  recolored after hydration. The store can't carry a per-request value — it's a
  module singleton shared by concurrent SSR requests — so the new
  `SsrThemeSeedContext` (with `SsrThemeSeed`, `SSR_THEME_SEED_DEFAULT`, and
  `useSsrThemeSeed`) is the per-request channel. Provide it from a signal the
  server and browser read identically (a cookie), and `useTheme` resolves from
  it on web until persistence has loaded.

  `SSR_THEME_SEED_DEFAULT` is `system`/light, i.e. what the store boots with —
  so a host that receives no signal renders exactly as it did before the seed
  existed. Note that this default is a *fallback*, not a reading: a host that
  also writes the resolved scheme into its served HTML (`<html data-theme>`, a
  blocking script's early-return, a `prefers-color-scheme` CSS fallback) must
  distinguish "seed came from the visitor" from "seed is the default" and skip
  the write in the latter case, or it will pin a dark-OS first-time visitor to
  light with its own failsafes disabled.

- **`user-theme-preference` cookie mirror.** On web, `setTheme` now dual-writes
  `localStorage` **and** a `user-theme-preference` cookie (`path=/;
  max-age≈1y; SameSite=Lax`, exported as `THEME_COOKIE_NAME`), and `loadTheme`
  backfills/repairs it from `localStorage`, so a server-rendered host can read
  the visitor's theme off the request. `localStorage` remains the source of
  truth; the cookie is a render hint only. Native persistence is unchanged.

- **`hasLoadedTheme` on the theme store.** False until `loadTheme()` has read
  persistence (or `setTheme` was called). While it's false on web, `useTheme`
  resolves from the SSR seed instead of store state; after that, store state
  wins for good. Mirrors the `hasLoadedOnboarding` pattern.

### Changed

- **Dim text is more readable in both schemes (visual change).**
  `textDim`/`mutedForeground` moved from `#A1A1AA` → `#B0B0B8` in dark
  (~9.2:1 on `background`, ~6.9:1 on `muted`, up from ~7.8:1/~5.9:1) and from
  zinc-500 `#71717A` → zinc-600 `#52525B` in light (~7.7:1 on white, up from
  ~4.8:1). Captions, timestamps, meta rows, and neutral `StatCard` changes all
  render a step brighter (dark) or darker (light) than before; both stay
  clearly dimmer than `text`, so hierarchy is preserved. A new package test
  enforces the floors (≥7:1 on `background`/`card`/`popover`, ≥6:1 on
  `muted`/`secondary`), so these tokens cannot be dimmed back down silently.
  Apps that hardcoded the old hexes, or asserted them in tests, need to update
  those literals; apps using the tokens get the change for free.

- **`Drawer` chrome paints `surfaceSunken`.** Both the overlay drawer panel and
  the in-flow rail switched from `background` to `surfaceSunken`, so navigation
  chrome is visibly darker than the content it sits beside (dark) or a faint
  step off white (light). Override via the existing `style` props, or re-skin
  `surfaceSunken` through `setColors`/`ThemeColorScope`, to restore the old
  flat look.

- **`syncThemeFromEnvironment()` starts the OS listener before reading
  persistence.** `loadTheme()` is what flips `hasLoadedTheme` (the moment web
  renders stop trusting the SSR seed), so the real OS scheme is now read first
  and a `system` user never sees a frame of the boot-default light.

## [0.19.0]

### Added

- **`Avatar` and `AvatarGroup`.** The package had `SkeletonAvatar` (a loading
  placeholder) but no real avatar, so consumers hand-rolled circles. `Avatar`
  renders an image with a graceful fallback chain — image → initials → icon —
  and downgrades to initials at runtime when the image fails to load, so a
  dead URL never leaves an empty hole. Accepts `source`, `name` (supplies 1–2
  initials and the default accessibility label), `icon` (Feather, defaults to
  `user`), `size` (`"sm" | "md" | "lg"` = 32/40/48, or an explicit pixel
  diameter), and `shape` (`"circle" | "square"`). Initials derivation is
  grapheme-aware: a decomposed accented character keeps its mark and an emoji
  is not sliced into a lone surrogate.

  `AvatarGroup` stacks children with a ring in the theme `background` color so
  the stack reads on any surface, collapses anything past `max` into a `+N`
  tile, propagates its `size` and `shape` to children that don't set their own,
  and announces the total count (including the collapsed overflow) to screen
  readers.

  Uses React Native's own `Image`, so there is no new peer dependency.

- **`Carousel` — horizontally snapping slide row with dot indicators.**
  Children-based: each child becomes one slide at the resolved item width.

  ```tsx
  <Carousel itemWidth={0.8} onIndexChange={setPage}>
    {testimonials.map((t) => (
      <Card key={t.name}>
        <BodyText>{t.quote}</BodyText>
      </Card>
    ))}
  </Carousel>
  ```

  `itemWidth` (default `0.85`) is a fraction of the carousel's own width when
  `<= 1` — leaving the next slide peeking — and absolute pixels when `> 1`.
  `gap`, `contentPadding`, `showDots`, `initialIndex`, `onIndexChange`, and
  `snap` cover the rest; dots are plain themed views (active uses `accent`)
  and auto-hide for a single slide. `onIndexChange` fires once per settle.

  Built on `ScrollView`, not a virtualized list, so every slide is in the
  server-rendered tree — web SSR ships the real slide content instead of an
  empty scroller that fills in after measurement. No animation library is
  involved: native snapping uses `snapToInterval`, and because
  react-native-web drops that prop, web gets equivalent CSS scroll-snap
  (`scroll-snap-type`/`scroll-snap-align` plus a `scroll-padding-left` that
  keeps page `i` at `i * (itemWidth + gap)` on both platforms). Wheel and
  trackpad scrolling keep the dots live via throttled scroll ticks, since RNW
  emits no momentum events.

  Accessibility: the dot row is a `tablist` of `tab`s carrying
  `selected` state and per-slide labels, plus a visually clipped
  `aria-live="polite"` "N of M" page announcement.

  `getCarouselIndex(offsetX, interval, count)` and
  `resolveCarouselItemWidth(itemWidth, containerWidth)` are exported for hosts
  building custom controls on the same math.

## [0.18.0]

### Added

- **`BottomSheet.Content` `backgroundStyle` pass-through.** The native sheet
  surface (web vaul panel, Android `containerColor`, iOS
  `presentationBackground`) previously hardcoded the themed card color.
  `BottomSheet.Content` now accepts an optional `backgroundStyle` merged over
  that default, so hosts can pass `{ backgroundColor: "transparent" }` to let
  custom chrome (e.g. a Liquid Glass backdrop) show through. Omitting the prop
  preserves the existing card background. The RN content column still paints
  its own card fill; clear that via `style` when going transparent.

## [0.17.0]

### Added

- **`mono` font variant.** `StyledText` accepts `variant="mono"` (plus a
  `MonoText` convenience alias) for code, IDs, and tabular figures. Defaults
  to the platform's system monospace (Menlo on iOS, `monospace` on Android, a
  `ui-monospace` stack on web); host apps swap in their own faces via the new
  `mono` group in `setFonts`.

- **Per-weight-partial font override groups.** `setFonts` families are now
  partial at both levels: per group (`sansSerif` alone leaves `serif`/`mono`
  at their defaults, as before) and per weight — weights missing from an
  overridden group fall back to that group's `regular`, never to a package
  face. Registering only Regular + Medium is enough. `serif` also gained the
  full weight range (previously `regular`/`bold` only, and `SerifText`
  ignored the requested weight; it now resolves per weight).

- **`useResources` skips the Inter download when `sansSerif` is overridden.**
  A host app that forwards its own sans faces owns loading them; nothing
  would reference the packaged Inter, so the native `.ttf` fetch and the web
  Google-Fonts stylesheet are skipped. Call `setFonts` before the hook mounts
  for the skip to apply; the Feather icon font always loads. Without
  overrides, loading is unchanged.

- **`setShape` — shape injection, completing the `setColors`/`setFonts`
  trio.** Grouped per component for future growth; currently covers Button:

  ```ts
  useThemeStore.getState().setShape({
    button: { borderRadius: 9999, withShadow: false },
  });
  ```

  `borderRadius` applies to every Button preset (package default stays 12);
  `withShadow` controls the `default` preset's resting shadow (default stays
  on). Precedence is caller-wins throughout: the per-instance `withShadow`
  prop and caller `style` beat the global override, which beats the package
  default. `setShape({})` clears back to the defaults.

- **Every text-rendering component now resolves families through the theme
  store.** Button labels, Label, Switch track labels, InputOTP cells, and
  TextInput previously hardcoded Inter family constants in their static
  styles, so `setFonts` re-skinned `StyledText` but left control chrome on
  Inter. They now share one resolver (`resolveFontStyle`, surfaced to
  components as the `useFontStyle` hook, both exported), so a `setFonts` call
  re-skins the whole package at once.

- Exported `FontVariant`, `FontFamilyOverride`, `ResolvedFontStyle`,
  `resolveFontStyle` (from `constants`), `useFontStyle` (from `hooks`),
  `ShapeOverrides` (from `state`), and `MonoText` (from `components`).

### Why

A consuming app rethemed to a new design language (custom sans/serif/mono
faces, pill buttons, flat surfaces) and hit the package's remaining hardcoded
Inter references, the fixed button radius, and the always-on default-preset
shadow — none of which were themable. Fully backward compatible: with no
`setFonts`/`setShape` call, fonts, radii, and shadows are identical to 0.16.0.

## [0.16.0]

### Added

- **`setFonts` — font injection, mirroring `setColors`.** A host app can now
  forward its own bundled faces to the package:

  ```ts
  useThemeStore.getState().setFonts({
    families: { sansSerif: { light: "…", regular: "…", medium: "…",
                             semibold: "…", bold: "…" } },
    webWeightStrategy: "family",
  });
  ```

  Overrides are partial and per-group — pass `sansSerif` alone and `serif`
  keeps the package default. `setFonts({})` clears back to the defaults.
  `StyledText` subscribes to the store, so a call after mount re-renders
  rather than leaving stale families on screen.

- **`webWeightStrategy` — `"numeric" | "family"`.** Declares how a family map
  expresses weight. `"numeric"` (the package default on web) assumes one
  multi-weight CSS family where a numeric `fontWeight` selects the
  `@font-face` variant. `"family"` means each weight is its own
  separately-registered single-face family, so the family name alone carries
  the weight and `StyledText` suppresses the numeric `fontWeight`. Native is
  always `"family"`, unchanged.

  Apps loading per-weight faces through `expo-font` need `"family"` on web:
  `expo-font` registers each file as its own family there too, so the previous
  always-numeric behaviour synthesised a second layer of bold on top of an
  already-bold face.

- Exported `FontFamilyMap`, `FontFamilyWeight`, `FontOverrides`,
  `FontWeightStrategy`, and `defaultWebWeightStrategy` from `constants/fonts`.

- **`createThemedStyles` — SSR-safe themed style registration**, exported from
  `lib`. Wraps a `(theme: Theme) => styles` factory so both base themes are
  registered with react-native-web at module scope — before expo-router
  snapshots the server-side stylesheet — instead of lazily during render via
  `useMemo`, which left SSR HTML referencing class names with no rules
  (unstyled first paint until hydration). Override themes are cached per theme
  object identity. The package's own components (Badge, Button, Card,
  EmptyState, InputOTP, Label, Notification, Skeleton, TextInput) now use it.

### Why

`fontFamilies` was a module-level `const` with no injection point, so the only
way for a consumer to use its own type was to patch `dist/` inside
`node_modules`. Bun keys `patchedDependencies` on an exact `name@version`, so
those patches stop applying — silently, with no warning — the moment the
package version is bumped. Two consumer apps hit exactly that and shipped
fallback fonts without noticing. Colors already had `setColors` for this
reason; fonts now match.

Fully backward compatible: with no `setFonts` call, font resolution is
identical to 0.15.0.

## [0.15.0]

### Added

- **New composition primitives: `SectionHeader`, `StatCard`, and `Item`.**
  `EmptyState` was also upgraded with richer layout options as part of the
  same pass.
- **Typography system.** The package now loads Inter with real weights and a
  letter-spacing scale via `useResources`, replacing synthetic bolding.
- Motion tokens, dual-layer shadow tokens, and softer radii in the design
  tokens.

### Changed

- Interaction sweep across components: press feedback, focus rings, and
  shadow adoption.
- Updated all `@rn-primitives/*` dependencies from `~1.4.0` to `~1.5.2`,
  picking up upstream's native accessibility overhaul: menus, popovers, and
  dialogs are now usable with VoiceOver/TalkBack (focus moves into opened
  content, escape gestures dismiss), toggles and switches announce the
  correct state, and `nativeID` plumbing that broke Reanimated exiting
  animations was removed.

## [0.14.0]

### Changed

- Aligned the declared compatibility floor with the package's `@expo/ui`
  requirement: Expo 56+, React Native 0.85+, and their matching Expo modules.
- Kept Expo 57 and React Native 0.86 support in the same compatibility window.
- Removed the duplicate workspace dev copy of
  `react-native-keyboard-controller`; the root consumer now supplies the peer
  consistently for tests, builds, and native autolinking.

## [0.13.0]

### Added

- **`Drawer.Header` now supports a compact app-brand layout.** Use the new
  `icon`, `title`, and `action` slots for a leading brand icon and title with a
  trailing close or `Drawer.ToggleCollapse` control. Existing child-based
  headers remain supported.

### Changed

- Expanded peer compatibility through Expo 57, React Native 0.86, and their
  matching `@expo/ui` and gesture-handler releases.

## [0.12.1]

### Fixed

- **`BottomSheet` now dismisses the keyboard when tapping outside a focused
  field on Android.** The native sheet hosts its content in a separate window
  (via `@expo/ui`'s `RNHostView`), outside the app's `KeyboardProvider` — so the
  app-wide tap-away never reached sheet content, and `useKeyboardState()` /
  `KeyboardController.dismiss()` are blind to that window. iOS papered over this
  (SwiftUI resigns first-responder on outside taps for free); Compose did not,
  leaving a focused field stuck open. `BottomSheet.Content` now mounts a
  transparent dismiss overlay while a field is focused, detecting focus via the
  window-independent `keyboardFocusRegistry` and resigning the field through its
  own native `blur()` ref. The registry gained `subscribeKeyboardFocus`,
  `hasKeyboardFocusedInput`, and `dismissKeyboardFocusedInput`, and `TextInput`
  now registers a `blur` handle on focus.

## [0.12.0]

### Added

- **`KeyboardAvoidingView` is now a public package component.** Native uses
  `react-native-keyboard-controller` with `automaticOffset` enabled by default,
  while web renders a plain `View`.
- **`UIProvider` now owns app-wide native keyboard avoidance by default.** Apps
  that mount `KeyboardProvider` above `UIProvider` get root-level keyboard
  avoiding behavior without adding per-screen `KeyboardAvoidingView` wrappers.
  Pass `keyboardAvoiding={false}` to opt out, or `keyboardAvoidingProps` to tune
  the root wrapper. Web skips the root keyboard wrapper unless explicitly
  enabled.

### Fixed

- **`DismissKeyboard` no longer nests keyboard-avoiding wrappers when the root
  provider already owns keyboard avoidance.**

## [0.11.0]

### Added

- **New peer dependency: `react-native-keyboard-controller` (>=1.21.0 <2.0.0).**
  Required by `DismissKeyboard` to dismiss the software keyboard for the native
  `@expo/ui` TextInput (see fix below). It ships a no-op web fallback, so web
  bundles are unaffected.

### Fixed

- **`DismissKeyboard` now dismisses the keyboard for native `@expo/ui` fields.**
  The native TextInput is a SwiftUI / Compose field that never registers with
  React Native's `TextInputState`, so the previous `Keyboard.dismiss()` (which
  only blurs RN-tracked inputs) did nothing — tapping outside never closed the
  keyboard on iOS or Android. `DismissKeyboard` now mounts a full-screen
  tap-catcher *only while the keyboard is visible* (`useKeyboardState`) that calls
  `KeyboardController.dismiss()` at the IME level. Mounting it only while visible
  avoids stealing the focus tap and fighting bottom sheets / modals. Web remains a
  no-op (no software keyboard); all existing props (`children`, `style`,
  `avoidKeyboard`, `scrollable`) and the `KeyboardAvoidingView` / `ScrollView`
  wrapping behavior are preserved.
- **Android: TextInput text is now vertically centered.** The native field set a
  fixed `height`, but Android's Compose `BasicTextField` decoration box defaults to
  `contentAlignment = topStart`, so text pinned to the top with the slack falling to
  the bottom (iOS centered fine). The single-line field is now sized by symmetric
  vertical padding instead of a fixed height, centering the text on Android with no
  change to iOS sizing or centering. Multiline is unchanged.

## [0.10.1]

### Fixed

- Fix TextInput rounded-corner fill leak on New Architecture. On Fabric, the
  `outline`/`filled` variants stroked a rounded border but painted the
  background fill as an un-clipped rect, so the fill's square corners poked past
  the rounded stroke (most visible on dark themes and the `filled` variant). The
  fill, border, and radius now live on the RN wrapper `View` with
  `overflow: "hidden"`, and the native `@expo/ui` host renders transparent inside
  that clipped rounded surface. The `underlined` variant (bottom border only),
  error state, `forceLight` mode, and the secure-entry eye toggle are unchanged.

## [0.10.0]

### Added

- Drawer collapsible rail mode (`variant="rail"`, `Drawer.ToggleCollapse`).
- Theme-aware Icon color resolution.
