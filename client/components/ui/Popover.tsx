import { AnimatedView } from "@/client/components/ui/AnimatedView";
import { TextClassContext, TextColorContext } from "@/client/components/ui/StyledText";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import * as PopoverPrimitive from "@rn-primitives/popover";
import * as React from "react";
import { Platform, StyleSheet, View, ViewProps } from "react-native";
import { FullWindowOverlay as RNFullWindowOverlay } from "react-native-screens";
import { palette } from "@/client/constants/colors";

/**
 * Popover Trigger Component
 * The element that triggers the popover to open/close
 */
const PopoverTrigger = PopoverPrimitive.Trigger;

/**
 * FullWindowOverlay wrapper - uses native overlay on iOS for proper z-index handling
 * On Android/Web, uses Fragment to avoid unnecessary nesting
 */
const FullWindowOverlay = Platform.OS === "ios" ? RNFullWindowOverlay : React.Fragment;

interface PopoverContentProps extends PopoverPrimitive.ContentProps {
  /**
   * Optional portal host name for custom portal mounting
   */
  portalHost?: string;
}

/**
 * Popover Content Component
 * The content that appears in the popover overlay
 * Supports smart positioning, animations, and theme integration
 */
function PopoverContent({
  side,
  align = "center",
  sideOffset = 4,
  portalHost,
  ...props
}: PopoverContentProps) {
  const { theme, getShadowStyle, getContrastingColor } = useTheme();

  // Calculate text color for popover content based on background
  const textColor = getContrastingColor(
    theme.colors.background,
    palette.white,
    palette.black
  );

  const contentStyle = StyleSheet.flatten([
    {
      backgroundColor: theme.colors.background,
      borderColor: theme.colors.border,
      borderWidth: 2,
      borderRadius: spacing.radiusMd,
      padding: spacing.xs,
      ...getShadowStyle("soft"),
    },
  ]);

  return (
    <PopoverPrimitive.Portal hostName={portalHost}>
      <FullWindowOverlay>
        <PopoverPrimitive.Overlay style={Platform.select({ native: StyleSheet.absoluteFill })}>
          <AnimatedView type="fade" enterDuration={200} exitDuration={150}>
            <TextColorContext.Provider value={textColor}>
              <TextClassContext.Provider value="">
                <PopoverPrimitive.Content
                  side={side}
                  align={align}
                  sideOffset={sideOffset}
                  style={contentStyle}
                  {...props}
                />
              </TextClassContext.Provider>
            </TextColorContext.Provider>
          </AnimatedView>
        </PopoverPrimitive.Overlay>
      </FullWindowOverlay>
    </PopoverPrimitive.Portal>
  );
}

/**
 * Popover Header Component
 * Optional header section for the popover content
 */
interface PopoverHeaderProps extends ViewProps {
  children: React.ReactNode;
}

function PopoverHeader({ children, style, ...props }: PopoverHeaderProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          paddingHorizontal: spacing.xs,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

/**
 * Popover Body Component
 * Main content area of the popover
 */
interface PopoverBodyProps extends ViewProps {
  children: React.ReactNode;
}

function PopoverBody({ children, style, ...props }: PopoverBodyProps) {
  return (
    <View
      style={[
        {
          paddingHorizontal: spacing.xs,
          paddingVertical: spacing.sm,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

/**
 * Popover Footer Component
 * Optional footer section for the popover content
 */
interface PopoverFooterProps extends ViewProps {
  children: React.ReactNode;
}

function PopoverFooter({ children, style, ...props }: PopoverFooterProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          paddingHorizontal: spacing.xs,
          paddingVertical: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

/**
 * Popover Root Component
 * Manages popover state and provides context for trigger and content
 */
const PopoverRoot = PopoverPrimitive.Root;

/**
 * Popover Component with Sub-components
 * Properly typed interface for dot notation access (e.g., Popover.Trigger)
 */
const Popover = Object.assign(PopoverRoot, {
  Trigger: PopoverTrigger,
  Content: PopoverContent,
  Header: PopoverHeader,
  Body: PopoverBody,
  Footer: PopoverFooter,
});

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverFooter,
};
