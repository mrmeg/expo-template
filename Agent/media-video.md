---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Video: an expo-video component with native, custom, or no controls

## Goal

Ship `Video` at `@mrmeg/expo-ui/components/Video`, built on `expo-video`, for iOS, Android, and web (desktop and
mobile browsers):

- it sizes from the video's real aspect ratio, or from an explicit one, at any container size;
- `controls="native" | "custom" | "none"` switches between platform controls, themed design-system controls that look
  the same everywhere, or bare playback;
- desktop browsers get hover-revealed controls and keyboard shortcuts.

## Stacking

Stacks on spec `media-image` (which sits on `media-lab` and `media-foundation`), because the poster uses `Image`.
Branch `agent/media-video` from `agent/media-image` and open the draft PR against `agent/media-image`; retarget as the
parents merge. If `agent/media-image` does not exist, skip for this pass with the unblock step "implement media-image
first". Do not mark it blocked. `media-viewer` stacks on this branch.

## Context

Verified on `dev` at df1a06a (2026-10-23), expo-video 58.0.10.

- From `media-foundation`:
  - `mediaFrameStyle` / `useMediaAspectRatio` (`lib/mediaFrame.ts`);
  - `formatMediaTime` / `mediaTimeA11y` (`lib/mediaTime.ts`);
  - `MediaControlButton` (overlay-only), `MediaScrubber` and `useMediaKeyboard`;
  - built-in `play`, `pause`, `volume-2`, `volume-x`, `maximize`, `minimize`, `rotate-ccw`, `captions` icons;
  - the `test/mocks/expoVideo.ts` fake.
  - Subpath-only: never add `Video` to `components/index.ts`. Module-scope styles carry `/*#__PURE__*/`
    (`packageSideEffects.test.ts`).
- From `media-lab`:
  - the core `assets/media/landscape.mp4`, `portrait.mp4` and `landscape.jpg` (as a poster);
  - `MEDIA_FIXTURES` and `resolveFixtureUri`;
  - the generator;
  - the Media Lab `renderers.video` slot with playground state (controls, fit, autoplay+muted, loop, poster).
- From `media-image`: `Image` for the poster.
- expo-video API (`node_modules/expo-video/build/`):
  - `VideoContentFit = 'contain' | 'cover' | 'fill'` (`VideoView.types.d.ts:9`). This is narrower than `ImageFit`,
    so `Video` gets its own `VideoFit` type.
  - Native controls are always on in fullscreen (`VideoView.types.d.ts:27`). On Android the JS runtime pauses in
    native fullscreen (`VideoView.d.ts:27`).
  - `VideoView` methods: `enterFullscreen`, `exitFullscreen`, `startPictureInPicture` (`VideoView.d.ts:23-59`).
  - Props: `allowsPictureInPicture`, `playsInline` (web), `fullscreenOptions`, `onFullscreenEnter`/`Exit`.
  - Player events (`VideoPlayerEvents.types.d.ts`): `statusChange` (`idle|loading|readyToPlay|error`),
    `playingChange`, `mutedChange`, `playToEnd`, `timeUpdate` (needs `player.timeUpdateEventInterval > 0`),
    `sourceLoad` (with `duration`), and `videoTrackChange` (`videoTrack.size` gives the natural width and height for
    the auto aspect ratio).
  - `useEvent(player, name, initial)` from `expo` re-renders on an event (used in
    `client/features/media/components/VideoPlayer.tsx:79`).
- PiP needs the config plugin. The template sets `expo-video` with `supportsPictureInPicture: true` in
  `app.config.ts:59-62`. Consumer apps may not, so document it.
- **SSR.** `useVideoPlayer` (`VideoPlayer.web.js:4-30`) builds `new VideoPlayerWeb(source)` during render, on the
  server too. Its constructor touches no DOM, but the class extends `globalThis.expo.SharedObject`, and no
  server-rendered route mounts a player today (the media tab mounts `VideoPlayer` only on tap). `VideoView.web.js`
  guards `window`/`document` access. Verify a server render of a route containing `<Video>`. If it throws, or the
  server and client markup differ, render the poster frame (or a muted frame) until `useHydrated()`
  (`hooks/useHydrated.ts`) and mount the player after.
- HLS: expo-video web sets `<video src>` directly and has no hls.js. `.m3u8` plays natively on Safari only. Document
  this and do not add hls.js.
