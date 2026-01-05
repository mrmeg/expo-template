import { AnimatedView } from "@/client/components/ui/AnimatedView";
import { TextClassContext, TextColorContext } from "@/client/components/ui/StyledText";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import * as TooltipPrimitive from "@rn-primitives/tooltip";
import * as React from "react";
import { Platform, StyleSheet, View, ViewProps } from "react-native";
import { FullWindowOverlay as RNFullWindowOverlay } from "react-native-screens";
import { palette } from "@/client/constants/colors";

/**
 * Tooltip Trigger Component
 * The element that triggers the tooltip to appear on hover (web) or press (native)
 */
const TooltipTrigger = TooltipPrimitive.Trigger;

/**
 * FullWindowOverlay wrapper - uses native overlay on iOS for proper z-index handling
 * On Android/Web, uses Fragment to avoid unnecessary nesting
 */
const FullWindowOverlay = Platform.OS === "ios" ? RNFullWindowOverlay : React.Fragment;

/**
 * Tooltip variant styles
 */
export type TooltipVariant = "default" | "dark" | "light";

interface TooltipContentProps extends TooltipPrimitive.ContentProps {
  /**
   * Optional portal host name for custom portal mounting
   */
  portalHost?: string;
  /**
   * Visual variant
   * @default "default"
   */
  variant?: TooltipVariant;
}

/**
 * Tooltip Content Component
 * The content that appears in the tooltip overlay
 * Supports smart positioning, animations, and theme integration
 *
 * Features:
 * - Side positioning (top, bottom, left, right - left/right web only)
 * - Alignment options (start, center, end)
 * - Visual variants (default, dark, light)
 * - Smooth animations
 * - Portal-based rendering for proper z-index
 */
function TooltipContent({
  side = "top",
  align = "center",
  sideOffset = 4,
  portalHost,
  variant = "default",
  ...props
}: TooltipContentProps) {
  const { theme, getShadowStyle, getContrastingColor } = useTheme();

  // Determine colors based on variant
  const getVariantColors = () => {
    switch (variant) {
    case "dark":
      return {
        background: palette.gray800,
        border: palette.gray800,
        text: palette.white,
      };
    case "light":
      return {
        background: palette.white,
        border: palette.gray200,
        text: palette.gray800,
      };
    case "default":
    default:
      return {
        background: theme.colors.card,
        border: theme.colors.border,
        text: getContrastingColor(theme.colors.card, palette.white, palette.black),
      };
    }
  };

  const colors = getVariantColors();

  const contentStyle = StyleSheet.flatten([
    {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: spacing.radiusSm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      maxWidth: 250,
      ...getShadowStyle("soft"),
    },
  ]);

  return (
    <TooltipPrimitive.Portal hostName={portalHost}>
      <FullWindowOverlay>
        <TooltipPrimitive.Overlay style={Platform.select({ native: StyleSheet.absoluteFill })}>
          <AnimatedView type="fade" enterDuration={150} exitDuration={100}>
            <TextColorContext.Provider value={colors.text}>
              <TextClassContext.Provider value="">
                <TooltipPrimitive.Content
                  side={side}
                  align={align}
                  sideOffset={sideOffset}
                  style={contentStyle}
                  {...props}
                />
              </TextClassContext.Provider>
            </TextColorContext.Provider>
          </AnimatedView>
        </TooltipPrimitive.Overlay>
      </FullWindowOverlay>
    </TooltipPrimitive.Portal>
  );
}

/**
 * Tooltip Body Component
 * Simple wrapper for tooltip content with padding
 */
interface TooltipBodyProps extends ViewProps {
  children: React.ReactNode;
}

function TooltipBody({ children, style, ...props }: TooltipBodyProps) {
  return (
    <View
      style={[
        {
          paddingHorizontal: spacing.xxs,
          paddingVertical: spacing.xxs,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

interface TooltipProps extends TooltipPrimitive.RootProps {
  /**
   * Time to wait before showing tooltip (web only)
   * @default 700
   */
  delayDuration?: number;
  /**
   * Time between tooltips when moving cursor (web only)
   * @default 300
   */
  skipDelayDuration?: number;
}

/**
 * Tooltip Root Component
 * Manages tooltip state and provides context for trigger and content
 *
 * Usage:
 * ```tsx
 * // Basic tooltip
 * <Tooltip>
 *   <TooltipTrigger asChild>
 *     <Button><Text>Hover me</Text></Button>
 *   </TooltipTrigger>
 *   <TooltipContent>
 *     <StyledText>Tooltip text</StyledText>
 *   </TooltipContent>
 * </Tooltip>
 *
 * // With positioning
 * <Tooltip>
 *   <TooltipTrigger asChild>
 *     <Icon as={Info} size={20} />
 *   </TooltipTrigger>
 *   <TooltipContent side="bottom" align="start">
 *     <StyledText>Information tooltip</StyledText>
 *   </TooltipContent>
 * </Tooltip>
 *
 * // Dark variant
 * <Tooltip>
 *   <TooltipTrigger asChild>
 *     <Button><Text>Help</Text></Button>
 *   </TooltipTrigger>
 *   <TooltipContent variant="dark">
 *     <StyledText>Dark tooltip</StyledText>
 *   </TooltipContent>
 * </Tooltip>
 * ```
 */
function Tooltip({
  delayDuration = 700,
  skipDelayDuration = 300,
  ...props
}: TooltipProps) {
  return (
    <TooltipPrimitive.Root
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  );
}

/**
 * Tooltip Component with Sub-components
 * Properly typed interface for dot notation access (e.g., Tooltip.Trigger)
 */
const TooltipComponent = Object.assign(Tooltip, {
  Trigger: TooltipTrigger,
  Content: TooltipContent,
  Body: TooltipBody,
});

export {
  TooltipComponent as Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipBody,
};
