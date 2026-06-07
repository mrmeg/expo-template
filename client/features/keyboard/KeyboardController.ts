import { Platform } from "react-native";

interface KeyboardControllerType {
  dismiss: () => void;
}

const WebKeyboardController: KeyboardControllerType = {
  dismiss: () => {
    if (document.activeElement && "blur" in document.activeElement) {
      (document.activeElement as HTMLElement).blur();
    }
  },
};

export const KeyboardController: KeyboardControllerType = {
  dismiss:
    Platform.OS === "web"
      ? WebKeyboardController.dismiss
      : async () => {
        const { KeyboardController } = await import("react-native-keyboard-controller");
        KeyboardController.dismiss();
      },
};