- Tracks and live (`VideoPlayer.types.d.ts`):
  - `isLive` (line 109) and `bufferedPosition` (140);
  - `subtitleTrack`, which is settable, takes an entry from `availableSubtitleTracks` or `null` (152-158, 180);
  - `audioTrack` and `availableAudioTracks` (166, 173);
  - events `availableSubtitleTracksChange` and `subtitleTrackChange`.
- `VideoTrack.size` (line 565) carries no rotation field. Whether it reports pre- or post-rotation dimensions for a
  file flagged with a 90° display rotation is unverified; the `media-lab` rotation fixture decides it.
- Existing app player: `client/features/media/components/VideoPlayer.tsx`, a full-screen modal with hand-rolled
  loading and error overlays. `media-viewer` deletes it later. Here, swap only its inner `VideoView` and overlays for
  `<Video>` (see Work 4).
- The design-system `StatusBar` follows the theme. The existing modal disables `expo-ui/no-raw-primitives` for a
  forced-light bar (`VideoPlayer.tsx:25-26`).

## Work

1. **`packages/ui/src/components/Video.tsx`** (new):

   ```ts
   export type VideoFit = "contain" | "cover" | "fill";
   export type VideoControls = "native" | "custom" | "none";
   export interface VideoProps {
     source?: VideoSource;               // ignored when `player` is given
     player?: VideoPlayer;               // bring your own useVideoPlayer() for programmatic control
     controls?: VideoControls;           // default "native"
     fit?: VideoFit;                     // default "contain"
     aspectRatio?: MediaAspectRatio | "auto"; // default "auto", fallback 16:9 until videoTrack.size arrives
     maxWidth?: number; maxHeight?: number; fill?: boolean;
     radius?: ImageRadius;               // reuse the Image radius tokens
     poster?: ImageSource | string;      // shown until the first play, then hidden
     autoPlay?: boolean;                 // default false; autoplay on web requires muted (document)
     loop?: boolean; muted?: boolean;    // initial values applied in the player setup
     allowsFullscreen?: boolean;         // default true
     allowsPictureInPicture?: boolean;   // default true on native and web
     title?: string;                     // accessibility label base + error text
     accessibilityLabel?: string;
     onStatusChange?(status: VideoPlayerStatus): void;
     onPlayingChange?(playing: boolean): void;
     onEnd?(): void;
     onError?(message: string): void;
     style?: StyleProp<ViewStyle>; testID?: string;
   }
   ```

   - **Frame.** Same sizing modes as `Image`, via `mediaFrameStyle`. The background is `palette.black`. `VideoView`
     absolutely fills the frame with `contentFit={fit}`. Report `videoTrack.size` from `videoTrackChange` (and the
     initial `player.videoTrack`) to `reportNaturalSize`.
   - **Player.** Create the player with `useVideoPlayer(source, setup)` when `player` is absent; `setup` applies
     `loop`, `muted`, `timeUpdateEventInterval = 0.25` (custom controls only), and `autoPlay`. A changed `source`
     uses expo-video's own replace path. Never call methods on a released player.
   - **States.**
     - `loading`: a centered `ActivityIndicator` (white) over the poster or black.
     - `error`: a muted message `translateText("media.videoError", "Video failed to load")` plus a retry
       `MediaControlButton` (`rotate-ccw`) that calls `player.replaceAsync(source)`, and `onError`.
     - `playToEnd`: show a replay affordance in custom mode and call `onEnd`.
   - **`controls="native"`.** Set `nativeControls`, `fullscreenOptions={{ enable: allowsFullscreen }}` and
     `allowsPictureInPicture`. No overlay chrome except the loading and error states.
   - **`controls="none"`.** Set `nativeControls={false}`. No chrome, and no tap handling beyond state overlays.
   - **`controls="custom"`.**
     - Layout:
       - a center play/pause `MediaControlButton` (`size="lg"`, overlay);
       - a bottom bar on a `withAlpha(palette.black, 0.45)` gradient-free scrim, inset by safe area only in
         fullscreen, containing play/pause, the `MediaScrubber` (`tone="overlay"`, value from `timeUpdate`,
         `buffered` from `bufferedPosition` when available), the `formatMediaTime(current, duration) /
         formatMediaTime(duration)` text in `palette.white` with tabular numbers, mute (`volume-2`/`volume-x`,
         `selected` when muted), captions (`captions`, only when `availableSubtitleTracks.length > 0`, `selected` when
         a track is on), and fullscreen (`maximize`/`minimize`) when `allowsFullscreen`.
     - Captions: the toggle sets `subtitleTrack` to the track matching the device language (fall back to the first
       track), or to `null`. The labels are `media.captionsOn` and `media.captionsOff`. Choosing among several subtitle
       tracks, and choosing audio tracks, is excluded from custom mode; the docs point to `controls="native"` for
       both.
       - Verify on each tested surface that the selected track renders while native controls are off.
       - If a platform does not render it, hide the toggle there and record that in the Media Lab `observed` notes.
     - Live (`isLive` or `duration === Infinity`): the scrubber is disabled, and the time text reads `Live` through
       `formatMediaTime`.
     - No video track (an audio-only file): keep the fallback ratio, show the poster or black, and keep the controls
       working.
     - Scrubbing: `onScrubStart` remembers whether the video was playing and pauses. `onScrubEnd` sets
       `player.currentTime` and resumes if it was playing.
     - Visibility: chrome shows on mount, when paused, on focus, on hover (web `onHoverIn`/`onHoverOut` on the frame),
       and on a tap of the frame. It hides 3 s after the last interaction while playing. Use a fade with RN
       `Animated`, skipped under `useReducedMotion()`. Hidden chrome is
       `importantForAccessibility="no-hide-descendants"`, but a screen reader focus or the native `magicTap` brings it
       back. With a screen reader on (`AccessibilityInfo.isScreenReaderEnabled`), never auto-hide.
     - Fullscreen, given the forced native controls:
       - Web: call `requestFullscreen()` on the frame's DOM node (an RNW `View` ref is the element) so custom chrome
         stays. Track `fullscreenchange`, and let Esc exit.
       - Native: present an RN `Modal` (`presentationStyle="fullScreen"`, black, `statusBarTranslucent`, light status
         bar) containing a full-window frame with the same player and chrome. Unmount the inline `VideoView` while the
         modal is open so the player is attached to one view at a time. Close on the `minimize` button or Android
         back.
     - Keyboard (web, via `useMediaKeyboard` on the frame, `focusable`):
       - Space/K play-pause;
       - ←/→ ±5 s;
       - ↑/↓ volume ±0.1;
       - M mute;
       - F fullscreen;
       - Esc exits fullscreen.
     - Native accessibility:
       - The frame is `accessible` with label `title ?? accessibilityLabel ?? "Video"`;
       - `accessibilityActions` are `activate` (play/pause), `magicTap` (play/pause) and `increment`/`decrement`
         (±10 s);
       - `accessibilityValue.text` comes from `mediaTimeA11y`.
     - Labels come from `translateText`: `media.play`, `media.pause`, `media.mute`, `media.unmute`,
       `media.enterFullscreen`, `media.exitFullscreen`, `media.replay`, `media.retry`.
   - **Poster.** `Image` with `fill`, `fit={fit === "fill" ? "fill" : fit}` and `alt=""`. Show it until the first
     `playingChange(true)`, then remove it.
   - **Lifecycle.** Pause on unmount (when the caller owns `player`, pause only, never release). Document that pausing
     on screen blur is the app's job, using expo-router `useIsFocused`, because the kit has no router.
