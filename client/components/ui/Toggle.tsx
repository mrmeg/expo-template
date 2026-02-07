import React from "react";
import { Icon } from "@/client/components/ui/Icon";
import { TextClassContext, TextColorContext } from "@/client/components/ui/StyledText";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import * as TogglePrimitive from "@rn-primitives/toggle";
import { Platform, StyleSheet, ViewStyle, ActivityIndicator, StyleProp } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { palette } from "@/client/constants/colors";

const DEFAULT_HIT_SLOP = 8;

// Size configurations
const TOGGLE_SIZES = {
  sm: {
    height: 32,
    minWidth: 32,
    paddingHorizontal: spacing.sm,
    fontSize: 12,
    iconSize: spacing.iconSm,
  },
  default: {
    height: 36,
    minWidth: 36,
    paddingHorizontal: spacing.md,
    fontSize: 13,
    iconSize: spacing.iconMd,
  },
  lg: {
    height: 40,
    minWidth: 40,
    paddingHorizontal: spacing.lg,
    fontSize: 14,
    iconSize: spacing.iconMd,
  },
};

export type ToggleVariant = "default" | "outline";
export type ToggleSize = "sm" | "default" | "lg";
export type ToggleShape = "default" | "square" | "circle";

interface ToggleProps extends Omit<TogglePrimitive.RootProps, "style"> {
  /**
   * Visual style variant
   * - default: transparent background with subtle border
   * - outline: primary border with transparent background
   * @default "default"
   */
  variant?: ToggleVariant;
  /**
   * Size of the toggle button
   * - sm: 32px height
   * - default: 40px height
   * - lg: 48px height
   * @default "default"
   */
  size?: ToggleSize;
  /**
   * Shape of the toggle button
   * - default: rounded corners (radiusMd)
   * - square: sharp corners (0)
   * - circle: fully rounded (radiusFull)
   * @default "default"
   */
  shape?: ToggleShape;
  /**
   * Whether the toggle is in a loading state
   * Shows spinner and disables interaction
   */
  loading?: boolean;
  /**
   * Whether the toggle is icon-only (equal padding)
   * Optimizes padding for icon buttons
   */
  iconOnly?: boolean;
  /**
   * Custom style override (uses StyleSheet.flatten for web compatibility)
   */
  style?: StyleProp<ViewStyle>;
}

/**
 * Enhanced Toggle Component
 *
 * Features:
 * - 2 variants (default, outline)
 * - 3 sizes (sm, default, lg)
 * - 3 shapes (default, square, circle)
 * - Loading state with spinner
 * - Icon-only optimization
 * - Style prop support
 * - Full accessibility
 *
 * Usage:
 * ```tsx
 * // Basic
 * const [pressed, setPressed] = useState(false);
 * <Toggle pressed={pressed} onPressedChange={setPressed}>
 *   <SansSerifText>Toggle Me</SansSerifText>
 * </Toggle>
 *
 * // With icon
 * import { Bold } from 'lucide-react-native';
 * <Toggle pressed={pressed} onPressedChange={setPressed} iconOnly>
 *   <ToggleIcon as={Bold} />
 * </Toggle>
 *
 * // Different shapes
 * <Toggle shape="square" pressed={pressed} onPressedChange={setPressed}>
 *   <SansSerifText>Square</SansSerifText>
 * </Toggle>
 *
 * <Toggle shape="circle" iconOnly pressed={pressed} onPressedChange={setPressed}>
 *   <ToggleIcon as={Bold} />
 * </Toggle>
 *
 * // Loading state
 * <Toggle loading pressed={pressed} onPressedChange={setPressed}>
 *   <SansSerifText>Loading...</SansSerifText>
 * </Toggle>
 * ```
 */
function Toggle({
  variant = "default",
  size = "default",
  shape = "default",
  loading = false,
  iconOnly = false,
  style: styleOverride,
  ...props
}: ToggleProps) {
  const { theme, getContrastingColor, withAlpha } = useTheme();
  const sizeConfig = TOGGLE_SIZES[size];

  // Calculate text color based on state and variant
  const getTextColor = () => {
    if (props.pressed) {
      if (variant === "outline") {
        // When pressed with outline variant, background is primary
        return getContrastingColor(
          theme.colors.primary,
          palette.white,
          palette.black
        );
      }
      // When pressed with default variant, use primary color
      return theme.colors.primary;
    }
    // When not pressed, use base content or primary for outline
    return variant === "outline" ? theme.colors.primary : theme.colors.text;
  };

  const textColor = getTextColor();

  // Determine border radius based on shape
  const getBorderRadius = () => {
    if (shape === "square") return 0;
    if (shape === "circle") return spacing.radiusFull;
    return spacing.radiusMd;
  };

  // Flatten style override for web compatibility
  const flattenedStyle = styleOverride ? StyleSheet.flatten(styleOverride) : undefined;

  const isDisabled = props.disabled || loading;

  return (
    <TextColorContext.Provider value={textColor}>
      <TextClassContext.Provider value="">
        <TogglePrimitive.Root
          {...props}
          disabled={isDisabled}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            height: sizeConfig.height,
            minWidth: sizeConfig.minWidth,
            paddingHorizontal: iconOnly ? sizeConfig.height / 2 - sizeConfig.iconSize / 2 : sizeConfig.paddingHorizontal,
            borderRadius: getBorderRadius(),
            borderWidth: 1,
            // Base variant styles
            ...(variant === "default" && !props.pressed && {
              backgroundColor: "transparent",
              borderColor: theme.colors.border,
            }),
            ...(variant === "default" && props.pressed && {
              backgroundColor: withAlpha(theme.colors.primary, 0.1),
              borderColor: theme.colors.primary,
            }),
            // Outline variant styles
            ...(variant === "outline" && !props.pressed && {
              backgroundColor: "transparent",
              borderColor: theme.colors.primary,
            }),
            ...(variant === "outline" && props.pressed && {
              backgroundColor: theme.colors.primary,
              borderColor: theme.colors.primary,
            }),
            // Disabled state
            opacity: isDisabled ? 0.5 : 1,
            // Web-specific styles
            ...(Platform.OS === "web" && {
              cursor: isDisabled ? "not-allowed" : ("pointer" as any),
              transition: "all 150ms",
            }),
            // Apply custom style override
            ...(flattenedStyle || {}),
          }}
          hitSlop={DEFAULT_HIT_SLOP}
          accessibilityRole="button"
          accessibilityState={{
            selected: props.pressed,
            disabled: !!isDisabled,
            busy: loading,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={textColor} />
          ) : (
            props.children
          )}
        </TogglePrimitive.Root>
      </TextClassContext.Provider>
    </TextColorContext.Provider>
  );
}

/**
 * ToggleIcon Component
 * Icon wrapper for use inside Toggle buttons
 * Automatically inherits sizing from parent Toggle
 *
 * Usage:
 * ```tsx
 * import { Bold } from 'lucide-react-native';
 * <Toggle pressed={pressed} onPressedChange={setPressed}>
 *   <ToggleIcon as={Bold} />
 * </Toggle>
 * ```
 */
interface ToggleIconProps {
  as: LucideIcon;
  size?: number;
  color?: string;
}

function ToggleIcon({ as: IconComponent, size, color }: ToggleIconProps) {
  return <Icon as={IconComponent} size={size || spacing.iconMd} color={color} />;
}

export { Toggle, ToggleIcon };
export type { ToggleProps };
