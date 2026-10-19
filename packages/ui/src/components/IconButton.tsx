import React, { useEffect, useRef } from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import { Button, buttonHeights, type ButtonProps, type ButtonSize } from "./Button";
import type { IconName } from "./Icon";
import { verticalSlopFor } from "../lib/webHitTarget";

/** Glyph size per `ButtonSize`, in points. */
const ICON_SIZES: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 22 };

/**
 * One registered style per size and shape, created at module scope so web
 * server rendering serializes them (see `docs/server-guide.md`). The square is
 * `Button`'s own height on both axes, so `verticalSlopFor(height)` on all four
 * sides brings it to 44pt wide and tall.
 */
function squareStyles(circle: boolean) {
  const entry = (size: ButtonSize): ViewStyle => {
    const height = buttonHeights[size];
    return {
      width: height,
      minWidth: height,
      paddingHorizontal: 0,
      paddingVertical: 0,
      ...(circle && { borderRadius: height / 2 }),
    };
  };
  return StyleSheet.create({ sm: entry("sm"), md: entry("md"), lg: entry("lg") });
}

const SQUARE_STYLES = squareStyles(false);
const CIRCLE_STYLES = squareStyles(true);

const MISSING_LABEL_WARNING =
  "IconButton: `accessibilityLabel` is required; an icon-only button has no other accessible name.";

export interface IconButtonProps
  extends Omit<
    ButtonProps,
    "children" | "text" | "tx" | "txOptions" | "RightAccessory" | "LeftAccessory" | "fullWidth" | "accessibilityLabel"
  > {
  /** Registered icon name. */
  icon: IconName;
  /** Required: the button's only accessible name (no visible text). */
  accessibilityLabel: string;
  /** @default "ghost" */
  preset?: ButtonProps["preset"];
  /** Visible size: sm 28, md 32, lg 40 (Button heights). Hit area is ≥ 44 on every platform. @default "md" */
  size?: ButtonSize;
  /** @default "square" (Button radius); "circle" for a round button. */
  shape?: "square" | "circle";
}

/**
 * IconButton
 *
 * An icon-only `Button`. An `Icon` with no `accessibilityLabel` is hidden from
 * assistive tech, so an icon-only control has no accessible name unless the
 * author supplies one; here `accessibilityLabel` is required by type and
 * dev-warned when empty. It reuses `Button`'s presets and states, draws a
 * square (or circle) as wide as `Button` is tall, and reaches a 44pt hit area
 * on iOS, Android and web through a numeric `hitSlop` (native `Pressable`
 * `hitSlop`; on web `Button`'s transparent hit extender).
 *
 * ```tsx
 * <IconButton icon="refresh-cw" accessibilityLabel="Refresh" onPress={refetch} />
 * <IconButton icon="upload" preset="default" shape="circle" accessibilityLabel="Upload" onPress={upload} />
 * ```
 */
export function IconButton({
  icon,
  accessibilityLabel,
  preset = "ghost",
  size = "md",
  shape = "square",
  style,
  hitSlop,
  ...rest
}: IconButtonProps) {
  const unlabelled = typeof accessibilityLabel !== "string" || accessibilityLabel.trim() === "";
  const warned = useRef(false);
  useEffect(() => {
    if (!__DEV__ || !unlabelled || warned.current) return;
    warned.current = true;
    console.warn(MISSING_LABEL_WARNING);
  }, [unlabelled]);

  const shapeStyle = (shape === "circle" ? CIRCLE_STYLES : SQUARE_STYLES)[size];

  return (
    <Button
      {...rest}
      preset={preset}
      size={size}
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop ?? verticalSlopFor(buttonHeights[size])}
      // Spread array styles so `Button` never receives a nested array (web).
      style={[shapeStyle, ...(Array.isArray(style) ? style : [style])]}
    >
      <Button.Icon name={icon} size={ICON_SIZES[size]} />
    </Button>
  );
}
