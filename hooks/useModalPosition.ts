import { useState, useEffect } from "react";
import { useDimensions } from "./useDimensions";

type Position = { top: number; left: number };
type Size = { width: number; height: number | undefined };
type TriggerRect = { width: number; height: number; x: number; y: number };
type Placement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

/**
 * useModalPosition
 *
 * Ensures a modal is positioned within the visible screen bounds.
 * Useful for positioning popovers or tooltips triggered by user interaction.
 *
 * Params:
 * - initialPosition: top/left coordinates (e.g. from measure or click position)
 * - size: optional width/height of the modal (used to prevent overflow)
 * - padding: optional screen edge margin (default: 8px)
 * - triggerRect: optional dimensions and position of the trigger element
 * - placement: optional preferred placement relative to the trigger
 *
 * Returns:
 * - adjusted top/left position that fits within screen dimensions
 *
 * Example usage:
 * const position = useModalPosition({ top: 300, left: 100 }, { width: 250, height: 180 });
 */
export const useModalPosition = (
  initialPosition: Position,
  size?: Size,
  padding: number = 8,
  triggerRect?: TriggerRect,
  placement?: Placement
) => {
  const { width: screenWidth, height: screenHeight } = useDimensions();
  const [adjustedPosition, setAdjustedPosition] = useState(initialPosition);

  useEffect(() => {
    const modalWidth = size?.width || 120;
    const modalHeight = size?.height || 80;
    
    let newTop = initialPosition.top;
    let newLeft = initialPosition.left;

    // If we have trigger dimensions and a placement preference, calculate position
    if (triggerRect && triggerRect.width > 0 && placement) {
      const gap = 10; // Gap between trigger and popover
      
      switch (placement) {
        case 'top':
          newTop = triggerRect.y - modalHeight - gap;
          newLeft = triggerRect.x + (triggerRect.width / 2) - (modalWidth / 2);
          break;
        case 'bottom':
          newTop = triggerRect.y + triggerRect.height + gap;
          newLeft = triggerRect.x + (triggerRect.width / 2) - (modalWidth / 2);
          break;
        case 'left':
          newTop = triggerRect.y + (triggerRect.height / 2) - (modalHeight / 2);
          newLeft = triggerRect.x - modalWidth - gap;
          break;
        case 'right':
          newTop = triggerRect.y + (triggerRect.height / 2) - (modalHeight / 2);
          newLeft = triggerRect.x + triggerRect.width + gap;
          break;
        // Auto placement will use the initialPosition
      }
    }

    // Screen boundary checks
    if (newTop + modalHeight > screenHeight - padding) {
      newTop = Math.max(padding, screenHeight - modalHeight - padding);
    }
    if (newLeft + modalWidth > screenWidth - padding) {
      newLeft = Math.max(padding, screenWidth - modalWidth - padding);
    }

    newLeft = Math.max(padding, newLeft);
    newTop = Math.max(padding, newTop);

    setAdjustedPosition({ top: newTop, left: newLeft });
  }, [initialPosition, size, padding, screenWidth, screenHeight, triggerRect, placement]);

  return adjustedPosition;
};
