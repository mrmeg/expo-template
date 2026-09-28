/**
 * Side and height cap for a native popover.
 *
 * `@rn-primitives/popover` places native content on the requested side and,
 * when it does not fit, clamps it to the screen edge instead of flipping, so an
 * oversized popover covers its own trigger or sits under the system bars.
 * `PopoverContent` resolves the side and a height cap here first; the content
 * then scrolls inside the cap. Web never calls this: Radix flips on its own.
 */

export type PopoverSide = "top" | "bottom";

export interface PopoverPlacementInput {
  /** Requested side; undefined means the primitive's default, `"bottom"`. */
  side: PopoverSide | undefined;
  sideOffset: number;
  /** The trigger's measured screen frame, or null until the primitive measures it. */
  trigger: { pageY: number; height: number } | null;
  screenHeight: number;
  insets: { top?: number; bottom?: number };
  /** The content's uncapped height, card chrome included; undefined while unknown. */
  naturalHeight: number | undefined;
  avoidCollisions: boolean;
}

export interface PopoverPlacement {
  side: PopoverSide;
  /** Undefined when the popover is not capped. */
  maxHeight: number | undefined;
}

/** Smallest cap; with less room than this the primitive's inset clamp places the card. */
export const POPOVER_MIN_CAP = 120;

export function resolvePopoverPlacement({
  side,
  sideOffset,
  trigger,
  screenHeight,
  insets,
  naturalHeight,
  avoidCollisions,
}: PopoverPlacementInput): PopoverPlacement {
  const requested = side ?? "bottom";
  if (!avoidCollisions || !trigger) {
    return { side: requested, maxHeight: undefined };
  }

  const room: Record<PopoverSide, number> = {
    top: trigger.pageY - sideOffset - (insets.top ?? 0),
    bottom: screenHeight - (insets.bottom ?? 0) - (trigger.pageY + trigger.height + sideOffset),
  };
  const opposite: PopoverSide = requested === "top" ? "bottom" : "top";
  // Without the natural height (not measured yet, or content that scrolls
  // itself) there is nothing to compare, so only cap the requested side.
  const flips =
    naturalHeight !== undefined &&
    naturalHeight > room[requested] &&
    room[opposite] > room[requested];
  const chosen = flips ? opposite : requested;

  return { side: chosen, maxHeight: Math.max(room[chosen], POPOVER_MIN_CAP) };
}
