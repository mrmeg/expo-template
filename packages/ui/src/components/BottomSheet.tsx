import React, { createContext, use, useCallback, useEffect, useMemo, useReducer, useRef, useSyncExternalStore } from "react";
import {
  View,
  ViewProps,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
  ScrollView,
  ScrollViewProps,
  Platform,
  useWindowDimensions,
} from "react-native";
import { BottomSheet as NativeBottomSheet } from "@expo/ui/community/bottom-sheet";
import { KeyboardController } from "react-native-keyboard-controller";
import { useSafeAreaInsets, initialWindowMetrics } from "react-native-safe-area-context";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../constants/spacing";
import { TextColorContext, TextClassContext } from "./StyledText.context";
import { Icon } from "./Icon";
import {
  dismissKeyboardFocusedInput,
  hasKeyboardFocusedInput,
  subscribeKeyboardFocus,
} from "./keyboardFocusRegistry";

/**
 * BottomSheet — a sliding bottom sheet with a compound API, backed by the
 * platform's native sheet via `@expo/ui/community/bottom-sheet`:
 *
 *   - iOS:     SwiftUI `.sheet()` with presentation detents
 *   - Android: Material3 `ModalBottomSheet`
 *   - Web:     `vaul` drawer (bundled with @expo/ui)
 *
 * The compound surface (Trigger / Content / Handle / Header / Body / Footer /
 * Close), controlled + uncontrolled state, and theming match a hand-rolled
 * sheet, but the platform owns gestures and keyboard avoidance — so there's no
 * PanResponder, snap-physics, or keyboard lift-and-shrink code to maintain.
 *
 * Platform-owned behaviors (props accepted for ergonomics, but the platform
 * decides):
 *   - `.Handle` replaces the native drag indicator with a pressable equivalent.
 *     Pressing it walks through the configured snap points, reversing direction
 *     at either end. Dragging the sheet continues to use the platform gesture.
 *   - `swipeEnabled` / `avoidKeyboard` / `dismissKeyboardOnDrag` are accepted
 *     for call-site ergonomics but have no effect — the platform handles them.
 *   - Sheet *chrome* (corner radius, system background, safe area) is the
 *     platform's on native; theming reaches the content + background color.
 *   - On Android only two snap states exist (partial / expanded); extra snap
 *     points map to the nearest of those two.
 *
 * Scrollable bodies: the native sheet doesn't bound the hosted RN content to
 * the detent height, so a tall `Body` overflows and clips its footer/tail. When
 * `Body` detects overflow, `Content` caps the column to the detent height so the
 * `ScrollView` actually scrolls to the bottom. Swipe-to-dismiss still works (the
 * native sheet coordinates the pan: a pull at the top of the scroll view
 * dismisses, elsewhere it scrolls). A close affordance is also surfaced for
 * scrollable sheets so there's a one-tap close: the `Header` renders a trailing
 * X, or — if there's no `Header` — `Content` floats one in the top-right corner.
 * No extra props required.
 *
 * @example
 * ```tsx
 * <BottomSheet open={open} onOpenChange={setOpen} snapPoints={["50%"]}>
 *   <BottomSheet.Trigger asChild>
 *     <Button>Open</Button>
 *   </BottomSheet.Trigger>
 *   <BottomSheet.Content>
 *     <BottomSheet.Header>
 *       <SansSerifBoldText>Title</SansSerifBoldText>
 *     </BottomSheet.Header>
 *     <BottomSheet.Body>
 *       <SansSerifText>Content</SansSerifText>
 *     </BottomSheet.Body>
 *     <BottomSheet.Footer>
 *       <Button>Action</Button>
 *     </BottomSheet.Footer>
 *   </BottomSheet.Content>
 * </BottomSheet>
 * ```
 */

// ============================================================================
// Types
// ============================================================================

type SnapPoint = number | `${number}%`;

const DEFAULT_SNAP_POINTS: SnapPoint[] = ["50%"];

