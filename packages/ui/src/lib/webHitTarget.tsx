/**
 * Web pointer targets. react-native-web ignores `hitSlop`, so a control whose
 * drawn box is shorter than `spacing.touchTarget` (44) grows its target on web
 * with a transparent, absolutely positioned child inside the drawn box. The
 * Pressable root keeps its rect (popover and tooltip anchors do not move),
 * layout does not change, and a click on the child bubbles to the root.
 *
 * The default extends vertically only: two controls in an 8pt-gap row must
 * never share a hit region. A caller `hitSlop` is used as given, like native.
 * Used by `Button`, `Toggle` and `ToggleGroup` items.
 */
import React from "react";
import { Platform, View, type PressableProps } from "react-native";
import { spacing } from "../constants/spacing";

export type HitInsets = { top: number; bottom: number; left: number; right: number };

/** Slop per side that brings `height` up to `spacing.touchTarget`; 0 when it already is. */
export const verticalSlopFor = (height: number) =>
  Math.ceil(Math.max(0, spacing.touchTarget - height) / 2);

/**
 * Web insets for the hit extender: the default vertical slop for `height`, or
 * a caller `hitSlop` (a number on all four sides, insets as given, missing
 * sides 0). `null` when nothing extends (`hitSlop={0}` opts out).
 */
export function getWebHitInsets(hitSlop: PressableProps["hitSlop"], height: number): HitInsets | null {
  if (hitSlop === undefined || hitSlop === null) {
    const slop = verticalSlopFor(height);
    return slop > 0 ? { top: slop, bottom: slop, left: 0, right: 0 } : null;
  }
  const insets = typeof hitSlop === "number"
    ? { top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop }
    : { top: hitSlop.top ?? 0, bottom: hitSlop.bottom ?? 0, left: hitSlop.left ?? 0, right: hitSlop.right ?? 0 };
  return insets.top || insets.bottom || insets.left || insets.right ? insets : null;
}

interface WebHitTargetProps {
  insets: HitInsets | null;
  /** The drawn box's border width: an absolute child sits against the padding box, inside the border. */
  border?: number;
  testID?: string;
}

/**
 * The transparent hit extender. Render it as the last child of the drawn box
 * (so it paints above the content); nothing on native or when `insets` is null.
 * Hidden from assistive tech: the control itself is the accessible element.
 */
export function WebHitTarget({ insets, border = 0, testID = "hit-target" }: WebHitTargetProps) {
  if (Platform.OS !== "web" || !insets) return null;
  return (
    <View
      testID={testID}
      aria-hidden={true}
      importantForAccessibility="no-hide-descendants"
      focusable={false}
      style={{
        position: "absolute",
        // `0 - n` keeps a 0 inset at +0 (a unary minus would give -0).
        top: 0 - (insets.top + border),
        bottom: 0 - (insets.bottom + border),
        left: 0 - (insets.left + border),
        right: 0 - (insets.right + border),
      }}
    />
  );
}
