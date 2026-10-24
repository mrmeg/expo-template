/**
 * The DOM listeners `MediaViewer`'s zoom needs on web, in one module so a test
 * can drive them with a plain `EventTarget` (the Jest environment has no DOM).
 *
 * React's `onWheel` is passive, so `preventDefault` there cannot stop the
 * browser zooming the page on Ctrl + wheel; the listener has to be added by
 * hand with `{ passive: false }`. Every DOM access is guarded: this file is
 * imported on the server too. Internal: not in the `lib` barrel.
 */
import { wheelZoomFactor, type Point } from "./mediaZoom";

/** The slice of a DOM node this reads. */
type ZoomNode = {
  addEventListener?: (type: string, listener: (event: never) => void, options?: { passive?: boolean }) => void;
  removeEventListener?: (type: string, listener: (event: never) => void, options?: { passive?: boolean } | boolean) => void;
  getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
};

interface WheelLike {
  ctrlKey?: boolean;
  metaKey?: boolean;
  deltaY?: number;
  deltaMode?: number;
  clientX?: number;
  clientY?: number;
  preventDefault?: () => void;
}

interface MouseLike {
  clientX?: number;
  clientY?: number;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

export interface ZoomEventHandlers {
  /** A Ctrl or Cmd wheel (a trackpad pinch on Chrome, Edge and Firefox): scale by `factor` around `focal`. */
  onWheelZoom: (factor: number, focal: Point) => void;
  /** A double click at `focal`. */
  onDoubleClick: (focal: Point) => void;
}

/** A client position as a point from the center of `node`'s box. */
function focalPoint(node: ZoomNode, clientX: number | undefined, clientY: number | undefined): Point {
  const rect = node.getBoundingClientRect?.();
  if (!rect) return { x: 0, y: 0 };
  return {
    x: (clientX ?? rect.left + rect.width / 2) - rect.left - rect.width / 2,
    y: (clientY ?? rect.top + rect.height / 2) - rect.top - rect.height / 2,
  };
}

/**
 * Listen for zoom gestures on `node`. A wheel event without Ctrl or Cmd is left
 * alone (it is the pager's scroll); one with them is cancelled so the page does
 * not zoom too. A double click is reported at its position. The browser's
 * native image drag is cancelled and hidden from react-native-web: it would
 * otherwise start on the first move of a mouse pan, and react-native-web ends
 * a responder gesture on `dragstart`. Returns the cleanup, and does nothing for
 * a node that is not a DOM element (a native host, or `null`).
 */
export function attachZoomEvents(node: unknown, handlers: ZoomEventHandlers): () => void {
  const target = node as ZoomNode | null | undefined;
  if (!target || typeof target.addEventListener !== "function") return () => {};

  const handleWheel = (event: WheelLike) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault?.();
    handlers.onWheelZoom(wheelZoomFactor(event.deltaY ?? 0, event.deltaMode ?? 0), focalPoint(target, event.clientX, event.clientY));
  };

  const handleDoubleClick = (event: MouseLike) => {
    event.preventDefault?.();
    handlers.onDoubleClick(focalPoint(target, event.clientX, event.clientY));
  };

  const handleDragStart = (event: MouseLike) => {
    event.preventDefault?.();
    event.stopPropagation?.();
  };

  target.addEventListener("wheel", handleWheel as (event: never) => void, { passive: false });
  target.addEventListener("dblclick", handleDoubleClick as (event: never) => void);
  target.addEventListener("dragstart", handleDragStart as (event: never) => void);

  return () => {
    target.removeEventListener?.("wheel", handleWheel as (event: never) => void, { passive: false });
    target.removeEventListener?.("dblclick", handleDoubleClick as (event: never) => void);
    target.removeEventListener?.("dragstart", handleDragStart as (event: never) => void);
  };
}
