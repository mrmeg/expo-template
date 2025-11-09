import { Icon } from "@/components/ui/Icon";
import { TextClassContext, TextColorContext } from "@/components/ui/StyledText";
import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/constants/spacing";
import * as ToggleGroupPrimitive from "@rn-primitives/toggle-group";
import * as React from "react";
import { Platform } from "react-native";
import type { LucideIcon } from "lucide-react-native";

const DEFAULT_HIT_SLOP = 8;

// Size configurations (same as Toggle)
const TOGGLE_GROUP_SIZES = {
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

type ToggleGroupVariant = "default" | "outline";
type ToggleGroupSize = "sm" | "default" | "lg";

// Context to share variant/size with items
interface ToggleGroupContextValue {
  variant: ToggleGroupVariant;
  size: ToggleGroupSize;
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue | null>(null);

function useToggleGroupContext() {
  const context = React.useContext(ToggleGroupContext);
  if (context === null) {
    throw new Error(
      "ToggleGroup compound components cannot be rendered outside the ToggleGroup component"
    );
  }
  return context;
}

type ToggleGroupProps = ToggleGroupPrimitive.RootProps & {
  /**
   * Visual style variant
   * - default: transparent background with subtle border
   * - outline: primary border with grouped appearance
   */
  variant?: ToggleGroupVariant;
  /**
   * Size of the toggle buttons
   * - sm: 32px height
   * - default: 40px height
   * - lg: 48px height
   */
  size?: ToggleGroupSize;
};

/**
 * ToggleGroup Component
 * A group of toggle buttons for single or multiple selection
 * Using @rn-primitives/toggle-group with DaisyUI theme integration
 *
 * Usage (Single Selection):
 * ```tsx
 * const [alignment, setAlignment] = useState('left');
 * <ToggleGroup type="single" value={alignment} onValueChange={setAlignment}>
 *   <ToggleGroupItem value="left">Left</ToggleGroupItem>
 *   <ToggleGroupItem value="center">Center</ToggleGroupItem>
 *   <ToggleGroupItem value="right">Right</ToggleGroupItem>
 * </ToggleGroup>
 * ```
 *
 * Usage (Multiple Selection):
 * ```tsx
 * const [formats, setFormats] = useState(['bold']);
 * <ToggleGroup type="multiple" value={formats} onValueChange={setFormats}>
 *   <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
 *   <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
 * </ToggleGroup>
 * ```
 */
function ToggleGroup({
  variant = "default",
  size = "default",
  children,
  ...props
}: ToggleGroupProps) {
  const { theme } = useTheme();

  // Count valid children for first/last detection
  const childrenArray = React.Children.toArray(children);
  const validChildren = childrenArray.filter(
    (child) => React.isValidElement(child) && child.type === ToggleGroupItem
  );
  const childCount = validChildren.length;

  // Clone children with position props
  let itemIndex = 0;
  const enhancedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement(child) && child.type === ToggleGroupItem) {
      const isFirst = itemIndex === 0;
      const isLast = itemIndex === childCount - 1;
      itemIndex++;
      return React.cloneElement(child as React.ReactElement<any>, {
        isFirst,
        isLast,
      });
    }
    return child;
  });

  return (
    <ToggleGroupPrimitive.Root
      {...props}
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: spacing.radiusMd,
        // No shadow on Android - causes text background artifact
        ...(variant === "outline" && Platform.OS === "ios" && {
          shadowColor: theme.colors.overlay,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
        }),
        ...(Platform.OS === "web" && {
          width: "fit-content" as any,
        }),
      }}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {enhancedChildren}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

type ToggleGroupItemProps = ToggleGroupPrimitive.ItemProps & {
  /**
   * Automatically set by ToggleGroup parent - don't set manually
   */
  isFirst?: boolean;
  /**
   * Automatically set by ToggleGroup parent - don't set manually
   */
  isLast?: boolean;
};

/**
 * ToggleGroupItem Component
 * Individual toggle button within a ToggleGroup
 * Position (first/last) is automatically detected for rounded corners
 */
