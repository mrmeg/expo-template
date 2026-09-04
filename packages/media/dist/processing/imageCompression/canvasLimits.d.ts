/**
 * Per-browser canvas ceilings.
 *
 * A canvas larger than the host's maximum area/edge does not throw — it draws
 * blank. The failure mode is a fully transparent (or black) upload that passes
 * every size check, so the ladder has to clamp *before* it draws rather than
 * detect afterwards.
 *
 * Numbers are the widely reproduced per-engine limits; the default is the
 * conservative one because guessing high is the failure we are avoiding.
 */
/** iOS Safari (and every iOS browser, since they all use WebKit). */
export declare const CANVAS_LIMIT_IOS = 4096;
/** Firefox's documented single-edge limit. */
export declare const CANVAS_LIMIT_FIREFOX = 11180;
/** Chrome, Edge, and desktop Safari. */
export declare const CANVAS_LIMIT_CHROMIUM = 16384;
/** Used when the UA string tells us nothing. */
export declare const CANVAS_LIMIT_DEFAULT = 4096;
/**
 * Best-effort canvas long-edge ceiling for a user-agent string.
 * Pure so it can be tested without a DOM.
 */
export declare function canvasLongEdgeLimitFor(userAgent: string | undefined | null): number;
/** Reads the ambient UA when there is one. Never throws in a non-DOM context. */
export declare function currentCanvasLongEdgeLimit(): number;
/**
 * Clamp a requested long edge to what the host can actually rasterise.
 * Returns the requested value untouched when it already fits.
 */
export declare function clampLongEdgeToCanvasLimit(longEdge: number, limit: number): number;