2. **Tests** (`Video.test.tsx`, `Video.web.test.tsx`), using
   `jest.mock("expo-video", () => require("@/test/mocks/expoVideo"))`:
   - Each `controls` mode renders the right chrome and sets `nativeControls`.
   - `videoTrackChange` switches the auto aspect ratio.
   - Loading and error overlays, and retry calls `replaceAsync`.
   - Scrub start pauses and scrub end seeks then resumes.
   - Chrome auto-hides after 3 s with fake timers, and never auto-hides with a screen reader on.
   - Web keyboard: Space toggles, arrows seek, F calls `requestFullscreen` (stub it).
   - Native fullscreen opens the `Modal` and unmounts the inline view.
   - An external `player` is not released on unmount.
3. **Media Lab.** Implement `renderers.video` in `MediaLabScreen.tsx`.
   - Render every `kind: "video"` fixture through `Video`, driven by the playground state.
   - Mount at most one playing player at a time. A tile shows its poster or a play glyph until tapped, so a grid of
     30 fixtures does not create 30 players.
   - Run `bun run media:fixtures`. Then, on each surface you test, go through **every** video fixture in each
     controls mode. Pay particular attention to:
     - the rotation-flagged clip: it must display portrait, with the auto aspect ratio portrait too. If
       `videoTrack.size` is pre-rotation, fix it here or document it;
     - the 1 h 05 m clip, which shows `h:mm:ss` and allows far seeks;
     - the 2 s loop;
     - no audio track, where mute does nothing harmful;
     - the audio-only `.mp4`;
     - HEVC and 10-bit HEVC, VP9 WebM, AV1 MP4/WebM, `.mov`, 60 fps and 4K;
     - non-faststart, where the loading state stays visible until playable;
     - fragmented MP4;
     - the remote HLS streams: Apple TS with alternate audio and CC, Apple HEVC, Mux long VOD, and Mux with WebVTT
       subtitles, where the captions toggle appears and works;
     - DASH;
     - both live HLS streams, which show `Live` with the scrubber disabled;
     - the broken files.
   - Record what you saw in `observed`, and leave untested surfaces unset. Never fill a surface from memory. Every
     `expectError` fixture must reach the error state, with retry and no crash.
   - Fix failures that should work here. List platform gaps in the PR with evidence and in the `LLM_USAGE.md` entry.
