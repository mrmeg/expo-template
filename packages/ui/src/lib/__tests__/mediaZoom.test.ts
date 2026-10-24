/**
 * The pure zoom, pan and gesture math behind `MediaViewer`: clamp, anchor,
 * double-tap target, and pan bounds for portrait and landscape pictures in
 * portrait and landscape viewports.
 */
import {
  BACKDROP_FLOOR,
  DISMISS_DISTANCE,
  DOUBLE_TAP_MS,
  DOUBLE_TAP_SLOP,
  ELASTIC_MIN_SCALE,
  IDENTITY_TRANSFORM,
  ZOOM_STEP,
  clampScale,
  clampTransform,
  clampTranslation,
  containSize,
  distanceBetween,
  dismissDecision,
  doubleTapScale,
  doubleTapTransform,
  dragBackdropOpacity,
  dragIntent,
  elasticScale,
  isDoubleTap,
  isTap,
  isZoomed,
  midpointOf,
  panBounds,
  pinchTransform,
  settleTransform,
  shouldCapturePinch,
  shouldRefuseTermination,
  stepScale,
  wheelZoomFactor,
  zoomAround,
  type ZoomGeometry,
} from "../mediaZoom";

const PORTRAIT_VIEWPORT = { width: 400, height: 800 };
const LANDSCAPE_VIEWPORT = { width: 800, height: 400 };

const landscapePicture = { width: 3000, height: 2000 }; // 3:2
const portraitPicture = { width: 2000, height: 3000 }; // 2:3
const panorama = { width: 3000, height: 1000 }; // 3:1
const strip = { width: 400, height: 1200 }; // 1:3

const geometry = (natural: ZoomGeometry["natural"], viewport = PORTRAIT_VIEWPORT): ZoomGeometry => ({ natural, viewport });

describe("clampScale and elasticScale", () => {
  it("holds a scale to [1, maxZoom]", () => {
    expect(clampScale(0.4, 4)).toBe(1);
    expect(clampScale(2, 4)).toBe(2);
    expect(clampScale(9, 4)).toBe(4);
  });

  it("treats a maxZoom below 1, or garbage, as no zoom", () => {
    expect(clampScale(3, 0.5)).toBe(1);
    expect(clampScale(Number.NaN, 4)).toBe(1);
    expect(clampScale(3, Number.NaN)).toBe(1);
  });

  it("lets a live pinch dip to the elastic floor, and no further", () => {
    expect(elasticScale(0.1, 4)).toBe(ELASTIC_MIN_SCALE);
    expect(elasticScale(0.8, 4)).toBe(0.8);
    expect(elasticScale(8, 4)).toBe(4);
  });
});

describe("isZoomed", () => {
  it("is false at rest, including float dust, and true past it", () => {
    expect(isZoomed(1)).toBe(false);
    expect(isZoomed(1.0004)).toBe(false);
    expect(isZoomed(1.01)).toBe(true);
  });
});

describe("containSize", () => {
  it("fits a landscape picture to the width of a portrait viewport", () => {
    const size = containSize(landscapePicture, PORTRAIT_VIEWPORT);
    expect(size.width).toBeCloseTo(400);
    expect(size.height).toBeCloseTo(400 * (2 / 3));
  });

  it("fits a portrait picture to the height of a landscape viewport", () => {
    const size = containSize(portraitPicture, LANDSCAPE_VIEWPORT);
    expect(size.height).toBeCloseTo(400);
    expect(size.width).toBeCloseTo(400 * (2 / 3));
  });

  it("fills the viewport when the natural size is unknown or unusable", () => {
    expect(containSize(null, PORTRAIT_VIEWPORT)).toEqual(PORTRAIT_VIEWPORT);
    expect(containSize({ width: 0, height: 100 }, PORTRAIT_VIEWPORT)).toEqual(PORTRAIT_VIEWPORT);
    expect(containSize({ width: Number.NaN, height: 100 }, PORTRAIT_VIEWPORT)).toEqual(PORTRAIT_VIEWPORT);
  });
});

