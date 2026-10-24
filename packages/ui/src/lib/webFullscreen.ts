/**
 * Browser Fullscreen API helpers for `Video`'s custom controls.
 *
 * Plain DOM calls with the `webkit` fallbacks, in one module so a test can
 * replace them (the Jest environment has no DOM). Every `document` access is
 * guarded: this file is imported on the server too, where there is none.
 * No media-module imports, and not part of the `lib` barrel.
 */

type FullscreenElement = {
  requestFullscreen?: (options?: { navigationUI?: "hide" | "show" | "auto" }) => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = {
  fullscreenElement?: unknown;
  webkitFullscreenElement?: unknown;
  exitFullscreen?: () => Promise<void> | void;
  webkitExitFullscreen?: () => Promise<void> | void;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

const currentDocument = (): FullscreenDocument | null =>
  typeof document === "undefined" ? null : (document as unknown as FullscreenDocument);

/** Whether `node` can be made fullscreen itself (iPhone Safari cannot: only its `<video>` can). */
export function supportsElementFullscreen(node: unknown): boolean {
  const element = node as FullscreenElement | null | undefined;
  return !!element && (typeof element.requestFullscreen === "function" || typeof element.webkitRequestFullscreen === "function");
}

/** The element that is fullscreen right now, or `null`. */
export function getFullscreenElement(): unknown {
  const doc = currentDocument();
  return doc?.fullscreenElement ?? doc?.webkitFullscreenElement ?? null;
}

/**
 * Make `node` fullscreen. Resolves `false` when the browser has no element
 * fullscreen, or refuses (no user gesture, a sandboxed frame), so the caller
 * can fall back instead of failing silently.
 */
export async function enterElementFullscreen(node: unknown): Promise<boolean> {
  const element = node as FullscreenElement | null | undefined;
  if (!supportsElementFullscreen(element)) return false;
  try {
    if (typeof element?.requestFullscreen === "function") await element.requestFullscreen({ navigationUI: "hide" });
    else await element?.webkitRequestFullscreen?.();
    return true;
  } catch {
    return false;
  }
}

/** Leave fullscreen. A no-op when nothing is fullscreen. */
export async function exitElementFullscreen(): Promise<void> {
  const doc = currentDocument();
  if (!doc || getFullscreenElement() === null) return;
  try {
    if (typeof doc.exitFullscreen === "function") await doc.exitFullscreen();
    else await doc.webkitExitFullscreen?.();
  } catch {
    // Already left, or the document is going away.
  }
}

/** Call `listener` whenever any element enters or leaves fullscreen. Returns the unsubscribe. */
export function subscribeFullscreenChange(listener: () => void): () => void {
  const doc = currentDocument();
  if (!doc?.addEventListener) return () => {};
  doc.addEventListener("fullscreenchange", listener);
  doc.addEventListener("webkitfullscreenchange", listener);
  return () => {
    doc.removeEventListener?.("fullscreenchange", listener);
    doc.removeEventListener?.("webkitfullscreenchange", listener);
  };
}
