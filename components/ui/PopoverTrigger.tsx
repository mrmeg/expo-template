import React, { ReactNode, useRef, useState } from "react";
import { View, NativeMethods, Pressable } from "react-native";

type PopoverTriggerProps = {
  trigger: (props: { onPress: () => void }) => ReactNode;
  popover: (props: {
    visible: boolean;
    triggerRect: { width: number; height: number; x: number; y: number };
    onClose: () => void;
  }) => ReactNode;
  preferredPosition?: "top" | "bottom" | "left" | "right" | "auto";
  gap?: number;
};

export const PopoverTrigger = ({
  trigger,
  popover,
  preferredPosition = "auto",
  gap = 10
}: PopoverTriggerProps) => {
  const [visible, setVisible] = useState(false);
  const [triggerRect, setTriggerRect] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const triggerRef = useRef<View & NativeMethods>(null);
  const [layoutHeight, setLayoutHeight] = useState(0);

  const handlePress = () => {
    triggerRef.current?.measure(
      (x, y, width, height, pageX, pageY) => {
        setTriggerRect({
          width,
          height,
          x: pageX,
          y: pageY,
        });

        setVisible(true);
      }
    );
  };

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={handlePress}
        onLayout={(e) => setLayoutHeight(e.nativeEvent.layout.height)}
      >
        {/* eslint-disable-next-line react-compiler/react-compiler */}
        {trigger({ onPress: handlePress })}
      </Pressable>
      {popover({
        visible,
        triggerRect,
        onClose: () => setVisible(false)
      })}
    </>
  );
};
