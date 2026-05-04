import type { IconName } from "./Icon";
import { Icon } from "./Icon";
import { TextClassContext, TextColorContext, TextSelectabilityContext } from "./StyledText";
import { spacing } from "../constants/spacing";
import { useTheme } from "../hooks/useTheme";
import * as ToggleGroupPrimitive from "@rn-primitives/toggle-group";
import * as React from "react";
import { Platform } from "react-native";

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
      return React.cloneElement(child as React.ReactElement<ToggleGroupItemProps>, {
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
  const { theme, withAlpha, getContrastingColor } = useTheme();
  const context = useToggleGroupContext();
  const { value: groupValue } = ToggleGroupPrimitive.useRootContext();
  const sizeConfig = TOGGLE_GROUP_SIZES[context.size];

  // Check if this item is selected
  const isSelected = ToggleGroupPrimitive.utils.getIsSelected(groupValue, props.value);

  // Determine the actual background color for this item
  const itemBgColor = (() => {
    if (context.variant === "outline" && isSelected) return theme.colors.primary;
    if (context.variant === "default" && isSelected) return theme.colors.background;
    return theme.colors.background;
  })();

  // Calculate text color with contrast against the actual background
  const textColor = isSelected
    ? getContrastingColor(itemBgColor, theme.colors.foreground, theme.colors.background)
    : theme.colors.foreground;

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
              borderColor: theme.colors.border,
            }),
            ...(context.variant === "default" && isSelected && {
              backgroundColor: withAlpha(theme.colors.primary, 0.1),
              borderColor: theme.colors.primary,
            }),
            // Outline variant styles
            ...(context.variant === "outline" && !isSelected && {
              backgroundColor: "transparent",
              borderColor: theme.colors.border,
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
              transition: "all 150ms",
              userSelect: "none" as any,
              // Ensure proper z-index on focus
              ...(isSelected && {
                zIndex: 10,
              }),
            }),
          }}
          hitSlop={DEFAULT_HIT_SLOP}
        >
          {typeof children === "function" ? (
            (state: any) => (
              <TextSelectabilityContext.Provider value={false}>
                {children(state)}
              </TextSelectabilityContext.Provider>
            )
          ) : (
            <TextSelectabilityContext.Provider value={false}>
              {children}
            </TextSelectabilityContext.Provider>
          )}
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
 * <ToggleGroupItem value="bold">
 *   <ToggleGroupIcon name="bold" />
 * </ToggleGroupItem>
 * ```
 */
interface ToggleGroupIconProps {
  name: IconName;
  size?: number;
  color?: string;
}

function ToggleGroupIcon({ name, size, color }: ToggleGroupIconProps) {
  const contextColor = React.useContext(TextColorContext);
  return <Icon name={name} size={size || spacing.iconMd} color={color || contextColor} />;
}

export { ToggleGroup, ToggleGroupIcon, ToggleGroupItem };
export type { ToggleGroupProps, ToggleGroupSize, ToggleGroupVariant };
