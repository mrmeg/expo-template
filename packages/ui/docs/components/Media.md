---
components: [MediaControlButton, MediaScrubber]
also: [MediaControlButton, MediaScrubber]
use-for: "Icon control over video or images; seek bar"
---

# Media

None knows about storage; `@mrmeg/expo-media` supplies the data.

Each media module is an optional peer; install only what you import, at the
version your Expo SDK recommends (`npx expo install <name>`):

- `expo-image` for `Image`.
- `expo-video` for `Video`.
- `expo-audio` for `AudioPlayer`, which draws its artwork with `Image`, so it
  needs `expo-image` as well. `expo-audio` adds native code, so a dev client
  built before you installed it needs a fresh build.
- `MediaViewer` needs the peers of the media it shows.

On iOS 26 the native stack backs out on a horizontal swipe anywhere on the
screen, and a JS gesture cannot stop it, so dragging the seek bar of a custom
`Video` or an `AudioPlayer` (or any `MediaScrubber`) pops the screen. Set
`fullScreenGestureEnabled: false` in the stack options of the screens that
show them; the edge swipe still goes back.

For custom media UI, build on the shared primitives, none of which import a
media module:

- `MediaControlButton` from `components/MediaControlButton`: an icon-only
  control for chrome drawn over video or images (white glyph on a translucent
  black circle that reads over any frame, at least 44 pt to hit). On a themed
  surface use `IconButton` (`preset="ghost"`, `shape="circle"`) instead.
  `accessibilityLabel` is required; `selected` sets the toggle state for mute.
- `MediaScrubber` from `components/MediaScrubber`: a seek bar with
  `onScrubStart`, `onScrubChange(seconds)` and `onScrubEnd(seconds)`,
  `tone="overlay"` over video or `"default"` on a themed surface, a buffered
  fill, screen-reader increment and decrement by `step`, and ←/→/Home/End on
  web. It is not `Slider`, which has no sliding start or end events.
- `useMediaKeyboard` from `hooks`: spread its result on a focusable container
  for Space/`k`, arrows, `m`, `f`, Esc and zoom keys on web. It acts only on
  keys you pass a handler for, and only inside that container.
- `formatMediaTime`, `mediaTimeA11y`, `mediaFrameStyle`, `parseAspectRatio` and
  `useMediaAspectRatio` from `lib`: `m:ss` or `h:mm:ss` readouts and their
  spoken form, a full-width ratio frame capped by `maxHeight`, and the ratio an
  `aspectRatio="auto"` prop resolves.

Built-in icons for media controls: `play`, `pause`, `volume-2`, `volume-x`,
`maximize`, `minimize`, `rotate-ccw`, `chevron-left`, `chevron-right`, `x`,
`image-off`, `captions`.