describe("panBounds", () => {
  it("is zero at scale 1 for a picture that fills one axis, and for the other axis too", () => {
    expect(panBounds(geometry(landscapePicture), 1)).toEqual({ x: 0, y: 0 });
    expect(panBounds(geometry(portraitPicture, LANDSCAPE_VIEWPORT), 1)).toEqual({ x: 0, y: 0 });
  });

  it("lets a landscape picture in a portrait viewport pan sideways first, and up and down only once it is taller than the viewport", () => {
    // Contained: 400 x 266.7. At 2x: 800 x 533.3, so 200 sideways and nothing vertical.
    const twice = panBounds(geometry(landscapePicture), 2);
    expect(twice.x).toBeCloseTo(200);
    expect(twice.y).toBe(0);

    // At 4x: 1600 x 1066.7, so 600 sideways and 133.3 vertical.
    const four = panBounds(geometry(landscapePicture), 4);
    expect(four.x).toBeCloseTo(600);
    expect(four.y).toBeCloseTo(133.33, 1);
  });

  it("lets a portrait picture in a portrait viewport pan both ways at 2x", () => {
    // Contained: 400 x 600 in 400 x 800. At 2x: 800 x 1200.
    const bounds = panBounds(geometry(portraitPicture), 2);
    expect(bounds.x).toBeCloseTo(200);
    expect(bounds.y).toBeCloseTo(200);
  });

  it("lets a portrait picture in a landscape viewport pan up and down first", () => {
    // Contained: 266.7 x 400 in 800 x 400. At 2x: 533.3 x 800.
    const bounds = panBounds(geometry(portraitPicture, LANDSCAPE_VIEWPORT), 2);
    expect(bounds.x).toBe(0);
    expect(bounds.y).toBeCloseTo(200);
  });

  it("lets a landscape picture in a landscape viewport pan sideways only until it is wider than the viewport", () => {
    // Contained: 600 x 400 in 800 x 400. At 2x: 1200 x 800.
    const bounds = panBounds(geometry(landscapePicture, LANDSCAPE_VIEWPORT), 2);
    expect(bounds.x).toBeCloseTo(200);
    expect(bounds.y).toBeCloseTo(200);
    expect(panBounds(geometry(landscapePicture, LANDSCAPE_VIEWPORT), 1.2).x).toBe(0);
  });

  it("keeps a panorama's edges inside the viewport: it pans along its length and stays centered across", () => {
    // 3:1 in a portrait viewport: 400 x 133.3 contained. At 3x: 1200 x 400 (short of the 800 height).
    const bounds = panBounds(geometry(panorama), 3);
    expect(bounds.x).toBeCloseTo(400);
    expect(bounds.y).toBe(0);
  });

  it("keeps a 1:3 strip's edges inside the viewport", () => {
    // 1:3 in a portrait viewport: contained 266.7 x 800. At 4x: 1066.7 x 3200.
    const bounds = panBounds(geometry(strip), 4);
    expect(bounds.x).toBeCloseTo(333.33, 1);
    expect(bounds.y).toBeCloseTo(1200);
  });

  it("falls back to the viewport for the shape while the natural size is unknown", () => {
    expect(panBounds(geometry(null), 2)).toEqual({ x: 200, y: 400 });
  });
});