interface BottomSheetContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toggle: () => void;
  snapPoints: SnapPoint[];
  snapIndex: number;
  setSnapIndex: (index: number) => void;
  cycleSnapPoint: () => void;
  closeOnBackdropPress: boolean;
  /**
   * True when a `Body`'s content overflows its viewport (is genuinely
   * scrollable). Drives two things: `Content` caps the column to the detent
   * height so the `ScrollView` can reach its bottom, and a close affordance is
   * surfaced (a `Header` X, or floating if there's no `Header`) so a long sheet
   * always has a one-tap close. Set by `Body`.
   */
  scrollable: boolean;
  setScrollable: (scrollable: boolean) => void;
  /** Whether a `Header` is mounted, so `Content` knows to render a fallback close. */
  hasHeader: boolean;
  setHasHeader: (present: boolean) => void;
  /** Whether a `Footer` is mounted, so `Body` can own the bottom safe-area inset when it isn't. */
  hasFooter: boolean;
  setHasFooter: (present: boolean) => void;
}

interface BottomSheetProps {
  /** Controlled open state. Omit to use uncontrolled mode with `defaultOpen`. */
  open?: boolean;
  /** Callback when open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Initial open state for uncontrolled mode. Default: false. */
  defaultOpen?: boolean;
  /** Snap point heights (px or percentage strings). Default: ["50%"]. */
  snapPoints?: SnapPoint[];
  /**
   * Whether swiping/pulling down (or tapping the backdrop) dismisses the sheet.
   * Maps to the native sheet's `enablePanDownToClose` (iOS
   * `interactiveDismissDisabled`). Default: true.
   *
   * Works with scrollable bodies — the native sheet coordinates the pan (pull at
   * the top of the scroll view dismisses, elsewhere it scrolls). Set to `false`
   * to disable dismiss entirely; the sheet then surfaces an explicit close
   * affordance automatically (a `Header` X, or a floating X if there's no
   * `Header`). Scrollable sheets also get that close affordance regardless, so
   * there's always a one-tap close.
   */
  closeOnBackdropPress?: boolean;
  children: React.ReactNode;
}

interface BottomSheetTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

