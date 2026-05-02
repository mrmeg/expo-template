import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from "react";
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
  ScrollView,
  ScrollViewProps,
} from "react-native";
import { Portal } from "@rn-primitives/portal";
import { FullWindowOverlay as RNFullWindowOverlay } from "react-native-screens";
import { Pressable as SlotPressable } from "@rn-primitives/slot";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../constants/spacing";
import { shouldUseNativeDriver } from "../lib/animations";
import { TextColorContext, TextClassContext } from "./StyledText";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * BottomSheet Component with Sub-components
 *
 * A sliding bottom sheet overlay with snap points, swipe gestures,
 * and compound component pattern matching Drawer.tsx.
 *
 * @example
 * ```tsx
 * <BottomSheet>
 *   <BottomSheet.Trigger asChild>
 *     <Button>Open Sheet</Button>
 *   </BottomSheet.Trigger>
 *   <BottomSheet.Content>
 *     <BottomSheet.Handle />
 *     <BottomSheet.Header>
 *       <SansSerifBoldText>Title</SansSerifBoldText>
 *     </BottomSheet.Header>
 *     <BottomSheet.Body>
 *       <SansSerifText>Content here</SansSerifText>
 *     </BottomSheet.Body>
 *     <BottomSheet.Footer>
 *       <Button>Action</Button>
 *     </BottomSheet.Footer>
 *   </BottomSheet.Content>
 * </BottomSheet>
 * ```
 */

// Platform-specific overlay wrapper
const FullWindowOverlay = Platform.OS === "ios" ? RNFullWindowOverlay : React.Fragment;

// ============================================================================
// Types
// ============================================================================

type SnapPoint = number | `${number}%`;

interface BottomSheetContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toggle: () => void;
  snapPoints: number[];
  currentSnapIndex: number;
  closeOnBackdropPress: boolean;
}

interface BottomSheetProps {
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Default open state for uncontrolled mode */
  defaultOpen?: boolean;
  /** Snap point heights (px or percentage strings) */
  snapPoints?: SnapPoint[];
  /** Whether to close when backdrop is pressed */
  closeOnBackdropPress?: boolean;
  children: React.ReactNode;
}

interface BottomSheetTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

