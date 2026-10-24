/**
 * Pure zoom, pan and gesture math for `MediaViewer`.
 *
 * Internal: not re-exported from `lib/index.ts`, and no imports at all, so it
 * runs in Jest and on the server unchanged.
 *
 * The model every function shares: a page is a `viewport`-sized frame whose
 * contents are drawn contain-fit and centered, then transformed about the
 * frame's center. Points are measured from that center, in points, with y
 * growing down, and a content point `c` lands on screen at
 *
 *     screen = translation + scale * c
 *
 * which is what `transform: [{ translateX }, { translateY }, { scale }]` does
 * to a view in React Native (the translation is not scaled).
 */

export interface Size {
  width: number;
  height: number;
}

/** A point measured from the center of the viewport. */
export interface Point {
  x: number;
  y: number;
}

/** The transform applied to a page: a uniform scale and a translation (see the model above). */
export interface ZoomTransform {
  scale: number;
  x: number;
  y: number;
}

export interface ZoomGeometry {
  /** The picture's natural size once it has loaded (after EXIF rotation). Unknown: the viewport is used. */
  natural: Size | null;
  viewport: Size;
}

export const IDENTITY_TRANSFORM: ZoomTransform = { scale: 1, x: 0, y: 0 };

/** The lowest scale a pinch passes through on its way down; releasing below 1 springs back to 1. */
export const ELASTIC_MIN_SCALE = 0.5;
/** One keyboard `+` / `-` step. */
export const ZOOM_STEP = 1.5;
/** Two taps this close in time (ms) and space (pt) are a double tap. */
export const DOUBLE_TAP_MS = 250;
export const DOUBLE_TAP_SLOP = 20;
/** A press that moves less than this (pt) and ends within `TAP_MAX_MS` is a tap. */
export const TAP_SLOP = 10;
export const TAP_MAX_MS = 500;
/** A vertical drag past this distance (pt), or faster than this velocity (pt/ms), dismisses the viewer. */
export const DISMISS_DISTANCE = 120;
export const DISMISS_VELOCITY = 1;
/** Movement (pt) before a drag is read as vertical or horizontal. */
export const DRAG_INTENT_SLOP = 8;

const EPSILON = 1e-3;

const finiteOr = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const positiveSize = (size: Size | null | undefined): size is Size =>
  !!size && Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0;

/** Whether a scale is past rest. Paging turns off, and the pan responder takes one finger, while this is true. */
export function isZoomed(scale: number): boolean {
  return scale > 1 + EPSILON;
}

/** A scale held to `[1, maxZoom]`. A `maxZoom` below 1 means no zoom: always 1. */
export function clampScale(scale: number, maxZoom: number): number {
  const max = Math.max(1, finiteOr(maxZoom, 1));
  return Math.min(max, Math.max(1, finiteOr(scale, 1)));
}

/** A scale held to `[ELASTIC_MIN_SCALE, maxZoom]`: what a live pinch may show before it springs back. */
export function elasticScale(scale: number, maxZoom: number): number {
  const max = Math.max(1, finiteOr(maxZoom, 1));
  return Math.min(max, Math.max(ELASTIC_MIN_SCALE, finiteOr(scale, 1)));
}

/**
 * The size the picture occupies at scale 1: its natural size contained in the
 * viewport. With no natural size yet, the whole viewport.
 */
export function containSize(natural: Size | null | undefined, viewport: Size): Size {
  if (!positiveSize(natural)) return { width: viewport.width, height: viewport.height };
  const fit = Math.min(viewport.width / natural.width, viewport.height / natural.height);
  return { width: natural.width * fit, height: natural.height * fit };
}

/**
 * The farthest the translation may reach on each axis at `scale`: how far the
 * zoomed picture overhangs the viewport, per side. Zero on an axis where the
 * picture is not larger than the viewport, so it stays centered there (a
 * panorama zoomed 2x in a portrait viewport still pans sideways only).
 */
