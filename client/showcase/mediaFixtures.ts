/**
 * The Media Lab corpus: one typed manifest the lab screen and the media
 * component specs (`Image`, `Video`, `AudioPlayer`, `MediaViewer`) read.
 *
 * Three tiers:
 *
 * - `core`: committed in `assets/media/`, bundled with `require()`, always
 *   available. Gallery previews use these. Also the inline data-URI entry.
 * - `generated`: built on demand into `public/media-fixtures/` by
 *   `bun run media:fixtures` (`scripts/build-media-fixtures.mjs`) and served
 *   from the app's own origin. Gitignored. Every id and path here must match a
 *   fixture the generator declares; `__tests__/mediaFixtures.test.ts` holds the
 *   two in step.
 * - `remote`: public streams that were reachable when the entry was added.
 *
 * `observed` starts empty in the declarations below. What a component PR saw
 * goes in `mediaObserved.ts`, merged in at the end: record `works`, `fails`
 * or `partial` only for what you saw on a surface you actually ran, and leave
 * the rest unset (shown as `unverified`). Never fill support from memory.
 */
import Constants from "expo-constants";

import { resolveApiOrigin } from "@/client/lib/api/apiOrigin";

import { OBSERVED } from "./mediaObserved";

export type FixtureKind = "image" | "video" | "audio";
export type FixtureTier = "core" | "generated" | "remote";
export type FixtureCategory =
  | "aspect"
  | "format"
  | "codec"
  | "orientation"
  | "color"
  | "duration"
  | "tracks"
  | "container"
  | "stream"
  | "live"
  | "captions"
  | "source"
  | "scale"
  | "broken";
export type Surface = "ios" | "android" | "web-chrome" | "web-safari" | "web-firefox";
export type Observed = "works" | "fails" | "partial" | "unverified";

export interface MediaFixture {
  id: string;
  kind: FixtureKind;
  tier: FixtureTier;
  category: FixtureCategory;
  /** Short, e.g. "HEVC 10-bit". */
  label: string;
  /** What to look for, e.g. "rotation flag: must display portrait". */
  note?: string;
  /** `require()` for core, a `/media-fixtures/…` path for generated, a URL for remote. */
  source: number | string;
  width?: number;
  height?: number;
  durationSec?: number;
  /** Intentionally broken: the component must show its error state, not crash. */
  expectError?: boolean;
  /**
   * The path is absent on purpose (the 404 source kind). The lab skips its
   * availability probe and hands the URI to a component, because the component
   * reaching its error state is the point. Distinct from a fixture that is
   * missing because the generator has not run.
   */
  intentionallyMissing?: boolean;
  /** Default `{}`, shown as `unverified`. */
  observed: Partial<Record<Surface, Observed>>;
}

export const FIXTURE_KINDS: readonly FixtureKind[] = ["image", "video", "audio"];
export const FIXTURE_TIERS: readonly FixtureTier[] = ["core", "generated", "remote"];
export const FIXTURE_SURFACES: readonly Surface[] = ["ios", "android", "web-chrome", "web-safari", "web-firefox"];
export const OBSERVED_VALUES: readonly Observed[] = ["works", "fails", "partial", "unverified"];
export const FIXTURE_CATEGORIES: readonly FixtureCategory[] = [
  "aspect",
  "format",
  "codec",
  "orientation",
  "color",
  "duration",
  "tracks",
  "container",
  "stream",
  "live",
  "captions",
  "source",
  "scale",
  "broken",
];

/** Where the generator writes, as served by the app (`public/` is the web root). */
export const GENERATED_URL_PREFIX = "/media-fixtures/";

// ---------------------------------------------------------------------------
// Declaration helpers
// ---------------------------------------------------------------------------

type Extras = Partial<Pick<MediaFixture, "note" | "width" | "height" | "durationSec" | "expectError" | "intentionallyMissing">>;

const generated = (
  kind: FixtureKind,
  dir: "images" | "video" | "audio",
  id: string,
  category: FixtureCategory,
  label: string,
  file: string,
  extras: Extras = {},
): MediaFixture => ({
  id,
  kind,
  tier: "generated",
  category,
  label,
  source: `${GENERATED_URL_PREFIX}${dir}/${file}`,
  observed: {},
  ...extras,
});

const img = (id: string, category: FixtureCategory, label: string, file: string, extras?: Extras) =>
  generated("image", "images", id, category, label, file, extras);
