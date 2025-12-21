import { Alert as RNAlert, Platform } from "react-native";

/**
 * Cross-platform Alert utility.
 *
 * Wraps React Native's Alert API to support both native and web platforms.
 * On web, it uses `window.alert()` or `window.confirm()` to simulate native alerts.
 *
 * Usage:
 * Alert.show({
 *   title: "Delete Item",
 *   message: "Are you sure you want to delete this?",
 *   buttons: [
 *     { text: "Cancel", style: "cancel" },
 *     { text: "Delete", style: "destructive", onPress: () => handleDelete() }
 *   ]
 * });
 */

type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

interface AlertParams {
  title?: string;
  message: string;
  buttons?: AlertButton[];
}

export const Alert = {
  show: ({ title = "", message, buttons = [{ text: "OK" }] }: AlertParams): void => {
    if (Platform.OS === "web") {
      if (buttons.length > 1) {
        const result = window.confirm(`${title}\n${message}`);
        const confirmButton = buttons.find(b => b.style !== "cancel");
        const cancelButton = buttons.find(b => b.style === "cancel");

        if (result && confirmButton?.onPress) {
          confirmButton.onPress();
        } else if (!result && cancelButton?.onPress) {
          cancelButton.onPress();
        }
      } else {
        window.alert(`${title}\n${message}`);
        buttons[0]?.onPress?.();
      }
    } else {
      RNAlert.alert(title, message, buttons);
    }
  }
};
