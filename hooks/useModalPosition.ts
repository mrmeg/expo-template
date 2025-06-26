import { useState, useEffect } from "react";
import { useDimensions } from "./useDimensions";

type Position = { top: number; left: number };
type Size = { width: number; height: number | undefined };

export const useModalPosition = (
  initialPosition: Position,
  size?: Size,
  padding: number = 8
) => {
  const { width: screenWidth, height: screenHeight } = useDimensions();
  const [adjustedPosition, setAdjustedPosition] = useState(initialPosition);

  useEffect(() => {
    const modalWidth = size?.width || 120;
    const modalHeight = size?.height || 80;

    let newTop = initialPosition.top;
    let newLeft = initialPosition.left;

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
  }, [initialPosition, size, padding]);

  return adjustedPosition;
};