4. **Showcase and dogfood.**
   - Register `{ id: "Video", importPath: "@mrmeg/expo-ui/components/Video", category: "media" }`.
   - Preview:
     - the core `landscape.mp4` with `controls="custom"` and `landscape.jpg` as its poster;
     - the same with `"native"`;
     - the core `portrait.mp4` with `maxHeight={320}` (centered, not stretched);
     - `fit="cover"` in a 1:1 frame;
     - a broken URI showing the error state.
   - Keep previews behind the lazy gallery (`gallerySplitPoint.test.ts`).
   - In `client/features/media/components/VideoPlayer.tsx`, replace the `VideoView`, the `useVideoPlayer` call and
     the hand-rolled loading and error overlays with `<Video source={{ uri }} controls="native" fill autoPlay />`.
     Keep the modal, header and close button. `media-viewer` replaces the whole file later.
5. **Docs.**
   - Fill `Video` in `LLM_USAGE.md` `## Media`:
     - choosing a controls mode;
     - fullscreen behavior per mode;
     - PiP config plugin requirement;
     - autoplay needs `muted` on web;
     - HLS is Safari-only on web;
     - captions in custom mode cover the one-track toggle only; use `native` controls to pick among tracks or audio
       tracks;
     - the codec and container results recorded in the Media Lab, summarized as a short support table that cites
       what was observed;
     - pause on blur is app-owned;
     - prefer an explicit `aspectRatio` when known.
   - Add a CHANGELOG `## [Unreleased]` Added entry.
   - Run `bun run docs:llms`.

## Validation

- `bun run pkg ui typecheck`, `bun run pkg ui test`, `bun run typecheck`, `bun run test`, `bun run lint`,
  `bun lint:ui --changed`, `bun run gen --check`.
- `bun run build && bun run bundle-size`. `expo-video` must not enter the eager entry chunk: check that the
  `/(main)/(tabs)` index route's HTML `<script>` set does not grow.
- Browser, against `bun run build && bun run start`:
  - The gallery Video preview server-renders without errors (check the server log and the browser console for
    hydration warnings).
  - Custom controls: hover shows and leaves hide after 3 s; scrubbing with the mouse is smooth and does not jump
    back.
  - Keyboard shortcuts work on the focused player and not when focus is elsewhere.
  - F gives true fullscreen with custom chrome, and Esc exits.
  - Native mode shows the browser controls.
  - The portrait clip is centered at `maxHeight`, and the frame rescales from 1280 to 375 px.
  - Media Lab, Video section: every fixture in each controls mode in Chrome, plus Safari and Firefox if available.
    Paste the observed table into the PR.
  - Report screenshots.
- iOS simulator (run skill) if available:
  - custom chrome tap and auto-hide;
  - scrubber drag;
  - the custom fullscreen modal;
  - native mode with PiP;
  - the media tab video plays;
  - the Media Lab Video section: rotation, HLS with captions, live, the codec set, and the broken files.

  Android and VoiceOver/TalkBack go in the PR's manual checks.
