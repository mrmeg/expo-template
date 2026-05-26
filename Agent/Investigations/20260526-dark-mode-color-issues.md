# Investigation: Dark Mode Color Issues

**Date:** 2026-05-26
**Mode:** Targeted scan (theming + +html.tsx + UI package)
**Status:** Findings

## Prompt

> I'm seeing a lot of issues with colors in dark mode, like dark text on dark
> background, etc. Take a look at my template repo and how it's using my UI
> packages and theming, as well as the +html file for additional gotchas for
> setting up this app.

## Area Map

### Theming surface

- **Tokens:** `packages/ui/src/constants/colors.ts` exports `colors.light`/`colors.dark` with semantic tokens (`background`, `foreground`, `card`, `cardForeground`, `text`, `textDim`, `primary`, `primaryForeground`, `secondary`, `secondaryForeground`, `muted`, `mutedForeground`, `accent`, `accentForeground`, `destructive`, `destructiveForeground`, `success`, `warning`, `border`, `input`, `ring`, `overlay`) plus a `palette` of raw colors.
- **Active scheme resolution:** `packages/ui/src/state/themeStore.ts` (Zustand). Defaults are `userTheme: "system"`, `systemTheme: "light"`. `resolveThemePreference(userTheme, systemTheme)` returns the active scheme.
- **Hook:** `packages/ui/src/hooks/useTheme.ts` returns `theme`, `scheme`, helpers, plus a `useEffect` that mirrors `effectiveScheme` to `document.documentElement.dataset.theme` and `style.colorScheme` on web.
- **Provider:** `packages/ui/src/components/UIProvider.tsx` mounts `Notification`, `PortalHost`, `StatusBar`. It does NOT manage theme state — that's done implicitly by Zustand subscriptions.

### Web first-paint surface

- **`app/+html.tsx`** ships:
  - Body CSS with a default light bg and `@media (prefers-color-scheme: dark)` and `html[data-theme=...]` overrides.
  - A blocking inline `<script>` that resolves the user's preferred scheme from `localStorage["user-theme-preference"]` (or OS), sets `html.dataset.theme` and `html.style.colorScheme`, and adds `theme-loading` class on `<html>` for dark visitors so `#root { visibility: hidden }` until React hydrates.
  - A 500ms `setTimeout` fallback that removes `theme-loading` even if hydration never runs.
- **`app/_layout.tsx`** calls:
  1. `const { scheme } = useTheme();` — reads store (initially light).
  2. `useEffect(() => syncThemeFromEnvironment(), [])` — loads persisted `userTheme` from `localStorage` and starts the OS color-scheme listener.
  3. `useEffect(() => { ... classList.remove("theme-loading"); }, [])` — drops the shield unconditionally on first commit.

### Native first-paint surface

- **`app.config.ts`** plugins:
  - `expo-splash-screen`: `backgroundColor: "#ffffff"`. No `dark` variant.
  - `android.adaptiveIcon`: `backgroundColor: "#ffffff"`. No themed icon.
  - `userInterfaceStyle: "automatic"` is set (good).
- **`packages/ui/src/components/StatusBar.tsx`** correctly derives `barStyle` from `useTheme().scheme`.

### Recent churn

- The SSR-aware `+html.tsx` and the `theme-loading` shield were added together; the inline script and the `_layout.tsx` shield-removal `useEffect` are co-evolved.
- `useTheme.ts` gained the `data-theme` mirroring `useEffect` and the `useStyles` hook.

## Trace Notes

### A. Light/dark contrast on the play overlay (`app/(main)/(tabs)/media.tsx:741`)

```tsx
// app/(main)/(tabs)/media.tsx
<View style={styles.playButton}>
  <Icon name="play" size={16} color="white" />
</View>
// styles
playButton: { backgroundColor: theme.colors.primary, ... }
```

