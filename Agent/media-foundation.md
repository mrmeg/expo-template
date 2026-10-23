---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Media foundation: optional media peers and shared playback primitives in expo-ui

## Goal

`@mrmeg/expo-ui` gets cross-platform media components (iOS, Android, web including desktop browsers): `Image`
(spec `media-image`), `Video` (`media-video`), `AudioPlayer` (`media-audio`) and `MediaViewer` (`media-viewer`).
This spec lays the shared ground so those four can be built in parallel without fighting over `package.json`, the
version, test mocks, or duplicated helpers:

- `expo-image`, `expo-video` and `expo-audio` become **optional** peers of `@mrmeg/expo-ui`, with the version bump
  that requires.
- Shared primitives: aspect-ratio sizing, time formatting, an overlay-capable icon button, a seek bar, and a web
  keyboard hook.
- Jest mocks for `expo-video` and `expo-audio`, built-in media icons, and the docs skeleton.

No public media component ships here. The follow-ups stack on this branch: `media-image` on foundation, then
`media-video` and `media-audio` on image, then `media-viewer` on video. See each spec's `## Stacking`.

## Context

Verified on `dev` at 54e0bc9.

- **Barrel rule.** `packages/ui/src/index.ts` re-exports `./components`, and `components/index.ts` re-exports every
  component. If a module that imports `expo-video` lands in the barrel, every consumer must install `expo-video`, and
  7 consumer apps import the barrel. So **no media module goes in `components/index.ts`**. Consumers import by
  subpath through the existing `./components/*` wildcard (`@mrmeg/expo-ui/components/Image`), which needs no
  `exports` change. The lint manifest is read from the barrel only (`packages/lint/lib/source.js:316-321`), so
  subpath-only components do not change lint behavior.
- **File placement.** `./components/*` resolves `src/components/*.tsx` only, `./hooks/*` resolves
  `src/hooks/*.ts`, and `lib` has no wildcard. `scripts/__tests__/workspaceSourceCondition.test.ts:106-130` fails
  when a module under a wildcard directory has no matching subpath. That is why `components/bottomSheetDismiss.ts`
  and others carry explicit `exports` entries. So:
  - put pure `.ts` helpers in `src/lib/`, re-exported from `lib/index.ts`;
  - put `.ts` hooks in `src/hooks/`, re-exported from `hooks/index.ts`;
  - put `.tsx` components in `src/components/`.

  None of these need an `exports` change. `packages/ui/src/__tests__/packageSideEffects.test.ts` requires
  module-scope `StyleSheet.create` and `createThemedStyles` calls to carry `/*#__PURE__*/`, as in
  `Avatar.tsx:438,515`.
- **Peers.** `packages/ui/package.json` has no `peerDependenciesMeta` today. All three media peers must be optional so
  apps that never import media keep installing nothing new. Adding `peerDependencies`/`peerDependenciesMeta` needs a
  version bump (`AGENTS.md`; gate `bun run packages:drift-check`, `scripts/check-package-publish-drift.mjs`). npm has
  `@mrmeg/expo-ui@0.29.1`. Drafts #157/#159/#160 may already bump `dev` to an unreleased 0.29.2 or 0.30.0.
- **Peer gates.**
  - `scripts/check-package-peer-compatibility.mjs` asserts every runtime import in `packages/ui/src` is declared, and
    that each profile version in `scripts/package-compatibility-profiles.mjs` (`ui:` Expo 56/57/58) satisfies the
    peer range.
  - The ui consumer smoke (`scripts/check-package-consumer.mjs` ~551-560) installs every `peerDependencies` entry
    into its fixture, so the new peers get installed there too.
- **Installed versions.** Root `package.json` has `expo-image ~58.0.14` and `expo-video ~58.0.10`. `expo-audio` is
  **not installed**; npm `latest` is 58.0.10.
  - Media profile versions already used for `expo-video`: 56.1.4 / 57.0.0 / 58.0.1
    (`scripts/package-compatibility-profiles.mjs:11,25,39,53`).
  - For the other two, read `npm view expo-image dist-tags` and `npm view expo-audio dist-tags` (`sdk-56`, `sdk-57`,
    `latest`).
- **Forbidden imports.** `scripts/check-ui-forbidden-imports.mjs` bans `react-native-reanimated` and
  `react-native-worklets` (also Lucide and vector-icon runtimes) anywhere in `packages/ui`. Gestures here use RN
  `PanResponder` + `Animated`, as `Drawer.tsx:542` does.
