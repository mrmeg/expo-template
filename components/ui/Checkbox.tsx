import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/constants/spacing';
import * as CheckboxPrimitive from '@rn-primitives/checkbox';
import { Check } from 'lucide-react-native';
import { Platform } from 'react-native';

const DEFAULT_HIT_SLOP = 8;

/**
 * Checkbox Component
 * A controlled checkbox component using @rn-primitives/checkbox
 * Integrates with DaisyUI theme system and supports React Native Reusables patterns
 *
 * Usage:
 * ```tsx
 * const [checked, setChecked] = useState(false);
 * <Checkbox checked={checked} onCheckedChange={setChecked} />
 * ```
 */
function Checkbox({
  ...props
}: CheckboxPrimitive.RootProps & React.RefAttributes<CheckboxPrimitive.RootRef>) {
  const { theme, getContrastingColor } = useTheme();

  // Dynamic border color with sufficient contrast against background
  // React 19 compiler automatically memoizes this calculation
  const borderColor = getContrastingColor(
    theme.colors.bgPrimary,      // Background color
    theme.colors.textPrimary,  // Option 1: Main text color
    theme.colors.neutral           // Option 2: Neutral gray
  );

  return (
    <CheckboxPrimitive.Root
      {...props}
      style={{
        borderColor: props.checked ? theme.colors.primary : borderColor,
        backgroundColor: 'transparent',
        borderRadius: spacing.radiusXs,
        borderWidth: 2,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: props.disabled ? 0.5 : 1,
      }}
      hitSlop={DEFAULT_HIT_SLOP}
    >
      <CheckboxPrimitive.Indicator
        style={{
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Icon
          as={Check}
          size={16}
          strokeWidth={3}
          color={theme.colors.primary}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
