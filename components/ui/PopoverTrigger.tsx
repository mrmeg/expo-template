import React, { ReactNode, useRef, useState } from "react";
import { View, NativeMethods, Pressable, Dimensions } from "react-native";

type PopoverTriggerProps = {
  trigger: (props: { onPress: () => void }) => ReactNode;
  popover: (props: {
    visible: boolean;
    position: { top: number; left: number };
    onClose: () => void
  }) => ReactNode;
  position?: { top: number; left: number };
  preferredPosition?: "top" | "bottom" | "auto";
  popoverWidth?: number;
  popoverHeight?: number;
};

export const PopoverTrigger = ({ 
  trigger, 
  popover, 
  position: manualPosition,
  preferredPosition = "auto",
  popoverWidth = 200,
  popoverHeight = 300
}: PopoverTriggerProps) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<View & NativeMethods>(null);
  
  const windowHeight = Dimensions.get("window").height;
  const windowWidth = Dimensions.get("window").width;
  const SCREEN_PADDING = 16;

  const handlePress = () => {
    if (manualPosition) {
      setPosition(manualPosition);
      setVisible(true);
    } else {
      triggerRef.current?.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
        const spaceAbove = pageY;
        const spaceBelow = windowHeight - (pageY + height);
        
        // Calculate vertical position
        let newTop = pageY + height + 4; // Add small gap below trigger
        
        if (preferredPosition === "top" || 
            (preferredPosition === "auto" && spaceBelow < popoverHeight && spaceAbove > spaceBelow)) {
          newTop = Math.max(SCREEN_PADDING, pageY - popoverHeight - 4); // Add small gap above trigger
        }
        
        // Calculate horizontal position - align right edge of popover with right edge of trigger
        let newLeft = pageX + width - popoverWidth;
        
        // Ensure popover doesn't go off the left edge of screen
        if (newLeft < SCREEN_PADDING) {
          newLeft = SCREEN_PADDING;
        }
        
        // Ensure popover doesn't go off the right edge of screen
        if (newLeft + popoverWidth > windowWidth - SCREEN_PADDING) {
          newLeft = windowWidth - popoverWidth - SCREEN_PADDING;
        }
        
        setPosition({
          top: newTop,
          left: newLeft
        });
        setVisible(true);
      });
    }
  };

  return (
    <>
      <Pressable ref={triggerRef} onPress={handlePress}>
        {trigger({ onPress: handlePress })}
      </Pressable>
      {popover({
        visible,
        position: manualPosition || position,
        onClose: () => setVisible(false)
      })}
    </>
  );
};