- **Why not `Slider` for seeking.** `Slider.tsx` wraps `@expo/ui/community/slider`, whose props expose only
  `onValueChange` (`node_modules/@expo/ui/build/community/slider/types.d.ts:69`). There are no sliding-start or
  sliding-end events, so a playing video's position updates would fight the thumb mid-drag.
- **Icons.** The package's built-in glyphs come from `packages/ui/src/components/icon-names.json`
  (`check, chevron-down, chevron-right, chevron-up, circle-alert, …, x`). `bun run ui:icons` regenerates
  `iconBuiltins.generated.ts`. There are no play, pause, volume, or maximize glyphs.
- **i18n.** Default strings go through `translateText(key, fallback)` (`lib/i18n.ts`). Keys are namespaced like
  `notification.loading` (`Notification.tsx:232`).
- **Tests.** `test/setup.ts` handles expo-image's `expo-observe` import (lines 9-21) and mocks
  `react-native-gesture-handler`. There are no `expo-video` or `expo-audio` mocks. `jest.config.js` maps `@/` to the
  repo root. Web-only tests import `./forceWebPlatform` first
  (`packages/ui/src/components/__tests__/forceWebPlatform.ts`).
- **Hit areas.** `lib/webHitTarget.tsx` has `verticalSlopFor(h)` and `getWebHitInsets`, the kit's 44 pt hit-area
  helpers.
- **Collisions.** Drafts #156–#161 edit `packages/ui/CHANGELOG.md` and `packages/ui/LLM_USAGE.md`, and #156 edits the
  icon generators. Rebase onto current `dev` before opening the PR, keep CHANGELOG entries under `## [Unreleased]`,
  and rerun `bun run gen` after the rebase.

## Work

1. **Peers and version.**
   - In `packages/ui/package.json`, add `expo-image`, `expo-video` and `expo-audio` to `peerDependencies`, each
     `">=56.0.0 <59.0.0 || >=58.0.0-0 <59.0.0"` to match the existing Expo peers. Mark all three
     `peerDependenciesMeta.{name}.optional: true`.
   - Version: if `dev`'s ui version is on npm, bump to the next minor. If it is already an unreleased bump, make sure
     it is at least one minor above 0.29.1 (new API).
2. **Root install.** Check `git status` first; per the vault note, never `bun install` over another thread's
   uncommitted dependency changes. Then run `bunx expo install expo-audio` so the version is SDK-pinned (expect
   `~58.0.10`) and commit `package.json` plus `bun.lock`. Add no `expo-audio` config plugin; background audio stays an
   app concern.
3. **Compatibility gates.**
   - Add `expo-image`, `expo-video` and `expo-audio` versions to all three `ui` profiles in
     `scripts/package-compatibility-profiles.mjs`.
   - In `scripts/check-package-peer-compatibility.mjs`, assert that ui's `expo-image`, `expo-video` and `expo-audio`
     peers are optional, with a message saying why (barrel consumers must not need media).
4. **`packages/ui/src/lib/mediaFrame.ts`** (new, pure, no media imports; re-export from `lib/index.ts`):
   - `export type MediaAspectRatio = number | \`${number}:${number}\` | { width: number; height: number }`.
   - `parseAspectRatio(value): number | undefined` returns `undefined` for non-finite, ≤ 0, or malformed input.
   - `mediaFrameStyle({ aspectRatio, maxWidth, maxHeight, fill }): ViewStyle`:
     - `fill` returns `StyleSheet.absoluteFill`-equivalent values.
     - Otherwise `{ width: "100%", aspectRatio: r, alignSelf: "center" }`, plus `maxWidth: min(maxWidth, maxHeight * r)`
       when `maxHeight` is set.
     - This keeps a portrait clip in a wide desktop column from growing taller than `maxHeight`. It is centered
       rather than letterboxed in a full-width box. It is pure style, so the server HTML already has the final box.
   - `useMediaAspectRatio(explicit: MediaAspectRatio | "auto" | undefined, fallback: number)` returns
     `{ ratio, reportNaturalSize(width, height) }`:
     - an explicit ratio wins;
     - `"auto"` starts at `fallback` and switches to the reported natural size once (ignore 0/NaN);
     - `undefined` means "caller sizes via style" (`ratio: undefined`).
5. **`packages/ui/src/lib/mediaTime.ts`** (new; re-export from `lib/index.ts`): `formatMediaTime(seconds, referenceDuration?)` returns
   `m:ss`, or `h:mm:ss` when the value or the reference is ≥ 1 h, so elapsed and total share a width. Negative or
   NaN input returns `--:--`, and `Infinity` returns `translateText("media.live", "Live")`. Also export
   `mediaTimeA11y(current, duration)`, which returns `"1 minute 2 seconds of 3 minutes 45 seconds"` for
   `accessibilityValue.text` (route words through `translateText`).