const vid = (id: string, category: FixtureCategory, label: string, file: string, extras?: Extras) =>
  generated("video", "video", id, category, label, file, extras);
const aud = (id: string, category: FixtureCategory, label: string, file: string, extras?: Extras) =>
  generated("audio", "audio", id, category, label, file, extras);

const remote = (
  id: string,
  kind: FixtureKind,
  category: FixtureCategory,
  label: string,
  source: string,
  note: string,
): MediaFixture => ({ id, kind, tier: "remote", category, label, note, source, observed: {} });

const APPLE_STREAMS = "https://devstreaming-cdn.apple.com/videos/streaming/examples";

/** A 24x16 PNG (about 450 bytes), inline, for the data-URI source kind. */
const DATA_URI_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAQCAIAAACDRijCAAAACXBIWXMAAAABAAAAAQBPJcTWAAABe0lEQVR4nGOsY/jLgA3U/2OGs5mZEGr+MvxHiP9jgrNZsJpCBoAaNI/BAU1iH4qAI5xlz/APIezASDMXDVaDxBkuAMktTUpA8h+LOJDM3/gSSEoxnAWSJ5o1gCT3719AMqnpEViHHk4Xtbe0M/ybXVl3UVWdISFePCHBdcGC3UDxiV0TGH7OKKg9K8vIUFerW1tT29zSjOKiOgZQetkP5hyoZ2D4ncO8j4HBlsGGkWH7jpcHHXd7ejAweHxl+JrK3GjHwGBn8/+ffxPDwfqSdfUMzGBtHm8OZ+cE0zKwXV8wFBWZi/34tnDBZWRxU4ZDE9rSxb5/b25ehCy+Q8R2x4pXtHTRbgmG3ctOAsOIgR9F/DSDnXXVdRtQyrZhYDgCF1f6dhW7QWSA7OxsFINUNzEUFYfd4jna1/dUlg8U/dsF9YDRf+wkNzD6HzUjov/83x5Q9Nvh9lpf7yq3KOmiImnu33+AXEgiAoL8sgJggpzQbAxJkGiJaOrUqQDCyYH/MtCvUAAAAABJRU5ErkJggg==";

// ---------------------------------------------------------------------------
// The manifest
// ---------------------------------------------------------------------------

/** The generated 60-thumbnail list-scale set, `img-scale-01` … `img-scale-60`. */
const SCALE_COUNT = 60;
const scaleSet: MediaFixture[] = Array.from({ length: SCALE_COUNT }, (_, index) => {
  const n = String(index + 1).padStart(2, "0");
  return img(`img-scale-${n}`, "scale", `Thumbnail ${n}`, `scale-${n}.jpg`, {
    width: 256,
    height: 256,
    note: index === 0 ? "60 distinct 256x256 JPEGs for list, grid and pager scale" : undefined,
  });
});

