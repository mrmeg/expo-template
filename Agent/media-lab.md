---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/164
---

# Media Lab: a test corpus and a screen that exercises every media case

## Goal

`Image`, `Video`, `AudioPlayer` and `MediaViewer` must be checked against every case a real app meets, not three
happy-path samples. This spec delivers:

1. **A media corpus.**
   - A small committed core, used by gallery previews and always available.
   - A large set generated on demand: aspect ratios, formats, codecs, rotation metadata, durations past 1 h, broken
     files, and list-scale sets.
   - A list of verified public streams: HLS, DASH, live, captions, and alternate audio.
2. **A generator script** that rebuilds the corpus from nothing, with no third-party content.
3. **A Media Lab demo screen** that lists every fixture and shows whether it is available. It has shared playground
   controls (fit, sizing, width, controls mode, theme), plus one section per component that each component spec fills
   in.

Nothing here touches `packages/ui`.

## Stacking

Stacks on spec `media-foundation`. Branch `agent/media-lab` from `agent/media-foundation` and open the draft PR against
it; retarget as the parent merges. If `agent/media-foundation` does not exist, skip with the unblock step "implement
media-foundation first". Do not mark the spec blocked. `media-image` stacks on this branch.

## Context

Verified on `dev` at df1a06a on 2026-10-23.

- **Static serving supports what media needs.** These were measured against `bun ./server.bun.ts` serving files from
  `dist/client`:
  - Range requests return `206` with `Content-Range` for `.mp4`, `.mov`, `.m4a`, `.wav`, `.ogg`, `.vtt` and `.m3u8`.
  - MIME types come from `MIME_TYPES` or Bun's fallback (`server/http/staticFiles.ts:76-82`): `video/mp4`,
    `video/quicktime`, `audio/x-m4a`, `audio/x-wav`, `audio/ogg`, `text/vtt` and `application/vnd.apple.mpegurl`.
  - The compressor skips `206` responses (`server/http/compression.ts:360-372`).
  - No server change is needed.
- **Metro serves `public/` to native loaders.** `expo start` answered a plain `GET /fonts/inter/…woff2` with a
  `Range` header with `206`. It returns `400` only when the request carries the dev client's `expo-platform` header,
  which expo-image, AVPlayer and ExoPlayer do not send.
  - Native reaches the dev server through `resolveApiOrigin()` (`client/lib/api/apiOrigin.ts:59`, dev fallback
    `Constants.expoConfig.hostUri`, line 124).
  - Web uses same-origin relative paths.
  - `expo export` copies `public/` into `dist/client`. `scripts/precompress.mjs` only touches `_expo/static`.
- **Tools present on Matt's Mac:**
  - ffmpeg and ffprobe, with encoders `libx264`, `libx265`, `hevc_videotoolbox`, `libvpx-vp9`, `libsvtav1`,
    `libopus`, `flac`, `libmp3lame`, `png`, `mjpeg`, `gif`, `apng`, and muxers `mp4`/`ipod`/`mov`/`webm`/`ogg`/
    `flac`/`mp3`/`webp`/`apng`;
  - `avifenc`, `cwebp`, `img2webp`, `gif2webp`, `cjpeg`, and macOS `sips` (HEIC, color profiles).
  - There is no `exiftool` and no ImageMagick. CI and Railway have none of these tools.
- **Remote streams** (reachable 2026-10-23, `curl -r 0-200`):
  - Apple `img_bipbop_adv_example_ts/master.m3u8`: three alternate audio groups (2ch and 6ch) and CEA-608 closed
    captions.
  - Apple `bipbop_adv_example_hevc/master.m3u8`.
  - Mux `x36xhzz/x36xhzz.m3u8` (long VOD).
  - Mux `tos_ismc/main.m3u8`: WebVTT and TTML subtitle groups.
  - Akamai DASH `dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd`.
  - Live HLS: `cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8` and
    `demo.unified-streaming.com/k8s/live/stable/live.isml/.m3u8`.
  - Live MP3: `stream.live.vc.bbcmedia.co.uk/bbc_world_service` (may be geo-restricted).
  - SomaFM did not answer.
  - Full Apple URLs are under `https://devstreaming-cdn.apple.com/videos/streaming/examples/`.
