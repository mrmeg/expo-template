import * as React from "react";
import { Platform } from "react-native";
import { PortalHost } from "@rn-primitives/portal";
import { Notification } from "./Notification";
import { StatusBar } from "./StatusBar";
import {
  KeyboardAvoidingView,
  type KeyboardAvoidingViewProps,
} from "./KeyboardAvoidingView";

export interface UIProviderProps {
  children: React.ReactNode;
  /**
   * Mount the package notification renderer for globalUIStore feedback.
   *
   * @default true
   */
  notification?: boolean;
  /**
   * Mount the default @rn-primitives portal host used by package overlays.
   *
   * @default true
   */
  portalHost?: boolean;
  /**
   * Mount the package status bar renderer.
   *
   * @default true
   */
  statusBar?: boolean;
  /**
   * Wrap app content in the package keyboard-avoiding root.
   *
   * @default true on native, false on web
   */
  keyboardAvoiding?: boolean;
  /**
   * Props forwarded to the keyboard-avoiding root when enabled.
   */
  keyboardAvoidingProps?: Omit<KeyboardAvoidingViewProps, "children">;
}

export function UIProvider({
  children,
  notification = true,
  portalHost = true,
  statusBar = true,
  keyboardAvoiding = Platform.OS !== "web",
  keyboardAvoidingProps,
}: UIProviderProps) {
  const { style: keyboardAvoidingStyle, ...restKeyboardAvoidingProps } =
    keyboardAvoidingProps ?? {};
  const content = keyboardAvoiding ? (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, keyboardAvoidingStyle]}
      {...restKeyboardAvoidingProps}
    >
      {children}
    </KeyboardAvoidingView>
  ) : (
    children
  );

  return (
    <>
      {content}
      {notification ? <Notification /> : null}
      {portalHost ? <PortalHost /> : null}
      {statusBar ? <StatusBar /> : null}
    </>
  );
}
