import * as React from "react";
import { Platform } from "react-native";
import { useFeedbackStore, type HapticsSetting } from "../state/feedbackStore";
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
  /**
   * Which interactions may vibrate on native: `"off"`, `"selection"` (state
   * changes on Switch, Checkbox, Toggle, ToggleGroup, SegmentedControl) or
   * `"all"` (selection plus a light tap on press for Button, pressable Card
   * and Item). Written to the feedback store on mount and whenever it changes;
   * omit it to leave the store as it is. Web never vibrates.
   *
   * @default "selection"
   */
  haptics?: HapticsSetting;
}

export function UIProvider({
  children,
  notification = true,
  portalHost = true,
  statusBar = true,
  keyboardAvoiding: keyboardAvoidingProp,
  keyboardAvoidingProps,
  haptics,
}: UIProviderProps) {
  // Controls read the setting at event time (`hapticPress` / `hapticSelection`),
  // so an effect is early enough; no child renders differently because of it.
  React.useEffect(() => {
    if (haptics !== undefined) useFeedbackStore.getState().setHaptics(haptics);
  }, [haptics]);

  // Resolved in the body rather than as a default parameter: the React
  // Compiler can't reorder a computed default, and skipped the component.
  const keyboardAvoiding = keyboardAvoidingProp === undefined ? Platform.OS !== "web" : keyboardAvoidingProp;
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