interface BottomSheetContentProps extends ViewProps {
  /** Whether to enable swipe/drag gestures */
  swipeEnabled?: boolean;
  /** Velocity threshold for quick swipe to close */
  velocityThreshold?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

interface BottomSheetHeaderProps extends ViewProps {
  children: React.ReactNode;
}

interface BottomSheetBodyProps extends ScrollViewProps {
  children: React.ReactNode;
}

interface BottomSheetFooterProps extends ViewProps {
  children: React.ReactNode;
}

interface BottomSheetHandleProps {
  style?: StyleProp<ViewStyle>;
}

interface BottomSheetCloseProps {
  asChild?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// ============================================================================
// Context
// ============================================================================

const BottomSheetContext = createContext<BottomSheetContextValue | null>(null);

function useBottomSheetContext() {
  const context = useContext(BottomSheetContext);
  if (!context) {
    throw new Error("BottomSheet components must be used within a BottomSheet");
  }
  return context;
}

/**
 * Internal context for Content → Handle communication.
 * Allows Handle to initiate drag on web using the Content's animation values.
 */
interface DragContextValue {
  onDragMove: (dy: number) => void;
  onDragEnd: (dy: number, velocity: number) => void;
}

const DragContext = createContext<DragContextValue | null>(null);

// ============================================================================
// Utility Functions
// ============================================================================

function resolveSnapPoints(points: SnapPoint[]): number[] {
  const screenHeight = Dimensions.get("window").height;
  return points.map((p) => {
    if (typeof p === "number") return p;
    return (parseFloat(p) / 100) * screenHeight;
  });
}

// ============================================================================
// Reducer
// ============================================================================

type SheetAction = { type: "OPEN" } | { type: "CLOSE" } | { type: "TOGGLE" };

function sheetReducer(state: boolean, action: SheetAction): boolean {
  switch (action.type) {
    case "OPEN": return true;
    case "CLOSE": return false;
    case "TOGGLE": return !state;
  }
}

// ============================================================================
// BottomSheet Root
// ============================================================================

function BottomSheetRoot({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen = false,
  snapPoints: rawSnapPoints = ["50%"],
  closeOnBackdropPress = true,
  children,
}: BottomSheetProps) {
  const [internalOpen, dispatch] = useReducer(sheetReducer, defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const snapPoints = resolveSnapPoints(rawSnapPoints);

  const toggle = () => {
    if (isControlled) {
      controlledOnOpenChange?.(!controlledOpen);
    } else {
      dispatch({ type: "TOGGLE" });
    }
  };

  const onOpenChange = (newOpen: boolean) => {
    if (isControlled) {
      controlledOnOpenChange?.(newOpen);
    } else {
      dispatch({ type: newOpen ? "OPEN" : "CLOSE" });
    }
  };

  const contextValue: BottomSheetContextValue = {
    open,
    onOpenChange,
    toggle,
    snapPoints,
    currentSnapIndex: 0,
    closeOnBackdropPress,
  };

  return (
    <BottomSheetContext.Provider value={contextValue}>
      {children}
    </BottomSheetContext.Provider>
  );
}

// ============================================================================
// Trigger
// ============================================================================

function BottomSheetTrigger({ asChild, children, style: styleOverride }: BottomSheetTriggerProps) {
  const { toggle } = useBottomSheetContext();

  const handlePress = () => toggle();

  if (asChild && React.isValidElement(children)) {
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
// Content
// ============================================================================

function BottomSheetContent({
  swipeEnabled = true,
  velocityThreshold = 500,
  style: styleOverride,
  children,
  ...props
}: BottomSheetContentProps) {
  const sheetContext = useBottomSheetContext();
  const { open, onOpenChange, snapPoints, closeOnBackdropPress } = sheetContext;
  const { theme } = useTheme();

  // Highest snap point is the max height
  const maxHeight = Math.max(...snapPoints);
  // With bottom:0 positioning, translateY=0 means visible, translateY=maxHeight means hidden below
  const closedPosition = maxHeight;

  const translateY = useRef(new Animated.Value(open ? 0 : closedPosition)).current;
  const backdropOpacity = useRef(new Animated.Value(open ? 1 : 0)).current;

  const [isVisible, setIsVisible] = useState(open);
  const lastOpenRef = useRef<boolean | null>(null);
  const runningAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const currentHeightRef = useRef(maxHeight);

  // Track which snap we're at
  const currentSnapRef = useRef(snapPoints.length - 1);

  const textColor = theme.colors.foreground;

  // ------------------------------------------------------------------
  // Shared snap/close logic used by both native PanResponder and web drag
  // ------------------------------------------------------------------

  const handleDragRelease = useCallback(
    (dragDistance: number, velocity: number) => {
      const visibleHeight = currentHeightRef.current - dragDistance;

      if (velocity > velocityThreshold / 1000 || dragDistance > currentHeightRef.current * 0.4) {
        const lowerSnaps = snapPoints.filter((s) => s < currentHeightRef.current);

        if (lowerSnaps.length > 0 && dragDistance < currentHeightRef.current * 0.4) {
          const nextSnap = lowerSnaps[lowerSnaps.length - 1];
          currentHeightRef.current = nextSnap;
          const targetY = maxHeight - nextSnap;

          Animated.parallel([
            Animated.spring(translateY, {
              toValue: targetY,
              tension: 65,
              friction: 11,
              useNativeDriver: shouldUseNativeDriver,
            }),
            Animated.timing(backdropOpacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: shouldUseNativeDriver,
            }),
          ]).start();
        } else {
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: closedPosition,
              duration: 200,
              useNativeDriver: shouldUseNativeDriver,
            }),
            Animated.timing(backdropOpacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: shouldUseNativeDriver,
            }),
          ]).start(() => {
            onOpenChange(false);
            setIsVisible(false);
          });
        }
      } else {
        let nearestSnap = snapPoints[0];
        let minDistance = Infinity;
        for (const snap of snapPoints) {
          const dist = Math.abs(visibleHeight - snap);
          if (dist < minDistance) {
            minDistance = dist;
            nearestSnap = snap;
          }
        }

        currentHeightRef.current = nearestSnap;
        const targetY = maxHeight - nearestSnap;

        Animated.parallel([
          Animated.spring(translateY, {
            toValue: targetY,
            tension: 65,
            friction: 11,
            useNativeDriver: shouldUseNativeDriver,
          }),
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: shouldUseNativeDriver,
          }),
        ]).start();
      }
    },
    [snapPoints, maxHeight, closedPosition, translateY, backdropOpacity, onOpenChange, velocityThreshold]
  );

  const handleDragMove = useCallback(
    (dy: number) => {
      // Base offset: where the sheet sits at the current snap point
      // translateY=0 means top snap (maxHeight visible), higher values = further down
      const baseOffset = maxHeight - currentHeightRef.current;
      const newY = Math.max(baseOffset, baseOffset + dy);
      translateY.setValue(newY);
      // Progress: 1 = fully at current snap, 0 = fully closed
      const dragFromBase = newY - baseOffset;
      const progress = 1 - dragFromBase / currentHeightRef.current;
      backdropOpacity.setValue(Math.max(0, progress));
    },
    [translateY, backdropOpacity, maxHeight]
  );

  // ------------------------------------------------------------------
  // Trigger animation during render if open changed
  // ------------------------------------------------------------------

  if (open !== lastOpenRef.current) {
    const previousOpen = lastOpenRef.current;
    lastOpenRef.current = open;

    if (runningAnimationRef.current) {
      runningAnimationRef.current.stop();
      runningAnimationRef.current = null;
    }

    if (open) {
      if (!isVisible) {
        setIsVisible(true);
      }

      currentSnapRef.current = snapPoints.length - 1;
      currentHeightRef.current = maxHeight;

      if (previousOpen === null) {
        translateY.setValue(closedPosition);
        backdropOpacity.setValue(0);
      }

      const animation = Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: shouldUseNativeDriver,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: shouldUseNativeDriver,
        }),
      ]);

      runningAnimationRef.current = animation;
      animation.start(({ finished }) => {
        if (finished) runningAnimationRef.current = null;
      });
    } else if (previousOpen === true) {
      const animation = Animated.parallel([
        Animated.timing(translateY, {
          toValue: closedPosition,
          duration: 200,
          useNativeDriver: shouldUseNativeDriver,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: shouldUseNativeDriver,
        }),
      ]);

      runningAnimationRef.current = animation;
      animation.start(({ finished }) => {
        runningAnimationRef.current = null;
        if (finished) setIsVisible(false);
      });
    }
  }

  // ------------------------------------------------------------------
  // Native: PanResponder for swipe gestures on the whole sheet
  // ------------------------------------------------------------------

  const panResponder = useRef(
    Platform.OS !== "web" && swipeEnabled
      ? PanResponder.create({
          onStartShouldSetPanResponder: () => false,
          onMoveShouldSetPanResponder: (
            _evt: GestureResponderEvent,
            gestureState: PanResponderGestureState
          ) => {
            const isVertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
            const isSignificant = Math.abs(gestureState.dy) > 10;
            const isDownward = gestureState.dy > 0;
            return isVertical && isSignificant && isDownward;
          },
          onPanResponderMove: (
            _evt: GestureResponderEvent,
            gestureState: PanResponderGestureState
          ) => {
            handleDragMove(gestureState.dy);
          },
          onPanResponderRelease: (
            _evt: GestureResponderEvent,
            gestureState: PanResponderGestureState
          ) => {
            handleDragRelease(Math.max(0, gestureState.dy), gestureState.vy);
          },
        })
      : null
  ).current;

  // ------------------------------------------------------------------
  // Web: drag context provides callbacks for Handle's pointer events
  // ------------------------------------------------------------------

  const dragContextValue: DragContextValue | null =
    Platform.OS === "web" && swipeEnabled
      ? {
          onDragMove: handleDragMove,
          onDragEnd: (dy: number, velocity: number) => {
            handleDragRelease(Math.max(0, dy), velocity);
          },
        }
      : null;

  const handleBackdropPress = () => {
    if (closeOnBackdropPress) {
      onOpenChange(false);
    }
  };

  if (!isVisible && !open) {
    return null;
  }

  const sheetStyle: ViewStyle = {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: maxHeight,
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: spacing.radiusXl,
    borderTopRightRadius: spacing.radiusXl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.border,
    ...(Platform.OS === "web" && { zIndex: 51 }),
  };

  const sheetContent = (
    <TextColorContext.Provider value={textColor}>
      <TextClassContext.Provider value="">
        {children}
      </TextClassContext.Provider>
    </TextColorContext.Provider>
  );

  const contentElement = (
    <Portal name="bottom-sheet-portal">
      <FullWindowOverlay>
        <BottomSheetContext.Provider value={sheetContext}>
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

            {/* Sheet Panel */}
            <Animated.View
              style={[
                sheetStyle,
                { transform: [{ translateY }] },
                styleOverride && typeof styleOverride !== "function"
                  ? StyleSheet.flatten(styleOverride)
                  : undefined,
              ]}
              accessibilityViewIsModal={true}
              {...(Platform.OS === "web" && {
                role: "dialog",
                "aria-modal": true,
              } as any)}
              {...(panResponder ? panResponder.panHandlers : {})}
              {...props}
            >
              {dragContextValue ? (
                <DragContext.Provider value={dragContextValue}>
                  {sheetContent}
                </DragContext.Provider>
              ) : (
                sheetContent
              )}
            </Animated.View>
          </View>
        </BottomSheetContext.Provider>
      </FullWindowOverlay>
    </Portal>
  );

  return contentElement;
}

