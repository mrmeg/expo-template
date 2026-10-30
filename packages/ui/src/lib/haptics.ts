import { Platform } from "react-native";

import { useFeedbackStore } from "../state/feedbackStore";

function runHaptic(fn: () => Promise<unknown> | void) {
  if (Platform.OS === "web") return;
  try {
    // Swallow rejections too: an Android app that blocks the VIBRATE
    // permission gets a rejected promise from every expo-haptics call, and an
    // uncaught one surfaces as an unhandled rejection (and a Sentry event).
    void Promise.resolve(fn()).catch(() => {});
  } catch {
    // Haptics not available
  }
}

/** A light tap, unconditionally. Prefer `hapticPress` / `hapticSelection`. */
export function hapticLight() {
  runHaptic(() => {
    const H = require("expo-haptics");
    return H.impactAsync(H.ImpactFeedbackStyle.Light);
  });
}

export function hapticMedium() {
  runHaptic(() => {
    const H = require("expo-haptics");
    return H.impactAsync(H.ImpactFeedbackStyle.Medium);
  });
}

export function hapticSuccess() {
  runHaptic(() => {
    const H = require("expo-haptics");
    return H.notificationAsync(H.NotificationFeedbackType.Success);
  });
}

/**
 * The tap a control fires when its state changes (Switch, Checkbox, Toggle,
 * ToggleGroup, SegmentedControl). Fires under the `"selection"` (default) and
 * `"all"` settings; silent under `"off"`.
 */
export function hapticSelection() {
  if (useFeedbackStore.getState().haptics === "off") return;
  hapticLight();
}

/**
 * The tap a pressable fires on press-in (Button, pressable Card and Item,
 * `useScalePress` consumers). Fires only under the `"all"` setting.
 */
export function hapticPress() {
  if (useFeedbackStore.getState().haptics !== "all") return;
  hapticLight();
}
