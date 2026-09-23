import * as React from "react";
import { Modal, Platform, StyleSheet, View, ViewProps } from "react-native";
import * as DialogPrimitive from "@rn-primitives/dialog";
import * as AlertDialogPrimitive from "@rn-primitives/alert-dialog";
import { AnimatedView } from "./AnimatedView";
import { KeyboardAvoidingView } from "./KeyboardAvoidingView";
import { useKeyboardDismissResponder } from "./keyboardDismiss";
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
  /** The primitive's portal for this dialog kind; Android and web render through it. */
  Portal: typeof DialogPrimitive.Portal | typeof AlertDialogPrimitive.Portal;
  open: boolean;
  /** Custom `@rn-primitives/portal` host name; honored on Android and web only. */
  portalHost?: string;
  /** Close request from the platform (hardware back / TV menu); wired to the root's `onOpenChange`. */
  onRequestClose: () => void;
  children: React.ReactNode;
}

/**
 * Presentation for dialog content.
 *
 * iOS presents through React Native's `Modal`, rendered inline where the
 * dialog sits in the tree rather than through the portal host. Until 0.27.1
 * both dialogs rendered into `UIProvider`'s portal host inside
 * react-native-screens' `FullWindowOverlay`, which stacks above native stack
 * modals by adding its container straight to the `UIWindow`. No
 * `UIViewController` sits above that container, and `expo-modules-core`'s
 * `ExpoSwiftUI.HostingView` — which attaches its `UIHostingController` only
 * when `reactViewController()` finds a parent controller — removed the SwiftUI
 * view instead. Every `@expo/ui`-hosted control inside (`TextInput`, `Slider`,
 * `SegmentedControl`) was a zero-height box: no editable element, no focus, no
 * keyboard (fieldnest on iOS 27, `@mrmeg/expo-ui` 0.27.0; reproduced in the
 * template's `Dialog` `form` variant — the accessibility tree listed only the
 * field labels, and the same content mounted with the overlay removed).
 *
 * `Modal` presents a real view controller, so hosted controls mount and take
 * focus on the first tap. RN presents it from the view controller nearest the
 * `Modal`'s own host view, which is why it renders inline: a `Modal` in the
 * root portal host presents from the root controller and silently fails
 * whenever that controller already presents a native stack modal or a sheet
 * (device-verified: the trigger reported expanded, nothing appeared). Inline,
 * the presenter is whatever screen, native stack modal or sheet contains the
 * dialog, and the dialog stacks above it. The trade-off: content hosted by
 * `FullWindowOverlay` (`Drawer`, `Popover`, `Select`, `DropdownMenu`,
 * `Tooltip`) has no view controller either, so a dialog placed inside that
 * content cannot present on iOS — render it at screen level and open it from
 * the item's `onPress`.
 *
 * Android and web render into the portal host, as before.
 */
function DialogPresentation({
  Portal,
  open,
  portalHost,
  onRequestClose,
  children,
}: DialogPresentationProps) {
  if (Platform.OS !== "ios") {
    return <Portal hostName={portalHost}>{children}</Portal>;
  }
  if (!open) {
    return null;
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
 * Dialog content sits outside `UIProvider`'s root `KeyboardAvoidingView` on
 * both native platforms — the iOS `Modal` above is presented outside it, and
 * on Android the primitive `Portal` renders into `UIProvider`'s `PortalHost`,
 * a sibling of the root avoidance — so nothing else can keep a focused dialog
 * field and the footer above the keyboard. This wrapper pads the centered
 * container by the keyboard height, and the card (capped at 85% of the
 * remaining height) recenters in the space that is left. It is the package
 * `KeyboardAvoidingView` (keyboard-controller on native, which observes the
 * main window's IME on Android, where the portal-hosted dialog lives), so
 * `useKeyboardAvoidance()` is `true` inside `DialogContent` and a
 * `DismissKeyboard` in dialog content adds no second layer. Do not wrap dialog
 * content in another `KeyboardAvoidingView`.
 *
 * Web has no software keyboard and keeps the portal-host tree unchanged.
 */
function DialogKeyboardAvoidance({ children }: { children: React.ReactNode }) {
  if (Platform.OS === "web") {
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

/**
 * Tap-away keyboard dismissal for dialog content.
 *
 * The iOS `Modal` sits outside any app-level `DismissKeyboard`, and the
 * portal-hosted tree on Android does too, so a tap on the card's dead space
 * (padding, labels, the gap between fields and footer) left the keyboard up.
 * The centered container now carries the same boundary as `DismissKeyboard`
 * and `BottomSheet.Content` (`useKeyboardDismissResponder`): it never claims
 * the touch — `Close` / `Action` / `Cancel`, buttons and fields win the
 * negotiation and fire on the first tap — and dismisses on release of an
 * unclaimed single-finger tap within the travel slop, through the registered
 * field's blur handle with a `KeyboardController.dismiss()` fallback. It covers
 * the backdrop as well: the primitive `Overlay` still claims that tap and closes
 * the dialog while the keyboard drops with it. Inert on web (returns `{}`).
 */
function useDialogKeyboardDismissBoundary() {
  return useKeyboardDismissResponder();
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
  const { open, onOpenChange } = DialogPrimitive.useRootContext();
  const dismissBoundaryProps = useDialogKeyboardDismissBoundary();
  const textColor = getContrastingColor(
    theme.colors.popover,
    palette.white,
    palette.black,
  );

  return (
    <DialogPresentation
      Portal={DialogPrimitive.Portal}
      open={open}
      portalHost={portalHost}
      onRequestClose={() => onOpenChange(false)}
    >
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
            <View style={overlayStyles.centeredContainer} {...dismissBoundaryProps}>
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
  const { open, onOpenChange } = AlertDialogPrimitive.useRootContext();
  const dismissBoundaryProps = useDialogKeyboardDismissBoundary();
  const textColor = getContrastingColor(
    theme.colors.popover,
    palette.white,
    palette.black,
  );

  return (
    <DialogPresentation
      Portal={AlertDialogPrimitive.Portal}
      open={open}
      portalHost={portalHost}
      onRequestClose={() => onOpenChange(false)}
    >
      <AlertDialogPrimitive.Overlay
        style={StyleSheet.flatten([
          StyleSheet.absoluteFill,
          { backgroundColor: theme.colors.overlay },
          Platform.OS === "web" && { zIndex: 52 },
        ])}
      >
        <AnimatedView type="fade" enterDuration={200} style={StyleSheet.absoluteFill}>
          <DialogKeyboardAvoidance>
            <View style={overlayStyles.centeredContainer} {...dismissBoundaryProps}>
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