interface BottomSheetContentProps extends ViewProps {
  /** Accepted for call-site ergonomics; ignored (platform owns gestures). */
  swipeEnabled?: boolean;
  /** Accepted for call-site ergonomics; ignored (platform owns keyboard avoidance). */
  avoidKeyboard?: boolean;
  /** Accepted for call-site ergonomics; ignored (platform owns keyboard). */
  dismissKeyboardOnDrag?: boolean;
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

type SnapDirection = -1 | 1;

interface BottomSheetRootState {
  internalOpen: boolean;
  scrollable: boolean;
  hasHeader: boolean;
  hasFooter: boolean;
  snapIndex: number;
  snapDirection: SnapDirection;
}

type BottomSheetRootAction =
  | { type: "setInternalOpen"; open: boolean; maxSnapIndex: number }
  | { type: "setScrollable"; scrollable: boolean }
  | { type: "setHasHeader"; present: boolean }
  | { type: "setHasFooter"; present: boolean }
  | { type: "setSnapIndex"; index: number; maxSnapIndex: number }
  | { type: "cycleSnapPoint"; maxSnapIndex: number; android: boolean };

function clampSnapIndex(index: number, maxSnapIndex: number) {
  return Math.min(Math.max(index, 0), maxSnapIndex);
}

function createInitialRootState(defaultOpen: boolean, maxSnapIndex: number): BottomSheetRootState {
  return {
    internalOpen: defaultOpen,
    scrollable: false,
    hasHeader: false,
    hasFooter: false,
    snapIndex: maxSnapIndex,
    snapDirection: -1,
  };
}

function bottomSheetRootReducer(
  state: BottomSheetRootState,
  action: BottomSheetRootAction
): BottomSheetRootState {
  switch (action.type) {
    case "setInternalOpen": {
      const snapIndex = action.open ? state.snapIndex : action.maxSnapIndex;
      const snapDirection = action.open ? state.snapDirection : -1;

      if (
        state.internalOpen === action.open &&
        state.snapIndex === snapIndex &&
        state.snapDirection === snapDirection
      ) {
        return state;
      }

      return {
        ...state,
        internalOpen: action.open,
        snapIndex,
        snapDirection,
      };
    }
    case "setScrollable":
      if (state.scrollable === action.scrollable) return state;
      return { ...state, scrollable: action.scrollable };
    case "setHasHeader":
      if (state.hasHeader === action.present) return state;
      return { ...state, hasHeader: action.present };
    case "setHasFooter":
      if (state.hasFooter === action.present) return state;
      return { ...state, hasFooter: action.present };
    case "setSnapIndex": {
      const snapIndex = clampSnapIndex(action.index, action.maxSnapIndex);
      const snapDirection =
        snapIndex === 0 ? 1 : snapIndex === action.maxSnapIndex ? -1 : state.snapDirection;

      if (state.snapIndex === snapIndex && state.snapDirection === snapDirection) return state;

      return {
        ...state,
        snapIndex,
        snapDirection,
      };
    }
    case "cycleSnapPoint": {
      if (action.maxSnapIndex === 0) return state;

      if (action.android) {
        const snapIndex = state.snapIndex === action.maxSnapIndex ? 0 : action.maxSnapIndex;
        return { ...state, snapIndex, snapDirection: snapIndex === 0 ? 1 : -1 };
      }

      let snapDirection = state.snapDirection;
      if (state.snapIndex <= 0) snapDirection = 1;
      if (state.snapIndex >= action.maxSnapIndex) snapDirection = -1;

      return {
        ...state,
        snapIndex: state.snapIndex + snapDirection,
        snapDirection,
      };
    }
  }
}

// ============================================================================
// Context
// ============================================================================

const BottomSheetContext = createContext<BottomSheetContextValue | null>(null);

function useBottomSheetContext() {
  const context = use(BottomSheetContext);
  if (!context) {
    throw new Error("BottomSheet components must be used within a BottomSheet");
  }
  return context;
}

/**
 * Safe-area insets for content *inside* the sheet.
 *
 * The native sheet (SwiftUI `.sheet()` / Material `ModalBottomSheet`) is
 * presented outside the React tree's `SafeAreaProvider`, so `useSafeAreaInsets()`
 * reads all-zero in here. Fall back to `initialWindowMetrics` — the same trick
 * the app uses for its full-screen Modals — so bottom padding actually clears
 * the home indicator and the last row of a scroll body is reachable.
 */
function useSheetInsets() {
  const insets = useSafeAreaInsets();
  const fallback = initialWindowMetrics?.insets;
  return {
    top: insets.top || fallback?.top || 0,
    bottom: insets.bottom || fallback?.bottom || 0,
    left: insets.left || fallback?.left || 0,
    right: insets.right || fallback?.right || 0,
  };
}

/**
 * Interactive (pull-down / backdrop) dismiss is off only when the consumer
 * explicitly turned it off (`closeOnBackdropPress={false}`). Scrollable bodies
 * keep swipe-to-dismiss: the native sheet coordinates the gesture itself (a pull
 * at the top of the scroll view dismisses; elsewhere it scrolls), so there's no
 * conflict to work around once the content column is height-bounded.
 */
function useDismissDisabled() {
  const { closeOnBackdropPress } = useBottomSheetContext();
  return !closeOnBackdropPress;
}

/**
 * Whether to surface an explicit close affordance (the auto X). True when:
 *   - swipe/backdrop dismiss is off (otherwise there'd be no way to close), or
 *   - the body scrolls — so a long sheet always has a one-tap close without
 *     hunting for a footer button or pulling the sheet down.
 */
function useShowClose() {
  const { scrollable } = useBottomSheetContext();
  return useDismissDisabled() || scrollable;
}

// ============================================================================
// Auto close button — shown when interactive dismiss is off
// ============================================================================

function SheetCloseButton({ style }: { style?: StyleProp<ViewStyle> }) {
  const { onOpenChange } = useBottomSheetContext();
  const { theme } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      onPress={() => onOpenChange(false)}
      hitSlop={spacing.sm}
      style={({ pressed }) => [
        {
          width: spacing.xl,
          height: spacing.xl,
          borderRadius: spacing.xl / 2,
          alignItems: "center",
          justifyContent: "center",
          // Higher-contrast than `muted`: a solid `secondary` fill with a
          // bordered edge so the control reads clearly against the card, and a
          // full-strength `foreground` glyph instead of the faint muted one.
          backgroundColor: theme.colors.secondary,
          borderWidth: 1,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.7 : 1,
        },
        Platform.OS === "web" && { cursor: "pointer" as any },
        style,
      ]}
    >
      <Icon name="x" size={22} color="text" />
    </Pressable>
  );
}

// ============================================================================
// Keyboard dismiss overlay — tap-away dismissal inside the sheet
// ============================================================================

