import * as React from "react";
import type { StyleProp, TextStyle, ViewProps, ViewStyle } from "react-native";
import { useTheme } from "../hooks/useTheme";
import type { ThemeColors } from "../constants/colors";
import { ICONS, type IconName } from "./iconRegistry.generated";

/**
 * Kebab-case Lucide icon names the package bundles, served from
 * `icon-names.json` through the generated registry. Add a name there and run
 * `bun run ui:icons` to extend the union; pass any other Lucide component
 * through `component` without touching the registry.
 */
export type { IconName };

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
  ViewProps,
  "accessible" | "importantForAccessibility" | "accessibilityElementsHidden" | "aria-hidden"
>;

/**
 * Props handed to a `component`. Wide enough that any `lucide-react-native`
 * component type-checks as-is (`LucideProps` extends `SvgProps`, whose `style`
 * is a view style), and any component that accepts `size` and `color` works.
 */
type CustomIconComponentProps = {
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
} & Partial<IconAccessibilityProps>;

type RegistryIconProps = IconBaseProps & {
  /** The icon name to render (a Lucide name from the package registry) */
  name: IconName;
  component?: never;
};

type CustomIconProps = IconBaseProps & {
  name?: never;
  /**
   * Custom component to render instead of a registry icon. Receives size and
   * color as props — any `lucide-react-native` icon import works here.
   */
  component: React.ComponentType<CustomIconComponentProps>;
};

export type IconProps = RegistryIconProps | CustomIconProps;

/**
 * Universal Icon Component
 * Renders `lucide-react-native` SVG icons with theme integration and style
 * support. Icons are SVG on every platform: no font to load, and server markup
 * carries the glyph.
 *
 * Usage:
 * ```tsx
 * <Icon name="check" color="primary" size={16} />
 * <Icon name="calendar" color="#FF0000" size={24} />
 * <Icon name="terminal" style={{ marginRight: 8 }} />
 * <Icon component={Rocket} color="accent" /> // any Lucide import
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

  // `style` stays a text style on the public prop for source compatibility
  // with the font-icon era; SVG roots take a view style, and every layout
  // property callers actually pass (margins, transforms) belongs to both.
  const iconStyle = [style, { pointerEvents: "none" as const }] as StyleProp<ViewStyle>;

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

  const Lucide = ICONS[(props as RegistryIconProps).name];

  return (
    <Lucide
      size={size}
      color={iconColor}
      style={iconStyle}
      {...accessibilityProps}
    />
  );
}
