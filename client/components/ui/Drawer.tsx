import React, { createContext, useContext, useState, useReducer, useRef } from "react";
import {
  View,
  ViewProps,
  Pressable,
  Animated,
  StyleSheet,
  Platform,
  Dimensions,
  StyleProp,
  ViewStyle,
  PanResponder,
  PanResponderGestureState,
  GestureResponderEvent,
} from "react-native";
import { Portal } from "@rn-primitives/portal";
import { FullWindowOverlay as RNFullWindowOverlay } from "react-native-screens";
import { Pressable as SlotPressable } from "@rn-primitives/slot";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { TextColorContext, TextClassContext } from "./StyledText";
import { useSafeAreaInsets } from "react-native-safe-area-context";


/**
 * Drawer Component with Sub-components
 *
 * A sliding drawer overlay that can appear from left or right side.
 * Supports both controlled and uncontrolled modes.
 * Supports swipe gestures on native platforms and backdrop press to close.
 *
 * @example
 * ```tsx
 * // Uncontrolled (internal state management)
 * <Drawer side="left">
 *   <Drawer.Trigger asChild>
 *     <Button>Open Menu</Button>
 *   </Drawer.Trigger>
 *   <Drawer.Content>
 *     <Drawer.Header>
 *       <SansSerifBoldText>Menu</SansSerifBoldText>
 *     </Drawer.Header>
 *     <Drawer.Body>
 *       <SansSerifText>Content here</SansSerifText>
 *     </Drawer.Body>
 *     <Drawer.Footer>
 *       <DrawerCloseButton />
 *     </Drawer.Footer>
 *   </Drawer.Content>
 * </Drawer>
 *
 * // Controlled (parent manages state)
 * const [open, setOpen] = useState(false);
 * <Drawer open={open} onOpenChange={setOpen} side="left">
 *   ...
 * </Drawer>
 * ```
 */


// Platform-specific overlay wrapper
const FullWindowOverlay = Platform.OS === "ios" ? RNFullWindowOverlay : React.Fragment;

// ============================================================================
// Types
// ============================================================================

type DrawerSide = "left" | "right";

interface DrawerContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toggle: () => void;
  side: DrawerSide;
  width: number;
  closeOnBackdropPress: boolean;
}

interface DrawerProps {
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Default open state for uncontrolled mode */
  defaultOpen?: boolean;
  /** Which side the drawer appears from */
  side?: DrawerSide;
  /** Drawer width in pixels or percentage string */
  width?: number | `${number}%`;
  /** Whether to close when backdrop is pressed */
  closeOnBackdropPress?: boolean;
  /** Children components */
  children: React.ReactNode;
}

interface DrawerTriggerProps {
  /** Use child component as trigger */
  asChild?: boolean;
  /** Children components */
  children: React.ReactNode;
  /** Optional style override */
  style?: StyleProp<ViewStyle>;
}

interface DrawerContentProps extends ViewProps {
  /** Whether to enable swipe gestures (native only) */
  swipeEnabled?: boolean;
  /** Swipe threshold to trigger close (0-1, percentage of width) */
  swipeThreshold?: number;
  /** Velocity threshold for quick swipe */
  velocityThreshold?: number;
  /** Optional style override */
  style?: StyleProp<ViewStyle>;
  /** Children components */
  children: React.ReactNode;
}

interface DrawerHeaderProps extends ViewProps {
  children: React.ReactNode;
}

interface DrawerBodyProps extends ViewProps {
  children: React.ReactNode;
}

interface DrawerFooterProps extends ViewProps {
  children: React.ReactNode;
}

// ============================================================================
// Context
// ============================================================================

const DrawerContext = createContext<DrawerContextValue | null>(null);

function useDrawerContext() {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error("Drawer components must be used within a Drawer");
  }
  return context;
}

// ============================================================================
// Utility Functions
// ============================================================================

