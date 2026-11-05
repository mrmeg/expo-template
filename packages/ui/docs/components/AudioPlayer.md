---
components: [AudioPlayer]
use-for: "Audio with themed controls"
---

# AudioPlayer

`AudioPlayer` (`components/AudioPlayer`, needs `expo-audio` and `expo-image`):
a themed, flat audio player with the same controls on iOS, Android and web,
including desktop browsers. It draws no container; put it in a `Card` (one
item in a collection) or an `Item` row.

```tsx
import { AudioPlayer } from "@mrmeg/expo-ui/components/AudioPlayer";

<AudioPlayer source={note.url} title="Voice note" />
<AudioPlayer
  variant="full"
  source={episode.url}
  title={episode.title}
  subtitle={show.name}
  artwork={show.cover}
  onEnd={playNext}
/>
```

- `variant="compact"` (default) is one 44 pt row: play and pause, a scrubber,
  and the total length until it starts, then the elapsed time. Use it for
  voice notes and attachments. `variant="full"` adds 56 pt `artwork`, a
  `title` over a `subtitle`, a full-width scrubber, elapsed and `-remaining`
  times, and a speed button (1×, 1.25×, 1.5×, 2×, 0.75×; `showSpeed={false}`
  hides it). Use it for episodes and tracks. `showMute` adds a mute button in
  either variant.
- `title` also names the controls for assistive tech ("Play {title}", "Pause
  {title}"). The scrubber announces the position in words, and the numeric
  times are hidden from assistive tech. On iOS a magic tap on the player
  toggles play.
- Words go through `translateText` under `media.play`, `media.pause`,
  `media.playTitle` and `media.pauseTitle` (with `{ title }`), `media.loading`,
  `media.audioError`, `media.mute`, `media.unmute`, `media.playbackSpeed`
  (with `{ rate }`), `media.audioPlayer` and the shared `media.seek` /
  `media.live`; the English fallback is already filled in.
- Web: focus the player, then Space or K plays and pauses, ←/→ move 5 s, and M
  mutes (with or without the `showMute` button, which only shows the state).
  The keys act only while focus is inside the player.
- A source that fails to load, or no `source` at all, disables the controls
  and shows "Audio unavailable" in place of the time; `onError(message)` is
  called once per message. A play request the browser refuses (autoplay
  before a gesture) is reported to `onError` but leaves the player usable.
  `onEnd` fires when playback reaches the end (not while `loop`), and the next
  play starts from 0. A live stream, whose length is never known, shows
  `Live` and disables the scrubber.
- Scrubbing pauses a playing clip, seeks on release and resumes. To own the
  player (to read it elsewhere, or to set `useAudioPlayer` options such as
  `downloadFirst`, `crossOrigin` or `updateInterval`), create it with
  `useAudioPlayer(source, options)` and pass it as `player`. The component then
  never pauses, replaces or releases it. Without `player` it creates one,
  pauses it on unmount and releases it.
- Web server rendering: `expo-audio`'s web player builds an
  `HTMLAudioElement`, which a server does not have. `AudioPlayer` renders the
  same layout with a disabled play button and `--:--` on the server and
  through the hydration pass, and creates the player once hydrated (on
  native, and whenever you pass `player`, at once). Do not call
  `useAudioPlayer` during a server render yourself.
- The audio session is yours. `AudioPlayer` never calls `setAudioModeAsync`,
  which is process-wide, so set it once at app start:
  - iOS plays nothing with the silent switch on unless you call
    `setAudioModeAsync({ playsInSilentMode: true })`.
  - Background playback needs the `expo-audio` config plugin (its
    `enableBackgroundPlayback` adds the iOS `audio` background mode and the
    Android foreground service) and
    `setAudioModeAsync({ shouldPlayInBackground: true })`. On Android,
    sustained background playback also needs `lockScreen`.
  - `lockScreen` publishes `title`, `subtitle` (as the artist) and `artwork`
    to the lock screen and notification while playing, and clears them on
    unmount. It requires `setAudioModeAsync({ interruptionMode: "doNotMix" })`.
- Web, remote files: an `<audio>` element plays a file from another origin
  without CORS headers. The server must send `Access-Control-Allow-Origin`
  for the page's origin only when you pass `headers` in the source or create
  the player with `downloadFirst` or `crossOrigin`.
- Platform gaps, from reading `expo-audio` 58.0.10: its web player reports
  `isLoaded: true` and `isBuffering: false` on every update, so the loading
  spinner (shown on native while buffering, or between play and load) never
  appears on web. `AudioPlayer` does not read a file's embedded ID3 cover art:
  the `artwork` prop is the only picture. Per-format results (MP3 CBR and VBR,
  WAV, FLAC, Ogg and WebM Opus, long files, live, broken files) are in the
  Media Lab Audio section (`/media-lab`) and its `observed` badges.