- **Showcase pattern.**
  - Gallery routes are one-line lazy shells. For example `app/(main)/(demos)/surface-lab.tsx` renders
    `<GalleryRoute screen="SurfaceLabScreen" />`.
  - The body is exported from `client/showcase/gallery.tsx:39`.
  - The `ScreenName` union and loader map live in `client/showcase/lazyGallery.tsx:84,100`.
  - The demo entry lives in `DEMOS` (`client/showcase/registry.ts:79`).
  - `client/showcase/__tests__/gallerySplitPoint.test.ts` fails on a static import of showcase code from outside
    `client/showcase/`.
  - `ThemeToggle.tsx`, `Section.tsx` and `SubSection.tsx` are the existing showcase building blocks.
  - App icons are added with `bun run icons add <name>`.
- **Screen rules** (`AGENTS.md`, `packages/ui/LLM_USAGE.md#screen-layout`):
  - flat layout with `spacing.screenPadding`;
  - lists as `ItemGroup` + `Item`;
  - `Card` only for one item in a collection, so a fixture tile may be a `Card`.
- **Generated files are not byte-stable** across encoder versions, and `sips` is macOS-only. The generator must stay
  out of `bun run gen` and `bun run verify`.

## Work

1. **`scripts/build-media-fixtures.mjs`** (new) and the `package.json` script `"media:fixtures"`.
   - Run modes:
     - `bun run media:fixtures` builds the full corpus into `public/media-fixtures/`. Add that directory to
       `.gitignore`.
     - `--core` rebuilds only the committed core in `assets/media/`.
     - `--only <id,…>` builds a subset.
     - `--list` prints every fixture with its tool and status.
   - Each fixture is declared once (id, output path, tool, args).
   - When a required tool is missing, skip that fixture, print a warning, and keep going.
   - At the end, print a summary table: built, skipped and why, and total size.
   - Use only generated sources: `testsrc2`, `smptehdbars`, `mandelbrot`, `sine`, and color and geq filters. Use no
     downloaded or third-party media.
   - **Core** (committed in `assets/media/`, 2.5 MB at most, all opaque and small):
     - `landscape.jpg` (1600×900, `smptehdbars`, whose distinct top and bottom bands make `position` crops visible);
     - `portrait.jpg` (900×1600) and `square.jpg` (1024×1024);
     - `alpha.png` (512×512 RGBA with a transparent background and an opaque shape);
     - `landscape.mp4` and `portrait.mp4`: 10 s, 640×360 / 360×640, H.264 baseline + AAC, `+faststart`, 600 KB at most
       each;
     - `tone.m4a` (20 s AAC 64 kb/s).
   - **Generated images** (`public/media-fixtures/images/`):
     - **Aspect and size:** 21:9, 3:1 panorama, 1:3 tall strip, 4:3, 3:4, 16×16 and 48×48 (upscaling), and
       8000×6000 (48 MP, for zoom, memory and downsampling).
     - **Formats:**
       - baseline JPEG, and progressive JPEG (`cjpeg -progressive`);
       - opaque PNG, alpha PNG, and 16-bit PNG;
       - lossy WebP and lossless WebP with alpha (`cwebp`), and AVIF (`avifenc`);
       - animated GIF, animated WebP (`img2webp`) and APNG;
       - a hand-written SVG with `viewBox` and no width/height, and one with fixed width/height;
       - HEIC (`sips -s format heic`).
     - **Orientation:** a JPEG whose pixels are landscape but whose EXIF `Orientation` is 6. With no exiftool,
       insert a minimal APP1 Exif segment after SOI in Node and confirm with `sips -g all`.
     - **Color:** a Display P3 image (`sips -m "/System/Library/ColorSync/Profiles/Display P3.icc"`), a grayscale
       JPEG, and a CMYK JPEG (`sips` with the Generic CMYK profile). Skip one if its profile path is missing.
     - **Responsive:** one image at 400, 800 and 1600 widths for `source` arrays.
     - **List scale:** 60 distinct 256×256 JPEG thumbnails, taken as different `testsrc2` frames.
     - **Broken:** a truncated JPEG (first half of the bytes), a zero-byte `.jpg`, PNG bytes saved as `.jpg` (should
       still decode), and a text file saved as `.png`.
   - **Generated video** (`public/media-fixtures/video/`):
     - **Aspect:** 1:1, 4:3 and 21:9.
     - **Rotation:** 640×360 H.264 flagged with a 90° display rotation. Confirm with `ffprobe` that the side data or
       the rotate tag is present.
     - **Tracks:** a video with no audio track, and an audio-only `.mp4` (AAC, no video track).
     - **Duration:** a 2 s loop clip, and a 1 h 05 m clip (64×36, 1 fps, a few kb/s, 3 MB at most) for `h:mm:ss`.
     - **Codecs:**
       - H.264 High 1080p (3 s);
       - HEVC (`libx265 -tag:v hvc1`) and 10-bit HEVC;
       - VP9 + Opus WebM;
       - AV1 (`libsvtav1`) in both MP4 and WebM;
       - H.264 in `.mov`;
       - 60 fps;
       - 3840×2160 (3 s).
     - **Container:** a non-faststart MP4 (moov at the end, about 5 MB, so slow start is visible) and a fragmented
       MP4.
     - **Broken:** a truncated MP4, a zero-byte `.mp4`, and text saved as `.mp4`.
   - **Generated audio** (`public/media-fixtures/audio/`):
     - **Formats:** MP3 CBR 128k, MP3 VBR (`-q:a 4`, a known duration-estimate edge), WAV PCM, FLAC, Ogg Opus, and
       WebM Opus (what Chrome's MediaRecorder produces).
     - **Duration:** 1.5 s (voice note), 3 min, and 1 h 05 m (mono low-bitrate MP3, 4 MB at most).
     - **Channels:** a stereo L/R test (a different tone per side), and a file that is silent throughout.
     - **Metadata:** an MP3 with ID3 title and artist and embedded cover art.
     - **Broken:** truncated, zero-byte, and text saved as `.mp3`.
2. **`client/showcase/mediaFixtures.ts`** (new), the typed manifest that the lab and the component specs read:

   ```ts
   export type FixtureKind = "image" | "video" | "audio";
   export type FixtureTier = "core" | "generated" | "remote";
   export type FixtureCategory = "aspect" | "format" | "codec" | "orientation" | "color" | "duration" | "tracks"
     | "container" | "stream" | "live" | "captions" | "source" | "scale" | "broken";
   export type Surface = "ios" | "android" | "web-chrome" | "web-safari" | "web-firefox";
   export type Observed = "works" | "fails" | "partial" | "unverified";
   export interface MediaFixture {
     id: string; kind: FixtureKind; tier: FixtureTier; category: FixtureCategory;
     label: string;            // short, e.g. "HEVC 10-bit"
     note?: string;            // what to look for, e.g. "rotation flag: must display portrait"
     source: number | string;  // require() for core, "/media-fixtures/…" path for generated, URL for remote
     width?: number; height?: number; durationSec?: number;
     expectError?: boolean;    // intentionally broken: the component must show its error state, not crash
     observed: Partial<Record<Surface, Observed>>; // default {} → shown as "unverified"
   }
   export const MEDIA_FIXTURES: MediaFixture[];
   export function resolveFixtureUri(f: MediaFixture): string | number | null;
   ```

   - **Source resolution.** Generated paths resolve against `resolveApiOrigin()` on native. Return `null` when it is
     not configured, which the UI shows as "no origin". On web they stay relative.
   - **Remote entries** are exactly the streams verified in Context. Before committing, run `curl -r 0-200` again and
     drop any that fail.
   - **Source kinds** are covered by extra entries: a data-URI PNG (a tiny inline base64 string), and a `404` path
     under `/media-fixtures/`.
   - **`observed` starts empty.** Never seed codec or format support from memory: HEVC in Chrome, Opus on iOS,
     AVIF/HEIC on Android, VBR duration and the like. Each component PR records only what it saw on the surfaces it
     actually tested.
3. **`client/showcase/MediaLabScreen.tsx`** and the `app/(main)/(demos)/media-lab.tsx` lazy shell.
   - Wiring: add `"MediaLabScreen"` to `lazyGallery.tsx`, export it from `gallery.tsx`, and add a `DEMOS` entry
     (`id: "media-lab"`, label "Media Lab"). Add an icon via `bun run icons add film`.
   - **Availability.** After mount, client-side only, HEAD-check every generated and remote fixture with a 5 s
     timeout and at most 6 in flight. Each fixture shows one of four states, and these must look different from one
     another:
     - `available`;
     - `not generated`, with the hint "run `bun run media:fixtures`";
     - `unreachable` (remote);
     - `no origin` (native without an API origin).

     A fixture that is missing is never rendered through a component. A missing file and an intentional `broken`
     fixture must not look alike.
   - **Playground bar.** Built from `SegmentedControl` / `Select` / `Switch` in one `ItemGroup`, holding one state
     object passed to every section. Controls:
     - Image `fit` (5 values), `position` (center/top/bottom/left/right), sizing (`aspectRatio` explicit / `"auto"` /
       `fill` in a fixed box / style-sized);
     - `maxHeight` on/off, and `radius`;
     - Video `controls` (native/custom/none), `fit` (3 values), autoplay+muted, loop, poster on/off;
     - Audio `variant`;
     - container width: full, 375, 768 or 1280, centered, to simulate breakpoints in one window;
     - the theme toggle (`ThemeToggle`).
   - **Sections:** Images, Video, Audio, Viewer.
     - Each has filter chips (category, tier, and "only expected errors").
     - Each fixture shows its label, note, dimensions or duration, its availability, and one observed-status badge per
       surface (`unverified` by default).
     - This spec renders each section's fixtures as a metadata list (`ItemGroup` rows) with no media component.
     - Export a `renderers` map (`{ image?, video?, audio?, viewer? }`) that `media-image`, `media-video`,
       `media-audio` and `media-viewer` each fill. A section with no renderer shows its list and the line
       "Component arrives with spec media-…".
   - **Source kinds row:** bundled `require`, public path, remote HTTPS, data URI, and "Pick from library" (via
     `expo-image-picker`, already installed: show the picked `file://` URI in the active section). Also link to the
     media tab for signed URLs.
4. **Docs.** Add a "Media Lab and fixtures" subsection to `docs/e2e.md` or the template guide, whichever already
   describes demo screens. It covers:
   - the tiers;
   - how to run the generator and which tools it needs (ffmpeg required; avifenc, cwebp, img2webp, cjpeg and macOS
     `sips` optional);
   - that generated files are gitignored;
   - how to record observed results in `mediaFixtures.ts`;
   - throttling for loading states: Chrome DevTools network throttling, and Network Link Conditioner on iOS.

   Then run `bun run docs:llms`, because the lab adds a demo route and screen.
5. **Tests:**
   - `client/showcase/__tests__/mediaFixtures.test.ts`:
     - unique ids;
     - every core `source` resolves to a file in `assets/media/`;
     - every generated path matches a fixture id declared in the generator (export the generator's declarations, or
       parse `--list --json`);
     - remote entries are HTTPS;
     - `observed` holds only valid values;
     - `resolveFixtureUri` handles web, native with an origin, and native without one.
   - `client/showcase/__tests__/mediaLab.test.tsx`: the four availability states render differently (mock `fetch`),
     sections with no renderer show the pending line, and playground state reaches a renderer.
   - The registry and gallery split-point tests still pass.

## Validation

- `bun run media:fixtures --core`, then confirm with `git status` that only `assets/media/*` changed and the core
  totals 2.5 MB or less. Then run `bun run media:fixtures` and paste the summary table into the PR.
- Check the outputs with ffprobe: the rotation flag is present, the long files show `1:05:00`, the non-faststart file
  has its moov at the end, and the audio-only `.mp4` has no video stream.
- `bun run typecheck`, `bun run test`, `bun run lint`, `bun lint:ui --changed`, `bun run gen --check`. Run
  `bun run verify` and report its output.
- Browser, against `bun run build && bun run start`:
  - The Media Lab lists every fixture, with generated ones `available` when the corpus is built.
  - After temporarily moving `public/media-fixtures` away, they show `not generated` (not error tiles).
  - Remote entries show `available` or `unreachable`.
  - Playground controls change state. Width presets and the theme toggle work.
  - Report screenshots.
- iOS simulator (run skill), if available: the lab loads generated fixtures from the dev server through
  `resolveApiOrigin()`.