function parseWidth(width: number | `${number}%`): number {
  if (typeof width === "number") {
    return width;
  }
  // Parse percentage string
  const percentage = parseFloat(width) / 100;
  const screenWidth = Dimensions.get("window").width;
  return screenWidth * percentage;
}

// ============================================================================
// Reducer for stable state management
// ============================================================================

type DrawerAction = { type: 'OPEN' } | { type: 'CLOSE' } | { type: 'TOGGLE' };

function drawerReducer(state: boolean, action: DrawerAction): boolean {
  switch (action.type) {
    case 'OPEN': return true;
    case 'CLOSE': return false;
    case 'TOGGLE': return !state;  // Always uses current state!
  }
}

// ============================================================================
// Drawer Root Component
// ============================================================================

function DrawerRoot({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen = false,
  side = "left",
  width = 300,
  closeOnBackdropPress = true,
  children,
}: DrawerProps) {
  // Use reducer for stable state management - dispatch is stable and reducer always gets current state
  const [internalOpen, dispatch] = useReducer(drawerReducer, defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  // Stable toggle function - dispatch is stable across renders
  const toggle = () => {
    if (isControlled) {
      // For controlled mode, we need to call the callback with the toggled value
      // We use a functional update pattern via dispatch to ensure we get current state
      controlledOnOpenChange?.(!controlledOpen);
    } else {
      dispatch({ type: 'TOGGLE' });
    }
  };

  // Handler for explicit open/close actions
  const onOpenChange = (newOpen: boolean) => {
    if (isControlled) {
      controlledOnOpenChange?.(newOpen);
    } else {
      dispatch({ type: newOpen ? 'OPEN' : 'CLOSE' });
    }
  };

  const parsedWidth = parseWidth(width);

  const contextValue: DrawerContextValue = {
    open,
    onOpenChange,
    toggle,
    side,
    width: parsedWidth,
    closeOnBackdropPress,
  };

  return (
    <DrawerContext.Provider value={contextValue}>
      {children}
    </DrawerContext.Provider>
  );
}

// ============================================================================
// Drawer Trigger Component
// ============================================================================

function DrawerTrigger({ asChild, children, style: styleOverride }: DrawerTriggerProps) {
  const { toggle } = useDrawerContext();

  // Use toggle directly - it reads current state from a ref, avoiding stale closures
  const handlePress = () => {
    toggle();
  };

  if (asChild && React.isValidElement(children)) {
    // Clone child and inject onPress directly instead of using SlotPressable
    return React.cloneElement(children as React.ReactElement<any>, {
      onPress: handlePress,
      style: [
        (children as React.ReactElement<any>).props.style,
        Platform.OS === "web" && { cursor: "pointer" as any },
        styleOverride,
      ],
    });
  }

  return (
    <Pressable
      onPress={handlePress}
      style={[
        Platform.OS === "web" && { cursor: "pointer" as any },
        styleOverride,
      ]}
    >
      {children}
    </Pressable>
  );
}

// ============================================================================
// Drawer Content Component
// ============================================================================

function DrawerContent({
  swipeEnabled = true,
  swipeThreshold = 0.3,
  velocityThreshold = 500,
  style: styleOverride,
  children,
  ...props
}: DrawerContentProps) {
  const drawerContext = useDrawerContext();
  const { open, onOpenChange, side, width, closeOnBackdropPress } = drawerContext;
  const { theme, getShadowStyle } = useTheme();
  const insets = useSafeAreaInsets();

  // Animation values - initialize based on initial open state
  const closedPosition = side === "left" ? -width : width;
  const translateX = useRef(new Animated.Value(open ? 0 : closedPosition)).current;
  const backdropOpacity = useRef(new Animated.Value(open ? 1 : 0)).current;

  // Track if drawer is actually visible (for unmounting after close animation)
  const [isVisible, setIsVisible] = useState(open);

  // Track what we last animated to - persists across renders
  const lastOpenRef = useRef<boolean | null>(null);

  // Track running animation to properly cancel it
  const runningAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Use semantic foreground color for text on background
  const textColor = theme.colors.foreground;

  // Trigger animation during render if open changed
  if (open !== lastOpenRef.current) {
    const previousOpen = lastOpenRef.current;
    lastOpenRef.current = open;

    // Stop any running animations immediately
    if (runningAnimationRef.current) {
      runningAnimationRef.current.stop();
      runningAnimationRef.current = null;
    }

    if (open) {
      // Opening - set visible immediately
      if (!isVisible) {
        setIsVisible(true);
      }

      // If this is first render (previousOpen is null), set initial position
      // Otherwise animate from current position (handles mid-animation toggle)
      if (previousOpen === null) {
        translateX.setValue(closedPosition);
        backdropOpacity.setValue(0);
      }

      // Animate to open position from wherever we are
      const animation = Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]);

      runningAnimationRef.current = animation;
      animation.start(({ finished }) => {
        if (finished) {
          runningAnimationRef.current = null;
        }
      });
    } else if (previousOpen === true) {
      // Closing - only animate if we were actually open (skip mount when drawer starts closed)
      const animation = Animated.parallel([
        Animated.timing(translateX, {
          toValue: closedPosition,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]);

      runningAnimationRef.current = animation;
      animation.start(({ finished }) => {
        runningAnimationRef.current = null;
        // Only hide if animation completed (wasn't interrupted)
        if (finished) {
          setIsVisible(false);
        }
      });
    }
  }

  // Create pan responder for swipe gestures (native only)
  const panResponder = useRef(
    Platform.OS !== "web" && swipeEnabled
      ? PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (
          _evt: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          // Only respond to horizontal swipes
          const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
          const isSignificant = Math.abs(gestureState.dx) > 10;

          // For left drawer, only respond to leftward swipes (negative dx)
          // For right drawer, only respond to rightward swipes (positive dx)
          const isCorrectDirection =
            (side === "left" && gestureState.dx < 0) ||
            (side === "right" && gestureState.dx > 0);

          return isHorizontal && isSignificant && isCorrectDirection;
        },
        onPanResponderMove: (
          _evt: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          // Clamp the translation
          let translation: number;
          if (side === "left") {
            // Left drawer: allow negative translation (closing)
            translation = Math.min(0, Math.max(-width, gestureState.dx));
          } else {
            // Right drawer: allow positive translation (closing)
            translation = Math.max(0, Math.min(width, gestureState.dx));
          }

          translateX.setValue(translation);

          // Update backdrop opacity based on drawer position
          const progress = 1 - Math.abs(translation) / width;
          backdropOpacity.setValue(progress);
        },
        onPanResponderRelease: (
          _evt: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          const velocity = side === "left" ? -gestureState.vx : gestureState.vx;
          const translation = Math.abs(gestureState.dx);

          // Determine if we should close
          const shouldClose =
            translation > width * swipeThreshold || velocity > velocityThreshold / 1000;

          if (shouldClose) {
            // Animate to closed
            const targetX = side === "left" ? -width : width;
            Animated.parallel([
              Animated.spring(translateX, {
                toValue: targetX,
                tension: 65,
                friction: 11,
                useNativeDriver: true,
              }),
              Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start(() => {
              onOpenChange(false);
              setIsVisible(false);
            });
          } else {
            // Snap back to open
            Animated.parallel([
              Animated.spring(translateX, {
                toValue: 0,
                tension: 65,
                friction: 11,
                useNativeDriver: true,
              }),
              Animated.timing(backdropOpacity, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
              }),
            ]).start();
          }
        },
      })
      : null
  ).current;

  // Handle backdrop press
  const handleBackdropPress = () => {
    if (closeOnBackdropPress) {
      onOpenChange(false);
    }
  };

  // Don't render if not visible
  if (!isVisible && !open) {
    return null;
  }

  const shadowStyle = StyleSheet.flatten(getShadowStyle("soft"));

  const drawerStyle: ViewStyle = {
    position: "absolute",
    top: 0,
    bottom: 0,
    width,
    [side]: 0,
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    ...(side === "left"
      ? { borderRightWidth: 1 }
      : { borderLeftWidth: 1 }),
    ...shadowStyle,
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
    ...(Platform.OS === "web" && { zIndex: 51 }),
  };

  const contentElement = (
    <Portal name="drawer-portal">
      <FullWindowOverlay>
        {/* Re-provide context inside Portal since Portal breaks context tree */}
        <DrawerContext.Provider value={drawerContext}>
          <View style={StyleSheet.absoluteFill}>
            {/* Backdrop */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: theme.colors.overlay,
                  opacity: backdropOpacity,
                },
                Platform.OS === "web" && { zIndex: 50 },
              ]}
            >
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={handleBackdropPress}
              />
            </Animated.View>

            {/* Drawer Panel */}
            <Animated.View
              style={[
                drawerStyle,
                {
                  transform: [{ translateX }],
                },
                styleOverride && typeof styleOverride !== "function"
                  ? StyleSheet.flatten(styleOverride)
                  : undefined,
              ]}
              {...(panResponder ? panResponder.panHandlers : {})}
              {...props}
            >
              <TextColorContext.Provider value={textColor}>
                <TextClassContext.Provider value="">
                  {children}
                </TextClassContext.Provider>
              </TextColorContext.Provider>
            </Animated.View>
          </View>
        </DrawerContext.Provider>
      </FullWindowOverlay>
    </Portal>
  );

  return contentElement;
}