// ============================================================================
// Handle
// ============================================================================

function BottomSheetHandle({ style }: BottomSheetHandleProps) {
  const { theme } = useTheme();
  const dragCtx = useContext(DragContext);

  // Web pointer-event drag — attaches move/up listeners on document
  const dragStartY = useRef(0);
  const lastTimestamp = useRef(0);
  const lastDy = useRef(0);
  const isDragging = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web" || !dragCtx) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      const dy = e.clientY - dragStartY.current;
      const now = Date.now();
      const dt = (now - lastTimestamp.current) / 1000;
      lastTimestamp.current = now;
      lastDy.current = dy;
      dragCtx.onDragMove(dy);

      // Store velocity data on the event for release calculation
      (isDragging as any)._lastDt = dt;
      (isDragging as any)._lastDy = dy;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      const dy = e.clientY - dragStartY.current;
      const dt = (isDragging as any)._lastDt || 0.016;
      const prevDy = (isDragging as any)._lastDy || 0;
      const velocity = dt > 0 ? (dy - prevDy) / dt / 1000 : 0;
      dragCtx.onDragEnd(dy, velocity);
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
  }, [dragCtx]);

  const handlePointerDown = useCallback(
    (e: any) => {
      if (Platform.OS !== "web" || !dragCtx) return;
      isDragging.current = true;
      dragStartY.current = e.nativeEvent?.clientY ?? e.clientY;
      lastTimestamp.current = Date.now();
      lastDy.current = 0;
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    },
    [dragCtx]
  );

  return (
    <View
      style={[
        staticStyles.handleContainer,
        Platform.OS === "web" && { cursor: "grab" as any },
        style,
      ]}
      {...(Platform.OS === "web" && dragCtx
        ? { onPointerDown: handlePointerDown } as any
        : {})}
    >
      <View
        style={[
          staticStyles.handle,
          { backgroundColor: theme.colors.muted },
        ]}
      />
    </View>
  );
}

