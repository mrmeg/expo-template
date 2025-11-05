import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/constants/spacing';
import * as CheckboxPrimitive from '@rn-primitives/checkbox';
import { Check } from 'lucide-react-native';
import { Platform } from 'react-native';

const DEFAULT_HIT_SLOP = 24;

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
  className,
  checkedClassName,
  indicatorClassName,
  iconClassName,
  style: styleOverride,
  ...props
}: CheckboxPrimitive.RootProps &
  React.RefAttributes<CheckboxPrimitive.RootRef> & {
    checkedClassName?: string;
    indicatorClassName?: string;
    iconClassName?: string;
  }) {
  const { theme, getContrastingColor } = useTheme();

  // Dynamic border color with sufficient contrast against background
  // React 19 compiler automatically memoizes this calculation
  const borderColor = getContrastingColor(
    theme.colors['base-100'],      // Background color
    theme.colors['base-content'],  // Option 1: Main text color
    theme.colors.neutral           // Option 2: Neutral gray
  );

  return (
    <CheckboxPrimitive.Root
      className={cn(
        'size-4 shrink-0 rounded-[4px] border shadow-sm shadow-black/5',
        Platform.select({
          web: cn(
            'focus-visible:ring-[3px] focus-visible:ring-opacity-50 outline-none transition-shadow cursor-default disabled:cursor-not-allowed',
            'aria-invalid:border-destructive',
          ),
          native: 'overflow-hidden',
        }),
        props.disabled && 'opacity-50',
        className
      )}
      style={[
        {
          borderColor: borderColor,
          backgroundColor: Platform.OS === 'web'
            ? theme.colors.input + '30' // Add transparency
            : 'transparent',
          borderRadius: spacing.radiusXs,
          borderWidth: 1,
        },
        props.checked && {
          borderColor: theme.colors.primary,
        },
        // Spread array styles from Slot to prevent nested arrays on web
        // Only spread if styleOverride is not a function
        ...(styleOverride && typeof styleOverride !== 'function'
          ? (Array.isArray(styleOverride) ? styleOverride : [styleOverride])
          : []
        ),
      ]}
      hitSlop={DEFAULT_HIT_SLOP}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn('h-full w-full items-center justify-center', indicatorClassName)}
        style={{
          backgroundColor: theme.colors.primary,
        }}
      >
        <Icon
          as={Check}
          size={12}
          strokeWidth={Platform.OS === 'web' ? 2.5 : 3.5}
          className={cn(iconClassName)}
          color={theme.colors['primary-foreground']}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