- Light scheme: `primary` = `gray-900` (#18181B). White icon on dark = OK.
- Dark scheme: `primary` = `gray-50` (#FAFAFA). White icon on near-white = **invisible**.

### B. Profile avatar (`app/(main)/(tabs)/profile.tsx:184`)

```tsx
<View style={[styles.avatar, getShadowStyle("soft")]}>
  <Icon name="user" color={palette.white} size={48} />
</View>
// styles
avatar: { backgroundColor: theme.colors.primary, ... }
```

Same inversion bug as A. Avatar icon disappears in dark mode.

### C. Native splash white-flash on dark devices

`app.config.ts:84` hard-codes `backgroundColor: "#ffffff"` and supplies a single `image`. On a dark-mode device, the splash is bright white before the app takes over. `expo-splash-screen` accepts a `dark` block:

```ts
"expo-splash-screen", {
  image: "./assets/images/splash-icon.png",
  backgroundColor: "#ffffff",
  dark: { image: "./assets/images/splash-icon-dark.png", backgroundColor: "#09090B" },
}
```

That's not used. Same story for `android.adaptiveIcon.backgroundColor` — `monochromeImage` and a dark-friendly background are not provided, so Android themed-icon mode and dark-mode launchers render a white halo.

### D. Web SSR/hydration race (the most likely root cause of "dark text on dark background")

The Zustand store always initializes to `userTheme: "system"`, `systemTheme: "light"`. Both server render and the first client render therefore use the **light theme**. The story for a dark-preferring web visitor is:

1. Server renders HTML. React tree uses light tokens (white card bg, gray-950 text). HTML element has no `data-theme` attribute.
2. Browser parses head; the inline blocking script runs:
   - Sets `html.dataset.theme = "dark"`, `html.style.colorScheme = "dark"`.
   - Adds `theme-loading` class — `#root { visibility: hidden }`.
   - Schedules `setTimeout(() => classList.remove("theme-loading"), 500)`.
3. CSS rule `html[data-theme="dark"] body { background-color: #09090B }` paints the body dark. `#root` is hidden, so the user sees a blank dark page.
4. React hydrates. `useTheme()` returns the light scheme (store default). The `useEffect` at `useTheme.ts:87-92` runs and writes `dataset.theme = "light"`. **This fights the inline script** — the body briefly becomes light again.
5. `_layout.tsx:91-93` `syncThemeFromEnvironment()` finally reads `localStorage`, calls `set({ userTheme: "dark" })`, then `setSystemTheme("dark")`. State updates queue a re-render.
6. `_layout.tsx:99-101` `classList.remove("theme-loading")` runs (unconditionally) and `#root` becomes visible.
7. Re-render commits with dark theme. `useTheme.ts:87` runs again and writes `dataset.theme = "dark"`. Body returns to dark.

Two failure modes fall out of this:

- **Fast-hydration flash:** Steps 4 and 5 may happen on either side of a browser paint. If the browser repaints between step 4 (body=light) and step 7 (body=dark), the visitor sees a light flash and possibly the still-light React tree showing through. Dark text from the still-light scheme on the still-light body is the textbook FOUC. (React 19 batches in-effect setState, so the worst case is timing-dependent rather than guaranteed.)
- **Slow-hydration flash:** If hydration takes longer than the 500 ms failsafe in step 2's inline script, `theme-loading` is removed before React mounts. `#root` becomes visible while still showing the SSR-rendered light tree on the inline-script-set dark body. The user sees light cards / dark-on-dark text on a dark body until React finally hydrates and re-renders.

The root cause is shared: the **theme store has no way to know the visitor's resolved scheme during SSR / first render**, so initial CSR tokens are always light, and the `useTheme.ts` `useEffect` happily writes that stale value back to the DOM, undoing the inline script's correction.

### E. Decoration colors that don't scale to the dark background

- `app/(main)/(demos)/screen-list.tsx:31-33` — `online: "#22c55e"`, `away: "#eab308"`, `offline: "#94a3b8"` status dots. The "offline" slate is low contrast on the dark `card` (#18181B). Visual nit.
- `client/screens/DetailHeroScreen.tsx:378` — back-button `backgroundColor: "rgba(0,0,0,0.2)"` over a hero image. If the hero is dark or absent in dark mode, the button is barely visible.
- `app/(main)/(tabs)/profile.tsx:598` — `providerLetter` style defaults to `color: palette.white`. Both call sites work (Google has a hard-coded red bg, Apple overrides with `theme.colors.background`), but the default is theme-fragile if a third provider is added.
- `packages/ui/src/components/Switch.tsx:111` — iOS variant uses `#34C759` for both schemes. Documented design choice.

### F. Doc gaps

`Agent/Docs/EXPO_UI_PACKAGE.md` documents `useTheme()`, `useThemeStore`, and the recommended `+html.tsx`, but says nothing about:

- The inline-script + `theme-loading` shield contract.
- The store-default-light SSR tradeoff.
- The native splash needing a `dark` block.
- That every place using `theme.colors.primary` as a background must pair it with `theme.colors.primaryForeground` (and the same rule for `theme.colors.foreground` ↔ `theme.colors.background`).

## Findings

| Priority | Type | Effort | Confidence | Finding | Evidence | Why it matters | Spec-ready? |
|----------|------|--------|------------|---------|----------|----------------|-------------|
| P0 | Bug | Small | High | Web first-paint theme race: store defaults to light, `useTheme.ts:87-92` writes stale `data-theme="light"` after hydration, `_layout.tsx:99-101` drops the dark-mode shield unconditionally, and the 500 ms failsafe can drop the shield before React hydrates. Dark visitors see a light tree (or a light body flash) before the store syncs. | `packages/ui/src/state/themeStore.ts:33-37`, `packages/ui/src/hooks/useTheme.ts:86-92`, `app/_layout.tsx:91-101`, `app/+html.tsx:140-152` | Most likely root cause of "dark text on dark background" reports for web visitors. Affects every screen. | Yes |
| P1 | Bug | Trivial | High | `app/(main)/(tabs)/media.tsx:741` — play icon `<Icon ... color="white" />` rendered on `theme.colors.primary` background. In dark mode primary = `gray-50` → invisible icon. | `app/(main)/(tabs)/media.tsx:740-742, 975-983` | Visible primary feature (Media tab) breaks in dark mode. | Yes |
| P1 | Bug | Trivial | High | `app/(main)/(tabs)/profile.tsx:184` — avatar `<Icon name="user" color={palette.white} ... />` rendered on `theme.colors.primary` background. Same inversion: invisible icon in dark mode. | `app/(main)/(tabs)/profile.tsx:183-185, 484-490` | Profile tab avatar disappears in dark mode. | Yes |
| P1 | Bug | Small | High | Native splash hard-codes `backgroundColor: "#ffffff"` with no `dark` variant. Dark-mode users on iOS/Android always get a white splash flash. | `app.config.ts:78-86` | Highly visible regression on every cold launch for dark-mode users. | Yes (needs a dark splash asset to land "Ready") |
| P2 | Bug | Small | High | Android `adaptiveIcon.backgroundColor: "#ffffff"` is non-adaptive; no `monochromeImage` for Android 13+ themed icons. Bright halo behind the app icon on dark launchers. | `app.config.ts:138-144` | Polish, but a visible mismatch when the rest of the app supports dark. | Yes (needs monochrome asset to land "Ready") |
| P2 | Tech Debt | Small | Medium | `Agent/Docs/EXPO_UI_PACKAGE.md` does not document the +html.tsx inline-script contract, the store-default-light SSR tradeoff, the splash dark-variant requirement, or the rule that every `primary`/`foreground` background must be paired with its inverting foreground token. | `Agent/Docs/EXPO_UI_PACKAGE.md` (no SSR/hydration section) | Future apps cloning this template will repeat the bugs above. | Yes |
| P3 | Bug | Trivial | Medium | `app/(main)/(tabs)/profile.tsx:598` `providerLetter` defaults to `color: palette.white`. Both current consumers happen to work (Google has hard-coded red bg; Apple overrides). A third provider added by an agent could regress. | `app/(main)/(tabs)/profile.tsx:596-600` | Latent footgun, not a current visible bug. | Needs decision (refactor or document) |
| P3 | Bug | Trivial | Medium | `app/(main)/(demos)/screen-list.tsx:33` — `offline: "#94a3b8"` status dot is low contrast on the dark `card` (#18181B). | `app/(main)/(demos)/screen-list.tsx:31-33` | Visual nit on a demo screen. | Needs decision |
| P3 | Bug | Trivial | Medium | `client/screens/DetailHeroScreen.tsx:378` — back button `rgba(0,0,0,0.2)` over a hero. If hero is dark or absent in dark mode, button is hard to see. | `client/screens/DetailHeroScreen.tsx:378` | Affects only the detail-hero demo. | Needs decision |

### Verified-clean (not findings)

- No `useColorScheme()` from React Native, no `Appearance.getColorScheme()` outside `themeStore.ts`.
- No `@react-navigation/*` `useTheme` imports.
- No NativeWind/Tailwind class strings.
- All `@rn-primitives/*` consumers feed theme tokens through.
- `Stack.contentStyle`, tabbar, header, and `StatusBar` all read from the active scheme.
- Every other location that uses `theme.colors.primary` or `theme.colors.foreground` as a background pairs it with the correct inverting foreground token (`primaryForeground` / `background`) or contrast-derived computation.

## Recommended Specs

In execution order:

1. **`fix-web-theme-first-paint-race`** — Eliminate the light-flash for dark-mode web visitors. Options the spec needs to choose between:
   - Make `useTheme.ts:87-92` skip the DOM write while the store is still in its "uninitialized" state.
   - Read `document.documentElement.dataset.theme` (set by the inline script) into the store synchronously on the first render *before* React hydrates the rest of the tree, so SSR/CSR initial render matches the inline script.
   - Gate `_layout.tsx:99-101` `classList.remove("theme-loading")` on the store actually having been hydrated (and remove the unconditional 500 ms failsafe in `+html.tsx:148-152`, or extend its timeout).
   - Ensure the React tree itself does not render on web until `syncThemeFromEnvironment()` has resolved the user preference (current rendering blocks only on native).
2. **`fix-dark-mode-icon-on-primary-bg`** — Replace `color="white"` and `color={palette.white}` with `theme.colors.primaryForeground` at `app/(main)/(tabs)/media.tsx:741` and `app/(main)/(tabs)/profile.tsx:184`. Add a unit test or visual snapshot to lock the contract.
3. **`add-dark-splash-and-themed-app-icon`** — Add `dark` variant to `expo-splash-screen` plugin config and a dark/monochrome `adaptiveIcon` for Android. Requires a dark splash and (optionally) monochrome icon asset.
4. **`document-theming-contracts-in-expo-ui-package-doc`** — Extend `Agent/Docs/EXPO_UI_PACKAGE.md` with: SSR/hydration model, inline-script + shield contract, splash dark-variant requirement, and the "primary/foreground bg ⇒ paired inverting foreground" rule. Update `packages/ui/llms*.md` mirrors as part of the same spec.
5. *(Optional, P3)* **`tighten-providerletter-default`** — Make the `providerLetter` style derive its color from contrast against its container or require an explicit color, so a future provider added by an agent can't silently regress.

## Blockers and Open Questions

- **Spec 3** needs a designed dark splash asset (and ideally an Android monochrome adaptive icon). I have not produced these.
- **Spec 1** — open product/UX choice: do we want SSR to ship correct dark-themed HTML for visitors with a `prefers-color-scheme` cookie/header (best-of-class but requires a Set-Cookie or middleware integration), or do we accept "dark visitors render light HTML but never paint until store syncs" (simpler, makes hydration the long pole)? Either is much better than today.
- **Spec 1** — should we keep the 500 ms failsafe at all? If we accept that dark-mode visitors see a blank dark page until React hydrates, the failsafe should probably be removed. If we keep it, removal must coincide with the store sync, not a hard timer.

## Evidence

Inspected paths (non-exhaustive — full ripgrep across `app/`, `client/`, `packages/`, `plugins/`, root configs):

- `app/+html.tsx`
- `app/_layout.tsx`
- `app/(main)/_layout.tsx`
- `app/(main)/(tabs)/_layout.tsx`
- `app/(main)/(tabs)/media.tsx`
- `app/(main)/(tabs)/profile.tsx`
- `app/(main)/(tabs)/settings.tsx`
- `app/(main)/(demos)/*` (audited each demo)
- `app.config.ts`
- `packages/ui/src/constants/colors.ts`
- `packages/ui/src/hooks/useTheme.ts`
- `packages/ui/src/state/themeStore.ts`
- `packages/ui/src/components/UIProvider.tsx`
- `packages/ui/src/components/StatusBar.tsx`
- `packages/ui/src/components/Button.tsx`, `Badge.tsx`, `ToggleGroup.tsx`, `Toggle.tsx`, `Tabs.tsx`, `Switch.tsx`, `TextInput.tsx`, `Tooltip.tsx`, `Checkbox.tsx`, `RadioGroup.tsx`, `Dialog.tsx`, `BottomSheet.tsx`, `Drawer.tsx`, `DropdownMenu.tsx`, `Select.tsx`, `Popover.tsx`, `Slider.tsx`, `InputOTP.tsx`, `Card.tsx`, `Skeleton.tsx`, `MaxWidthContainer.tsx`, `EmptyState.tsx`, `Notification.tsx`, `Icon.tsx`, `StyledText.tsx`
- `client/screens/*.tsx`
- `client/features/media/components/VideoPlayer.tsx`, `ImagePreview.tsx`
- `client/features/navigation/WebBackButton.tsx`
- `client/showcase/*.tsx`
- `Agent/Docs/EXPO_UI_PACKAGE.md`
