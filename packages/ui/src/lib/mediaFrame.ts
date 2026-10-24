/**
 * Shared sizing for media frames (`Image`, `Video`, `MediaViewer`).
 *
 * Pure style and state, with no media-module imports: this file ships in the
 * `lib` barrel, which every consumer loads, so it must never pull in
 * `expo-image`, `expo-video` or `expo-audio`.
 */
import { useCallback, useState } from "react";
import type { ViewStyle } from "react-native";

/**
 * A frame shape: a width / height ratio (`1.5`), a `"w:h"` string (`"16:9"`),
 * or a `{ width, height }` pair (a clip's natural size).
 */
export type MediaAspectRatio = number | `${number}:${number}` | { width: number; height: number };

const isPositiveFinite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/** A plain decimal: `16`, `1.5`, `.5`. No sign, no exponent, no hex. */
const DECIMAL = "(\\d+\\.?\\d*|\\.\\d+)";
const RATIO_STRING = new RegExp(`^\\s*${DECIMAL}\\s*:\\s*${DECIMAL}\\s*$`);

/**
 * Width / height as one number, or `undefined` for anything that is not a
 * usable ratio: non-finite, zero or negative numbers, a malformed string, a
 * `{ width, height }` with a non-positive side.
 *
 * ```ts
 * parseAspectRatio("16:9"); // 1.777…
 * parseAspectRatio({ width: 1080, height: 1920 }); // 0.5625
 * parseAspectRatio("wide"); // undefined
 * ```
 */
export function parseAspectRatio(value: unknown): number | undefined {
  if (typeof value === "number") return isPositiveFinite(value) ? value : undefined;

  if (typeof value === "string") {
    const match = RATIO_STRING.exec(value);
    if (!match) return undefined;
    const ratio = Number(match[1]) / Number(match[2]);
    return isPositiveFinite(ratio) ? ratio : undefined;
  }

  if (value !== null && typeof value === "object") {
    const { width, height } = value as { width?: unknown; height?: unknown };
    if (!isPositiveFinite(width) || !isPositiveFinite(height)) return undefined;
    const ratio = width / height;
    return isPositiveFinite(ratio) ? ratio : undefined;
  }

  return undefined;
}

export interface MediaFrameStyleOptions {
  /** The frame's shape. With none (or an unusable one) the caller sizes the frame, so only the max sizes apply. */
  aspectRatio?: MediaAspectRatio;
  /** Largest width, in points. Ignored unless positive and finite. */
  maxWidth?: number;
  /** Largest height, in points. Becomes a `maxWidth` of `maxHeight * ratio`, since the frame sizes itself by width. */
  maxHeight?: number;
  /** Fill the positioned parent (absolutely) instead of sizing by ratio. Wins over every other option. */
  fill?: boolean;
}

/**
 * The style of a media frame: full width at `aspectRatio`, centered. Pure
 * style with no measurement, so a server-rendered page already carries the
 * final box.
 *
 * `maxHeight` is enforced through width. A frame is as wide as its container,
 * so a portrait clip in a wide desktop column would otherwise grow far taller
 * than the viewport; capping the width at `maxHeight * ratio` keeps the
 * height at or under `maxHeight` and centers the frame instead of
 * letterboxing it inside a full-width box.
 *
 * ```tsx
 * <View style={mediaFrameStyle({ aspectRatio: "9:16", maxHeight: 640 })} />
 * <View style={mediaFrameStyle({ fill: true })} />
 * ```
 */
export function mediaFrameStyle({ aspectRatio, maxWidth, maxHeight, fill }: MediaFrameStyleOptions = {}): ViewStyle {
  if (fill) return { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 };

  const cappedWidth = isPositiveFinite(maxWidth) ? maxWidth : undefined;
  const cappedHeight = isPositiveFinite(maxHeight) ? maxHeight : undefined;
  const ratio = parseAspectRatio(aspectRatio);

  if (ratio === undefined) {
    return {
      ...(cappedWidth !== undefined && { maxWidth: cappedWidth }),
      ...(cappedHeight !== undefined && { maxHeight: cappedHeight }),
    };
  }

  const widthLimit =
    cappedHeight === undefined
      ? cappedWidth
      : Math.min(cappedWidth ?? Number.POSITIVE_INFINITY, cappedHeight * ratio);

  return {
    width: "100%",
    aspectRatio: ratio,
    alignSelf: "center",
    ...(widthLimit !== undefined && { maxWidth: widthLimit }),
  };
}

export interface MediaAspectRatioState {
  /**
   * The ratio to draw at. `undefined` only when `explicit` is `undefined`,
   * which means the caller sizes the frame through `style`.
   */
  ratio: number | undefined;
  /** Report the media's natural size once it is known. Zero, negative and non-finite sizes are ignored. */
  reportNaturalSize: (width: number, height: number) => void;
}

/**
 * The ratio a media component draws at, from the author's `aspectRatio` prop.
 *
 * - An explicit ratio wins, and natural-size reports are ignored. One that
 *   does not parse draws at `fallback`, so a typo cannot collapse the frame.
 * - `"auto"` starts at `fallback` and switches to the reported natural size
 *   once. Later reports (a second source, a rotating video) do not move the
 *   frame again, so the layout settles after one shift.
 * - `undefined` means the caller sizes the frame: `ratio` is `undefined`.
 */
export function useMediaAspectRatio(
  explicit: MediaAspectRatio | "auto" | undefined,
  fallback: number,
): MediaAspectRatioState {
  const [natural, setNatural] = useState<number | undefined>(undefined);

  const reportNaturalSize = useCallback((width: number, height: number) => {
    if (!isPositiveFinite(width) || !isPositiveFinite(height)) return;
    const next = width / height;
    if (!isPositiveFinite(next)) return;
    setNatural((current) => current ?? next);
  }, []);

  const safeFallback = isPositiveFinite(fallback) ? fallback : 16 / 9;

  let ratio: number | undefined;
  if (explicit === undefined) ratio = undefined;
  else if (explicit === "auto") ratio = natural ?? safeFallback;
  else ratio = parseAspectRatio(explicit) ?? safeFallback;

  return { ratio, reportNaturalSize };
}
