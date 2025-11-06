import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/constants/spacing';
import * as SwitchPrimitives from '@rn-primitives/switch';
import { Platform, View } from 'react-native';
import { SansSerifBoldText } from './StyledText';

const DEFAULT_HIT_SLOP = 8;

interface SwitchProps extends SwitchPrimitives.RootProps {
  /**
   * Optional label to display when switch is ON (checked)
   */
  labelOn?: string;
  /**
   * Optional label to display when switch is OFF (unchecked)
   */
  labelOff?: string;
  /**
   * Custom size for the switch container
   * Default: { width: 52, height: 28 }
   */
  size?: { width: number; height: number };
  /**
   * Custom size for the thumb (sliding circle)
   * Default: 24
   */
  thumbSize?: number;
}

/**
 * Switch Component
 * A controlled switch/toggle component using @rn-primitives/switch
 * Integrates with DaisyUI theme system and supports React Native Reusables patterns
 *
 * Usage:
 * ```tsx
 * const [checked, setChecked] = useState(false);
 * <Switch checked={checked} onCheckedChange={setChecked} />
 * ```
 *
 * With labels:
 * ```tsx
 * <Switch
 *   checked={checked}
 *   onCheckedChange={setChecked}
 *   labelOn="ON"
 *   labelOff="OFF"
 * />
 * ```
 */
function Switch({
  labelOn,
  labelOff,
  size = { width: 52, height: 28 },
  thumbSize = 24,
  ...props
}: SwitchProps) {
  const { theme, getContrastingColor } = useTheme();

  // Dynamic border color with sufficient contrast against background
  const borderColor = getContrastingColor(
    theme.colors['base-100'],
    theme.colors['base-300'],
    theme.colors.neutral
  );

  // Calculate label color for ON state (when checked, background is primary)
  const labelOnColor = getContrastingColor(
    theme.colors.primary,
    theme.colors.textLight,
    theme.colors.textDark
  );

  // Calculate positions and sizes
  const thumbTranslateX = props.checked ? size.width - thumbSize - 2 : 2;
  const labelFontSize = size.height / 3;

  return (
    <SwitchPrimitives.Root
      {...props}
      style={{
        position: 'relative',
        width: size.width,
        height: size.height,
        borderRadius: size.height / 2,
        borderWidth: 0.75,
        borderColor: props.checked ? theme.colors.primary : borderColor,
        backgroundColor: props.checked ? theme.colors.primary : theme.colors['base-300'],
        justifyContent: 'center',
        opacity: props.disabled ? 0.5 : 1,
        ...(Platform.OS === 'web' && { cursor: 'pointer' as any }),
      }}
      hitSlop={DEFAULT_HIT_SLOP}
    >
      {/* Label ON - shown when checked */}
      {labelOn && (
        <View
          style={{
            position: 'absolute',
            left: spacing.sm,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          pointerEvents="none"
        >
          <SansSerifBoldText
            style={{
              fontSize: labelFontSize,
              color: props.checked ? labelOnColor : 'transparent',
              userSelect: 'none',
            }}
          >
            {labelOn}
          </SansSerifBoldText>
        </View>
      )}

      {/* Thumb (sliding circle) */}
      <SwitchPrimitives.Thumb
        style={{
          width: thumbSize,
          height: thumbSize,
          borderRadius: thumbSize / 2,
          backgroundColor: theme.colors.white,
          transform: [{ translateX: thumbTranslateX }],
          ...(Platform.OS !== 'web' && {
            shadowColor: theme.colors.overlay,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3,
            elevation: 3,
          }),
        }}
      />

      {/* Label OFF - shown when unchecked */}
      {labelOff && (
        <View
          style={{
            position: 'absolute',
            right: spacing.sm,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          pointerEvents="none"
        >
          <SansSerifBoldText
            style={{
              fontSize: labelFontSize,
              color: !props.checked ? theme.colors['base-content'] : 'transparent',
              userSelect: 'none',
            }}
          >
            {labelOff}
          </SansSerifBoldText>
        </View>
      )}
    </SwitchPrimitives.Root>
  );
}

export { Switch };