/**
 * Tap-away keyboard dismissal for sheet content.
 *
 * The native sheet (SwiftUI `.sheet()` / Material `ModalBottomSheet`) hosts its
 * RN children in a separate native window via @expo/ui's `RNHostView`, OUTSIDE
 * the app's `KeyboardProvider` / `KeyboardDismissBoundary`. Two consequences,
 * both worked around here:
 *
 *  1. Detection: `react-native-keyboard-controller`'s `useKeyboardState` watches
 *     the main window and does NOT see a keyboard raised inside the sheet's
 *     window (the same isolation that makes `useSafeAreaInsets()` read zero in
 *     here). So presence is read from the `keyboardFocusRegistry` instead, which
 *     is fed by @expo/ui's own native focus events and is window-independent.
 *  2. Dispatch: RN's JS responder chain (onStartShouldSetResponder*) is NOT
 *     dispatched across the `RNHostView` boundary on Android — only `Pressable`
 *     hit-testing (native `measure()`) works inside the host. So this is a
 *     transparent `Pressable` mounted ONLY while a field is focused, mirroring
 *     the app's `DismissKeyboardOverlay`. The tap blurs the focused field via
 *     its own native ref (`dismissKeyboardFocusedInput`), which resigns the
 *     responder regardless of window; `KeyboardController.dismiss()` is a
 *     best-effort fallback for the (rare) case with no registered blur handle.
 *
 * iOS doesn't strictly need this (SwiftUI resigns first-responder on outside
 * taps for free), but the same path is harmless and keeps behavior identical.
 */
function SheetKeyboardDismissOverlay() {
  const hasFocus = useSyncExternalStore(
    subscribeKeyboardFocus,
    hasKeyboardFocusedInput,
    () => false
  );

  if (Platform.OS === "web" || !hasFocus) return null;

  return (
    <Pressable
      style={[StyleSheet.absoluteFill, styles.keyboardDismissOverlay]}
      onPressIn={() => {
        if (!dismissKeyboardFocusedInput()) KeyboardController.dismiss();
      }}
      accessibilityLabel="Dismiss keyboard"
      accessibilityRole="button"
    />
  );
}

const styles = StyleSheet.create({
  keyboardDismissOverlay: {
    zIndex: 999,
  },
});

// ============================================================================
// Root
// ============================================================================

function BottomSheetRoot({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen = false,
  snapPoints = DEFAULT_SNAP_POINTS,
  closeOnBackdropPress = true,
  children,
}: BottomSheetProps) {
  const maxSnapIndex = Math.max(snapPoints.length - 1, 0);
  const [state, dispatch] = useReducer(
    bottomSheetRootReducer,
    undefined,
    () => createInitialRootState(defaultOpen, maxSnapIndex)
  );

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : state.internalOpen;
  const snapIndex = clampSnapIndex(state.snapIndex, maxSnapIndex);

  const setSnapIndex = useCallback(
    (index: number) => {
      dispatch({ type: "setSnapIndex", index, maxSnapIndex });
    },
    [maxSnapIndex]
  );

  const cycleSnapPoint = useCallback(() => {
    dispatch({
      type: "cycleSnapPoint",
      maxSnapIndex,
      android: Platform.OS === "android",
    });
  }, [maxSnapIndex]);

  const onOpenChange = useCallback((newOpen: boolean) => {
    if (isControlled) {
      controlledOnOpenChange?.(newOpen);
    } else {
      dispatch({ type: "setInternalOpen", open: newOpen, maxSnapIndex });
    }
  }, [controlledOnOpenChange, isControlled, maxSnapIndex]);

  const toggle = useCallback(() => onOpenChange(!open), [onOpenChange, open]);

  const setScrollable = useCallback((scrollable: boolean) => {
    dispatch({ type: "setScrollable", scrollable });
  }, []);

  const setHasHeader = useCallback((present: boolean) => {
    dispatch({ type: "setHasHeader", present });
  }, []);

  const setHasFooter = useCallback((present: boolean) => {
    dispatch({ type: "setHasFooter", present });
  }, []);

  const contextValue = useMemo<BottomSheetContextValue>(
    () => ({
      open,
      onOpenChange,
      toggle,
      snapPoints,
      snapIndex,
      setSnapIndex,
      cycleSnapPoint,
      closeOnBackdropPress,
      scrollable: state.scrollable,
      setScrollable,
      hasHeader: state.hasHeader,
      setHasHeader,
      hasFooter: state.hasFooter,
      setHasFooter,
    }),
    [
      open,
      onOpenChange,
      toggle,
      snapPoints,
      snapIndex,
      setSnapIndex,
      cycleSnapPoint,
      closeOnBackdropPress,
      state.scrollable,
      setScrollable,
      state.hasHeader,
      setHasHeader,
      state.hasFooter,
      setHasFooter,
    ]
  );

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
      style={[Platform.OS === "web" && { cursor: "pointer" as any }, styleOverride]}
    >
      {children}
    </Pressable>
  );
}

