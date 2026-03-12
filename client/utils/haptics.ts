import { Platform } from "react-native";

function runHaptic(fn: () => void) {
  if (Platform.OS === "web") return;
  try {
    fn();
  } catch {
    // Haptics not available
  }
}

export function hapticLight() {
  runHaptic(() => {
    const H = require("expo-haptics");
    H.impactAsync(H.ImpactFeedbackStyle.Light);
  });
}

export function hapticMedium() {
  runHaptic(() => {
    const H = require("expo-haptics");
    H.impactAsync(H.ImpactFeedbackStyle.Medium);
  });
}

export function hapticSuccess() {
  runHaptic(() => {
    const H = require("expo-haptics");
    H.notificationAsync(H.NotificationFeedbackType.Success);
  });
}