export function panBounds({ natural, viewport }: ZoomGeometry, scale: number): Point {
  const contained = containSize(natural, viewport);
  const safeScale = Math.max(finiteOr(scale, 1), 0);
  return {
    x: Math.max(0, (contained.width * safeScale - viewport.width) / 2),
    y: Math.max(0, (contained.height * safeScale - viewport.height) / 2),
  };
}

/** A translation held inside `panBounds`, so the picture's edge never passes the viewport's. */
export function clampTranslation(translation: Point, bounds: Point): Point {
  return {
    x: Math.min(bounds.x, Math.max(-bounds.x, finiteOr(translation.x, 0))),
    y: Math.min(bounds.y, Math.max(-bounds.y, finiteOr(translation.y, 0))),
  };
}

/** A transform with its translation held inside the bounds for its own scale. */
export function clampTransform(transform: ZoomTransform, geometry: ZoomGeometry): ZoomTransform {
  const scale = finiteOr(transform.scale, 1);
  const { x, y } = clampTranslation(transform, panBounds(geometry, scale));
  return { scale, x, y };
}

export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpointOf(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Zoom to `nextScale` keeping the content point under `focal` where it is: the
 * anchor for a double tap, the cursor for the wheel, the center for the keys.
 * The result is held to the pan bounds.
 */
export function zoomAround(
  current: ZoomTransform,
  nextScale: number,
  focal: Point,
  geometry: ZoomGeometry,
): ZoomTransform {
  const from = Math.max(finiteOr(current.scale, 1), EPSILON);
  const ratio = nextScale / from;
  return clampTransform(
    {
      scale: nextScale,
      x: focal.x - ratio * (focal.x - current.x),
      y: focal.y - ratio * (focal.y - current.y),
    },
    geometry,
  );
}

/** What a pinch started from: the transform, the finger distance and the midpoint, all at the moment the second finger landed. */
export interface PinchStart {
  transform: ZoomTransform;
  distance: number;
  midpoint: Point;
}

/**
 * The transform for a pinch in progress. The scale is the start scale times the
 * ratio of finger distances, kept within `[ELASTIC_MIN_SCALE, maxZoom]`. The
 * content point that was under the start midpoint follows the current midpoint,
 * so a pinch zooms where the fingers are and a two-finger drag pans.
 */
export function pinchTransform(
  start: PinchStart,
  current: { distance: number; midpoint: Point },
  options: { maxZoom: number; geometry: ZoomGeometry },
): ZoomTransform {
  const startDistance = Math.max(start.distance, EPSILON);
  const scale = elasticScale(start.transform.scale * (current.distance / startDistance), options.maxZoom);
  const startScale = Math.max(start.transform.scale, EPSILON);
  const anchor = {
    x: (start.midpoint.x - start.transform.x) / startScale,
    y: (start.midpoint.y - start.transform.y) / startScale,
  };
  return clampTransform(
    {
      scale,
      x: current.midpoint.x - scale * anchor.x,
      y: current.midpoint.y - scale * anchor.y,
    },
    options.geometry,
  );
}

/**
 * Where a released pinch comes to rest: below 1 it springs back to the
 * identity, otherwise it stays, clamped to `maxZoom` and the pan bounds.
 */
export function settleTransform(
  transform: ZoomTransform,
  options: { maxZoom: number; geometry: ZoomGeometry },
): ZoomTransform {
  if (transform.scale < 1 + EPSILON) return IDENTITY_TRANSFORM;
  return clampTransform({ ...transform, scale: clampScale(transform.scale, options.maxZoom) }, options.geometry);
}

/**
 * The scale a double tap goes to: back to 1 from anywhere zoomed, otherwise
 * `doubleTapZoom`, never above `maxZoom` and never below 1.
 */
export function doubleTapScale(currentScale: number, doubleTapZoom: number, maxZoom: number): number {
  if (isZoomed(currentScale)) return 1;
  return clampScale(doubleTapZoom, maxZoom);
}

/** The transform a double tap at `point` produces. */
export function doubleTapTransform(
  current: ZoomTransform,
  point: Point,
  options: { doubleTapZoom: number; maxZoom: number; geometry: ZoomGeometry },
): ZoomTransform {
  const target = doubleTapScale(current.scale, options.doubleTapZoom, options.maxZoom);
  if (target === 1) return IDENTITY_TRANSFORM;
  return zoomAround(current, target, point, options.geometry);
}

/** One step of the `+` / `-` keys: `ZOOM_STEP` up or down, snapping to 1 at the bottom and held to `maxZoom`. */
export function stepScale(scale: number, direction: 1 | -1, maxZoom: number): number {
  const next = direction === 1 ? scale * ZOOM_STEP : scale / ZOOM_STEP;
  return next < 1 + EPSILON ? 1 : clampScale(next, maxZoom);
}

/**
 * The scale factor of one `wheel` event with Ctrl or Cmd held. A trackpad
 * pinch arrives as a stream of small `deltaY` values; a mouse wheel as large
 * steps. Exponential so both feel linear, and capped so one notch cannot jump.
 * `deltaMode` 1 (lines, Firefox's mouse wheel) is scaled to pixels first.
 */
export function wheelZoomFactor(deltaY: number, deltaMode = 0): number {
  const pixels = finiteOr(deltaY, 0) * (deltaMode === 1 ? 16 : 1);
  return Math.min(1.5, Math.max(1 / 1.5, Math.exp(-pixels * 0.01)));
}

export interface TapSample {
  /** `Date.now()`-style milliseconds. */
  time: number;
  x: number;
  y: number;
}

/** Whether `next` completes a double tap that `previous` began. */
export function isDoubleTap(previous: TapSample | null | undefined, next: TapSample): boolean {
  if (!previous) return false;
  const elapsed = next.time - previous.time;
  if (!(elapsed >= 0 && elapsed <= DOUBLE_TAP_MS)) return false;
  return Math.hypot(next.x - previous.x, next.y - previous.y) <= DOUBLE_TAP_SLOP;
}

/** Whether a press that ended after `elapsedMs` having moved `dx`, `dy` is a tap. */
export function isTap(dx: number, dy: number, elapsedMs: number): boolean {
  return Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP && elapsedMs < TAP_MAX_MS;
}

/**
 * Which way a one-finger drag is going, once it has moved past the slop:
 * `"vertical"` (swipe to dismiss) or `"horizontal"` (the pager's). `undefined`
 * until then.
 */
export function dragIntent(dx: number, dy: number): "vertical" | "horizontal" | undefined {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < DRAG_INTENT_SLOP) return undefined;
  return ay > ax ? "vertical" : "horizontal";
}