describe("clampTranslation and clampTransform", () => {
  it("holds a translation inside the bounds on both sides", () => {
    expect(clampTranslation({ x: 500, y: -500 }, { x: 200, y: 100 })).toEqual({ x: 200, y: -100 });
    expect(clampTranslation({ x: 50, y: -20 }, { x: 200, y: 100 })).toEqual({ x: 50, y: -20 });
  });

  it("centers an axis that has no room", () => {
    expect(clampTranslation({ x: 40, y: 40 }, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it("ignores non-finite input", () => {
    expect(clampTranslation({ x: Number.NaN, y: Infinity }, { x: 10, y: 10 })).toEqual({ x: 0, y: 0 });
  });

  it("clamps a transform against the bounds of its own scale", () => {
    const clamped = clampTransform({ scale: 2, x: 999, y: 999 }, geometry(landscapePicture));
    expect(clamped.scale).toBe(2);
    expect(clamped.x).toBeCloseTo(200);
    expect(clamped.y).toBe(0);
  });
});

describe("zoomAround", () => {
  it("keeps the content point under the focal point where it was", () => {
    const geo = geometry(null);
    const focal = { x: 100, y: -50 };
    const next = zoomAround(IDENTITY_TRANSFORM, 2, focal, geo);
    // The content point that was under the focal point at scale 1 is the focal point itself.
    expect(next.scale).toBe(2);
    expect(next.x + 2 * focal.x).toBeCloseTo(focal.x);
    expect(next.y + 2 * focal.y).toBeCloseTo(focal.y);
  });

  it("anchors at the center for the keyboard: no translation", () => {
    expect(zoomAround(IDENTITY_TRANSFORM, 3, { x: 0, y: 0 }, geometry(null))).toEqual({ scale: 3, x: 0, y: 0 });
  });

  it("clamps an anchor near a corner so the edge never passes the viewport's", () => {
    const geo = geometry(null);
    // A focal point at the far top-left corner of a 400 x 800 viewport.
    const next = zoomAround(IDENTITY_TRANSFORM, 4, { x: -200, y: -400 }, geo);
    expect(next.x).toBeCloseTo(600);
    expect(next.y).toBeCloseTo(1200);
    const bounds = panBounds(geo, 4);
    expect(Math.abs(next.x)).toBeLessThanOrEqual(bounds.x + 1e-9);
    expect(Math.abs(next.y)).toBeLessThanOrEqual(bounds.y + 1e-9);
  });

  it("zooming back out to 1 recenters", () => {
    const zoomed = zoomAround(IDENTITY_TRANSFORM, 3, { x: 120, y: 60 }, geometry(null));
    const back = zoomAround(zoomed, 1, { x: 120, y: 60 }, geometry(null));
    expect(back.scale).toBe(1);
    expect(back.x).toBeCloseTo(0);
    expect(back.y).toBeCloseTo(0);
  });
});

describe("pinchTransform", () => {
  const geo = geometry(null);
  const start = {
    transform: IDENTITY_TRANSFORM,
    distance: 100,
    midpoint: { x: 0, y: 0 },
  };

  it("scales by the ratio of finger distances", () => {
    const result = pinchTransform(start, { distance: 250, midpoint: { x: 0, y: 0 } }, { maxZoom: 4, geometry: geo });
    expect(result.scale).toBeCloseTo(2.5);
  });

  it("starts from the scale the pinch began at", () => {
    const zoomedStart = { ...start, transform: { scale: 2, x: 0, y: 0 } };
    const result = pinchTransform(zoomedStart, { distance: 150, midpoint: { x: 0, y: 0 } }, { maxZoom: 4, geometry: geo });
    expect(result.scale).toBeCloseTo(3);
  });

  it("clamps to maxZoom going up and to the elastic floor going down", () => {
    expect(pinchTransform(start, { distance: 900, midpoint: { x: 0, y: 0 } }, { maxZoom: 4, geometry: geo }).scale).toBe(4);
    expect(pinchTransform(start, { distance: 5, midpoint: { x: 0, y: 0 } }, { maxZoom: 4, geometry: geo }).scale).toBe(ELASTIC_MIN_SCALE);
  });

  it("anchors at the pinch midpoint: the content under the fingers stays under the fingers", () => {
    const midpoint = { x: 80, y: 40 };
    const result = pinchTransform(
      { ...start, midpoint },
      { distance: 200, midpoint },
      { maxZoom: 4, geometry: geo },
    );
    expect(result.scale).toBeCloseTo(2);
    // screen = translation + scale * content; the content point under the midpoint was the midpoint.
    expect(result.x + result.scale * midpoint.x).toBeCloseTo(midpoint.x);
    expect(result.y + result.scale * midpoint.y).toBeCloseTo(midpoint.y);
  });

  it("pans with the fingers when the midpoint moves", () => {
    const result = pinchTransform(
      start,
      { distance: 200, midpoint: { x: 30, y: -20 } },
      { maxZoom: 4, geometry: geo },
    );
    expect(result.x).toBeCloseTo(30);
    expect(result.y).toBeCloseTo(-20);
  });

  it("never lets the picture's edge past the viewport's", () => {
    const result = pinchTransform(
      start,
      { distance: 200, midpoint: { x: 500, y: 900 } },
      { maxZoom: 4, geometry: geo },
    );
    const bounds = panBounds(geo, result.scale);
    expect(Math.abs(result.x)).toBeLessThanOrEqual(bounds.x + 1e-9);
    expect(Math.abs(result.y)).toBeLessThanOrEqual(bounds.y + 1e-9);
  });

  it("survives a zero start distance", () => {
    const result = pinchTransform(
      { ...start, distance: 0 },
      { distance: 50, midpoint: { x: 0, y: 0 } },
      { maxZoom: 4, geometry: geo },
    );
    expect(Number.isFinite(result.scale)).toBe(true);
    expect(result.scale).toBe(4);
  });
});

describe("settleTransform", () => {
  const geo = geometry(null);

  it("springs back to the identity when released below 1", () => {
    expect(settleTransform({ scale: 0.7, x: 10, y: 10 }, { maxZoom: 4, geometry: geo })).toEqual(IDENTITY_TRANSFORM);
    expect(settleTransform({ scale: 1, x: 0, y: 0 }, { maxZoom: 4, geometry: geo })).toEqual(IDENTITY_TRANSFORM);
  });

  it("keeps a zoomed pinch where it is, inside the bounds", () => {
    const settled = settleTransform({ scale: 2, x: 9999, y: 0 }, { maxZoom: 4, geometry: geo });
    expect(settled.scale).toBe(2);
    expect(settled.x).toBeCloseTo(200);
  });
});

describe("double tap", () => {
  const geo = geometry(landscapePicture);

  it("zooms to doubleTapZoom from rest, and back to 1 from anywhere zoomed", () => {
    expect(doubleTapScale(1, 2.5, 4)).toBe(2.5);
    expect(doubleTapScale(2.5, 2.5, 4)).toBe(1);
    expect(doubleTapScale(1.2, 2.5, 4)).toBe(1);
  });

  it("never goes above maxZoom, or below 1", () => {
    expect(doubleTapScale(1, 6, 4)).toBe(4);
    expect(doubleTapScale(1, 0.4, 4)).toBe(1);
  });

  it("zooms at the tap point and holds the result inside the bounds", () => {
    const point = { x: 150, y: 0 };
    const zoomed = doubleTapTransform(IDENTITY_TRANSFORM, point, { doubleTapZoom: 2.5, maxZoom: 4, geometry: geo });
    expect(zoomed.scale).toBe(2.5);
    // Bounds at 2.5x: x = (400 * 2.5 - 400) / 2 = 300; the unclamped anchor is -225.
    expect(zoomed.x).toBeCloseTo(-225);
    expect(zoomed.y).toBe(0);
  });

  it("clamps a tap at the corner of a very large picture", () => {
    const big = geometry({ width: 8000, height: 6000 }, LANDSCAPE_VIEWPORT);
    const corner = { x: -400, y: -200 };
    const zoomed = doubleTapTransform(IDENTITY_TRANSFORM, corner, { doubleTapZoom: 2.5, maxZoom: 4, geometry: big });
    const bounds = panBounds(big, 2.5);
    expect(zoomed.x).toBeCloseTo(bounds.x);
    expect(zoomed.y).toBeCloseTo(bounds.y);
  });

  it("returns the identity when zoomed", () => {
    expect(
      doubleTapTransform({ scale: 2.5, x: 40, y: 10 }, { x: 5, y: 5 }, { doubleTapZoom: 2.5, maxZoom: 4, geometry: geo }),
    ).toEqual(IDENTITY_TRANSFORM);
  });
});

describe("stepScale", () => {
  it("steps up by ZOOM_STEP and holds at maxZoom", () => {
    expect(stepScale(1, 1, 4)).toBeCloseTo(ZOOM_STEP);
    expect(stepScale(3, 1, 4)).toBe(4);
    expect(stepScale(4, 1, 4)).toBe(4);
  });

  it("steps down and snaps to 1 at the bottom", () => {
    expect(stepScale(3, -1, 4)).toBeCloseTo(2);
    expect(stepScale(1.4, -1, 4)).toBe(1);
    expect(stepScale(1, -1, 4)).toBe(1);
  });
});

describe("wheelZoomFactor", () => {
  it("zooms in on a negative delta and out on a positive one, so scrolling up zooms in", () => {
    expect(wheelZoomFactor(-10)).toBeGreaterThan(1);
    expect(wheelZoomFactor(10)).toBeLessThan(1);
    expect(wheelZoomFactor(0)).toBe(1);
  });

  it("is close to linear for a trackpad's small deltas", () => {
    expect(wheelZoomFactor(-2)).toBeCloseTo(Math.exp(0.02), 5);
  });

  it("caps a mouse wheel's big step", () => {
    expect(wheelZoomFactor(-100)).toBeCloseTo(1.5);
    expect(wheelZoomFactor(100)).toBeCloseTo(1 / 1.5);
  });

  it("scales line-mode deltas to pixels", () => {
    expect(wheelZoomFactor(-1, 1)).toBeCloseTo(wheelZoomFactor(-16, 0));
  });

  it("ignores non-finite deltas", () => {
    expect(wheelZoomFactor(Number.NaN)).toBe(1);
  });
});

describe("taps", () => {
  it("is a double tap inside 250 ms and 20 pt", () => {
    expect(isDoubleTap({ time: 1000, x: 10, y: 10 }, { time: 1000 + DOUBLE_TAP_MS, x: 10 + DOUBLE_TAP_SLOP, y: 10 })).toBe(true);
    expect(isDoubleTap({ time: 1000, x: 10, y: 10 }, { time: 1100, x: 12, y: 11 })).toBe(true);
  });

  it("is not one past either limit, or without a first tap", () => {
    expect(isDoubleTap({ time: 1000, x: 10, y: 10 }, { time: 1000 + DOUBLE_TAP_MS + 1, x: 10, y: 10 })).toBe(false);
    expect(isDoubleTap({ time: 1000, x: 10, y: 10 }, { time: 1100, x: 10 + DOUBLE_TAP_SLOP + 1, y: 10 })).toBe(false);
    expect(isDoubleTap(null, { time: 1100, x: 10, y: 10 })).toBe(false);
    expect(isDoubleTap({ time: 2000, x: 0, y: 0 }, { time: 1000, x: 0, y: 0 })).toBe(false);
  });

  it("reads a short press that barely moved as a tap", () => {
    expect(isTap(2, -3, 120)).toBe(true);
    expect(isTap(12, 0, 120)).toBe(false);
    expect(isTap(0, 0, 900)).toBe(false);
  });
});

describe("drag intent and dismissal", () => {
  it("waits for movement before deciding", () => {
    expect(dragIntent(2, 3)).toBeUndefined();
  });

  it("reads the dominant axis", () => {
    expect(dragIntent(3, 30)).toBe("vertical");
    expect(dragIntent(-3, -30)).toBe("vertical");
    expect(dragIntent(30, 3)).toBe("horizontal");
  });

  it("closes past 120 pt or faster than 1 pt/ms, either direction, and restores otherwise", () => {
    expect(dismissDecision(DISMISS_DISTANCE + 1, 0)).toBe("close");
    expect(dismissDecision(-(DISMISS_DISTANCE + 1), 0)).toBe("close");
    expect(dismissDecision(40, 1.5)).toBe("close");
    expect(dismissDecision(40, -1.5)).toBe("close");
    expect(dismissDecision(DISMISS_DISTANCE, 1)).toBe("restore");
    expect(dismissDecision(60, 0.4)).toBe("restore");
  });

  it("fades the backdrop with the drag, down to a floor", () => {
    expect(dragBackdropOpacity(0, 800)).toBe(1);
    expect(dragBackdropOpacity(160, 800)).toBeCloseTo(1 - (1 - BACKDROP_FLOOR) / 2);
    expect(dragBackdropOpacity(-160, 800)).toBeCloseTo(dragBackdropOpacity(160, 800));
    expect(dragBackdropOpacity(5000, 800)).toBeCloseTo(BACKDROP_FLOOR);
    expect(dragBackdropOpacity(10, 0)).toBeGreaterThanOrEqual(BACKDROP_FLOOR - 1e-9);
  });
});

describe("responder predicates", () => {
  it("captures exactly two touches on a zoomable page, never one, three or any when zoom is off", () => {
    expect(shouldCapturePinch(2, true)).toBe(true);
    expect(shouldCapturePinch(1, true)).toBe(false);
    expect(shouldCapturePinch(3, true)).toBe(false);
    expect(shouldCapturePinch(2, false)).toBe(false);
  });

  it("refuses to give the touch up while pinching, zoomed or dismissing", () => {
    expect(shouldRefuseTermination(true, 1, false)).toBe(true);
    expect(shouldRefuseTermination(false, 2, false)).toBe(true);
    expect(shouldRefuseTermination(false, 1, true)).toBe(true);
    expect(shouldRefuseTermination(false, 1, false)).toBe(false);
  });
});

describe("geometry helpers", () => {
  it("measures distance and midpoint", () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(midpointOf({ x: 0, y: 10 }, { x: 10, y: 30 })).toEqual({ x: 5, y: 20 });
  });
});