// ============================================================================
// Content — renders the native sheet, wraps children in themed flex column
// ============================================================================

function BottomSheetContent({
  // Accepted-but-ignored ergonomics props (platform owns these behaviors):
  swipeEnabled: _swipeEnabled,
  avoidKeyboard: _avoidKeyboard,
  dismissKeyboardOnDrag: _dismissKeyboardOnDrag,
  style: styleOverride,
  children,
}: BottomSheetContentProps) {
  const { open, onOpenChange, snapPoints, snapIndex, setSnapIndex, hasHeader } =
    useBottomSheetContext();
  const { theme } = useTheme();
  const dismissDisabled = useDismissDisabled();
  const showClose = useShowClose();
  const { height: winH } = useWindowDimensions();

  // Boolean open → native imperative index. The root resets snapIndex to the
  // highest point while closed; -1 keeps the native sheet closed.
  const index = open ? snapIndex : -1;

  // The native RN-in-SwiftUI host does NOT clamp our RN column to the sheet's
  // detent height — it lays the column out at its full intrinsic content height,
  // SwiftUI then clips it at the sheet edge (footer/tail fall off-screen), and
  // `flex:1` never gets a definite parent height so the ScrollView can't bound
  // and scroll. Cap the column to the expanded detent height (highest snap
  // point) so `flex:1` resolves and the Body becomes scrollable.
  const expandedSnap = snapPoints[snapPoints.length - 1];
  const detentHeight =
    typeof expandedSnap === "number"
      ? expandedSnap
      : (parseFloat(expandedSnap) / 100) * winH;

  // When there's no Header to host the X (so a close affordance is wanted —
  // dismiss is off, or the body scrolls), float one over the top-right corner.
  // A Header, when present, renders its own (see BottomSheetHeader).
  const showFloatingClose = showClose && !hasHeader;
  const hasInteractiveHandle = containsHandle(children);

  const handleChange = (newIndex: number) => {
    // Native fires onChange(-1) on dismiss (swipe / backdrop / back button).
    if (newIndex < 0) {
      if (open) onOpenChange(false);
      return;
    }

    setSnapIndex(newIndex);
  };

  return (
    <NativeBottomSheet
      index={index}
      snapPoints={snapPoints as (string | number)[]}
      // The native indicator lives outside the hosted RN tree and cannot
      // receive JS presses. Hide it only when the compound Handle supplies the
      // interactive replacement; sheets without Handle retain native chrome.
      handleComponent={hasInteractiveHandle ? null : undefined}
      enablePanDownToClose={!dismissDisabled}
      onChange={handleChange}
      onClose={() => {
        if (open) onOpenChange(false);
      }}
      // Themes the scrim/background on web (vaul) and Android (containerColor).
      backgroundStyle={{ backgroundColor: theme.colors.card }}
    >
      <TextColorContext.Provider value={theme.colors.foreground}>
        <TextClassContext.Provider value="">
          <View
            style={[
              {
                flex: 1,
                maxHeight: detentHeight,
                // Themes the content surface across all platforms regardless of
                // native sheet chrome.
                backgroundColor: theme.colors.card,
              },
              styleOverride,
            ]}
          >
            {children}
            <SheetKeyboardDismissOverlay />
            {showFloatingClose && (
              <SheetCloseButton
                style={{
                  // The sheet card sits below the status bar, so no top inset
                  // is needed — just clear the sheet's own top edge / handle.
                  position: "absolute",
                  top: spacing.md,
                  right: spacing.md,
                }}
              />
            )}
          </View>
        </TextClassContext.Provider>
      </TextColorContext.Provider>
    </NativeBottomSheet>
  );
}

// ============================================================================
// Handle — pressable snap-point control; native drag gestures remain active
// ============================================================================

