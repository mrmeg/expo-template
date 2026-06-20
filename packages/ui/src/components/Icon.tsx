import * as React from "react";
import type { StyleProp, TextProps, TextStyle } from "react-native";
import { useTheme } from "../hooks/useTheme";
import Feather from "@expo/vector-icons/Feather";
import type { ThemeColors } from "../constants/colors";

/**
 * Theme color names that can be used as shortcuts.
 *
 * Derived from {@link ThemeColors} so it always covers every semantic token
 * (`foreground`, `accent`, `border`, …) and can never drift from the theme.
 */
export type ThemeColorName = keyof ThemeColors;

/**
 * Resolve an icon color against the active theme.
 *
 * A string that names an existing theme color resolves to that semantic color;
 * anything else is treated as a literal color value (hex, `rgb()`, or a CSS
 * named color). Checking the live theme object — rather than a hand-maintained
 * list — means new tokens are usable as icon colors automatically, and a token
 * name never silently falls through as an invalid literal.
 */
function resolveIconColor(color: string | ThemeColorName | undefined, themeColors: ThemeColors): string {
  if (!color) return themeColors.text;
  if (Object.prototype.hasOwnProperty.call(themeColors, color)) {
    return themeColors[color as ThemeColorName];
  }
  return color;
}

export type IconName = React.ComponentProps<typeof Feather>["name"];

type IconBaseProps = {
  /** Size of the icon in pixels */
  size?: number;
  /** Icon color - can be a hex color or a theme color name. Defaults to theme's text color */
  color?: string | ThemeColorName;
  /** Additional styles for positioning, transforms, etc. */
  style?: StyleProp<TextStyle>;
  /** When true, hides the icon from the accessibility tree. @default false */
  decorative?: boolean;
};

type IconAccessibilityProps = Pick<
  TextProps,
  "accessible" | "importantForAccessibility" | "accessibilityElementsHidden" | "aria-hidden"
>;

type CustomIconComponentProps = {
  size: number;
  color: string;
  style?: StyleProp<TextStyle>;
} & Partial<IconAccessibilityProps>;

type FeatherIconProps = IconBaseProps & {
  /** The icon name to render (Feather icons) */
  name: IconName;
  component?: never;
};

type CustomIconProps = IconBaseProps & {
  name?: never;
  /** Custom component to render instead of Feather. Receives size and color as props. */
  component: React.ComponentType<CustomIconComponentProps>;
};

export type IconProps = FeatherIconProps | CustomIconProps;

/**
 * Universal Icon Component
 * Renders @expo/vector-icons Feather with theme integration and style support
 *
 * Usage:
 * ```tsx
 * <Icon name="check" color="primary" size={16} />
 * <Icon name="calendar" color="#FF0000" size={24} />
 * <Icon name="terminal" style={{ marginRight: 8 }} />
 * ```
 */
export function Icon(props: IconProps) {
  const { size = 24, color, style, decorative = false } = props;
  const { theme } = useTheme();
  const iconColor = resolveIconColor(color, theme.colors);

  const CustomComponent = "component" in props ? props.component : undefined;

  const accessibilityProps: IconAccessibilityProps = decorative
    ? {
      accessible: false,
      importantForAccessibility: "no-hide-descendants",
      accessibilityElementsHidden: true,
      "aria-hidden": true,
    }
    : { accessible: true };

  const iconStyle = [style, { pointerEvents: "none" as const }];

  if (CustomComponent) {
    return (
      <CustomComponent
        size={size}
        color={iconColor}
        style={iconStyle}
        {...accessibilityProps}
      />
    );
  }

  return (
    <Feather
      name={(props as FeatherIconProps).name}
      size={size}
      color={iconColor}
      style={iconStyle}
      {...accessibilityProps}
    />
  );
}
