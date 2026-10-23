import { useCallback, useRef } from "react";
import { Platform } from "react-native";

/** Everything `useMediaKeyboard` can trigger. Pass only the ones the surface supports. */
export type MediaKeyboardAction =
  | "togglePlay"
  | "seekBack"
  | "seekForward"
  | "volumeUp"
  | "volumeDown"
  | "toggleMute"
  | "toggleFullscreen"
  | "escape"
  | "previous"
  | "next"
  | "zoomIn"
  | "zoomOut"
  | "zoomReset";

export type MediaKeyboardHandlers = Partial<Record<MediaKeyboardAction, () => void>>;

/**
 * The slice of a web keyboard event this hook reads. react-native-web hands a
 * `View`'s `onKeyDown` the DOM event itself; every field is optional so a
 * native `KeyDownEvent` type still accepts the handler.
 */
export interface MediaKeyboardEvent {
  key?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  defaultPrevented?: boolean;
  target?: unknown;
  currentTarget?: unknown;
  preventDefault?: () => void;
}

/** Props to spread on the focusable container: `{ focusable, onKeyDown }` on web, `{}` on native. */
export interface MediaKeyboardProps {
  focusable?: true;
  onKeyDown?: (event: MediaKeyboardEvent) => void;
}

type DomLike = {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
};

/** Targets that own the keyboard: a typed character or a selection must reach them. */
function isTextEntry(target: unknown): boolean {
  const node = target as DomLike | null | undefined;
  if (!node || typeof node !== "object") return false;
  const tag = typeof node.tagName === "string" ? node.tagName.toUpperCase() : "";
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable === true;
}

/**
 * A control inside the container. Space presses it, so the container must not
 * also toggle playback for the same key.
 */
function isInnerControl(target: unknown, container: unknown): boolean {
  const node = target as DomLike | null | undefined;
  if (!node || typeof node !== "object" || target === container) return false;
  if (typeof node.closest !== "function") return false;
  try {
    return !!node.closest('button, a[href], summary, [role="button"], [role="link"], [role="switch"], [role="checkbox"], [role="menuitem"]');
  } catch {
    return false;
  }
}

function actionFor(key: string, handlers: MediaKeyboardHandlers, innerControl: boolean): (() => void) | undefined {
  switch (key) {
    case " ":
    case "Spacebar":
      return innerControl ? undefined : handlers.togglePlay;
    case "k":
    case "K":
      return handlers.togglePlay;
    case "ArrowLeft":
      return handlers.seekBack ?? handlers.previous;
    case "ArrowRight":
      return handlers.seekForward ?? handlers.next;
    case "ArrowUp":
      return handlers.volumeUp;
    case "ArrowDown":
      return handlers.volumeDown;
    case "m":
    case "M":
      return handlers.toggleMute;
    case "f":
    case "F":
      return handlers.toggleFullscreen;
    case "Escape":
    case "Esc":
      return handlers.escape;
    case "+":
    case "=":
      return handlers.zoomIn;
    case "-":
      return handlers.zoomOut;
    case "0":
      return handlers.zoomReset;
    default:
      return undefined;
  }
}

/**
 * Keyboard shortcuts for a media surface on web, the way players behave:
 * Space and `k` play or pause; ←/→ seek (or go to the previous / next item
 * when no seek handler is given); ↑/↓ change the volume; `m` mutes; `f`
 * toggles fullscreen; Esc closes; `+` / `=`, `-` and `0` zoom in, out and
 * reset.
 *
 * Spread the result on a focusable container (a `View`). It returns
 * `{ focusable: true, onKeyDown }` on web and `{}` on native, where there is
 * no hardware keyboard to serve. Scope is that container only, never
 * `window`: a page with two players, or a text field, is never hijacked. The
 * hook acts only on a key whose handler you passed, calls `preventDefault`
 * only then, and lets everything else through. It also passes through
 * events from `input`, `textarea`, `select` and editable targets, anything
 * with Ctrl, Cmd or Alt held (browser zoom and find), an event a child
 * already handled (`defaultPrevented`, as `MediaScrubber`'s arrow keys are),
 * and Space aimed at a button inside the container, which Space presses.
 *
 * ```tsx
 * const keyboard = useMediaKeyboard({ togglePlay, seekBack, seekForward, escape: close });
 * <View {...keyboard}>{...}</View>
 * ```
 */
export function useMediaKeyboard(handlers: MediaKeyboardHandlers): MediaKeyboardProps {
  // Read through a ref so `onKeyDown` keeps one identity while the caller's
  // handlers change every render.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const onKeyDown = useCallback((event: MediaKeyboardEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (typeof event.key !== "string" || isTextEntry(event.target)) return;

    const handler = actionFor(event.key, handlersRef.current, isInnerControl(event.target, event.currentTarget));
    if (!handler) return;

    event.preventDefault?.();
    handler();
  }, []);

  return Platform.OS === "web" ? { focusable: true, onKeyDown } : {};
}
