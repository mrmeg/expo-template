/**
 * What each component PR observed, per fixture and surface. `mediaFixtures.ts`
 * merges this into `MEDIA_FIXTURES`, so the Media Lab shows it.
 *
 * Record only what you saw on a surface you ran, and name the surface version
 * in the block comment. Meaning:
 * - `works`: renders as intended. For an `expectError` fixture, the component
 *   reached its error state cleanly.
 * - `partial`: something rendered, but not the whole intent (a truncated file
 *   decoded halfway instead of erroring).
 * - `fails`: the platform could not play or decode it; the component showed its
 *   error state rather than crashing.
 */
import type { Observed, Surface } from "./mediaFixtures";

export const OBSERVED: Record<string, Partial<Record<Surface, Observed>>> = {
  // Images (media-image), 2026-10-23:
  // - web-chrome: Chrome 156 (Playwright, channel "chrome"), production build; DOM load/error state per tile
  //   plus a screenshot pass (alpha, animation, SVG, EXIF orientation).
  // - web-safari: Playwright WebKit 26.6 (Safari 26's engine, not Safari itself), same production build and checks.
  // - ios: iPhone 18 Pro simulator, iOS 27, dev client; each tile's onLoad/onError event (EXIF 6 reported
  //   450x800, i.e. portrait). Not a visual pass.
  // HEIC: Chrome has no HEIC decoder (iOS and WebKit decode it). Truncated JPEG: both paint the decoded part instead of erroring.
  "core-landscape": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "core-portrait": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "core-square": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "core-alpha": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-aspect-21x9": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-aspect-3x1": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-aspect-1x3": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-aspect-4x3": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-aspect-3x4": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-size-16": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-size-48": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-size-48mp": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-fmt-jpeg-baseline": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-fmt-jpeg-progressive": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-fmt-png-opaque": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-fmt-png-alpha": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-fmt-png-16bit": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-fmt-webp-lossy": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-fmt-webp-lossless-alpha": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-fmt-avif": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-fmt-gif-animated": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-fmt-webp-animated": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-fmt-apng": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-fmt-svg-viewbox": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-fmt-svg-fixed": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-fmt-heic": { "web-chrome": "fails", ios: "works", "web-safari": "works" },
  "img-orient-exif6": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-color-p3": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-color-gray": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-color-cmyk": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-responsive-400": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-responsive-800": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-responsive-1600": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-broken-truncated": { "web-chrome": "partial", ios: "partial", "web-safari": "partial" },
  "img-broken-zero": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-broken-png-as-jpg": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-broken-text-as-png": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "src-remote-png": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "src-data-uri": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "src-404": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  // The 60 list-scale thumbnails all loaded in the horizontal FlatList strip.
  ...Object.fromEntries(
    Array.from({ length: 60 }, (_, i) => [`img-scale-${String(i + 1).padStart(2, "0")}`, { "web-chrome": "works" as const, "web-safari": "works" as const }]),
  ),
  // Video (media-video), 2026-10-23:
  // - web-chrome: Chrome 156 and web-safari: Playwright WebKit 26.6, production build. Each tile mounted, played muted
  //   for ~3 s (currentTime advanced) or reached the error UI; custom controls, time readouts (h:mm:ss, Live) and
  //   auto-aspect frames checked on a subset.
  // - ios: iPhone 18 Pro simulator, iOS 27, dev client; each tile autoplayed and its status/playing/error/frame
  //   events were logged. Custom chrome and readouts were not read on iOS.
  // Rotation flag: browsers report the rotated size (portrait frame); iOS reports the pre-rotation size, so the auto
  // frame stays landscape and the picture is letterboxed. WebM (VP9, AV1): iOS "Cannot Open". AV1: this WebKit build
  // fails the MP4 and hangs on the WebM (metadata loads, play() never settles, no error event). HLS: Chrome 156 plays
  // some streams natively (Apple TS, Mux VOD, Unified live) but not Apple HEVC or the Mux subtitles stream; WebKit
  // and iOS play all four VOD streams. Captions: expo-video's web player exposes no subtitle tracks, so the custom
  // captions toggle never appears on web (iOS not checked; Mux subtitles left unverified there). DASH: no native
  // support anywhere tested. Akamai live: its playlist returns 404 on every surface (stream gone). Unified live
  // failed once in Chrome out of three runs.
  "core-video-landscape": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "core-video-portrait": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "vid-aspect-1x1": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "vid-aspect-4x3": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "vid-aspect-21x9": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "vid-rotate-90": { "web-chrome": "works", "web-safari": "works", ios: "partial" },
  "vid-tracks-no-audio": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "vid-tracks-audio-only": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "vid-dur-loop-2s": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "vid-dur-1h05": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "vid-codec-h264-high-1080p": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "vid-codec-hevc": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "vid-codec-hevc-10bit": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "vid-codec-vp9-opus-webm": { "web-chrome": "works", "web-safari": "works", ios: "fails" },
  "vid-codec-av1-mp4": { "web-chrome": "works", "web-safari": "fails", ios: "works" },
  "vid-codec-av1-webm": { "web-chrome": "works", "web-safari": "fails", ios: "fails" },
  "vid-codec-h264-mov": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "vid-codec-60fps": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "vid-codec-4k": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "vid-container-moov-end": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "vid-container-fragmented": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "vid-broken-truncated": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "vid-broken-zero": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "vid-broken-text": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "remote-hls-apple-adv-ts": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "remote-hls-apple-hevc": { "web-chrome": "fails", "web-safari": "works", ios: "works" },
  "remote-hls-mux-long-vod": { "web-chrome": "works", "web-safari": "works", ios: "works" },
  "remote-hls-mux-subtitles": { "web-chrome": "fails", "web-safari": "partial" },
  "remote-dash-akamai": { "web-chrome": "fails", "web-safari": "fails", ios: "fails" },
  "remote-live-hls-akamai": { "web-chrome": "fails", "web-safari": "fails", ios: "fails" },
  "remote-live-hls-unified": { "web-chrome": "works", "web-safari": "works", ios: "works" },
};
