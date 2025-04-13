import React, { ReactNode, useMemo, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Dimensions,
  StyleProp,
  ViewStyle,
  Platform,
  Pressable,
} from "react-native";
import { useTheme } from "@/hooks/useTheme";

type PopoverModalProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  bottomTabOffset?: number;
  triggerRect?: { width: number; height: number; x: number; y: number };
  placement?: "top" | "bottom" | "left" | "right" | "auto";
  gap?: number;
  size?: { width: number; height: number | undefined };
};

const Header = ({ children }: { children: ReactNode }) => (
  <View style={styles.header as StyleProp<ViewStyle>}>{children}</View>
);

const Content = ({ children }: { children: ReactNode }) => (
  <View style={styles.content as StyleProp<ViewStyle>}>{children}</View>
);

const Footer = ({ children }: { children: ReactNode }) => (
  <View style={styles.footer as StyleProp<ViewStyle>}>{children}</View>
);

export const PopoverModal = ({
  visible,
  onClose,
  children,
  bottomTabOffset = 70,
  triggerRect,
  placement = "auto",
  gap = 10,
  size,
}: PopoverModalProps) => {
  const { theme } = useTheme();
  const window = Dimensions.get("window");
  const windowWidth = window.width;
  const windowHeight = window.height;
  const [measuredHeight, setMeasuredHeight] = useState(0);

  const adjustedPosition = useMemo(() => {
    if (!triggerRect) return { top: 0, left: 0 };

    const modalWidth = size?.width || 220;
    const modalHeight = measuredHeight || size?.height || 150;
    const pixelNudge = Platform.OS === "web" ? 0 : 0;

    const centeredLeft =
      triggerRect.x + triggerRect.width / 2 - modalWidth / 2;
    const safeLeft = Math.max(
      10,
      Math.min(centeredLeft, windowWidth - modalWidth - 10)
    );

    const canPlaceAbove = triggerRect.y - modalHeight - gap >= 0;
    const canPlaceBelow =
      triggerRect.y + triggerRect.height + modalHeight + gap <= windowHeight;

    let finalTop: number;
    let finalLeft: number = safeLeft;

    let resolvedPlacement = placement;

    if (placement === "auto") {
      resolvedPlacement = canPlaceBelow
        ? "bottom"
        : canPlaceAbove
        ? "top"
        : "bottom";
    }

    switch (resolvedPlacement) {
      case "top":
        finalTop = triggerRect.y - modalHeight - gap;
        break;
      case "bottom":
        finalTop = triggerRect.y + triggerRect.height + gap - pixelNudge;
        break;
      case "left":
        finalLeft = triggerRect.x - modalWidth - gap;
        finalTop = triggerRect.y;
        break;
      case "right":
        finalLeft = triggerRect.x + triggerRect.width + gap;
        finalTop = triggerRect.y;
        break;
      default:
        finalTop = triggerRect.y + triggerRect.height + gap - pixelNudge;
    }

    return { top: finalTop, left: finalLeft };
  }, [
    triggerRect,
    placement,
    gap,
    size?.height,
    measuredHeight,
    windowWidth,
    windowHeight,
  ]);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={StyleSheet.absoluteFill}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          onLayout={(e) =>
            setMeasuredHeight(e.nativeEvent.layout.height)
          }
          style={[
            styles.container,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              top: adjustedPosition.top,
              left: adjustedPosition.left,
            },
            size && { width: size.width, maxHeight: size.height },
          ]}
        >
          {children}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    minWidth: 120,
    borderRadius: 10,
    borderWidth: 0.5,
    zIndex: 5,
    maxHeight: "80%",
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 0,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 0,
    paddingBottom: 16,
  },
  footer: {
    borderTopWidth: 0.5,
  },
});

PopoverModal.Header = Header;
PopoverModal.Content = Content;
PopoverModal.Footer = Footer;