/** A released swipe-down: past `DISMISS_DISTANCE`, or faster than `DISMISS_VELOCITY`, closes; otherwise it springs back. */
export function dismissDecision(dy: number, vy: number): "close" | "restore" {
  return Math.abs(dy) > DISMISS_DISTANCE || Math.abs(vy) > DISMISS_VELOCITY ? "close" : "restore";
}

/** Backdrop opacity at rest and its floor, and the fraction of the page height at which the floor is reached. */
export const BACKDROP_FLOOR = 0.2;
export const BACKDROP_FADE_FRACTION = 0.4;

/** The backdrop opacity for a page dragged `dy` points from rest: full at rest, down to `BACKDROP_FLOOR` at 40% of the page height. */
export function dragBackdropOpacity(dy: number, pageHeight: number): number {
  const range = Math.max(finiteOr(pageHeight, 0) * BACKDROP_FADE_FRACTION, 1);
  return 1 - (1 - BACKDROP_FLOOR) * Math.min(1, Math.abs(finiteOr(dy, 0)) / range);
}

/**
 * Whether a responder grant should be taken at the start or move of a touch:
 * two fingers on a zoomable page are a pinch, and the pager must not get them.
 */
export function shouldCapturePinch(touchCount: number, zoomEnabled: boolean): boolean {
  return zoomEnabled && touchCount === 2;
}

/** Whether the page must hold on to the responder: never let the pager take a pinch, or a zoomed image, away. */
export function shouldRefuseTermination(pinching: boolean, scale: number, dismissing: boolean): boolean {
  return pinching || isZoomed(scale) || dismissing;
}