6. **`packages/ui/src/components/MediaControlButton.tsx`** (new, subpath-exported, documented as the media building
   block):
   - Props:
     - `icon: IconName`;
     - `accessibilityLabel: string` (required by type; dev `console.warn` once if empty, following `Toggle.tsx:196-210`);
     - `onPress`;
     - `tone: "overlay" | "default"` (default `"default"`);
     - `size: "sm" | "md" | "lg"` with glyph 16/20/28 and visual diameter 32/40/56;
     - `selected?`, which sets `accessibilityState.selected` (for mute toggles);
     - `disabled?`, `testID`, `style`.
   - The hit area is at least 44 pt on every platform: native `hitSlop` and web insets via `lib/webHitTarget.tsx`.
   - `overlay` draws the glyph in `palette.white` on a `withAlpha(palette.black, 0.45)` circle, readable over any
     frame. `default` follows the theme: foreground glyph, transparent background, and `theme.colors.muted` when
     pressed.
   - Role is `button`. The web focus ring matches other pressables.
   - Note in its JSDoc that it mirrors `IconButton` (#160) and can delegate to it once that ships with an overlay
     tone.
7. **`packages/ui/src/components/MediaScrubber.tsx`** (new, subpath-exported):
   - Props:
     - `value` and `duration` (seconds), plus `buffered?` (seconds);
     - `onScrubStart`, `onScrubChange(seconds)` and `onScrubEnd(seconds)`;
     - `step` (default 5 s);
     - `tone: "overlay" | "default"`;
     - `disabled?` and `accessibilityLabel` (default `translateText("media.seek", "Seek")`).
   - Drawing: a track, a buffered fill, a progress fill and a thumb. The thumb grows while dragging. Use theme colors
     in `default` and white or translucent white in `overlay`.
   - Interaction: `PanResponder` on a ≥ 44 pt tall touch area. A tap seeks to that point. While dragging, the thumb
     follows the finger and ignores `value` until release. Width comes from `onLayout`. Works with mouse drag on web.
   - Accessibility: `accessibilityRole="adjustable"`, `accessibilityValue` with min, max, now and `mediaTimeA11y` text,
     and `accessibilityActions` increment and decrement by `step`, each reporting `onScrubEnd`.
   - Web keyboard when focused: ←/→ = ±`step`, Home/End.
   - With `duration` 0, NaN or Infinity (live), render the track disabled.
8. **`packages/ui/src/hooks/useMediaKeyboard.ts`** (new; re-export from `hooks/index.ts`):
   - `useMediaKeyboard(handlers: Partial<Record<"togglePlay" | "seekBack" | "seekForward" | "volumeUp" | "volumeDown" | "toggleMute" | "toggleFullscreen" | "escape" | "previous" | "next" | "zoomIn" | "zoomOut" | "zoomReset", () => void>)`
     returns props to spread on a focusable container: `{ focusable: true, onKeyDown }` on web and `{}` on native.
   - Key map:
     - Space and `k` → `togglePlay`;
     - ←/→ → `seekBack`/`seekForward`, falling back to `previous`/`next` when no seek handler is given;
     - ↑/↓ → volume;
     - `m`, `f` and Esc;
     - `+`, `=`, `-` and `0` → zoom.
   - Call `preventDefault` only for handled keys. Scope is the focused container only, never `window`, so a page
     with two players or a text field is never hijacked. Ignore events whose target is an input or textarea.
9. **Built-in icons.** Add `play`, `pause`, `volume-2`, `volume-x`, `maximize`, `minimize`, `rotate-ccw`,
   `chevron-left` and `image-off` to `packages/ui/src/components/icon-names.json` (canonical Lucide names only, see
   the vault quirk on aliases). Then run `bun run ui:icons`.
10. **Test mocks.**
    - Add `test/mocks/expoVideo.ts` with:
      - `useVideoPlayer(source, setup)`, which returns a stable fake player. It has `play`, `pause`, `replay`,
        `seekBy` and `replaceAsync` as `jest.fn()`; mutable `currentTime`, `duration`, `muted`, `volume`, `loop`,
        `playing`, `status`, `videoTrack` and `timeUpdateEventInterval`; an `emit(event, payload)` test helper; and
        `addListener` returning `{ remove }`. It calls `setup(player)`.
      - `VideoView`, a forwardRef `View` exposing `enterFullscreen`, `exitFullscreen` and
        `startPictureInPicture` as `jest.fn()`.
    - Add `test/mocks/expoAudio.ts` with `useAudioPlayer` (a fake player: `play`, `pause`, `seekTo`, `replace`,
      `setPlaybackRate`, `muted`, `volume`, `loop`) and `useAudioPlayerStatus(player)`, which returns
      `player.__status` and re-renders on `emit("playbackStatusUpdate", …)`.
    - Tests opt in per file with `jest.mock("expo-video", () => require("@/test/mocks/expoVideo"))`. Do **not**
      mock globally in `test/setup.ts`, so existing app tests keep their behavior. Each mock file starts with a
      comment block explaining this.
    - If `useEvent` from `expo` is used with these fakes, make the fake player implement whatever `useEvent` needs
      (`addListener`).
11. **Tests:**
    - `lib/__tests__/mediaFrame.test.ts`: parsing, `maxHeight` clamping math, and the auto ratio switching once.
    - `lib/__tests__/mediaTime.test.ts`: boundaries at 59 s, 1 h, NaN and Infinity.
    - `components/__tests__/MediaControlButton.test.tsx`: role, label, `selected` state, the dev warning, and a hit
      slop of at least 44.
    - `components/__tests__/MediaScrubber.test.tsx`: accessibility actions call `onScrubEnd` with clamped values.
      Drag via `fireEvent(responder, "responderMove", …)` or by calling the pan handlers directly, whichever matches
      how `Drawer.test.tsx` tests `PanResponder`.
    - `hooks/__tests__/useMediaKeyboard.web.test.tsx` (import `../../components/__tests__/forceWebPlatform` first):
      handled keys call handlers and `preventDefault`; unhandled keys and inputs pass through.
    - `__tests__/mediaPeers.test.ts`: starting at `src/index.ts`, follow relative imports with the TypeScript parser,
      as `packageSideEffects.test.ts` does. Fail if any reachable file imports `expo-image`, `expo-video` or
      `expo-audio`. This test is the guard that keeps barrel consumers peer-free.
12. **Docs.**
    - `packages/ui/LLM_USAGE.md`: add a `## Media` section that states:
      - media components are subpath-only (`components/Image`, `components/Video`, `components/AudioPlayer`,
        `components/MediaViewer`), never the barrel;
      - the optional peers each needs;
      - for custom media UI: `components/MediaControlButton` and `components/MediaScrubber`, `useMediaKeyboard`
        from `hooks`, and `formatMediaTime`/`mediaFrameStyle`/`useMediaAspectRatio` from `lib`.
      Leave one stub line per component that its spec fills in.
    - `packages/ui/README.md` Install: one paragraph on the optional media peers.
    - `packages/ui/CHANGELOG.md` `## [Unreleased]`: an Added entry (the peers and primitives).
    - Run `bun run gen` (icons, then `docs:llms`).

## Merge plan

Process the five specs in one shift in this order: `media-foundation` → `media-image` → `media-video` and
`media-audio` (either order) → `media-viewer`. Each is its own draft PR, stacked on its parent's branch. A follow-up
whose parent branch does not exist yet is skipped for that pass, not marked `blocked`. Alphabetical order would put
`media-audio` first, so follow this order instead. Merge into `dev` in the same order, retargeting each child PR to
`dev` after its parent merges.

`expo-audio` adds native code. A dev client built before this branch throws a missing-native-module error when
`AudioPlayer` mounts. Native checks in every follow-up need a fresh build: `expo run:ios --no-bundler`, then
`expo start --dev-client`.

## Exclusions

No `Image`, `Video`, `AudioPlayer` or `MediaViewer` component, no showcase entry, no app dogfooding: those are the
four follow-up specs. No native desktop target. Research on 2026-10-23 found that Expo SDK 58 has no macOS support
and none of the three modules has macOS or Windows native code. A desktop shell would wrap the web build, which these
components already serve.

## Validation

- `bun run pkg ui typecheck`, `bun run pkg ui test` (includes the forbidden-imports check).
- `node scripts/check-package-peer-compatibility.mjs`, `bun run packages:drift-check`, `bun run ui:consumer-smoke`.
- `bun run gen --check`, `bun run docs:versions:check`.
- `bun run verify`. Report its gate list output.
- `mediaPeers.test.ts` passes and fails when you temporarily add `export * from "./Image"`-style re-exports of a
  file that imports `expo-video` (check, then revert).
