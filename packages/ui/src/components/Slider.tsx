import { palette } from "../constants/colors";
import { interaction } from "../constants/interaction";
import { useTheme } from "../hooks/useTheme";
import { hapticLight } from "../lib/haptics";
import { stateSurfaceProps } from "../lib/stateSurface";
import React, { useCallback, useRef } from "react";
import { Platform, StyleProp, View, ViewStyle } from "react-native";
import { Slider as NativeSlider } from "@expo/ui/community/slider";
import { StyledText } from "./StyledText";

/**
 * Slider — a themed range input backed by the platform's native slider via
 * `@expo/ui/community/slider`:
 *
 *   - iOS:     SwiftUI `Slider`
 *   - Android: Material 3 `Slider`
 *   - Web:     native `<input type="range">`, drawn by the kit's own
 *              stylesheet (see `SLIDER_WEB_CSS`)
 *
 * The public `SliderProps` surface (value / onValueChange / min / max / step /
 * disabled / showValue / size / style) is preserved, and the active track is
 * themed with the design system's accent color on every platform. Thumb and
 * inactive-track tints additionally apply on Android and web (iOS draws the
 * system thumb). Haptic feedback fires on each step change, matching the prior
 * hand-rolled slider.
 *
 * Web: `@expo/ui` only maps `minimumTrackTintColor` to CSS `accent-color`, and
 * Chromium then paints the unfilled track dark in light mode. The kit sets
 * `appearance: none` on the input and draws the track, fill and thumb from
 * CSS variables it puts on the element, through one hoisted `<style>` (React
 * dedupes it by `href`). The stylesheet is scoped to `[data-expo-ui-slider]`,
 * so other range inputs on the page keep their look.
 *
 * Platform-owned behaviors (props accepted for ergonomics, but the platform
 * decides):
 *   - `size` is accepted for call-site compatibility but has no effect — the
 *     platform owns the track/thumb dimensions.
 */

export type SliderSize = "sm" | "md";

export interface SliderProps {
  /** Current value */
  value?: number;
  /** Called when the user drags the thumb */
  onValueChange?: (value: number) => void;
  /** Minimum value @default 0 */
  min?: number;
  /** Maximum value @default 100 */
  max?: number;
  /** Step increment @default 1 */
  step?: number;
  /** Size variant. Accepted for compatibility; the platform owns sizing. @default "md" */
  size?: SliderSize;
  /** Disable interaction @default false */
  disabled?: boolean;
  /** Show the current value as a label above the track @default false */
  showValue?: boolean;
  /** Style override for outer container */
  style?: StyleProp<ViewStyle>;
}

function Slider({
  value = 0,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  // Accepted for call-site compatibility; the platform owns track/thumb sizing.
  size: _size = "md",
  disabled = false,
  showValue = false,
  style: styleOverride,
}: SliderProps) {
  const { theme, withAlpha } = useTheme();

  // Light: `border`, not `muted` — on a card `muted` is a 1.05:1 step and the
  // unfilled track disappeared. Dark unchanged.
  const inactiveTrackColor = theme.dark ? withAlpha(palette.white, 0.1) : theme.colors.border;
  const activeTrackColor = disabled
    ? theme.dark
      ? withAlpha(palette.white, 0.28)
      : theme.colors.mutedForeground
    : theme.colors.accent;
  const thumbTintColor = disabled
    ? theme.dark
      ? withAlpha(palette.white, 0.32)
      : theme.colors.mutedForeground
    : theme.colors.accent;

  // Fire a light haptic whenever the slider crosses a step boundary, matching
  // the prior hand-rolled behavior. Native emits already-stepped values.
  const lastValue = useRef(value);
  const handleValueChange = useCallback(
    (next: number) => {
      if (next !== lastValue.current) {
        lastValue.current = next;
        hapticLight();
      }
      onValueChange?.(next);
    },
    [onValueChange],
  );

  return (
    // `alignSelf: "stretch"` gives the native slider's Host a definite width on
    // the first layout pass. Without it the SwiftUI/Compose Host measures width
    // lazily, so the thumb starts at an unresolved position and visibly snaps to
    // the correct spot on first interaction.
    <View
      {...stateSurfaceProps()}
      {...webSliderScope}
      style={[{ opacity: disabled ? interaction.disabledOpacity : 1, alignSelf: "stretch" }, styleOverride]}
    >
      {Platform.OS === "web" && sliderWebStylesheet}
      {showValue && (
        <StyledText
          selectable={false}
          style={{
            fontSize: 12,
            color: theme.colors.textDim,
            marginBottom: 4,
            userSelect: "none",
          }}
        >
          {value}
        </StyledText>
      )}
      <NativeSlider
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        disabled={disabled}
        onValueChange={handleValueChange}
        style={[
          { width: "100%" },
          Platform.OS === "web" &&
            webSliderVariables({
              fill: fillRatio(value, min, max),
              track: inactiveTrackColor,
              active: activeTrackColor,
              thumb: thumbTintColor,
              ring: theme.colors.ring,
              ringBackground: theme.colors.background,
            }),
        ]}
        // Active track — honored on iOS, Android, and web (`accentColor`).
        minimumTrackTintColor={activeTrackColor}
        // Inactive track + thumb — honored on Android (and web through the
        // CSS variables above); system-drawn on iOS.
        maximumTrackTintColor={inactiveTrackColor}
        thumbTintColor={thumbTintColor}
      />
    </View>
  );
}

