---
components: [Video]
use-for: "Inline video"
---

# Video

`Video` (`components/Video`, needs `expo-video`): a video that sizes itself
from its own aspect ratio, with the platform's controls, themed controls that
look the same everywhere, or none. The frame is black and sized like `Image`.

```tsx
import { Video } from "@mrmeg/expo-ui/components/Video";

<Video source={clip.url} controls="custom" aspectRatio={{ width: clip.width, height: clip.height }} poster={clip.poster} />
<Video source={{ uri }} aspectRatio="9:16" maxHeight={480} />
<Video source={clip.url} controls="none" aspectRatio="16:9" autoPlay muted loop />
<Video player={player} controls="custom" aspectRatio="16:9" />
```

- Choose `controls`. `"native"` (the default) is the platform's own (AVKit,
  the Media3 player UI, the browser's): the one mode that lets people pick
  among several subtitle tracks or audio tracks, and the one with Picture in
  Picture buttons. `"custom"` draws a center play button and a bottom bar
  (play, scrubber with buffered fill, time, mute, captions, fullscreen) that
  fades 3 s after the last interaction while playing and returns on hover,
  focus and tap. On web it answers Space/K (play), ←/→ (±5 s), ↑/↓ (volume),
  M, F and Esc while the frame is focused, and only then. `"none"` is bare
  playback: no chrome and no tap handling, for a muted loop or controls of
  your own (pass a `player`).
- Sizing is `Image`'s: `aspectRatio` (`16 / 9`, `"16:9"`, `{ width, height }`)
  fills the parent's width at that ratio, capped by `maxWidth` / `maxHeight`
  and centered; `fill` fills a positioned parent. `"auto"` (the default) draws
  at 16:9 until the video reports its size, then moves once. Prefer an
  explicit `aspectRatio` whenever you know it (upload metadata): the box is
  pure style, so a server-rendered page carries the final layout and nothing
  shifts. On native `"auto"` uses the size expo-video reports for the video
  track, which is the coded size: AVFoundation's `naturalSize` and Media3's
  `Format` both ignore a display-rotation flag, so a file that is landscape
  with a "rotate 90" flag (how some phones record portrait) can draw a
  landscape frame with the picture letterboxed inside it. On web it uses the
  `<video>`'s own `videoWidth` and `videoHeight`, which the browser reports
  after rotation. An explicit ratio avoids the question.
- `fit` is `contain` by default; `cover` and `fill` follow CSS `object-fit`
  (expo-video has no `none` or `scale-down`, so `VideoFit` is narrower than
  `ImageFit`). `radius` takes the `spacing.radius*` names.
- Fullscreen, per mode. `"native"`: the platform's control, which always shows
  the platform's controls, as expo-video does in fullscreen. `"custom"`: on web
  the frame itself goes fullscreen (the Fullscreen API), so the custom chrome
  stays and Esc leaves; iPhone Safari cannot fullscreen an element, so there
  the `<video>` goes fullscreen with the browser's controls. On iOS and Android
  a full-screen `Modal` takes the same player with the same chrome, and the
  inline view is unmounted while it is open so the player is attached to one
  view at a time; close it with the minimize button or Android back.
  `"none"`: none. `allowsFullscreen={false}` removes the control in every mode.
- Picture in Picture follows `allowsPictureInPicture` (default `true`) and
  shows in the platform's controls. It needs the expo-video config plugin in
  the app's config, `["expo-video", { supportsPictureInPicture: true }]`, then a
  new native build; without it the prop does nothing. Firefox has no web PiP.
- `autoPlay` asks for playback on mount. Browsers only allow it when the video
  is `muted`, so pass both for an inline loop. `loop` and `muted` are initial
  values read when `Video` creates its player; with your own `player`, set
  them on it. Changing `source` replaces it in place; on web a reload, Retry
  included, starts playing.
- HLS: expo-video on web puts the URL in `<video src>` and ships no hls.js, so
  an `.m3u8` plays natively in Safari only, though iOS and Android play HLS
  natively. `Video` does not add a loader; serve an MP4 or WebM for the other
  browsers.
- Captions: `"custom"` shows a captions button only when the player reports
  subtitle tracks, and it toggles one track (the device's language, else the
  first). To choose among tracks, or to choose an audio track, use `"native"`.
  expo-video's web player reports no subtitle tracks, so the button never
  appears in a browser: use `"native"` there. An audio-only file keeps the fallback ratio
  and its poster (or black) and the controls keep working.
- A live stream (`isLive`, or an infinite duration) reads "Live" and the
  scrubber is disabled; the readout of a long clip is `h:mm:ss` for both
  numbers.
- States are part of the frame: a white spinner over the poster or black while
  loading, and on failure a muted message with a retry button (`rotate-ccw`)
  that reloads `source`, plus `onError(message)`. Retry needs `source`: give it
  alongside your own `player` to get one. `poster` shows until playback first
  starts (under `"native"` it carries a play glyph, since a poster would hide
  the platform's own button), and is dropped if it fails to load.
- Lifecycle: it pauses on unmount, and releases the player it created; a
  `player` you pass is only paused. Pausing when the screen loses focus is the
  app's job, because the kit has no router: pause your own player from
  expo-router's `useIsFocused()`.
- Accessibility under `"custom"` on iOS and Android: the frame is one element
  named by `title`, else `accessibilityLabel`, else "Video", whose value is
  the position in words. Play or pause is the double tap (VoiceOver's
  `onAccessibilityTap`, TalkBack's `activate` action) and, on iOS, the
  two-finger magic tap (`onMagicTap`). The labeled actions are increment and
  decrement (seek 10 s) and custom ones for mute, captions and fullscreen,
  because the children of an accessible element are not separate stops on iOS. The chrome never
  auto-hides while a screen reader is on. On web the frame is a focusable
  group and its buttons are ordinary tab stops; focusing one brings the chrome
  back. react-native-web cannot detect a screen reader, so web relies on focus
  and hover instead.
- It server-renders: the first HTML carries the black sized frame, the
  `<video>` and the controls, and every timer starts after mount. Many players
  on one screen are heavy (one decoder each): mount a `Video` when the user taps
  a thumbnail, as the Media Lab does.
- Codec, container and stream support is the platform decoder's, not the
  component's. The Media Lab's Video section (`/media-lab`) runs every
  fixture (H.264, HEVC and 10-bit HEVC, VP9, AV1, `.mov`, 60 fps, 4K,
  non-faststart and fragmented MP4, audio-only, a 1 h 05 m clip, rotation
  flags, HLS, DASH, live streams, broken files) through `Video` under each
  controls mode and lists, per fixture, what each surface did; check it, not
  memory, before promising a format. Observed on 2026-10-23 (Chrome 156,
  Playwright WebKit 26.6, iOS 27 simulator):

  | Case | Chrome | WebKit | iOS |
  |---|---|---|---|
  | H.264, HEVC (+10-bit), `.mov`, 60 fps, 4K, fragmented, moov-at-end | plays | plays | plays |
  | VP9 / AV1 in WebM | plays | VP9 plays; AV1 hangs, no error | "Cannot Open" |
  | AV1 in MP4 | plays | error | plays |
  | HLS VOD | some streams | plays | plays |
  | DASH | error | error | error |
  | Rotation flag, `aspectRatio="auto"` | portrait frame | portrait frame | landscape frame (pre-rotation size) |
  | Captions toggle (`"custom"`) | never shown | never shown | not checked |

  For rotated phone video, pass an explicit `aspectRatio`. For captions on
  web, use `controls="native"`.
