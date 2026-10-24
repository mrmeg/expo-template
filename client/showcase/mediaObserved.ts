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
  //   450x800, i.e. portrait). Not a visual pass, so transparency and animation stay unverified on iOS.
  // HEIC: Chrome has no HEIC decoder (iOS and WebKit decode it). Truncated JPEG: both paint the decoded part instead of erroring.
  "core-landscape": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "core-portrait": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "core-square": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "core-alpha": { "web-chrome": "works", "web-safari": "works" },
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
  "img-fmt-png-alpha": { "web-chrome": "works", "web-safari": "works" },
  "img-fmt-png-16bit": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-fmt-webp-lossy": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-fmt-webp-lossless-alpha": { "web-chrome": "works", "web-safari": "works" },
  "img-fmt-avif": { "web-chrome": "works", ios: "works", "web-safari": "works" },
  "img-fmt-gif-animated": { "web-chrome": "works", "web-safari": "works" },
  "img-fmt-webp-animated": { "web-chrome": "works", "web-safari": "works" },
  "img-fmt-apng": { "web-chrome": "works", "web-safari": "works" },
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
};
