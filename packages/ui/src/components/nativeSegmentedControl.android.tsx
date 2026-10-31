/**
 * Native segmented control indirection — Android variant.
 *
 * A package-owned port of `@expo/ui`'s community Android segmented control
 * (`@expo/ui` 58.0.23, `src/community/segmented-control/SegmentedControl.android.tsx`,
 * MIT licensed, Copyright (c) 650 Industries, Inc.), built on the public
 * `@expo/ui/jetpack-compose` Material 3 segmented buttons. It differs in one
 * place: the community control maps `tintColor` to `activeContainerColor` only,
 * so the selected label and check keep Material's default content color. In the
 * dark scheme that is a light tone, which disappears on a light accent fill
 * (Keepwatch's amber, for one). Here the selected segment also gets
 * `activeContentColor`, the readable label color `SegmentedControl.tsx` picks
 * for the fill, the same pairing the drawn control uses.
 */
import { Host, SegmentedButton, SingleChoiceSegmentedButtonRow, Text } from "@expo/ui/jetpack-compose";
import type { NativeSegmentedControlProps } from "./nativeSegmentedControl";

export type { NativeSegmentedControlProps } from "./nativeSegmentedControl";

export function NativeSegmentedControl({
  values,
  selectedIndex,
  enabled,
  onValueChange,
  tintColor,
  selectedLabelColor,
  appearance,
  style,
}: NativeSegmentedControlProps) {
  const colors = { activeContainerColor: tintColor, activeContentColor: selectedLabelColor };

  return (
    <Host matchContents={{ vertical: true }} style={style} colorScheme={appearance}>
      <SingleChoiceSegmentedButtonRow>
        {values.map((label, index) => (
          <SegmentedButton
            key={index}
            selected={index === selectedIndex}
            onClick={() => onValueChange(label)}
            enabled={enabled}
            colors={colors}
          >
            <SegmentedButton.Label>
              <Text>{label}</Text>
            </SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}