/** Filled share of the track, 0–1, for the web fill gradient. */
function fillRatio(value: number, min: number, max: number): number {
  if (!(max > min)) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/**
 * CSS custom properties the web stylesheet reads. They ride on the input's
 * inline `style` (React DOM writes `--*` keys as custom properties), so each
 * slider carries its own theme values and the stylesheet stays static.
 */
function webSliderVariables(v: {
  fill: number;
  track: string;
  active: string;
  thumb: string;
  ring: string;
  ringBackground: string;
}): ViewStyle {
  return {
    "--expo-ui-slider-fill": `${Number((v.fill * 100).toFixed(2))}%`,
    "--expo-ui-slider-track": v.track,
    "--expo-ui-slider-active": v.active,
    "--expo-ui-slider-thumb": v.thumb,
    "--expo-ui-slider-ring": v.ring,
    "--expo-ui-slider-ring-bg": v.ringBackground,
  } as unknown as ViewStyle;
}

/** `data-expo-ui-slider` on the wrapper (react-native-web's `dataSet`), scoping the stylesheet. */
const webSliderScope = Platform.OS === "web" ? ({ dataSet: { expoUiSlider: "" } } as object) : {};

const TRACK = "[data-expo-ui-slider] input[type=\"range\"]";
const THUMB_SHADOW = "0 1px 3px rgba(0,0,0,.25)";
const RING_SHADOW = "0 0 0 2px var(--expo-ui-slider-ring-bg),0 0 0 4px var(--expo-ui-slider-ring)";
const SLIDER_WEB_CSS = [
  `${TRACK}{-webkit-appearance:none;appearance:none;width:100%;height:24px;margin:0;padding:0;background:transparent;cursor:pointer;outline:none;--expo-ui-slider-fill:0%}`,
  `${TRACK}:disabled{cursor:not-allowed}`,
  `${TRACK}::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:linear-gradient(var(--expo-ui-slider-active),var(--expo-ui-slider-active)) 0 0/var(--expo-ui-slider-fill) 100% no-repeat var(--expo-ui-slider-track)}`,
  `${TRACK}::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:20px;margin-top:-8px;border:0;border-radius:50%;background:var(--expo-ui-slider-thumb);box-shadow:${THUMB_SHADOW}}`,
  `${TRACK}:focus-visible::-webkit-slider-thumb{box-shadow:${RING_SHADOW}}`,
  `${TRACK}::-moz-range-track{height:4px;border-radius:2px;background:var(--expo-ui-slider-track)}`,
  `${TRACK}::-moz-range-progress{height:4px;border-radius:2px;background:var(--expo-ui-slider-active)}`,
  `${TRACK}::-moz-range-thumb{width:20px;height:20px;border:0;border-radius:50%;background:var(--expo-ui-slider-thumb);box-shadow:${THUMB_SHADOW}}`,
  `${TRACK}:focus-visible::-moz-range-thumb{box-shadow:${RING_SHADOW}}`,
].join("");

/**
 * One hoistable stylesheet (React 19 `<style href precedence>`): rendered by
 * every web Slider, mounted in `<head>` once, and part of the server markup
 * so the first paint is already themed. The CSS goes through
 * `dangerouslySetInnerHTML` rather than a text child so the element stays
 * representable outside the DOM renderer (the RN test renderer rejects text
 * outside `<Text>`); the string is a package constant, never user input.
 */
const sliderWebStylesheet =
  Platform.OS === "web"
    ? React.createElement("style", {
        href: "expo-ui-slider",
        precedence: "default",
        dangerouslySetInnerHTML: { __html: SLIDER_WEB_CSS },
      } as Record<string, unknown>)
    : null;

export { Slider };
