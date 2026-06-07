import React, { createContext, use, useState } from "react";
import {
  View,
  ViewProps,
  Pressable,
  StyleProp,
  ViewStyle,
  ScrollView,
  ScrollViewProps,
  Platform,
} from "react-native";
import { BottomSheet as NativeBottomSheet } from "@expo/ui/community/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../constants/spacing";
import { TextColorContext, TextClassContext } from "./StyledText.context";

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
 *   - `.Handle` is a no-op: the platform draws the drag indicator.
 *   - `swipeEnabled` / `avoidKeyboard` / `dismissKeyboardOnDrag` are accepted
 *     for call-site ergonomics but have no effect — the platform handles them.
 *   - Sheet *chrome* (corner radius, system background, safe area) is the
 *     platform's on native; theming reaches the content + background color.
 *   - On Android only two snap states exist (partial / expanded); extra snap
 *     points map to the nearest of those two.
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

interface BottomSheetContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toggle: () => void;
  snapPoints: SnapPoint[];
  closeOnBackdropPress: boolean;
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
   * Whether swiping/pulling down dismisses the sheet. Maps to the native sheet's
   * `enablePanDownToClose` (iOS `interactiveDismissDisabled`). Default: true.
   *
   * Note for scrollable content on iOS: interactive dismiss is all-or-nothing —
   * when the inner scroll view is at its top, a continued downward drag is taken
   * by the sheet's dismiss gesture. If that's undesirable, set this to `false`
   * and provide an explicit close affordance (a button / the X in the header).
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

// ============================================================================
// Root
// ============================================================================

function BottomSheetRoot({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen = false,
  snapPoints = ["50%"],
  closeOnBackdropPress = true,
  children,
}: BottomSheetProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const onOpenChange = (newOpen: boolean) => {
    if (isControlled) {
      controlledOnOpenChange?.(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  const toggle = () => onOpenChange(!open);

  const contextValue: BottomSheetContextValue = {
    open,
    onOpenChange,
    toggle,
    snapPoints,
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
  const { open, onOpenChange, snapPoints, closeOnBackdropPress } = useBottomSheetContext();
  const { theme } = useTheme();

  // Boolean open → native imperative index. Open at the highest snap point so
  // the sheet starts fully expanded; -1 keeps it closed.
  const index = open ? snapPoints.length - 1 : -1;

  const handleChange = (newIndex: number) => {
    // Native fires onChange(-1) on dismiss (swipe / backdrop / back button).
    if (newIndex < 0 && open) onOpenChange(false);
  };

  return (
    <NativeBottomSheet
      index={index}
      snapPoints={snapPoints as (string | number)[]}
      enablePanDownToClose={closeOnBackdropPress}
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
                // Themes the content surface across all platforms regardless of
                // native sheet chrome.
                backgroundColor: theme.colors.card,
              },
              styleOverride,
            ]}
          >
            {children}
          </View>
        </TextClassContext.Provider>
      </TextColorContext.Provider>
    </NativeBottomSheet>
  );
}

// ============================================================================
// Handle — no-op (the platform draws the drag indicator)
// ============================================================================

function BottomSheetHandle(_props: BottomSheetHandleProps) {
  return null;
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
