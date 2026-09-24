import { create } from "zustand";

/**
 * Which interactions may vibrate.
 *
 * - `"off"`: never.
 * - `"selection"` (default): state changes — Switch, Checkbox, Toggle,
 *   ToggleGroup, SegmentedControl.
 * - `"all"`: selection plus a light tap on press for Button, pressable Card
 *   and Item, and every `useScalePress` consumer that has not opted out.
 *
 * Web never vibrates regardless of the setting.
 */
export type HapticsSetting = "off" | "selection" | "all";

export type FeedbackStore = {
  haptics: HapticsSetting;
  setHaptics: (setting: HapticsSetting) => void;
};

/**
 * Feedback settings the package's controls consult at event time. Set it
 * through `UIProvider`'s `haptics` prop or `setHaptics()`; read it in a
 * component with `useFeedbackStore((s) => s.haptics)`.
 */
export const useFeedbackStore = create<FeedbackStore>((set) => ({
  haptics: "selection",
  setHaptics: (setting) => {
    set({ haptics: setting });
  },
}));

/** Imperative form of `UIProvider`'s `haptics` prop, for app startup code. */
export function setHaptics(setting: HapticsSetting): void {
  useFeedbackStore.getState().setHaptics(setting);
}
