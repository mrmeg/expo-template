import { Keyboard } from "react-native";

interface KeyboardControllerType {
  dismiss: () => void;
}

export const KeyboardController: KeyboardControllerType = {
  dismiss: Keyboard.dismiss,
};
