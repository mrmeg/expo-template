import React, { ReactNode, useRef, useState, useEffect, useMemo } from "react";
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
  StyleProp,
  ViewStyle,
  ViewProps,
  AccessibilityRole,
} from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/constants/spacing";

interface PopoverProps {
  children: ReactNode;
  placement?: "top" | "bottom" | "left" | "right" | "auto";
  offset?: number;
  crossOffset?: number;
  arrowSize?: number;
  showArrow?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  shouldCloseOnInteractOutside?: boolean;
  showOverlay?: boolean;
  overlayStyle?: StyleProp<ViewStyle>;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
}

interface PopoverTriggerProps extends ViewProps {
  children: ReactNode;
  asChild?: boolean;
}

interface PopoverContentProps extends ViewProps {
  children: ReactNode;
  width?: number;
  maxHeight?: number;
  padding?: number;
}

interface PopoverArrowProps {
  placement: "top" | "bottom" | "left" | "right";
  color?: string;
  size?: number;
}

interface PopoverHeaderProps extends ViewProps {
  children: ReactNode;
}

interface PopoverBodyProps extends ViewProps {
  children: ReactNode;
}

interface PopoverFooterProps extends ViewProps {
  children: ReactNode;
}

type PopoverPosition = {
  top: number;
  left: number;
  placement: "top" | "bottom" | "left" | "right";
  arrowLeft?: number;
  arrowTop?: number;
};

const PopoverContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  triggerRef: React.RefObject<View | null>;
  contentSize: { width: number; height: number };
  setContentSize: (size: { width: number; height: number }) => void;
  position: PopoverPosition | null;
  setPosition: (position: PopoverPosition) => void;
  placement: "top" | "bottom" | "left" | "right" | "auto";
  offset: number;
  crossOffset: number;
  showArrow: boolean;
  arrowSize: number;
  shouldCloseOnInteractOutside: boolean;
  showOverlay: boolean;
  overlayStyle?: StyleProp<ViewStyle>;
  isContentMeasured: boolean;
  setIsContentMeasured: (measured: boolean) => void;
  close: () => void;
    }>({
      isOpen: false,
      setIsOpen: () => {},
      triggerRef: { current: null },
      contentSize: { width: 0, height: 0 },
      setContentSize: () => {},
      position: null,
      setPosition: () => {},
      placement: "auto",
      offset: 8,
      crossOffset: 0,
      showArrow: false,
      arrowSize: 8,
      shouldCloseOnInteractOutside: true,
      showOverlay: true,
      isContentMeasured: false,
      setIsContentMeasured: () => {},
      close: () => {},
    });

export function Popover({
  children,
  placement = "auto",
  offset = 8,
  crossOffset = 0,
  arrowSize = 8,
  showArrow = false,
  isOpen: controlledIsOpen,
  onOpenChange,
  shouldCloseOnInteractOutside = true,
  showOverlay = true,
  overlayStyle,
  accessibilityRole = "menu",
  accessibilityLabel,
}: PopoverProps) {
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 });
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const [isContentMeasured, setIsContentMeasured] = useState(false);
  const triggerRef = useRef<View | null>(null);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : uncontrolledIsOpen;

  const setIsOpen = (open: boolean) => {
    if (controlledIsOpen === undefined) {
      setUncontrolledIsOpen(open);
    }
    onOpenChange?.(open);
  };

  const closePopover = () => {
    setIsOpen(false);
    setIsContentMeasured(false);
    setPosition(null);
  };

  const value = useMemo(
    () => ({
      isOpen,
      setIsOpen,
      triggerRef,
      contentSize,
      setContentSize,
      position,
      setPosition,
      placement,
      offset,
      crossOffset,
      showArrow,
      arrowSize,
      shouldCloseOnInteractOutside,
      showOverlay,
      overlayStyle,
      isContentMeasured,
      setIsContentMeasured,
      close: closePopover,
    }),
    [isOpen, contentSize, position, placement, offset, crossOffset, showArrow, arrowSize, shouldCloseOnInteractOutside, showOverlay, overlayStyle, isContentMeasured]
  );

  return (
    <PopoverContext.Provider value={value}>
      <View
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: isOpen }}
      >
        {children}
      </View>
    </PopoverContext.Provider>
  );
}

