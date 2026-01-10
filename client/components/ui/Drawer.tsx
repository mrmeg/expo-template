import React, { createContext, useContext, useState, useEffect, useRef, useId } from "react";
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
import { palette } from "@/client/constants/colors";
import { TextColorContext, TextClassContext } from "./StyledText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { drawerStore, useDrawerOpen } from "@/client/stores/drawerStore";

// Platform-specific overlay wrapper
const FullWindowOverlay = Platform.OS === "ios" ? RNFullWindowOverlay : React.Fragment;

// ============================================================================
// Types
// ============================================================================

type DrawerSide = "left" | "right";

interface DrawerContextValue {
  id: string;
  side: DrawerSide;
  width: number;
  closeOnBackdropPress: boolean;
}

interface DrawerProps {
  /** Unique identifier for this drawer instance */
  id?: string;
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
// Drawer Root Component
// ============================================================================

function DrawerRoot({
  id: providedId,
  side = "left",
  width = 300,
  closeOnBackdropPress = true,
  children,
}: DrawerProps) {
  // Generate a stable ID if not provided
  const autoId = useId();
  const id = providedId ?? autoId;

  const parsedWidth = parseWidth(width);

  const contextValue: DrawerContextValue = {
    id,
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
  const { id } = useDrawerContext();

  // Use store.getState() to always get current state - avoids closure issues
  const handlePress = () => {
    drawerStore.getState().toggle(id);
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
  const { id, side, width, closeOnBackdropPress } = useDrawerContext();
  const open = useDrawerOpen(id);
  const { theme, getShadowStyle, getContrastingColor } = useTheme();
  const insets = useSafeAreaInsets();

  // Animation values
  const [animationState] = useState(() => ({
    translateX: new Animated.Value(side === "left" ? -width : width),
    backdropOpacity: new Animated.Value(0),
  }));

  // Track if drawer is actually visible (for unmounting)
  const [isVisible, setIsVisible] = useState(false);
  const isAnimatingRef = useRef(false);

  // Calculate text color for drawer content
  const textColor = getContrastingColor(
    theme.colors.background,
    palette.white,
    palette.black
  );

  // Animate open/close
  useEffect(() => {
    if (open) {
      setIsVisible(true);
      isAnimatingRef.current = true;

      // Reset to starting position
      animationState.translateX.setValue(side === "left" ? -width : width);
      animationState.backdropOpacity.setValue(0);

      Animated.parallel([
        Animated.spring(animationState.translateX, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(animationState.backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isAnimatingRef.current = false;
      });
    } else if (isVisible) {
      isAnimatingRef.current = true;
      const targetX = side === "left" ? -width : width;

      Animated.parallel([
        Animated.spring(animationState.translateX, {
          toValue: targetX,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(animationState.backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isAnimatingRef.current = false;
        setIsVisible(false);
      });
    }
  }, [open, side, width, animationState, isVisible]);

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

            animationState.translateX.setValue(translation);

            // Update backdrop opacity based on drawer position
            const progress = 1 - Math.abs(translation) / width;
            animationState.backdropOpacity.setValue(progress);
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
                Animated.spring(animationState.translateX, {
                  toValue: targetX,
                  tension: 65,
                  friction: 11,
                  useNativeDriver: true,
                }),
                Animated.timing(animationState.backdropOpacity, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }),
              ]).start(() => {
                drawerStore.getState().close(id);
                setIsVisible(false);
              });
            } else {
              // Snap back to open
              Animated.parallel([
                Animated.spring(animationState.translateX, {
                  toValue: 0,
                  tension: 65,
                  friction: 11,
                  useNativeDriver: true,
                }),
                Animated.timing(animationState.backdropOpacity, {
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

  // Handle backdrop press - use store.getState() to avoid closure issues
  const handleBackdropPress = () => {
    if (closeOnBackdropPress && !isAnimatingRef.current) {
      drawerStore.getState().close(id);
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
        <View style={StyleSheet.absoluteFill}>
          {/* Backdrop */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: theme.colors.overlay,
                opacity: animationState.backdropOpacity,
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
                transform: [{ translateX: animationState.translateX }],
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
  const { id } = useDrawerContext();
  return () => drawerStore.getState().close(id);
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Drawer Component with Sub-components
 *
 * A sliding drawer overlay that can appear from left or right side.
 * Uses Zustand store for state management to avoid closure issues.
 * Supports swipe gestures on native platforms and backdrop press to close.
 *
 * @example
 * ```tsx
 * <Drawer id="main-menu" side="left">
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
 *       <Button onPress={() => drawerStore.getState().close('main-menu')}>Close</Button>
 *     </Drawer.Footer>
 *   </Drawer.Content>
 * </Drawer>
 * ```
 */
const Drawer = Object.assign(DrawerRoot, {
  Trigger: DrawerTrigger,
  Content: DrawerContent,
  Header: DrawerHeader,
  Body: DrawerBody,
  Footer: DrawerFooter,
});

export {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  useDrawerClose,
};

export type {
  DrawerProps,
  DrawerTriggerProps,
  DrawerContentProps,
  DrawerHeaderProps,
  DrawerBodyProps,
  DrawerFooterProps,
};
