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
export const CANVAS_LIMIT_IOS = 4096;
/** Firefox's documented single-edge limit. */
export const CANVAS_LIMIT_FIREFOX = 11180;
/** Chrome, Edge, and desktop Safari. */
export const CANVAS_LIMIT_CHROMIUM = 16384;
/** Used when the UA string tells us nothing. */
export const CANVAS_LIMIT_DEFAULT = CANVAS_LIMIT_IOS;
/**
 * Best-effort canvas long-edge ceiling for a user-agent string.
 * Pure so it can be tested without a DOM.
 */
export function canvasLongEdgeLimitFor(userAgent) {
    if (!userAgent)
        return CANVAS_LIMIT_DEFAULT;
    const ua = userAgent.toLowerCase();
    // iPadOS 13+ reports a desktop UA, but "Macintosh" + touch is not detectable
    // from the string alone, so iPad-as-desktop lands on the desktop limit. That
    // is the one place this table can be optimistic; a 16k-edge source on an iPad
    // is rare enough to accept versus penalising every desktop Safari upload.
    if (/iphone|ipad|ipod/.test(ua))
        return CANVAS_LIMIT_IOS;
    if (/crios|edgios|fxios/.test(ua))
        return CANVAS_LIMIT_IOS;
    if (/firefox|fxios/.test(ua))
        return CANVAS_LIMIT_FIREFOX;
    if (/chrome|chromium|edg\//.test(ua))
        return CANVAS_LIMIT_CHROMIUM;
    if (/safari/.test(ua))
        return CANVAS_LIMIT_CHROMIUM;
    return CANVAS_LIMIT_DEFAULT;
}
/** Reads the ambient UA when there is one. Never throws in a non-DOM context. */
export function currentCanvasLongEdgeLimit() {
    const ua = typeof navigator !== "undefined" && typeof navigator.userAgent === "string"
        ? navigator.userAgent
        : undefined;
    return canvasLongEdgeLimitFor(ua);
}
/**
 * Clamp a requested long edge to what the host can actually rasterise.
 * Returns the requested value untouched when it already fits.
 */
export function clampLongEdgeToCanvasLimit(longEdge, limit) {
    if (!Number.isFinite(longEdge) || longEdge <= 0)
        return longEdge;
    if (!Number.isFinite(limit) || limit <= 0)
        return longEdge;
    return Math.min(longEdge, limit);
}