/** Walk a React children tree looking for a `BottomSheet.Handle` element. */
function containsHandle(node: React.ReactNode): boolean {
  return React.Children.toArray(node).some((child) => {
    if (!React.isValidElement(child)) return false;
    if (child.type === BottomSheetHandle) return true;
    return containsHandle((child.props as { children?: React.ReactNode }).children);
  });
}

function BottomSheetHandle({ style }: BottomSheetHandleProps) {
  const { cycleSnapPoint, snapPoints } = useBottomSheetContext();
  const { theme } = useTheme();
  const disabled = snapPoints.length < 2;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Change sheet height"
      accessibilityHint="Moves the sheet to the next snap point"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={cycleSnapPoint}
      style={({ pressed }) => [
        {
          minHeight: spacing.touchTarget,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.65 : 1,
        },
        Platform.OS === "web" && !disabled && { cursor: "pointer" as any },
        style,
      ]}
    >
      <View
        style={{
          width: spacing.xl,
          height: spacing.xs,
          borderRadius: spacing.radiusFull,
          backgroundColor: theme.colors.mutedForeground,
        }}
      />
    </Pressable>
  );
}

// ============================================================================
// Header
// ============================================================================

/** Walk a React children tree looking for a `BottomSheet.Close` element. */
function containsClose(node: React.ReactNode): boolean {
  return React.Children.toArray(node).some((child) => {
    if (!React.isValidElement(child)) return false;
    if (child.type === BottomSheetClose) return true;
    return containsClose((child.props as { children?: React.ReactNode }).children);
  });
}

function BottomSheetHeader({ children, style, ...props }: BottomSheetHeaderProps) {
  const { theme } = useTheme();
  const { setHasHeader } = useBottomSheetContext();
  const showClose = useShowClose();

  // Tell Content a Header exists so it doesn't also float a close button.
  useEffect(() => {
    setHasHeader(true);
    return () => setHasHeader(false);
  }, [setHasHeader]);

  // Auto X is a fallback: render it when a close affordance is wanted (dismiss
  // off, or scrollable body) AND the consumer didn't already provide their own
  // Close inside the header (avoids a double X).
  const showAutoClose = showClose && !containsClose(children);

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        style,
      ]}
      {...props}
    >
      {/* Header content takes the remaining width; the auto X sits at the
          trailing edge so a scrollable (or non-dismissable) sheet always has a
          one-tap close without hunting for a footer button. */}
      <View style={{ flex: 1 }}>{children}</View>
      {showAutoClose && <SheetCloseButton />}
    </View>
  );
}

// ============================================================================
// Body
// ============================================================================

function BottomSheetBody({
  children,
  style,
  contentContainerStyle,
  onContentSizeChange,
  onLayout,
  ...props
}: BottomSheetBodyProps) {
  const { setScrollable, hasFooter } = useBottomSheetContext();
  const insets = useSheetInsets();

  // Track viewport vs content height to know whether the body actually
  // overflows. Only a genuinely-scrolling body needs the detent height cap and
  // the auto close X; short bodies size naturally and skip both.
  const viewportH = useRef(0);
  const contentH = useRef(0);

  const evaluate = useCallback(() => {
    const overflowing = contentH.current > viewportH.current + 1;
    setScrollable(overflowing);
  }, [setScrollable]);

  // Reset the shared flag on unmount so a reused root doesn't stay "scrollable".
  useEffect(() => () => setScrollable(false), [setScrollable]);

  return (
    <ScrollView
      style={[{ flex: 1 }, style]}
      contentContainerStyle={[
        {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          // When no Footer owns the bottom inset, the body must clear the home
          // indicator so the last item is reachable.
          paddingBottom: spacing.md + (hasFooter ? 0 : insets.bottom),
        },
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
      onLayout={(e) => {
        viewportH.current = e.nativeEvent.layout.height;
        evaluate();
        onLayout?.(e);
      }}
      onContentSizeChange={(w, h) => {
        contentH.current = h;
        evaluate();
        onContentSizeChange?.(w, h);
      }}
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
  const insets = useSheetInsets();
  const { setHasFooter } = useBottomSheetContext();

  // Tell Body a Footer owns the bottom safe-area inset, so Body doesn't add it too.
  useEffect(() => {
    setHasFooter(true);
    return () => setHasFooter(false);
  }, [setHasFooter]);

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
      style={[Platform.OS === "web" && { cursor: "pointer" as any }, styleOverride]}
    >
      {children}
    </Pressable>
  );
}

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