const PopoverTrigger = React.forwardRef<View, PopoverTriggerProps>(
  ({ children, asChild = false, ...props }, forwardedRef) => {
    const { setIsOpen, isOpen, triggerRef } = React.useContext(PopoverContext);

    const handlePress = () => {
      setIsOpen(!isOpen);
    };

    // Combine refs
    const combinedRef = React.useCallback((node: View | null) => {
      if (triggerRef) {
        (triggerRef as React.MutableRefObject<View | null>).current = node;
      }
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<View | null>).current = node;
      }
    }, [triggerRef, forwardedRef]);

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ref: combinedRef,
        onPress: (e: any) => {
          handlePress();
          (children.props as any)?.onPress?.(e);
        },
        ...props,
      });
    }

    return (
      <Pressable ref={combinedRef} onPress={handlePress} {...props}>
        {children}
      </Pressable>
    );
  }
);

PopoverTrigger.displayName = "PopoverTrigger";

function PopoverContent({
  children,
  width = 200,
  maxHeight,
  padding = 0,
  style,
  ...props
}: PopoverContentProps) {
  const { theme } = useTheme();
  const {
    isOpen,
    setIsOpen,
    triggerRef,
    contentSize,
    setContentSize,
    position,
    setPosition,
    placement,
    offset,
    crossOffset,
    showArrow,
    arrowSize,
    shouldCloseOnInteractOutside,
    showOverlay,
    overlayStyle,
    isContentMeasured,
    setIsContentMeasured,
  } = React.useContext(PopoverContext);

  const contentRef = useRef<View>(null);
  const windowDimensions = Dimensions.get("window");

  useEffect(() => {
    if (isOpen && triggerRef.current && contentSize.height > 0) {
      triggerRef.current.measure(
        (x, y, triggerWidth, triggerHeight, pageX, pageY) => {
          const calculatePosition = (): PopoverPosition => {
            const screenPadding = 16;
            const contentWidth = width;
            const contentHeight = contentSize.height;

            let finalPlacement: "top" | "bottom" | "left" | "right" = "bottom";
            let top = 0;
            let left = 0;
            let arrowLeft = 0;
            let arrowTop = 0;

            const spaceAbove = pageY - screenPadding;
            const spaceBelow = windowDimensions.height - (pageY + triggerHeight) - screenPadding;
            const spaceLeft = pageX - screenPadding;
            const spaceRight = windowDimensions.width - (pageX + triggerWidth) - screenPadding;

            if (placement === "auto") {
              if (spaceBelow >= contentHeight || spaceBelow > spaceAbove) {
                finalPlacement = "bottom";
              } else if (spaceAbove >= contentHeight) {
                finalPlacement = "top";
              } else if (spaceRight >= contentWidth) {
                finalPlacement = "right";
              } else if (spaceLeft >= contentWidth) {
                finalPlacement = "left";
              }
            } else {
              finalPlacement = placement as "top" | "bottom" | "left" | "right";
            }

            const arrowOffset = showArrow ? arrowSize : 0;

            switch (finalPlacement) {
            case "bottom":
              top = pageY + triggerHeight + offset + arrowOffset;
              left = pageX + (triggerWidth - contentWidth) / 2 + crossOffset;
              arrowLeft = contentWidth / 2 - arrowSize;
              arrowTop = -arrowSize;
              break;
            case "top":
              top = pageY - contentHeight - offset - arrowOffset;
              left = pageX + (triggerWidth - contentWidth) / 2 + crossOffset;
              arrowLeft = contentWidth / 2 - arrowSize;
              arrowTop = contentHeight;
              break;
            case "left":
              top = pageY + (triggerHeight - contentHeight) / 2 + crossOffset;
              left = pageX - contentWidth - offset - arrowOffset;
              arrowTop = contentHeight / 2 - arrowSize;
              arrowLeft = contentWidth;
              break;
            case "right":
              top = pageY + triggerHeight / 2 - contentHeight / 2 + crossOffset;
              left = pageX + triggerWidth + offset + arrowOffset;
              arrowTop = contentHeight / 2 - arrowSize;
              arrowLeft = -arrowSize;
              break;
            }

            // Ensure content stays within screen bounds
            left = Math.max(screenPadding, Math.min(left, windowDimensions.width - contentWidth - screenPadding));
            top = Math.max(screenPadding, Math.min(top, windowDimensions.height - contentHeight - screenPadding));

            return { top, left, placement: finalPlacement, arrowLeft, arrowTop };
          };

          const newPosition = calculatePosition();
          setPosition(newPosition);
        }
      );
    }
  }, [isOpen, width, maxHeight, placement, offset, crossOffset, showArrow, arrowSize, contentSize]);

  if (!isOpen) return null;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isOpen}
      onRequestClose={() => setIsOpen(false)}
    >
      <Pressable
        style={[
          showOverlay ? styles.overlay : styles.transparentOverlay,
          overlayStyle
        ]}
        onPress={shouldCloseOnInteractOutside ? () => setIsOpen(false) : undefined}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.contentContainer,
            {
              top: position ? position.top : -1000, // Render offscreen initially
              left: position ? position.left : -1000,
              width,
              maxHeight: maxHeight || windowDimensions.height * 0.8,
              opacity: position ? 1 : 0, // Hide until positioned
            },
          ]}
        >
          <View
            ref={contentRef}
            style={[
              styles.content,
              {
                backgroundColor: theme.colors["base-200"],
                borderColor: theme.colors["base-300"],
                padding,
              },
              style,
            ]}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              setContentSize({ width, height });
              if (!isContentMeasured) {
                setIsContentMeasured(true);
              }
            }}
            {...props}
          >
            {children}
            {showArrow && position && (
              <PopoverArrow
                placement={position.placement}
                color={theme.colors["base-200"]}
                size={arrowSize}
              />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PopoverArrow({ placement, color = "#fff", size = 8 }: PopoverArrowProps) {
  const { theme } = useTheme();
  const { position } = React.useContext(PopoverContext);

  if (!position) return null;

  const arrowStyle: StyleProp<ViewStyle> = {
    position: "absolute",
    width: 0,
    height: 0,
    borderStyle: "solid",
  };

  switch (placement) {
  case "bottom":
    Object.assign(arrowStyle, {
      top: -size,
      left: position.arrowLeft,
      borderLeftWidth: size,
      borderRightWidth: size,
      borderBottomWidth: size,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderBottomColor: color,
    });
    break;
  case "top":
    Object.assign(arrowStyle, {
      bottom: -size,
      left: position.arrowLeft,
      borderLeftWidth: size,
      borderRightWidth: size,
      borderTopWidth: size,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderTopColor: color,
    });
    break;
  case "left":
    Object.assign(arrowStyle, {
      right: -size,
      top: position.arrowTop,
      borderTopWidth: size,
      borderBottomWidth: size,
      borderLeftWidth: size,
      borderTopColor: "transparent",
      borderBottomColor: "transparent",
      borderLeftColor: color,
    });
    break;
  case "right":
    Object.assign(arrowStyle, {
      left: -size,
      top: position.arrowTop,
      borderTopWidth: size,
      borderBottomWidth: size,
      borderRightWidth: size,
      borderTopColor: "transparent",
      borderBottomColor: "transparent",
      borderRightColor: color,
    });
    break;
  }

  return (
    <>
      <View
        style={[
          arrowStyle,
          {
            ...arrowStyle,
            transform: [{ translateX: -1 }, { translateY: -1 }],
            borderBottomColor: placement === "bottom" ? theme.colors["base-300"] : arrowStyle.borderBottomColor,
            borderTopColor: placement === "top" ? theme.colors["base-300"] : arrowStyle.borderTopColor,
            borderLeftColor: placement === "left" ? theme.colors["base-300"] : arrowStyle.borderLeftColor,
            borderRightColor: placement === "right" ? theme.colors["base-300"] : arrowStyle.borderRightColor,
          },
        ]}
      />
      <View style={arrowStyle} />
    </>
  );
}

function PopoverHeader({ children, style, ...props }: PopoverHeaderProps) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.header,
        { borderBottomColor: theme.colors["base-300"] },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

function PopoverBody({ children, style, ...props }: PopoverBodyProps) {
  return (
    <View style={[styles.body, style]} {...props}>
      {children}
    </View>
  );
}

function PopoverFooter({ children, style, ...props }: PopoverFooterProps) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.footer,
        { borderTopColor: theme.colors["base-300"] },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  transparentOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  contentContainer: {
    position: "absolute",
  },
  content: {
    borderRadius: spacing.radiusMd,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.buttonPadding,
    borderBottomWidth: 1,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.buttonPadding,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.buttonPadding,
    borderTopWidth: 1,
  },
});

export const usePopover = () => {
  const context = React.useContext(PopoverContext);
  if (!context) {
    throw new Error("usePopover must be used within a Popover component");
  }
  return context;
};

Popover.Trigger = PopoverTrigger;
Popover.Content = PopoverContent;
Popover.Arrow = PopoverArrow;
Popover.Header = PopoverHeader;
Popover.Body = PopoverBody;
Popover.Footer = PopoverFooter;

export {
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverHeader,
  PopoverBody,
  PopoverFooter,
};
