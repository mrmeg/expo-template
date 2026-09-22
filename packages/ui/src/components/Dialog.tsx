import * as React from "react";
import { Modal, Platform, StyleSheet, View, ViewProps } from "react-native";
import * as DialogPrimitive from "@rn-primitives/dialog";
import * as AlertDialogPrimitive from "@rn-primitives/alert-dialog";
import { AnimatedView } from "./AnimatedView";
import { KeyboardAvoidingView } from "./KeyboardAvoidingView";
import { TextClassContext, TextColorContext } from "./StyledText.context";
import { StyledText } from "./StyledText";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../constants/spacing";
import { palette } from "../constants/colors";

// ============================================================================
// Presentation
// ============================================================================

/** The Modal follows the app's own orientation mask instead of RN's portrait-only default. */
const SUPPORTED_ORIENTATIONS = [
  "portrait",
  "portrait-upside-down",
  "landscape",
  "landscape-left",
  "landscape-right",
] as const;

interface DialogPresentationProps {
  /** Close request from the platform (hardware back / TV menu); wired to the root's `onOpenChange`. */
  onRequestClose: () => void;
  children: React.ReactNode;
}

/**
 * Native presentation for dialog content.
 *
 * iOS presents through React Native's `Modal`. Until 0.27.1 both dialogs
 * rendered through react-native-screens' `FullWindowOverlay` so they stacked
 * above native stack modals. That overlay adds its container straight to the
 * `UIWindow`, so no `UIViewController` sits above it, and `expo-modules-core`'s
 * `ExpoSwiftUI.HostingView` — which attaches its `UIHostingController` only
 * when `reactViewController()` finds a parent controller — removed the SwiftUI
 * view instead. Every `@expo/ui`-hosted control inside (`TextInput`, `Slider`,
 * `SegmentedControl`) was a zero-height box: no editable element, no focus, no
 * keyboard (fieldnest on iOS 27, `@mrmeg/expo-ui` 0.27.0; reproduced in the
 * template's `Dialog` `form` variant — the hosting view had height 0 and no
 * child inside `RNSFullWindowOverlayContainer`, and rendered with the overlay
 * removed). `Modal` presents a real view controller, still above native stack
 * modals, so hosted controls mount and take focus on the first tap.
 *
 * Android and web render inline into the portal host, as before.
 */
function DialogPresentation({ onRequestClose, children }: DialogPresentationProps) {
  if (Platform.OS !== "ios") {
    return <>{children}</>;
  }
  return (
    <Modal
      visible
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      supportedOrientations={SUPPORTED_ORIENTATIONS}
      onRequestClose={onRequestClose}
    >
      {children}
    </Modal>
  );
}

/**
 * Keyboard avoidance owner for dialog content.
 *
 * On iOS the `Modal` above is presented outside `UIProvider`'s root
 * `KeyboardAvoidingView`, so nothing else can keep a focused dialog field and
 * the footer above the keyboard: this wrapper pads the centered container by
 * the keyboard height, and the card (capped at 85% of the remaining height)
 * recenters in the space that is left. It is the package `KeyboardAvoidingView`,
 * so `useKeyboardAvoidance()` is `true` inside `DialogContent` and a
 * `DismissKeyboard` in dialog content adds no second layer. Do not wrap dialog
 * content in another `KeyboardAvoidingView`.
 *
 * Android and web keep the portal-host tree unchanged; the portal host sits
 * outside the root avoidance there, and a dialog is not keyboard-avoided yet.
 */
