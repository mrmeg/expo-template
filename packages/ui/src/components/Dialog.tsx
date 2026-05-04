import * as React from "react";
import { Platform, StyleSheet, View, ViewProps } from "react-native";
import { FullWindowOverlay as RNFullWindowOverlay } from "react-native-screens";
import * as DialogPrimitive from "@rn-primitives/dialog";
import * as AlertDialogPrimitive from "@rn-primitives/alert-dialog";
import { AnimatedView } from "./AnimatedView";
import { TextClassContext, TextColorContext } from "./StyledText";
import { StyledText } from "./StyledText";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../constants/spacing";
import { palette } from "../constants/colors";

const FullWindowOverlay = Platform.OS === "ios" ? RNFullWindowOverlay : React.Fragment;

// ============================================================================
// Dialog
// ============================================================================

const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

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
  const textColor = getContrastingColor(
    theme.colors.popover,
    palette.white,
    palette.black,
  );

  return (
    <DialogPrimitive.Portal hostName={portalHost}>
      <FullWindowOverlay>
        <DialogPrimitive.Overlay
          style={StyleSheet.flatten([
            StyleSheet.absoluteFill,
            { backgroundColor: theme.colors.overlay },
            Platform.OS === "web" && { zIndex: 50 },
          ])}
        >
          <AnimatedView type="fade" enterDuration={200}>
            <View style={overlayStyles.centeredContainer}>
              <AnimatedView type="scale" enterDuration={250}>
                <TextColorContext.Provider value={textColor}>
                  <TextClassContext.Provider value="">
                    <DialogPrimitive.Content
                      style={StyleSheet.flatten([
                        {
                          backgroundColor: theme.colors.popover,
                          borderColor: theme.colors.border,
                          borderWidth: 1,
                          borderRadius: spacing.radiusLg,
                          padding: spacing.lg,
                          width: "90%",
                          maxWidth: 450,
                          maxHeight: "85%",
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
          </AnimatedView>
        </DialogPrimitive.Overlay>
      </FullWindowOverlay>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ children, style, ...props }: ViewProps) {
  return (
    <View style={StyleSheet.flatten([{ gap: spacing.xs, marginBottom: spacing.md }, style])} {...props}>
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
          marginTop: spacing.lg,
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

const Dialog = Object.assign(DialogRoot, {
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

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogAction = AlertDialogPrimitive.Action;
const AlertDialogCancel = AlertDialogPrimitive.Cancel;

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
  const textColor = getContrastingColor(
    theme.colors.popover,
    palette.white,
    palette.black,
  );

  return (
    <AlertDialogPrimitive.Portal hostName={portalHost}>
      <FullWindowOverlay>
        <AlertDialogPrimitive.Overlay
          style={StyleSheet.flatten([
            StyleSheet.absoluteFill,
            { backgroundColor: theme.colors.overlay },
            Platform.OS === "web" && { zIndex: 52 },
          ])}
        >
          <AnimatedView type="fade" enterDuration={200}>
            <View style={overlayStyles.centeredContainer}>
              <AnimatedView type="scale" enterDuration={250}>
                <TextColorContext.Provider value={textColor}>
                  <TextClassContext.Provider value="">
                    <AlertDialogPrimitive.Content
                      style={StyleSheet.flatten([
                        {
                          backgroundColor: theme.colors.popover,
                          borderColor: theme.colors.border,
                          borderWidth: 1,
                          borderRadius: spacing.radiusLg,
                          padding: spacing.lg,
                          width: "90%",
                          maxWidth: 450,
                          maxHeight: "85%",
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
          </AnimatedView>
        </AlertDialogPrimitive.Overlay>
      </FullWindowOverlay>
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

const AlertDialog = Object.assign(AlertDialogRoot, {
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
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
