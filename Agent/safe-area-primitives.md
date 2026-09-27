---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Safe areas: kit primitives read insets, and a `Screen` primitive for the apps

## Goal
Matt (09-27): "a lot of screens or apps aren't observing safe areas very well, FieldNest and SimpleSell for sure." The app sessions fix their screens; this spec fixes what `@mrmeg/expo-ui` contributes and gives the apps one primitive to stand on. Audit of the kit on `origin/dev` `237e879`:

- **No screen/page/container primitive exists** (`MaxWidthContainer` is width-only), so every app hand-rolls `useSafeAreaInsets` per screen — or forgets. In the template itself only `welcome`, `form` and `chat` (`client/templates/*/Screen.tsx`) and the media viewers read insets; `settings`, `list`, `dashboard`, `profile` pad a fixed `spacing.xxl` at the bottom and nothing at the top (they happen to sit under a Stack header in the demos).
- **`Notification` (toast)** reads `SafeAreaInsetsContext` and falls back to a fixed 20 pt when the context is `null` (a `UIProvider` mounted above the app's `SafeAreaProvider`, or a toast host rendered outside it): a top toast then sits under the Dynamic Island and a bottom toast over the home indicator. With an inset it sits flush at `insets.top` with no breathing room.
- **`Dialog` / `AlertDialog`** center a `sizer` (`width 90%`, `maxHeight 85%`) inside `overlayStyles.centeredContainer`, which has no inset padding: on iOS the RN `Modal` covers the whole screen, so a tall dialog's 7.5 % margins are all that keep it off the island (59 pt) and home indicator (34 pt) — 72 pt on a Pro Max, less on smaller phones and in landscape.
- **`BottomSheet`** already resolves insets with an `initialWindowMetrics` fallback (`useSheetInsets`, native sheets present outside the provider) and pads its `Body`/`Footer` bottom; **`Drawer`** pads top/bottom from `useSafeAreaInsets`. Both keep working; the shared hook below replaces the private one.
- `KeyboardAvoidingView`, `UIProvider` and the tab helpers add no insets of their own (correct: they are not screens). There is no kit header/NavBar; navigator headers inset themselves.

## Context
- `packages/ui/src/components/Notification.tsx`: `const insets = use(SafeAreaInsetsContext)` (line ~57); `topPosition = insets?.top ? insets.top : 20`, `bottomPosition` likewise (~181); container `position: "absolute", left/right: spacing.md`. Tests: `__tests__/Notification.test.tsx` (no inset cases yet).
- `packages/ui/src/components/Dialog.tsx`: `overlayStyles.centeredContainer` / `sizer` (~536–559), used by both `DialogContent` (~236) and `AlertDialogContent` (~423); `DialogKeyboardAvoidance` wraps them on native. Tests: `__tests__/Dialog.test.tsx` (mocks `react-native/Libraries/Modal/Modal`).
- `packages/ui/src/components/BottomSheet.tsx` `useSheetInsets()` (~399): `insets.x || initialWindowMetrics?.insets.x || 0` per edge.
- `test/setup.ts` (~136) mocks `react-native-safe-area-context`: `useSafeAreaInsets()` returns zeros regardless of provider, `SafeAreaInsetsContext` is a real context defaulting to zeros, `initialWindowMetrics` is zeros. A test that wraps in `<SafeAreaInsetsContext.Provider value={{ top: 59, bottom: 34, left: 0, right: 0 }}>` is the "mocked SafeAreaProvider" — so the kit must read the **context** (`use(SafeAreaInsetsContext)`), not `useSafeAreaInsets()`, for the values to reach it (the real `useSafeAreaInsets` is that context read plus a throw when missing).
- `spacing` (`constants/spacing.ts`): `sm` 8, `smd` 12, `md` 16, `mdl` 20, `screenPadding` 16, `xxl` 48.
- Template screens: `client/templates/settings/Screen.tsx` (`View` + `ScrollView`, `styles.content` pads `paddingTop: spacing.md, paddingBottom: spacing.xxl, paddingHorizontal: spacing.screenPadding`), `list/Screen.tsx` (`FlatList`, `listContent.paddingBottom: spacing.xxl`), `dashboard/Screen.tsx` and `profile/Screen.tsx` (`View` + `ScrollView`). Demos render under `client/features/navigation/MainLayout.tsx`'s Stack header (top inset handled) with no tab bar (bottom not handled).
- Device: template dev client `com.mrmeg.template` is installed on the Pro Max `95466AD8-DCD0-4FA5-B538-1F4F7DDA7D53`; Metro on 8133 serves it via `xcrun simctl openurl <udid> "com.mrmeg.template://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8133"`. Toasts fire from the showcase Notification section (`/showcase`, "Show Success"/"Show Error"/"Show Warning") and the Profile edit sheet save.

## Work
1. **`useWindowInsets()`** in `packages/ui/src/hooks/useWindowInsets.ts` (exported from `hooks`): per edge `context?.edge || initialWindowMetrics?.insets.edge || 0`, reading `SafeAreaInsetsContext` with `use()` (no throw outside a provider — the fallback covers Modals, native sheets and a provider mounted too low). `BottomSheet` replaces `useSheetInsets` with it (same numbers).
2. **Notification**: `const insets = useWindowInsets()`; `topPosition = Math.max(insets.top, spacing.smd) + spacing.sm` (0 → 20 as today; 59 → 67), same for bottom (34 → 42). Explain the numbers in a comment.
3. **Dialog / AlertDialog**: the centered container pads `insets.top/bottom/left/right` from `useWindowInsets()` (native only — on web the overlay is the viewport), so `sizer`'s 85 % is of the safe area. Move the static style into the component or pass `[overlayStyles.centeredContainer, insetPadding]`.
4. **`Screen`** in `packages/ui/src/components/Screen.tsx` (exported from `components` and the root barrel):
   ```tsx
   <Screen edges={["top", "bottom"]} scroll padded>…</Screen>
   ```
   - `edges: ReadonlyArray<"top" | "bottom" | "left" | "right">` — **required**, no default: under a navigator header pass `["bottom"]`, under a tab bar `["top"]`, in a modal/form sheet `["bottom"]`, a headerless full screen `["top", "bottom"]`. The prop being required is what stops double padding.
   - `scroll?: boolean` — `false`: a `View` with the inset padding on itself; `true`: a `ScrollView` whose `contentContainerStyle` carries the inset padding (content scrolls under the island/home indicator, starts clear of them). `scrollProps?: Omit<ScrollViewProps, "style" | "contentContainerStyle">` for `refreshControl`, `keyboardShouldPersistTaps`, etc.
   - `padded?: boolean` (default `true`): horizontal `spacing.screenPadding` (the one screen inset) plus the left/right inset when those edges are named. `padded={false}` for full-bleed lists (`ItemGroup` rows carry their own 16).
   - `style`, `contentContainerStyle`, `testID`, `children`. Background `theme.colors.background` unless `style` overrides, so the inset strip is painted.
   - Insets from `useWindowInsets()`. Web: `edges` still apply (they are 0 there) so one component serves every platform.
5. **Template adoption** (the fork base): `settings`, `list`, `dashboard`, `profile` `Screen.tsx` take an `edges?: ScreenEdges` prop (default `["bottom"]`, matching their header-under placement) and build on `Screen` (`list` keeps its `FlatList`: a non-scroll `Screen` with `padded={false}` and the bottom inset added to `listContent`). `welcome`, `form`, `chat` keep their explicit inset code (they already pass). Demos unchanged.
6. **Docs**: README "Screen layout" and LLM_USAGE screen-layout rules gain the `Screen` primitive and the `edges` rule (explicit; never top under a header, never bottom above a tab bar); component tables; CHANGELOG `### Added` (`Screen`, `useWindowInsets`), `### Fixed` (toast placement, dialog insets). `bun run docs:llms`. `packages/lint` `no-raw-*` rules: check whether a "wrap screens in Screen" rule is cheap; if not, note it as a follow-up.

RED tests first (context provider with `{ top: 59, bottom: 34, left: 0, right: 0 }`, and the `null` / zero context fallbacks):
- `hooks/__tests__/useWindowInsets.test.tsx`: context values win; zero context falls back to `initialWindowMetrics` (mock it per test with `jest.doMock` or by mutating the mocked module's `initialWindowMetrics.insets`); nothing → zeros.
- `Notification.test.tsx`: top toast `top: 67` under the 59 inset, bottom toast `bottom: 42`; no provider → 20.
- `Dialog.test.tsx`: the centered container has `paddingTop: 59, paddingBottom: 34` on iOS.
- `Screen.test.tsx`: `edges={["top","bottom"]}` → View padding 59/34; `scroll` → the padding is on the ScrollView's contentContainer, not the ScrollView; `edges={["bottom"]}` → `paddingTop` absent (no double padding under a header); `padded` → horizontal 16, `padded={false}` → 0; left/right edges add to the horizontal padding.
- `client/templates/__tests__` (or the existing template tests): settings screen bottom padding is `insets.bottom + spacing.xxl`-equivalent — assert the content container `paddingBottom ≥ 34` under the mocked provider.

## Validation
- Targeted jest, then `bun run verify` gates via the heavy slot (`typecheck`, `pkg ui typecheck`, `lint`, `lint:ui --changed`, `gen --check`, `test:ci` sharded with `--maxWorkers=2`).
- Web (Metro 8133): `/screen-settings`, `/components/Dialog`, `/showcase` render unchanged (insets are 0); no console warnings (`sweep.mjs`).
- **Device (Pro Max, under `device-lock.sh acquire sim`, ≤ 25 min)**: Metro 8133 + the installed dev client; screenshots before (origin/dev) and after under `/tmp/fleet/ui/expo-ui/safe-area/{before,after}/`: top and bottom toasts from `/showcase`, `/components/Dialog` open, `/components/BottomSheet` open (grabber and footer), `/screen-settings` (bottom of the list), `/screen-form` (keyboard up), `/profile` (tab screen). Expected after: toast card 8 pt below the island / above the home indicator, dialog inside the safe area, last settings row fully above the home indicator. If the lock or a heavy slot is unavailable, ship on tests + web and list the device check as pending in the PR.
- Native build: not needed (no native module changes); the installed dev client's JS reloads from Metro.

## Out of scope
- Rewriting `welcome`/`form`/`chat` templates or the tab screens onto `Screen`.
- A header/NavBar primitive; tab-bar height helpers (native tabs inset themselves).
- Android (Pixel not attached) — list as pending.
- Publishing.

## Open questions
None.