function ToggleGroupItem({
  isFirst = false,
  isLast = false,
  children,
  ...props
}: ToggleGroupItemProps) {
  const { theme, getContrastingColor, withAlpha } = useTheme();
  const context = useToggleGroupContext();
  const { value: groupValue } = ToggleGroupPrimitive.useRootContext();
  const sizeConfig = TOGGLE_GROUP_SIZES[context.size];

  // Check if this item is selected
  const isSelected = ToggleGroupPrimitive.utils.getIsSelected(groupValue, props.value);

  // Calculate text color based on state and variant
  const getTextColor = () => {
    if (isSelected) {
      if (context.variant === "outline") {
        return getContrastingColor(
          theme.colors.primary,
          theme.colors.textLight,
          theme.colors.textDark
        );
      }
      return theme.colors.primary;
    }
    return context.variant === "outline"
      ? theme.colors.primary
      : theme.colors.textPrimary;
  };

  const textColor = getTextColor();

  return (
    <TextColorContext.Provider value={textColor}>
      <TextClassContext.Provider value="">
        <ToggleGroupPrimitive.Item
          {...props}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            height: sizeConfig.height,
            minWidth: sizeConfig.minWidth,
            paddingHorizontal: sizeConfig.paddingHorizontal,
            borderWidth: 1,
            flexShrink: 0,
            // Base variant styles
            ...(context.variant === "default" && !isSelected && {
              backgroundColor: "transparent",
              borderColor: theme.colors.bgTertiary,
            }),
            ...(context.variant === "default" && isSelected && {
              backgroundColor: withAlpha(theme.colors.primary, 0.1),
              borderColor: theme.colors.primary,
            }),
            // Outline variant styles
            ...(context.variant === "outline" && !isSelected && {
              backgroundColor: "transparent",
              borderColor: theme.colors.primary,
            }),
            ...(context.variant === "outline" && isSelected && {
              backgroundColor: theme.colors.primary,
              borderColor: theme.colors.primary,
            }),
            // Remove borders between items (except first)
            ...(context.variant === "outline" && !isFirst && {
              borderLeftWidth: 0,
            }),
            // Border radius handling
            borderRadius: 0, // Remove all radius by default
            ...(isFirst && {
              borderTopLeftRadius: spacing.radiusMd,
              borderBottomLeftRadius: spacing.radiusMd,
            }),
            ...(isLast && {
              borderTopRightRadius: spacing.radiusMd,
              borderBottomRightRadius: spacing.radiusMd,
            }),
            // Single item (both first and last)
            ...(isFirst && isLast && {
              borderRadius: spacing.radiusMd,
            }),
            // Disabled state
            opacity: props.disabled ? 0.5 : 1,
            // Web-specific styles
            ...(Platform.OS === "web" && {
              cursor: props.disabled ? "not-allowed" : ("pointer" as any),
              transition: "all 0.2s",
              // Ensure proper z-index on focus
              ...(isSelected && {
                zIndex: 10,
              }),
            }),
          }}
          hitSlop={DEFAULT_HIT_SLOP}
        >
          {children}
        </ToggleGroupPrimitive.Item>
      </TextClassContext.Provider>
    </TextColorContext.Provider>
  );
}

/**
 * ToggleGroupIcon Component
 * Icon wrapper for use inside ToggleGroup items
 * Automatically inherits sizing from parent ToggleGroup
 *
 * Usage:
 * ```tsx
 * import { Bold } from 'lucide-react-native';
 * <ToggleGroupItem value="bold">
 *   <ToggleGroupIcon as={Bold} />
 * </ToggleGroupItem>
 * ```
 */
interface ToggleGroupIconProps {
  as: LucideIcon;
  size?: number;
  color?: string;
}

function ToggleGroupIcon({ as: IconComponent, size, color }: ToggleGroupIconProps) {
  return <Icon as={IconComponent} size={size || spacing.iconMd} color={color} />;
}

export { ToggleGroup, ToggleGroupItem, ToggleGroupIcon };
export type { ToggleGroupProps, ToggleGroupVariant, ToggleGroupSize };
