/**
 * Native segmented control indirection — default variant (iOS, web, and the
 * type surface TypeScript resolves).
 *
 * Metro resolves `nativeSegmentedControl.android.tsx` on Android; iOS, web and
 * Jest resolve this file. iOS renders `@expo/ui`'s community control (a SwiftUI
 * segmented `Picker`, which ignores the colors); web never mounts it, because
 * `SegmentedControl.tsx` draws its own control there. Both variants must export
 * the same names with the same types.
 */
import { SegmentedControl as CommunitySegmentedControl } from "@expo/ui/community/segmented-control";
import type { StyleProp, ViewStyle } from "react-native";

export interface NativeSegmentedControlProps {
  values: string[];
  selectedIndex: number;
  enabled: boolean;
  onValueChange: (value: string) => void;
  /** Selected segment fill. */
  tintColor: string;
  /** Selected segment label (and Material check) color; Android only. */
  selectedLabelColor: string;
  appearance: "light" | "dark";
  style?: StyleProp<ViewStyle>;
}

// `selectedLabelColor` is not passed: the SwiftUI picker draws its own labels.
export function NativeSegmentedControl({ values, selectedIndex, enabled, onValueChange, tintColor, appearance, style }: NativeSegmentedControlProps) {
  return (
    <CommunitySegmentedControl
      values={values}
      selectedIndex={selectedIndex}
      enabled={enabled}
      onValueChange={onValueChange}
      tintColor={tintColor}
      appearance={appearance}
      style={style}
    />
  );
}
