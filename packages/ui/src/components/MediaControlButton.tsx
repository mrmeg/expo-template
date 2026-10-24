import React, { useEffect, useRef } from "react";
import { Platform, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { palette } from "../constants/colors";
import { useFocusVisible } from "../hooks/useFocusVisible";
import { useTheme, withAlpha } from "../hooks/useTheme";
import { stateSurfaceProps } from "../lib/stateSurface";
import { getWebHitInsets, verticalSlopFor, WebHitTarget } from "../lib/webHitTarget";
import { Icon, type IconName } from "./Icon";

export type MediaControlButtonSize = "sm" | "md" | "lg";

/** Visible diameter per size, in points. */
const DIAMETERS: Record<MediaControlButtonSize, number> = { sm: 32, md: 40, lg: 56 };

/** Glyph size per size, in points. */
const GLYPH_SIZES: Record<MediaControlButtonSize, number> = { sm: 16, md: 20, lg: 28 };

/** The scrim at rest and pressed. Fixed, never theme colors: the button sits over arbitrary frames. */
const SCRIM = /*#__PURE__*/ withAlpha(palette.black, 0.45);
const SCRIM_PRESSED = /*#__PURE__*/ withAlpha(palette.black, 0.6);

/**
 * Registered at module scope so web server rendering serializes them (see
 * `docs/server-guide.md`). The overlay colors do not follow the theme, so
 * every state is static.
 */
const styles = /*#__PURE__*/ StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    backgroundColor: SCRIM,
  },
  sm: { width: DIAMETERS.sm, height: DIAMETERS.sm, borderRadius: DIAMETERS.sm / 2 },
  md: { width: DIAMETERS.md, height: DIAMETERS.md, borderRadius: DIAMETERS.md / 2 },
  lg: { width: DIAMETERS.lg, height: DIAMETERS.lg, borderRadius: DIAMETERS.lg / 2 },
  pressed: { backgroundColor: SCRIM_PRESSED },
  glyphDisabled: { opacity: 0.4 },
});

const MISSING_LABEL_WARNING =
  "MediaControlButton: `accessibilityLabel` is required; an icon-only button has no other accessible name.";

export interface MediaControlButtonProps
  extends Omit<
    PressableProps,
    "children" | "style" | "accessibilityLabel" | "accessibilityRole" | "disabled"
  > {
  /** Registered icon name. */
  icon: IconName;
  /** Required: the button's only accessible name (no visible text). */
  accessibilityLabel: string;
  /** Visible size: sm 32, md 40, lg 56 (glyph 16, 20, 28). Hit area is at least 44 on every platform. @default "md" */
  size?: MediaControlButtonSize;
  /** Sets `accessibilityState.selected`, for a toggle such as mute. The glyph, not a tint, shows the state. */
  selected?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * MediaControlButton
 *
 * An icon-only control for chrome drawn over video and images: a white glyph
 * on a translucent black circle (`black` at 45% alpha, 60% pressed), which
 * reads over any frame. Use it for play, mute, fullscreen, close and the like
 * on a `Video` or `MediaViewer`. Themed surfaces, such as an `AudioPlayer`
 * bar, use `IconButton` (`preset="ghost"`, `shape="circle"`) instead.
 *
 * It is not an `IconButton` preset because `Button` presets follow the theme,
 * and an overlay must not: a light-theme ghost button is dark ink on a dark
 * frame. It takes `IconButton`'s prop names (`icon`, a required
 * `accessibilityLabel`, `size`, `disabled`) and its dev warning for an empty
 * label (once per instance, in development), so the two read alike.
 *
 * The hit area is at least 44 pt on iOS, Android and web: a numeric
 * `hitSlop` natively, and on web a transparent extender, since
 * react-native-web ignores `hitSlop`. The slop reaches past every edge, so
 * adjacent buttons need a gap of at least twice it: 12 pt for `sm`, 4 for
 * `md`, none for `lg` (already 56).
 *
 * ```tsx
 * <MediaControlButton icon="play" accessibilityLabel="Play" onPress={play} />
 * <MediaControlButton icon={muted ? "volume-x" : "volume-2"} selected={muted} accessibilityLabel="Mute" onPress={toggleMute} />
 * ```
 */
export function MediaControlButton({
  icon,
  accessibilityLabel,
  size = "md",
  selected,
  disabled,
  style,
  hitSlop,
  accessibilityState,
  onFocus,
  onBlur,
  ...rest
}: MediaControlButtonProps) {
  const { getFocusRingStyle } = useTheme();
  const { focused, onFocus: showFocusRing, onBlur: hideFocusRing } = useFocusVisible({ onFocus, onBlur });

  const unlabelled = typeof accessibilityLabel !== "string" || accessibilityLabel.trim() === "";
  const warned = useRef(false);
  useEffect(() => {
    if (!__DEV__ || !unlabelled || warned.current) return;
    warned.current = true;
    console.warn(MISSING_LABEL_WARNING);
  }, [unlabelled]);

  const diameter = DIAMETERS[size];
  const effectiveHitSlop = hitSlop ?? verticalSlopFor(diameter);
  const webHitInsets = Platform.OS === "web" ? getWebHitInsets(effectiveHitSlop, diameter) : null;
  const callerStyle = Array.isArray(style) ? style : [style];

  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ ...accessibilityState, disabled: !!disabled, ...(selected === undefined ? null : { selected }) }}
      // react-native-web does not map `accessibilityState`; a toggle states itself with aria-pressed.
      {...(Platform.OS === "web" && selected !== undefined ? { "aria-pressed": selected } : null)}
      disabled={disabled || undefined}
      hitSlop={effectiveHitSlop}
      onFocus={showFocusRing}
      onBlur={hideFocusRing}
      // Android: fixed native tree across pressed/disabled flips (see `stateSurfaceProps`).
      {...stateSurfaceProps()}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        pressed && !disabled && styles.pressed,
        focused && !disabled && getFocusRingStyle(),
        // Spread array styles so the Pressable never receives a nested array (web).
        ...callerStyle,
      ]}
    >
      <Icon
        name={icon}
        size={GLYPH_SIZES[size]}
        color={palette.white}
        style={disabled ? styles.glyphDisabled : undefined}
      />
      {/* Transparent hit extender (web); last child so it paints above the glyph. */}
      <WebHitTarget insets={webHitInsets} testID="media-control-hit-target" />
    </Pressable>
  );
}