const DECLARED_FIXTURES: MediaFixture[] = [
  // --- Core: bundled with require(), always available ----------------------
  {
    id: "core-landscape",
    kind: "image",
    tier: "core",
    category: "aspect",
    label: "Landscape 16:9",
    note: "SMPTE bars: top and bottom bands differ, so position crops are visible",
    source: require("@/assets/media/landscape.jpg"),
    width: 1600,
    height: 900,
    observed: {},
  },
  {
    id: "core-portrait",
    kind: "image",
    tier: "core",
    category: "aspect",
    label: "Portrait 9:16",
    source: require("@/assets/media/portrait.jpg"),
    width: 900,
    height: 1600,
    observed: {},
  },
  {
    id: "core-square",
    kind: "image",
    tier: "core",
    category: "aspect",
    label: "Square 1:1",
    source: require("@/assets/media/square.jpg"),
    width: 1024,
    height: 1024,
    observed: {},
  },
  {
    id: "core-alpha",
    kind: "image",
    tier: "core",
    category: "format",
    label: "Alpha PNG",
    note: "transparent background, opaque disc: check both themes",
    source: require("@/assets/media/alpha.png"),
    width: 512,
    height: 512,
    observed: {},
  },
  {
    id: "core-video-landscape",
    kind: "video",
    tier: "core",
    category: "aspect",
    label: "Landscape video 640x360",
    note: "H.264 baseline + AAC, faststart, 10 s",
    source: require("@/assets/media/landscape.mp4"),
    width: 640,
    height: 360,
    durationSec: 10,
    observed: {},
  },
  {
    id: "core-video-portrait",
    kind: "video",
    tier: "core",
    category: "aspect",
    label: "Portrait video 360x640",
    note: "H.264 baseline + AAC, faststart, 10 s",
    source: require("@/assets/media/portrait.mp4"),
    width: 360,
    height: 640,
    durationSec: 10,
    observed: {},
  },
  {
    id: "core-tone",
    kind: "audio",
    tier: "core",
    category: "format",
    label: "Tone M4A",
    note: "AAC 64 kb/s, 20 s, a beep every second",
    source: require("@/assets/media/tone.m4a"),
    durationSec: 20,
    observed: {},
  },

  // --- Generated images ------------------------------------------------------
  img("img-aspect-21x9", "aspect", "Ultrawide 21:9", "aspect-21x9.jpg", { width: 2100, height: 900 }),
  img("img-aspect-3x1", "aspect", "Panorama 3:1", "aspect-3x1.jpg", { width: 1800, height: 600 }),
  img("img-aspect-1x3", "aspect", "Tall strip 1:3", "aspect-1x3.jpg", { width: 400, height: 1200 }),
  img("img-aspect-4x3", "aspect", "4:3", "aspect-4x3.jpg", { width: 1200, height: 900 }),
  img("img-aspect-3x4", "aspect", "3:4", "aspect-3x4.jpg", { width: 900, height: 1200 }),
  img("img-size-16", "aspect", "16x16", "size-16.png", { width: 16, height: 16, note: "upscaling: crisp or smoothed?" }),
  img("img-size-48", "aspect", "48x48", "size-48.png", { width: 48, height: 48, note: "upscaling" }),
  img("img-size-48mp", "aspect", "48 MP", "size-48mp.jpg", {
    width: 8000,
    height: 6000,
    note: "zoom, memory and downsampling",
  }),

  img("img-fmt-jpeg-baseline", "format", "JPEG baseline", "fmt-jpeg-baseline.jpg", { width: 1200, height: 800 }),
  img("img-fmt-jpeg-progressive", "format", "JPEG progressive", "fmt-jpeg-progressive.jpg", {
    width: 1200,
    height: 800,
    note: "cjpeg -progressive",
  }),
  img("img-fmt-png-opaque", "format", "PNG opaque", "fmt-png-opaque.png", { width: 800, height: 600 }),
  img("img-fmt-png-alpha", "format", "PNG alpha", "fmt-png-alpha.png", {
    width: 640,
    height: 640,
    note: "transparent background: check both themes",
  }),
  img("img-fmt-png-16bit", "format", "PNG 16-bit", "fmt-png-16bit.png", { width: 640, height: 360 }),
  img("img-fmt-webp-lossy", "format", "WebP lossy", "fmt-webp-lossy.webp", { width: 1200, height: 800 }),
  img("img-fmt-webp-lossless-alpha", "format", "WebP lossless alpha", "fmt-webp-lossless-alpha.webp", {
    width: 640,
    height: 640,
    note: "transparent background: check both themes",
  }),
  img("img-fmt-avif", "format", "AVIF", "fmt-avif.avif", { width: 1200, height: 800 }),
  img("img-fmt-gif-animated", "format", "GIF animated", "fmt-gif-animated.gif", {
    width: 320,
    height: 240,
    note: "animation must play",
  }),
  img("img-fmt-webp-animated", "format", "WebP animated", "fmt-webp-animated.webp", {
    width: 320,
    height: 240,
    note: "animation must play",
  }),
  img("img-fmt-apng", "format", "APNG", "fmt-apng.png", { width: 320, height: 240, note: "animation must play" }),
  img("img-fmt-svg-viewbox", "format", "SVG viewBox only", "fmt-svg-viewbox.svg", {
    note: "viewBox with no width or height: no intrinsic size",
  }),
  img("img-fmt-svg-fixed", "format", "SVG fixed size", "fmt-svg-fixed.svg", {
    width: 320,
    height: 200,
    note: "fixed width and height",
  }),
  img("img-fmt-heic", "format", "HEIC", "fmt-heic.heic", {
    width: 1200,
    height: 800,
    note: "tiled: ffprobe reports a 512x512 tile, sips and ImageIO read 1200x800",
  }),

  img("img-orient-exif6", "orientation", "EXIF orientation 6", "orient-exif6.jpg", {
    width: 800,
    height: 450,
    note: "landscape pixels, EXIF Orientation 6: must display portrait (450x800)",
  }),

  img("img-color-p3", "color", "Display P3", "color-p3.jpg", { width: 1200, height: 800, note: "embedded Display P3 profile" }),
  img("img-color-gray", "color", "Grayscale JPEG", "color-gray.jpg", { width: 1200, height: 800, note: "single-component JPEG" }),
  img("img-color-cmyk", "color", "CMYK JPEG", "color-cmyk.jpg", { width: 1200, height: 800, note: "CMYK with Generic CMYK profile" }),

  img("img-responsive-400", "source", "Responsive 400", "responsive-400.jpg", {
    width: 400,
    height: 224,
    note: "one picture at 400, 800 and 1600 wide for source arrays; hue-shifted per width (0, 120, 240 degrees) so the file chosen is visible",
  }),
  img("img-responsive-800", "source", "Responsive 800", "responsive-800.jpg", { width: 800, height: 450, note: "hue shifted 120 degrees" }),
  img("img-responsive-1600", "source", "Responsive 1600", "responsive-1600.jpg", { width: 1600, height: 900, note: "hue shifted 240 degrees" }),

  ...scaleSet,

  img("img-broken-truncated", "broken", "Truncated JPEG", "broken-truncated.jpg", {
    expectError: true,
    note: "first half of the bytes: expect an error state; a partial decode is worth recording as `partial`, a crash never is",
  }),
  img("img-broken-zero", "broken", "Zero-byte JPEG", "broken-zero.jpg", { expectError: true, note: "0 bytes" }),
  img("img-broken-png-as-jpg", "broken", "PNG saved as .jpg", "broken-png-as-jpg.jpg", {
    width: 640,
    height: 360,
    note: "valid PNG bytes under a .jpg name: should still decode",
  }),
  img("img-broken-text-as-png", "broken", "Text saved as .png", "broken-text-as-png.png", {
    expectError: true,
    note: "plain text",
  }),

  // --- Generated video -------------------------------------------------------
  vid("vid-aspect-1x1", "aspect", "Video 1:1", "aspect-1x1.mp4", { width: 480, height: 480, durationSec: 3 }),
  vid("vid-aspect-4x3", "aspect", "Video 4:3", "aspect-4x3.mp4", { width: 640, height: 480, durationSec: 3 }),
  vid("vid-aspect-21x9", "aspect", "Video 21:9", "aspect-21x9.mp4", { width: 840, height: 360, durationSec: 3 }),
  vid("vid-rotate-90", "orientation", "Rotation flag 90", "rotate-90.mp4", {
    width: 640,
    height: 360,
    durationSec: 4,
    note: "coded 640x360 with a 90 degree display matrix: must display portrait, with a portrait auto aspect ratio",
  }),
  vid("vid-tracks-no-audio", "tracks", "No audio track", "tracks-no-audio.mp4", {
    width: 640,
    height: 360,
    durationSec: 4,
    note: "video stream only",
  }),
  vid("vid-tracks-audio-only", "tracks", "Audio-only MP4", "tracks-audio-only.mp4", {
    durationSec: 5,
    note: "AAC, no video stream",
  }),
  vid("vid-dur-loop-2s", "duration", "2 s loop clip", "dur-loop-2s.mp4", { width: 480, height: 270, durationSec: 2, note: "loop" }),
  vid("vid-dur-1h05", "duration", "1 h 05 m", "dur-1h05.mp4", {
    width: 64,
    height: 36,
    durationSec: 3900,
    note: "h:mm:ss time display and far seeks; 1 fps, no audio",
  }),
  vid("vid-codec-h264-high-1080p", "codec", "H.264 High 1080p", "codec-h264-high-1080p.mp4", {
    width: 1920,
    height: 1080,
    durationSec: 3,
  }),
  vid("vid-codec-hevc", "codec", "HEVC", "codec-hevc.mp4", { width: 640, height: 360, durationSec: 3, note: "libx265, hvc1 tag" }),
  vid("vid-codec-hevc-10bit", "codec", "HEVC 10-bit", "codec-hevc-10bit.mp4", {
    width: 640,
    height: 360,
    durationSec: 3,
    note: "main10, yuv420p10le",
  }),
  vid("vid-codec-vp9-opus-webm", "codec", "VP9 + Opus WebM", "codec-vp9-opus.webm", { width: 640, height: 360, durationSec: 3 }),
  vid("vid-codec-av1-mp4", "codec", "AV1 in MP4", "codec-av1.mp4", { width: 640, height: 360, durationSec: 3 }),
  vid("vid-codec-av1-webm", "codec", "AV1 in WebM", "codec-av1.webm", { width: 640, height: 360, durationSec: 3 }),
  vid("vid-codec-h264-mov", "codec", "H.264 in MOV", "codec-h264.mov", { width: 640, height: 360, durationSec: 3 }),
  vid("vid-codec-60fps", "codec", "60 fps", "codec-60fps.mp4", { width: 640, height: 360, durationSec: 3 }),
  vid("vid-codec-4k", "codec", "3840x2160", "codec-4k.mp4", { width: 3840, height: 2160, durationSec: 3 }),
  vid("vid-container-moov-end", "container", "Non-faststart MP4", "container-moov-end.mp4", {
    width: 1280,
    height: 720,
    durationSec: 20,
    note: "moov atom at the end, about 5 MB: slow start is visible under throttling",
  }),
  vid("vid-container-fragmented", "container", "Fragmented MP4", "container-fragmented.mp4", {
    width: 640,
    height: 360,
    durationSec: 6,
  }),
  vid("vid-broken-truncated", "broken", "Truncated MP4", "broken-truncated.mp4", {
    expectError: true,
    note: "moov atom missing: error state with retry, no crash",
  }),
  vid("vid-broken-zero", "broken", "Zero-byte MP4", "broken-zero.mp4", { expectError: true, note: "0 bytes" }),
  vid("vid-broken-text", "broken", "Text saved as .mp4", "broken-text.mp4", { expectError: true, note: "plain text" }),

  // --- Generated audio -------------------------------------------------------
  aud("aud-fmt-mp3-cbr", "format", "MP3 CBR 128k", "fmt-mp3-cbr.mp3", { durationSec: 10 }),
  aud("aud-fmt-mp3-vbr", "format", "MP3 VBR (-q:a 4)", "fmt-mp3-vbr.mp3", {
    durationSec: 12,
    note: "no Xing header: true length 12 s, but ffprobe estimates 7.3 s from the first frames, the known VBR edge",
  }),
  aud("aud-fmt-wav", "format", "WAV PCM", "fmt-wav.wav", { durationSec: 5 }),
  aud("aud-fmt-flac", "format", "FLAC", "fmt-flac.flac", { durationSec: 5 }),
  aud("aud-fmt-ogg-opus", "format", "Ogg Opus", "fmt-ogg-opus.ogg", { durationSec: 8 }),
  aud("aud-fmt-webm-opus", "format", "WebM Opus", "fmt-webm-opus.webm", {
    durationSec: 8,
    note: "what Chrome's MediaRecorder produces",
  }),
  aud("aud-dur-1s5", "duration", "1.5 s voice note", "dur-1s5.m4a", { durationSec: 1.5 }),
  aud("aud-dur-3min", "duration", "3 min", "dur-3min.mp3", { durationSec: 180 }),
  aud("aud-dur-1h05", "duration", "1 h 05 m", "dur-1h05.mp3", {
    durationSec: 3900,
    note: "h:mm:ss time display; mono 8 kb/s",
  }),
  aud("aud-chan-stereo-lr", "tracks", "Stereo L/R", "chan-stereo-lr.m4a", {
    durationSec: 10,
    note: "440 Hz left only, 880 Hz right only",
  }),
  aud("aud-chan-silent", "tracks", "Silent", "chan-silent.mp3", { durationSec: 5, note: "silent throughout" }),
  aud("aud-meta-id3-cover", "tracks", "ID3 + cover art", "meta-id3-cover.mp3", {
    durationSec: 8,
    note: "title, artist and an embedded cover image",
  }),
  aud("aud-broken-truncated", "broken", "Truncated MP3", "broken-truncated.mp3", {
    expectError: true,
    note: "cut mid-frame: the header still claims 6 s but only about 3 s decodes; expect an error or a short playback, never a crash",
  }),
  aud("aud-broken-zero", "broken", "Zero-byte MP3", "broken-zero.mp3", { expectError: true, note: "0 bytes" }),
  aud("aud-broken-text", "broken", "Text saved as .mp3", "broken-text.mp3", { expectError: true, note: "plain text" }),

  // --- Remote streams, each reachable (curl -r 0-200) on 2026-10-23 ----------
  remote(
    "remote-hls-apple-adv-ts",
    "video",
    "captions",
    "Apple HLS advanced (TS)",
    `${APPLE_STREAMS}/img_bipbop_adv_example_ts/master.m3u8`,
    "three alternate audio groups (2ch and 6ch) and CEA-608 closed captions",
  ),
  remote(
    "remote-hls-apple-hevc",
    "video",
    "stream",
    "Apple HLS advanced (HEVC)",
    `${APPLE_STREAMS}/bipbop_adv_example_hevc/master.m3u8`,
    "HLS master playlist with HEVC variants",
  ),
  remote(
    "remote-hls-mux-long-vod",
    "video",
    "stream",
    "Mux long VOD",
    "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    "long HLS video on demand",
  ),
  remote(
    "remote-hls-mux-subtitles",
    "video",
    "captions",
    "Mux subtitles (WebVTT + TTML)",
    "https://test-streams.mux.dev/tos_ismc/main.m3u8",
    "WebVTT and TTML subtitle groups",
  ),
  remote(
    "remote-dash-akamai",
    "video",
    "stream",
    "Akamai DASH",
    "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd",
    "MPEG-DASH manifest, not HLS",
  ),
  remote(
    "remote-live-hls-akamai",
    "video",
    "live",
    "Live HLS (Akamai)",
    "https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8",
    "live: no fixed duration",
  ),
  remote(
    "remote-live-hls-unified",
    "video",
    "live",
    "Live HLS (Unified Streaming)",
    "https://demo.unified-streaming.com/k8s/live/stable/live.isml/.m3u8",
    "live: no fixed duration",
  ),
  remote(
    "remote-live-mp3-bbc",
    "audio",
    "live",
    "Live MP3 (BBC World Service)",
    "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service",
    "live audio, never ends; may be geo-restricted",
  ),

  // --- Source kinds: remote image, inline data URI, and a path that 404s -------
  remote(
    "src-remote-png",
    "image",
    "source",
    "Remote HTTPS PNG",
    "https://raw.githubusercontent.com/mrmeg/expo-template/main/assets/images/icon.png",
    "the template's app icon from GitHub raw (verified 200 image/png, 2026-10-23)",
  ),
  {
    id: "src-data-uri",
    kind: "image",
    tier: "core",
    category: "source",
    label: "Data URI PNG",
    note: "tiny inline base64 PNG, 24x16",
    source: DATA_URI_PNG,
    width: 24,
    height: 16,
    observed: {},
  },
  {
    id: "src-404",
    kind: "image",
    tier: "generated",
    category: "source",
    label: "404 path",
    note: "a path under /media-fixtures/ that does not exist: error state, not a crash",
    source: `${GENERATED_URL_PREFIX}images/does-not-exist.jpg`,
    expectError: true,
    intentionallyMissing: true,
    observed: {},
  },
];

