import { Icon } from '@/components/ui/Icon';
import { TextClassContext } from '@/components/ui/StyledText';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/constants/spacing';
import * as TogglePrimitive from '@rn-primitives/toggle';
import * as React from 'react';
import { Platform, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

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
    height: 40,
    minWidth: 40,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    iconSize: spacing.iconMd,
  },
  lg: {
    height: 48,
    minWidth: 48,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    iconSize: spacing.iconMd,
  },
};

type ToggleVariant = 'default' | 'outline';
type ToggleSize = 'sm' | 'default' | 'lg';

interface ToggleProps extends TogglePrimitive.RootProps {
  /**
   * Visual style variant
   * - default: transparent background with subtle border
   * - outline: primary border with transparent background
   */
  variant?: ToggleVariant;
  /**
   * Size of the toggle button
   * - sm: 32px height
   * - default: 40px height
   * - lg: 48px height
   */
  size?: ToggleSize;
}

/**
 * Toggle Component
 * A button that can be toggled on/off (pressed/unpressed)
 * Using @rn-primitives/toggle with DaisyUI theme integration
 *
 * Usage:
 * ```tsx
 * const [pressed, setPressed] = useState(false);
 * <Toggle pressed={pressed} onPressedChange={setPressed}>
 *   <SansSerifText>Toggle Me</SansSerifText>
 * </Toggle>
 * ```
 *
 * With icon:
 * ```tsx
 * import { Bold } from 'lucide-react-native';
 * <Toggle pressed={pressed} onPressedChange={setPressed}>
 *   <ToggleIcon as={Bold} />
 * </Toggle>
 * ```
 */
function Toggle({
  variant = 'default',
  size = 'default',
  ...props
}: ToggleProps) {
  const { theme, getContrastingColor, withAlpha } = useTheme();
  const styles = createStyles(theme);
  const sizeConfig = TOGGLE_SIZES[size];

  // Calculate text color based on state and variant
  const getTextColor = () => {
    if (props.pressed) {
      if (variant === 'outline') {
        // When pressed with outline variant, background is primary
        return getContrastingColor(
          theme.colors.primary,
          theme.colors.white,
          theme.colors['base-content']
        );
      }
      // When pressed with default variant, use primary color
      return theme.colors.primary;
    }
    // When not pressed, use base content or primary for outline
    return variant === 'outline' ? theme.colors.primary : theme.colors['base-content'];
  };

  const textColor = getTextColor();

  return (
    <TextClassContext.Provider value="">
      <TogglePrimitive.Root
        {...props}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          height: sizeConfig.height,
          minWidth: sizeConfig.minWidth,
          paddingHorizontal: sizeConfig.paddingHorizontal,
          borderRadius: spacing.radiusMd,
          borderWidth: 1,
          // Base variant styles
          ...(variant === 'default' && !props.pressed && {
            backgroundColor: 'transparent',
            borderColor: theme.colors['base-300'],
          }),
          ...(variant === 'default' && props.pressed && {
            backgroundColor: withAlpha(theme.colors.primary, 0.1),
            borderColor: theme.colors.primary,
          }),
          // Outline variant styles
          ...(variant === 'outline' && !props.pressed && {
            backgroundColor: 'transparent',
            borderColor: theme.colors.primary,
          }),
          ...(variant === 'outline' && props.pressed && {
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.primary,
          }),
          // Disabled state
          opacity: props.disabled ? 0.5 : 1,
          // Web-specific styles
          ...(Platform.OS === 'web' && {
            cursor: props.disabled ? 'not-allowed' : ('pointer' as any),
            transition: 'all 0.2s',
          }),
        }}
        hitSlop={DEFAULT_HIT_SLOP}
      >
        {props.children}
      </TogglePrimitive.Root>
    </TextClassContext.Provider>
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

const createStyles = (theme: any) =>
  StyleSheet.create({
    // Styles are inline for better dynamic theming
  });

export { Toggle, ToggleIcon };
export type { ToggleProps, ToggleVariant, ToggleSize };