// ============================================================================
// Header
// ============================================================================

function BottomSheetHeader({ children, style, ...props }: BottomSheetHeaderProps) {
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
// Body
// ============================================================================

function BottomSheetBody({ children, style, ...props }: BottomSheetBodyProps) {
  return (
    <ScrollView
      style={[{ flex: 1 }, style]}
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
      }}
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

// ============================================================================
// Footer
// ============================================================================

function BottomSheetFooter({ children, style, ...props }: BottomSheetFooterProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: spacing.md + insets.bottom,
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
// Close
// ============================================================================

function BottomSheetClose({ asChild, children, style: styleOverride }: BottomSheetCloseProps) {
  const { onOpenChange } = useBottomSheetContext();

  const handlePress = () => onOpenChange(false);

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
// Static styles
// ============================================================================

const staticStyles = StyleSheet.create({
  handleContainer: {
    alignItems: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});

// ============================================================================
// Compound export
// ============================================================================

const BottomSheet = Object.assign(BottomSheetRoot, {
  Trigger: BottomSheetTrigger,
  Content: BottomSheetContent,
  Handle: BottomSheetHandle,
  Header: BottomSheetHeader,
  Body: BottomSheetBody,
  Footer: BottomSheetFooter,
  Close: BottomSheetClose,
});

export {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetContent,
  BottomSheetHandle,
  BottomSheetHeader,
  BottomSheetBody,
  BottomSheetFooter,
  BottomSheetClose,
  useBottomSheetContext,
};

export type {
  BottomSheetProps,
  BottomSheetTriggerProps,
  BottomSheetContentProps,
  BottomSheetHandleProps,
  BottomSheetHeaderProps,
  BottomSheetBodyProps,
  BottomSheetFooterProps,
  BottomSheetCloseProps,
};
