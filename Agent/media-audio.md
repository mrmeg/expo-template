---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# AudioPlayer: a themed expo-audio player for iOS, Android, and web

## Goal

Ship `AudioPlayer` at `@mrmeg/expo-ui/components/AudioPlayer`, built on `expo-audio`. It is a themed, flat player
with the same controls and keyboard behavior on iOS, Android, and web, including desktop browsers. It has two
layouts: `compact` (one row, for voice notes and attachments) and `full` (artwork, title, scrubber, times, and
speed, for episodes and tracks).

## Stacking

Stacks on spec `media-image`, which provides `Image` for artwork. Branch `agent/media-audio` from
`agent/media-image` and open the draft PR against `agent/media-image`. Retarget the PR as the parents merge. If
`agent/media-image` does not exist, skip with the unblock step "implement media-image first". This spec is
independent of `media-video`. Both add showcase entries, so rebase over whichever lands first. Process it after
`media-image` in the same shift (see `media-foundation` `## Merge plan`). Do not mark it `blocked` for a missing
parent; skip it for that pass.

## Context

Verified on `dev` at 54e0bc9, with the expo-audio 58.0.10 tarball inspected. `media-foundation` installs the package.
Read its `build/*.d.ts` there.

- **From `media-foundation`:**
  - `formatMediaTime` / `mediaTimeA11y`.
  - `MediaControlButton` (`tone="default"`), `MediaScrubber` (`tone="default"`), `useMediaKeyboard`.
  - The `play`, `pause`, `volume-2`, `volume-x` icons.
  - The `test/mocks/expoAudio.ts` fake.
  - Subpath-only: never add the component to `components/index.ts`.
  - Module-scope styles carry `/*#__PURE__*/` (`packageSideEffects.test.ts`).
- **From `media-image`:** `Image` with `radius`.
- **expo-audio API:**
  - `useAudioPlayer(source?, { updateInterval?, downloadFirst?, crossOrigin? })` returns `AudioPlayer`.
  - `useAudioPlayerStatus(player)` returns `AudioStatus` with `currentTime`, `duration` (0 until known), `playing`,
    `isBuffering`, `isLoaded`, `didJustFinish`, `playbackRate`, `mute`, `loop` (`Audio.types.d.ts:201-230`).
  - Player methods: `play()`, `pause()`, `replace(source)`, `seekTo(seconds)` (returns a Promise),
    `setPlaybackRate(rate, pitchCorrectionQuality?)` (`AudioModule.types.d.ts:135-157`), and
    `setActiveForLockScreen(active, metadata?, options?)` (line 174).
  - `setAudioModeAsync({ playsInSilentMode, interruptionMode, … })` is process-global (`Audio.types.d.ts:569-594`).
- **SSR blocker.** expo-audio's web `AudioPlayer` constructor calls `this._createMediaElement()`, which runs
  `new Audio(...)` (`build/AudioPlayer.web.js:11-17, 256`). `Audio` does not exist on the server, so calling
  `useAudioPlayer` during a server render throws. The component must not create a player until `useHydrated()`
  (`packages/ui/src/hooks/useHydrated.ts`) is true on web. Native has no hydration pass, so it mounts immediately.
  The import itself was not checked for module-scope `window`/`navigator` access (for example in the media-session
  controller). If the server log shows the import failing rather than the hook, the gate must be a lazy `import()` of
  the live player module, loaded after hydration, not `useHydrated` alone.
- **Native build.** `expo-audio` is native code new in `media-foundation`. Native checks need a dev client rebuilt
  from this branch (`expo run:ios --no-bundler`, then `expo start --dev-client`).
- **Screen rules** (`packages/ui/LLM_USAGE.md#screen-layout`, `AGENTS.md`): flat, no bordered or tinted panel as
  layout. The player draws no container chrome. A caller can put it in a `Card` (one item in a collection) or an
  `Item` row.
- **Global audio session.** iOS plays nothing while the silent switch is on unless `playsInSilentMode` is set.
  Background playback needs the `expo-audio` config plugin and `shouldPlayInBackground`. Both are app-wide decisions,
  so the component must not call `setAudioModeAsync`. Document them instead.

## Work