function DialogKeyboardAvoidance({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== "ios") {
    return <>{children}</>;
  }
  return (
    <KeyboardAvoidingView
      style={overlayStyles.fill}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

// ============================================================================
// Dialog
// ============================================================================

// These re-exports and the compound components below carry explicit type
// annotations because React Native 0.88 resolves primitive ref types through
// its private `ReactNativeElement`, which declaration emit cannot name
// portably (TS2883). Annotating with `typeof <primitive>` keeps the emitted
// .d.ts pointing at the primitive's own public types instead.
const DialogTrigger: typeof DialogPrimitive.Trigger = DialogPrimitive.Trigger;
const DialogClose: typeof DialogPrimitive.Close = DialogPrimitive.Close;

interface DialogProps extends DialogPrimitive.RootProps {
  children: React.ReactNode;
}

function DialogRoot({ children, ...props }: DialogProps) {
  return <DialogPrimitive.Root {...props}>{children}</DialogPrimitive.Root>;
}

interface DialogContentProps extends DialogPrimitive.ContentProps {
  portalHost?: string;
}

function DialogContent({
  portalHost,
  style,
  children,
  ...props
}: DialogContentProps) {
  const { theme, getShadowStyle, getContrastingColor } = useTheme();
  const { onOpenChange } = DialogPrimitive.useRootContext();
  const textColor = getContrastingColor(
    theme.colors.popover,
    palette.white,
    palette.black,
  );

  return (
    <DialogPrimitive.Portal hostName={portalHost}>
      <DialogPresentation onRequestClose={() => onOpenChange(false)}>
        <DialogPrimitive.Overlay
          // On web the primitive wraps the overlay in a react-native-web
          // Pressable whose click handler stops propagation unconditionally.
          // With that Pressable between the overlay and the Radix content,
          // outside presses (mouse and touch) and Escape never dismissed the
          // dialog, so a dialog without a Close button was stuck. `asChild`
          // makes the primitive clone our fade wrapper instead, removing the
          // Pressable; Radix dismissal then works. Native keeps the Pressable,
          // which is what implements closeOnPress there.
          asChild={Platform.OS === "web"}
          style={StyleSheet.flatten([
            StyleSheet.absoluteFill,
            { backgroundColor: theme.colors.overlay },
            Platform.OS === "web" && { zIndex: 50 },
          ])}
        >
          <AnimatedView type="fade" enterDuration={200} style={StyleSheet.absoluteFill}>
            <DialogKeyboardAvoidance>
              <View style={overlayStyles.centeredContainer}>
                <AnimatedView type="scale" enterDuration={250} style={overlayStyles.sizer}>
                  <TextColorContext.Provider value={textColor}>
                    <TextClassContext.Provider value="">
                      <DialogPrimitive.Content
                        style={StyleSheet.flatten([
                          {
                            backgroundColor: theme.colors.popover,
                            borderColor: theme.colors.border,
                            borderWidth: 1,
                            borderRadius: spacing.radiusLg,
                            padding: spacing.dialogPadding,
                            gap: spacing.md,
                            width: "100%",
                            ...getShadowStyle("soft"),
                          },
                          style,
                        ])}
                        {...props}
                      >
                        {children}
                      </DialogPrimitive.Content>
                    </TextClassContext.Provider>
                  </TextColorContext.Provider>
                </AnimatedView>
              </View>
            </DialogKeyboardAvoidance>
          </AnimatedView>
        </DialogPrimitive.Overlay>
      </DialogPresentation>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ children, style, ...props }: ViewProps) {
  return (
    <View style={StyleSheet.flatten([{ gap: spacing.xs }, style])} {...props}>
      {children}
    </View>
  );
}

function DialogFooter({ children, style, ...props }: ViewProps) {
  return (
    <View
      style={StyleSheet.flatten([
        {
          flexDirection: "row" as const,
          justifyContent: "flex-end" as const,
          gap: spacing.sm,
        },
        style,
      ])}
      {...props}
    >
      {children}
    </View>
  );
}

function DialogTitle({
  children,
  style,
  ...props
}: DialogPrimitive.TitleProps & { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <DialogPrimitive.Title asChild>
      <StyledText
        fontWeight="semibold"
        style={StyleSheet.flatten([
          {
            fontSize: 18,
            lineHeight: 24,
            letterSpacing: 0,
            color: theme.colors.text,
          },
          style,
        ])}
        {...props}
      >
        {children}
      </StyledText>
    </DialogPrimitive.Title>
  );
}

function DialogDescription({
  children,
  style,
  ...props
}: DialogPrimitive.DescriptionProps & { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <DialogPrimitive.Description asChild>
      <StyledText
        style={StyleSheet.flatten([
          {
            fontSize: 14,
            lineHeight: 20,
            color: theme.colors.textDim,
          },
          style,
        ])}
        {...props}
      >
        {children}
      </StyledText>
    </DialogPrimitive.Description>
  );
}

type DialogComponent = typeof DialogRoot & {
  Trigger: typeof DialogTrigger;
  Content: typeof DialogContent;
  Header: typeof DialogHeader;
  Footer: typeof DialogFooter;
  Title: typeof DialogTitle;
  Description: typeof DialogDescription;
  Close: typeof DialogClose;
};

const Dialog: DialogComponent = Object.assign(DialogRoot, {
  Trigger: DialogTrigger,
  Content: DialogContent,
  Header: DialogHeader,
  Footer: DialogFooter,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: DialogClose,
});

// ============================================================================
// AlertDialog
// ============================================================================

const AlertDialogTrigger: typeof AlertDialogPrimitive.Trigger = AlertDialogPrimitive.Trigger;
const AlertDialogAction: typeof AlertDialogPrimitive.Action = AlertDialogPrimitive.Action;
const AlertDialogCancel: typeof AlertDialogPrimitive.Cancel = AlertDialogPrimitive.Cancel;

interface AlertDialogProps extends AlertDialogPrimitive.RootProps {
  children: React.ReactNode;
}

function AlertDialogRoot({ children, ...props }: AlertDialogProps) {
  return <AlertDialogPrimitive.Root {...props}>{children}</AlertDialogPrimitive.Root>;
}

interface AlertDialogContentProps extends AlertDialogPrimitive.ContentProps {
  portalHost?: string;
}

function AlertDialogContent({
  portalHost,
  style,
  children,
  ...props
}: AlertDialogContentProps) {
  const { theme, getShadowStyle, getContrastingColor } = useTheme();
  const { onOpenChange } = AlertDialogPrimitive.useRootContext();
  const textColor = getContrastingColor(
    theme.colors.popover,
    palette.white,
    palette.black,
  );

  return (
    <AlertDialogPrimitive.Portal hostName={portalHost}>
      <DialogPresentation onRequestClose={() => onOpenChange(false)}>
        <AlertDialogPrimitive.Overlay
          style={StyleSheet.flatten([
            StyleSheet.absoluteFill,
            { backgroundColor: theme.colors.overlay },
            Platform.OS === "web" && { zIndex: 52 },
          ])}
        >
          <AnimatedView type="fade" enterDuration={200} style={StyleSheet.absoluteFill}>
            <DialogKeyboardAvoidance>
              <View style={overlayStyles.centeredContainer}>
                <AnimatedView type="scale" enterDuration={250} style={overlayStyles.sizer}>
                  <TextColorContext.Provider value={textColor}>
                    <TextClassContext.Provider value="">
                      <AlertDialogPrimitive.Content
                        style={StyleSheet.flatten([
                          {
                            backgroundColor: theme.colors.popover,
                            borderColor: theme.colors.border,
                            borderWidth: 1,
                            borderRadius: spacing.radiusLg,
                            padding: spacing.dialogPadding,
                            gap: spacing.md,
                            width: "100%",
                            ...getShadowStyle("soft"),
                          },
                          style,
                        ])}
                        {...props}
                      >
                        {children}
                      </AlertDialogPrimitive.Content>
                    </TextClassContext.Provider>
                  </TextColorContext.Provider>
                </AnimatedView>
              </View>
            </DialogKeyboardAvoidance>
          </AnimatedView>
        </AlertDialogPrimitive.Overlay>
      </DialogPresentation>
    </AlertDialogPrimitive.Portal>
  );
}

function AlertDialogTitle({
  children,
  style,
  ...props
}: AlertDialogPrimitive.TitleProps & { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <AlertDialogPrimitive.Title asChild>
      <StyledText
        fontWeight="semibold"
        style={StyleSheet.flatten([
          {
            fontSize: 18,
            lineHeight: 24,
            letterSpacing: 0,
            color: theme.colors.text,
          },
          style,
        ])}
        {...props}
      >
        {children}
      </StyledText>
    </AlertDialogPrimitive.Title>
  );
}

function AlertDialogDescription({
  children,
  style,
  ...props
}: AlertDialogPrimitive.DescriptionProps & { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <AlertDialogPrimitive.Description asChild>
      <StyledText
        style={StyleSheet.flatten([
          {
            fontSize: 14,
            lineHeight: 20,
            color: theme.colors.textDim,
          },
          style,
        ])}
        {...props}
      >
        {children}
      </StyledText>
    </AlertDialogPrimitive.Description>
  );
}

type AlertDialogComponent = typeof AlertDialogRoot & {
  Trigger: typeof AlertDialogTrigger;
  Content: typeof AlertDialogContent;
  Header: typeof DialogHeader;
  Footer: typeof DialogFooter;
  Title: typeof AlertDialogTitle;
  Description: typeof AlertDialogDescription;
  Action: typeof AlertDialogAction;
  Cancel: typeof AlertDialogCancel;
};

const AlertDialog: AlertDialogComponent = Object.assign(AlertDialogRoot, {
  Trigger: AlertDialogTrigger,
  Content: AlertDialogContent,
  Header: DialogHeader,
  Footer: DialogFooter,
  Title: AlertDialogTitle,
  Description: AlertDialogDescription,
  Action: AlertDialogAction,
  Cancel: AlertDialogCancel,
});

// ============================================================================
// Shared styles
// ============================================================================

const overlayStyles = StyleSheet.create({
  // The keyboard-avoiding wrapper fills the overlay so its bottom padding
  // shrinks the centered container instead of the card.
  fill: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  // Sizes the dialog relative to the full-screen centered container. Both the
  // width AND maxHeight must live on this wrapper (the direct flex child of the
  // full-screen container) rather than on Content: a percentage resolves
  // against the parent's resolved box, and this wrapper's box is the screen.
  // Putting `maxHeight: "85%"` on Content instead resolves it against this
  // (content-sized) wrapper — clamping the card to 85% of its own content
  // height, so the footer spills out the bottom.
  sizer: {
    width: "90%",
    maxWidth: 450,
    maxHeight: "85%",
  },
});

// ============================================================================
// Exports
// ============================================================================

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};

export type {
  DialogProps,
  DialogContentProps,
  AlertDialogProps,
  AlertDialogContentProps,
};