// ============================================================================
// Drawer Header Component
// ============================================================================

function DrawerHeader({ children, style, ...props }: DrawerHeaderProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

// ============================================================================
// Drawer Body Component
// ============================================================================

function DrawerBody({ children, style, ...props }: DrawerBodyProps) {
  return (
    <View
      style={[
        {
          flex: 1,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

// ============================================================================
// Drawer Footer Component
// ============================================================================

function DrawerFooter({ children, style, ...props }: DrawerFooterProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

// ============================================================================
// Close Button Hook (for programmatic close from within drawer)
// ============================================================================

function useDrawerClose() {
  const { onOpenChange } = useDrawerContext();
  return () => onOpenChange(false);
}

// ============================================================================
// Drawer Close Component (for close buttons inside drawer)
// ============================================================================

interface DrawerCloseProps {
  /** Use child component as close button */
  asChild?: boolean;
  /** Children components */
  children: React.ReactNode;
  /** Optional style override */
  style?: StyleProp<ViewStyle>;
}

function DrawerClose({ asChild, children, style: styleOverride }: DrawerCloseProps) {
  const { onOpenChange } = useDrawerContext();

  const handlePress = () => {
    onOpenChange(false);
  };

  if (asChild) {
    return (
      <SlotPressable
        onPress={handlePress}
        style={[
          Platform.OS === "web" && { cursor: "pointer" as any },
          styleOverride,
        ]}
      >
        {children}
      </SlotPressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={[
        Platform.OS === "web" && { cursor: "pointer" as any },
        styleOverride,
      ]}
    >
      {children}
    </Pressable>
  );
}

const Drawer = Object.assign(DrawerRoot, {
  Trigger: DrawerTrigger,
  Content: DrawerContent,
  Header: DrawerHeader,
  Body: DrawerBody,
  Footer: DrawerFooter,
  Close: DrawerClose,
});

export {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerClose,
  useDrawerClose,
};

export type {
  DrawerProps,
  DrawerTriggerProps,
  DrawerContentProps,
  DrawerHeaderProps,
  DrawerBodyProps,
  DrawerFooterProps,
  DrawerCloseProps,
};