1. **`packages/ui/src/components/AudioPlayer.tsx`** (new):

   ```ts
   export interface AudioPlayerProps {
     source?: AudioSource | string | number | null; // ignored when `player` is given
     player?: AudioPlayer;                // bring your own useAudioPlayer()
     variant?: "compact" | "full";        // default "compact"
     title?: string;                      // full: shown; both: accessibility labels
     subtitle?: string;                   // full only
     artwork?: ImageSource | string;      // full only, 56 pt Image radius "md"
     showSpeed?: boolean;                 // full only, default true; cycles 1 → 1.25 → 1.5 → 2 → 0.75 → 1
     showMute?: boolean;                  // default false
     autoPlay?: boolean;                  // default false
     loop?: boolean;
     lockScreen?: boolean;                // default false; when true and playing, setActiveForLockScreen(true, { title, artist: subtitle, artworkUrl })
     onPlayingChange?(playing: boolean): void;
     onEnd?(): void;
     onError?(message: string): void;
     style?: StyleProp<ViewStyle>; testID?: string;
   }
   ```

   - **Structure.** Use an outer shell that renders the static layout. Its inner `AudioPlayerLive` calls
     `useAudioPlayer`/`useAudioPlayerStatus` and mounts only when hydrated, or immediately on native and when a
     `player` is passed.
     - Before mount, the shell shows the same layout with a disabled play button and `--:--`, so the server HTML and
       the first client frame match and nothing shifts.
   - **Compact layout.** A single row:
     - play/pause `MediaControlButton` `size="md"`;
     - a `MediaScrubber` with `flex: 1`;
     - the elapsed time, or the total when idle, in `mutedForeground` with tabular numbers;
     - an optional mute button.
     - Height is 44 pt, and the row uses `spacing` tokens only.
   - **Full layout:**
     - a header row with artwork (if any), then title (`StyledText` semibold, one line) over subtitle
       (`mutedForeground`, one line), then the play/pause button `size="lg"`;
     - the scrubber at full width;
     - a time row with elapsed on the left, `-remaining` on the right, and between them a speed text button
       (`Button` ghost `sm`, label `1×`/`1.25×`…) plus mute.
   - **States.**
     - While `isBuffering` or not yet `isLoaded` after `play`, the play button shows an `ActivityIndicator` at the
       same size, labelled `translateText("media.loading", "Loading")`.
     - A load error or a missing source disables the controls and shows
       `translateText("media.audioError", "Audio unavailable")` in place of the time. Call `onError`.
     - `didJustFinish` calls `onEnd`. When not looping, the next play seeks to 0 first.
   - **Scrubbing.**
     - `onScrubStart` records whether audio was playing and pauses.
     - `onScrubEnd` awaits `seekTo` and resumes if it was playing.
     - The scrubber displays the drag value while dragging, not `currentTime`.
   - **Keyboard (web).** Spread `useMediaKeyboard` on the root, making it focusable: Space/K play-pause, ←/→ ±5 s,
     M mute.
   - **Accessibility.**
     - The play button label is `"Play {title}"`/`"Pause {title}"` through `translateText("media.playTitle", …,
       { title })`. Use plain `media.play`/`media.pause` when there is no title.
     - The scrubber uses `mediaTimeA11y`.
     - The speed button label is `"Playback speed {rate}"`.
     - On iOS, `magicTap` on the root toggles play.
   - **Lifecycle.** Pause on unmount when the component owns the player. When the caller passes `player`, never pause
     or release it on unmount. When `lockScreen` is on, call `setActiveForLockScreen(false)` on unmount.
2. **Tests** (`AudioPlayer.test.tsx`, `AudioPlayer.web.test.tsx`) with
   `jest.mock("expo-audio", () => require("@/test/mocks/expoAudio"))`:
   - Both variants render the right controls.
   - Play/pause toggles and the label includes the title.
   - The buffering spinner, the error state, and `onEnd` with seek-to-0 on the next play.
   - Scrub pauses, seeks, then resumes.
   - The speed cycle calls `setPlaybackRate`.
   - On web, the shell renders without calling `useAudioPlayer` before hydration: mock `useHydrated` false and assert
     the fake hook was not called. Keyboard shortcuts work.
   - An external `player` is untouched on unmount.
3. **Sample media.** Add `assets/media/sample-audio.m4a`: 20 s of generated tone, AAC 64 kb/s, ≤ 200 KB, no
   third-party content.
   `ffmpeg -f lavfi -i "sine=frequency=330:duration=20" -af "volume=0.3" -c:a aac -b:a 64k assets/media/sample-audio.m4a`.
4. **Showcase.**
   - Register `{ id: "AudioPlayer", importPath: "@mrmeg/expo-ui/components/AudioPlayer", category: "media" }`.
   - Preview: a compact player, a full player with title, subtitle, and artwork (the sample image from `media-image`),
     and a full player with a broken source.
   - Keep the previews behind the lazy gallery (`gallerySplitPoint.test.ts`).
5. **Docs.**
   - Fill the `AudioPlayer` entry in `LLM_USAGE.md` `## Media`:
     - variants and when to use each;
     - the app-owned `setAudioModeAsync({ playsInSilentMode: true })` call for iOS;
     - background playback needs the config plugin;
     - `lockScreen` requires `interruptionMode: "doNotMix"`;
     - web CORS for remote files.
   - Add a CHANGELOG `## [Unreleased]` Added entry, then run `bun run docs:llms`.

## Validation

- `bun run pkg ui typecheck`, `bun run pkg ui test`, `bun run typecheck`, `bun run test`, `bun run lint`,
  `bun lint:ui --changed`, `bun run gen --check`.
- `bun run build && bun run bundle-size`: expo-audio stays out of the eager entry chunk.
- In a browser, against `bun run build && bun run start`:
  - The gallery route server-renders with no `Audio is not defined` error in the server log and no hydration
    warning.
  - Play, pause, mouse scrubbing, speed cycling, and keyboard shortcuts all work while the player is focused.
  - Both variants look right at 1280 px and 375 px, in light and dark themes.
  - Report screenshots.
- On the iOS simulator (run skill), if available: play with the silent switch caveat noted, drag the scrubber, cycle
  speed. Put Android and screen-reader checks in the PR's manual checks.
