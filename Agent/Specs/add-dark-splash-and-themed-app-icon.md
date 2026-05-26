# Spec: Add Dark Splash And Themed App Icon

**Status:** Blocked
**Priority:** High
**Type:** Feature
**Area:** app, native build
**Blocked By:** Designer to provide dark-variant splash asset and Android monochrome adaptive-icon foreground asset (see Asset Requirements)

---

## What

Add a `dark` variant to the `expo-splash-screen` config plugin so dark-mode visitors do not see a white splash flash on cold launch, and add a monochrome adaptive icon for Android 13+ themed icons so the launcher icon stops showing a bright white halo on dark launchers.

## Why

`app.config.ts:78-86, 138-144` hard-code white backgrounds for both the splash and the Android adaptive icon. Investigation `Agent/Investigations/20260526-dark-mode-color-issues.md` (findings P1 splash, P2 icon) confirmed:

- Every cold launch on a dark-mode iOS or Android device begins with a full-screen `#ffffff` splash that immediately flips to the app's dark UI. This is the most visible "white flash" symptom for native users.
- Android 13+ themed-icon mode renders the app icon's foreground over the system-derived background. Without `monochromeImage`, the launcher falls back to the colorful adaptive icon plus the hard-coded `#ffffff` background, producing a bright halo on dark launchers while themed siblings render correctly.

`app.config.ts:133` already sets `userInterfaceStyle: "automatic"`, so the OS will tell the runtime which scheme to use. The plumbing is in place; the asset and config wiring are missing.

## Current State

`app.config.ts:78-86`:

```ts
[
  "expo-splash-screen",
  {
    image: "./assets/images/splash-icon.png",
    imageWidth: 200,
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
],
```

`app.config.ts:134-144`:

```ts
ios: {
  supportsTablet: true,
  bundleIdentifier: identity.iosBundleIdentifier,
},
android: {
  adaptiveIcon: {
    foregroundImage: "./assets/images/adaptive-icon.png",
    backgroundColor: "#ffffff",
  },
  package: identity.androidPackage,
},
```

`assets/images/`:

- `splash-icon.png` — 1024×1024, 8-bit colormap. Single asset used in both schemes today.
- `adaptive-icon.png` — 1024×1024, 8-bit colormap. Foreground only; background is the hard-coded white above.
- `icon.png` — 1024×1024.
- No `splash-icon-dark.png`, no `adaptive-icon-monochrome.png`.

`expo-splash-screen@56.0.10` (the version Expo SDK 56 ships and this repo installs per `node_modules/.bun/expo-splash-screen@56.0.10+...`) accepts a `dark` block on the plugin Props, but per `expo-splash-screen/plugin/build/types.d.ts:61-64` the public `dark` shape is **only `{ image?: string; backgroundColor?: string }`**. `imageWidth` and `resizeMode` are root-only and inherited; do not nest them inside `dark`.

`expo-config-plugins` exposes `monochromeImage` on `android.adaptiveIcon` (verified in `@expo/config-types/build/ExpoConfig.d.ts:509`), which Expo wires to the `mipmap-anydpi-v26/ic_launcher.xml` `<monochrome>` channel.

## Asset Requirements

Designer must provide before this spec moves to Ready:

1. **`assets/images/splash-icon-dark.png`** — 1024×1024, transparent background, foreground designed to read on `#09090B` (the `colors.dark.colors.background` token from `packages/ui/src/constants/colors.ts:158`). Match the visual weight of `splash-icon.png` so motion between splash and the first app frame is consistent.
2. **`assets/images/adaptive-icon-monochrome.png`** — 1024×1024, transparent background, foreground silhouette in solid white (Android system inverts this against the user's accent color in themed-icon mode). This is the Android Material You themed-icon channel; it replaces the foreground when the user has themed icons enabled and is rendered tinted by the launcher, never as-is.
3. **(Optional, recommended)** an updated dark splash background color if `#09090B` is not the desired splash color — e.g., a slightly off-black brand color. Default to `colors.dark.colors.background` from the theme tokens.

If the designer prefers to ship the dark splash with a different background hue from the theme background, document that override in the spec body when it goes Ready, and add a note to `Agent/Docs/EXPO_UI_PACKAGE.md` (covered by the docs spec) so the splash color is not silently divergent from `theme.colors.background`.

## Changes

### 1. Add the dark splash variant

Edit `app.config.ts:78-86`:

```ts
[
  "expo-splash-screen",
  {
    image: "./assets/images/splash-icon.png",
    imageWidth: 200,
    resizeMode: "contain",
    backgroundColor: "#ffffff",
    dark: {
      image: "./assets/images/splash-icon-dark.png",
      backgroundColor: "#09090B",
    },
  },
],
```

`imageWidth` and `resizeMode` stay at the root level — they are inherited by both light and dark renders. The plugin's public `dark` Props type only accepts `image` and `backgroundColor`; nesting `imageWidth` or `resizeMode` inside `dark` is a TypeScript error and will be silently dropped.

**Use the literal `"#09090B"` for the dark splash background**, not an import from `@mrmeg/expo-ui/constants`. `app.config.ts` runs in Node at config-load time; the `@mrmeg/expo-ui` package resolves to `packages/ui/dist`, which is not always built when `expo prebuild` runs. A literal avoids the build-order coupling. If a future palette change moves `colors.dark.colors.background` away from `#09090B`, update both the token and this literal in the same commit and call it out in the docs spec.

### 2. Add the monochrome adaptive icon

Edit `app.config.ts:138-144`:

```ts
android: {
  adaptiveIcon: {
    foregroundImage: "./assets/images/adaptive-icon.png",
    monochromeImage: "./assets/images/adaptive-icon-monochrome.png",
    backgroundColor: "#ffffff",
  },
  package: identity.androidPackage,
},
```

`backgroundColor` for the foreground variant stays `#ffffff` because the colorful adaptive icon is designed against white; the monochrome path is what's used for themed icons and ignores `backgroundColor`. If a future palette change wants a non-white background for the colorful icon, that is a separate concern.

### 3. Verify prebuild output

After `bunx expo prebuild --clean` (or rerunning the existing native build):

- iOS: `ios/{app}/Images.xcassets/SplashScreenLogo.imageset/` should contain a `Contents.json` with `appearances: [{ "appearance": "luminosity", "value": "dark" }]` entries pointing to the dark image. `ios/{app}/Images.xcassets/SplashScreenBackground.colorset/` should declare both `light` and `dark` color values.
- Android: `android/app/src/main/res/values/colors.xml` and `values-night/colors.xml` should declare the splash background. `android/app/src/main/res/drawable/splashscreen_logo.xml` and `drawable-night/splashscreen_logo.xml` should reference the matching assets.
- Android adaptive icon: `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` should contain a `<monochrome>` child referencing the new asset.

These checks happen in CI via `bun run prebuild:check` if available, otherwise manually during PR review.

### 4. Update CI / EAS build smoke

Run a fresh `eas build --profile preview --platform all` (or local equivalent) to confirm:

- iOS splash assets compile.
- Android themed-icon manifest entries compile and pass the lint that catches missing `monochrome` referenced files.

This is verification, not new infra. If the existing CI already covers this, point to it. If it doesn't, add a TODO to the PR but do not gate the spec on a new CI lane.

### 5. Manual verification guide

Add `Agent/Testing/{task-slug}.md` with `status: pending` in frontmatter per `Agent/Playbooks/VERIFICATION_GUIDE.md`. Cover:

- Cold launch on iOS Simulator with OS dark mode → splash background dark, splash logo visible.
- Cold launch on iOS Simulator with OS light mode → splash background white (unchanged), splash logo visible.
- Cold launch on Android emulator (API 33+) with OS dark mode and themed-icons enabled → launcher icon renders monochrome silhouette tinted by system accent. Adaptive icon background does not show as a white halo.
- Cold launch on Android emulator with OS light mode → launcher icon renders the full-color adaptive icon as today.

## Acceptance Criteria

1. `app.config.ts` declares a `dark` block on the `expo-splash-screen` plugin entry that points to `./assets/images/splash-icon-dark.png` and a dark background.
2. `app.config.ts` declares `monochromeImage` on `android.adaptiveIcon` pointing to `./assets/images/adaptive-icon-monochrome.png`.
3. Both new asset files exist and are 1024×1024 PNGs as specified.
4. Prebuild output contains the platform-specific dark splash and monochrome adaptive icon entries (verified via the Change 3 file checks).
5. iOS Simulator and Android emulator manual cold-launch verification matches the four cases in Change 5; results recorded in the verification artifact.
6. EAS preview build (or local equivalent) succeeds.

## Constraints

- Do not change the light splash image, light splash background, or light adaptive icon foreground. This spec only adds dark/monochrome variants.
- Do not delete the white `backgroundColor` on the colorful adaptive icon. That is the canvas for the colored foreground in non-themed-icon mode.
- Do not import from `@mrmeg/expo-ui/constants` in `app.config.ts`. Use the literal `"#09090B"` directly to avoid coupling `expo prebuild` to the order of `bun run ui:build`.
- Do not nest `imageWidth` or `resizeMode` inside the splash `dark` block. They are root-only properties (inherited).
- Splash logo dimensions (`imageWidth: 200`) must stay identical between light and dark variants so the splash → app frame transition does not visually pop.
- Asset color profiles must be sRGB to avoid the iOS color shift bug that hits HDR-tagged PNGs in `Images.xcassets`.

## Out of Scope

- Designing the new assets (designer task; this spec is blocked until they land).
- Changing the colorful adaptive icon for light mode.
- Web favicon dark variant (browsers handle this via `<link rel="icon" media="(prefers-color-scheme: dark)" ...>`; not in scope here, file as a separate spec if needed).
- Watch / TV / desktop splash variants.

## Files Likely Affected

Native build / config:

- `app.config.ts`

Assets (new):

- `assets/images/splash-icon-dark.png`
- `assets/images/adaptive-icon-monochrome.png`

Prebuild output (regenerated, do not hand-edit):

- `ios/{app}/Images.xcassets/SplashScreenLogo.imageset/`
- `ios/{app}/Images.xcassets/SplashScreenBackground.colorset/`
- `android/app/src/main/res/values/colors.xml`
- `android/app/src/main/res/values-night/colors.xml`
- `android/app/src/main/res/drawable/splashscreen_logo.xml`
- `android/app/src/main/res/drawable-night/splashscreen_logo.xml`
- `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`

Testing:

- `Agent/Testing/{task-slug}.md` (with `status: pending` in frontmatter)

## Edge Cases

- Designer ships only the dark splash and not the monochrome icon (or vice-versa). Spec stays Blocked until both arrive; do not partially land. The verification guide tests both.
- Asset is 1024×1024 but the resized splash logo is too thin for legibility on the dark background. Implementer flags this back to the designer; do not adjust by re-encoding the asset client-side.
- iOS Simulator does not always reflect the splash dark variant on the first launch after install. Test cold launch with the simulator's "Erase All Content and Settings" between scheme toggles.
- Android themed icons require a launcher that supports them (Pixel launcher / API 33+). Test on API 33 emulator; older API levels fall back to the colorful icon and that is correct.
- A user with iOS "Reduce Transparency" or "Increase Contrast" enabled may see different splash rendering. No special handling here, but call this out in the verification artifact.
- The `userInterfaceStyle: "automatic"` setting at `app.config.ts:133` is already correct. Do not change it to `"dark"` (that would force dark on every device, not what we want).

## Risks

- **Asset quality.** A poorly-contrasting dark splash logo defeats the purpose of the change. Designer review is required before merge, not just delivery.
- **iOS color asset format.** Splash configs that use color literals can render slightly differently from configs that use named color assets in `Images.xcassets`. Confirm the dark splash background renders true `#09090B` on a real device before merging.
- **Android themed-icon monochrome design.** Solid silhouettes work; gradient or detailed monochrome assets render poorly. Designer review must confirm the silhouette is suitable.
- **EAS preview build delay.** The first build with new native assets can take 15+ minutes. Schedule accordingly.
- **Drift between splash and app first-frame.** If the dark splash background drifts from `colors.dark.colors.background`, users will see a one-frame color flicker between splash hide and the app's first paint. The implementer should either share a single constant or document the intentional drift.