/** The manifest, with what each component PR observed (`mediaObserved.ts`) merged in. */
export const MEDIA_FIXTURES: MediaFixture[] = DECLARED_FIXTURES.map((fixture) =>
  OBSERVED[fixture.id] ? { ...fixture, observed: { ...fixture.observed, ...OBSERVED[fixture.id] } } : fixture,
);

export const fixturesOfKind = (kind: FixtureKind): MediaFixture[] =>
  MEDIA_FIXTURES.filter((fixture) => fixture.kind === kind);

// ---------------------------------------------------------------------------
// Source resolution
// ---------------------------------------------------------------------------

/**
 * The origin generated fixtures are served from: `""` on web (same-origin
 * relative paths), the API origin on native (`EXPO_PUBLIC_API_URL`, or the
 * dev server's `hostUri` in development, the same rule as `describeApiBaseUrl`),
 * and `null` when a native release build has no origin.
 */
function generatedOrigin(): string | null {
  const target = resolveApiOrigin();
  switch (target.kind) {
  case "same-origin":
    return "";
  case "configured":
    return target.origin;
  case "dev-server": {
    const hostUri = Constants.expoConfig?.hostUri;
    return hostUri ? `http://${hostUri}` : "http://localhost:8081";
  }
  case "unconfigured":
    return null;
  }
}

/**
 * The value to hand a media component for this fixture.
 *
 * Core fixtures (a `require()` number, or an inline data URI) and remote URLs
 * pass through. Generated paths resolve against the app origin; `null` means
 * native has no origin to load them from, which the lab shows as `no origin`.
 */
export function resolveFixtureUri(fixture: MediaFixture): string | number | null {
  if (fixture.tier !== "generated" || typeof fixture.source === "number") return fixture.source;
  const origin = generatedOrigin();
  return origin === null ? null : `${origin}${fixture.source}`;
}
