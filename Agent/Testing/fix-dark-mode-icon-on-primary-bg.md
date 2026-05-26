---
spec: fix-dark-mode-icon-on-primary-bg
platforms: [ios, web, android]
status: pending
---

# Verify: Dark-Mode Icon On Primary Background

Confirms two icons that previously hardcoded `color="white"` / `color={palette.white}` over a `theme.colors.primary` background now render correctly in both light and dark schemes. Also confirms the contrast lint guard (`bun run lint:theme`) and the contrast unit test (`packages/ui/src/constants/__tests__/colors.test.ts`) are wired and passing.

## Setup

### iOS
- Launch: `bun run ios` (or reuse an already-running iOS Simulator if Metro is up).
- Starting screen: tab bar after onboarding clears. If onboarding has not run, complete it once with the demo flow.
- Theme toggle: open the **Settings** tab (or any screen exposing the `useTheme().setTheme` control), or change device-wide via `Settings > Developer > Toggle Appearance` on the simulator.

### Web
- Launch: `bun run start` (or reuse an already-running web dev server).
- Starting URL: `http://localhost:8081/(main)/(tabs)`
- Theme toggle: Chrome DevTools > "Rendering" > "Emulate CSS media feature prefers-color-scheme: dark", OR change OS dark mode and refresh.

### Android
- Launch: `bun run android` (or reuse an already-running emulator).
- Starting screen: same tab bar as iOS.
- Theme toggle: emulator settings > Display > Dark theme.

## Scenarios

### 1. Media tab — play overlay icon visible in dark mode
**Goal** — The play icon on every video thumbnail must be readable against its `theme.colors.primary` circle in both schemes.

**Steps**
1. Navigate to the **Media** tab.
2. Confirm at least one video thumbnail is rendered (seed data or upload one if empty — see Setup notes per platform). If no video can be uploaded, the scenario is **Manual-Only** and should be skipped under that section.
3. Switch to dark mode and re-render.
4. Inspect the play overlay (small circle in the centre of the thumbnail).

**Expected**
- Light mode: dark-on-near-white play icon (icon = gray-50, circle = gray-900). Visible.
- Dark mode: dark-on-near-white play icon (icon = gray-900, circle = gray-50). Visible — **not** invisible white-on-near-white.

**On failure** — Screenshot of the thumbnail. Confirm the rendered `Icon` `color` prop using DevTools (web) or `npx expo doctor` + a temporary `console.log` of `theme.colors.primaryForeground` near `app/(main)/(tabs)/media.tsx:741`.

---

### 2. Profile tab — avatar fallback icon visible in dark mode
**Goal** — The user-avatar fallback icon must be readable against its `theme.colors.primary` circle in both schemes.

**Steps**
1. Navigate to the **Profile** tab.
2. If a user image is set, sign out / clear avatar so the fallback icon renders. (If no avatar override exists, this is the default state.)
3. Switch to dark mode and re-render.
4. Inspect the round avatar (circle ~96 dp).

**Expected**
- Light mode: near-white user icon on near-black avatar circle. Visible.
- Dark mode: near-black user icon on near-white avatar circle. Visible — **not** invisible white-on-near-white.

**On failure** — Screenshot, confirm `app/(main)/(tabs)/profile.tsx:184` uses `theme.colors.primaryForeground`.

---

### 3. Profile tab — Connected Accounts: Google and Apple chips
**Goal** — Both provider chips remain readable. The Google chip is hard-coded `#DB4437` red with a white "G" (intentional brand colors, unchanged). The Apple chip uses `theme.colors.foreground` background with `theme.colors.background` letter — must invert correctly across schemes.

**Steps**
1. Profile tab → "Connected Accounts" section.
2. Toggle dark mode.

**Expected**
- Google chip: red background, white "G" — both schemes.
- Apple chip light: near-black background, near-white "A".
- Apple chip dark: near-white background, near-black "A".

**On failure** — Screenshot. Verify `app/(main)/(tabs)/profile.tsx:373` (Google) passes `palette.white` explicitly; line 386 (Apple) passes `theme.colors.background`.

---

### 4. Toolchain — `bun run lint:theme` and contrast unit test
**Goal** — The new guards run in CI and would catch a regression of the bug pattern.

**Steps**
1. From repo root, run `bun run lint:theme`. Expect `lint:theme: 0 issues`.
2. Run `bun run --cwd packages/ui test packages/ui/src/constants/__tests__/colors.test.ts`. Expect 10 strict assertions pass and 3 todos.
3. *(Synthetic)* Temporarily revert `app/(main)/(tabs)/media.tsx:741` to `color="white"` and rerun `bun run lint:theme`. Expect:
   - exit code `1`
   - line `app/(main)/(tabs)/media.tsx:741: descendant color="white" on theme.colors.primary background — use theme.colors.primaryForeground`
4. Restore the file (`git checkout HEAD -- "app/(main)/(tabs)/media.tsx"` after re-applying the fix or via stash).

**Expected** — Step 3 must report the violation and exit non-zero. Steps 1, 2, and 4 must succeed.

**On failure** — Capture the script's stdout/stderr. Inspect `scripts/check-primary-fg.mjs` for the AST-walker logic.

## Regression Checks
- Existing UI package tests still pass: `bun run --cwd packages/ui test` reports `Tests: 3 todo, 166 passed`.
- Existing typecheck still clean: `bun run --cwd packages/ui typecheck` and `bun run typecheck`.
- `bun run lint` (expo lint) still reports `0 errors` (warnings unchanged from baseline).
- Existing `useTheme()` consumers still resolve the same `getContrastingColor` / `withAlpha` / `getTextColorForBackground` helpers (these now re-export from `packages/ui/src/lib/contrast.ts`).

## Manual-Only Scenarios
- Real device dark-mode toggle on a TestFlight build (cannot reach from `/verify-ui`).
- Visual review by a designer to confirm the new icons feel right at the tile size, not just that they're visible.

## Acceptance
All non-manual scenarios pass on the highest-priority platform that is runnable. The lint script regression test (Scenario 4 step 3) MUST be exercised at least once — it is the durable guard against re-introducing the bug.
