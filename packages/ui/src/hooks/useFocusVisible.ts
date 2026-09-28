import { useCallback, useState } from "react";
import { Platform, type NativeSyntheticEvent, type TargetedEvent } from "react-native";

export type FocusVisibleEvent = NativeSyntheticEvent<TargetedEvent>;

export interface UseFocusVisibleOptions<E = FocusVisibleEvent> {
  /** Caller's focus handler, invoked after the ring state updates. */
  onFocus?: ((event: E) => void) | null;
  /** Caller's blur handler, invoked after the ring state updates. */
  onBlur?: ((event: E) => void) | null;
}

/**
 * Focus-ring state gated on `:focus-visible`.
 *
 * On web a pointer tap focuses the element too, which left the ring visible
 * after every click; `:focus-visible` is only true for keyboard-driven focus,
 * so the ring follows it and falls back to showing when the target can't be
 * queried (non-DOM targets, older engines). Off web every focus shows the
 * ring. Spread `onFocus`/`onBlur` onto the Pressable and layer
 * `getFocusRingStyle()` while `focused` is true and the control is enabled.
 *
 * @example
 * ```tsx
 * const focus = useFocusVisible({ onFocus, onBlur });
 * <Pressable onFocus={focus.onFocus} onBlur={focus.onBlur}
 *   style={[styles.base, focus.focused && !disabled && getFocusRingStyle()]} />
 * ```
 */
export function useFocusVisible<E = FocusVisibleEvent>(options: UseFocusVisibleOptions<E> = {}) {
  const { onFocus: onFocusProp, onBlur: onBlurProp } = options;
  const [focused, setFocused] = useState(false);

  const onFocus = useCallback(
    (event: E) => {
      setFocused(isKeyboardFocus(event));
      onFocusProp?.(event);
    },
    [onFocusProp],
  );

  const onBlur = useCallback(
    (event: E) => {
      setFocused(false);
      onBlurProp?.(event);
    },
    [onBlurProp],
  );

  return { focused, onFocus, onBlur };
}

function isKeyboardFocus(event: unknown): boolean {
  if (Platform.OS !== "web") return true;
  const target = (event as { nativeEvent?: { target?: unknown } } | null | undefined)?.nativeEvent?.target as
    | { matches?: (selector: string) => boolean }
    | null
    | undefined;
  if (!target || typeof target.matches !== "function") return true;
  try {
    return target.matches(":focus-visible");
  } catch {
    return true;
  }
}
