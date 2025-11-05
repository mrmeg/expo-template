import { NativeOnlyAnimatedView } from '@/components/ui/native-only-animated-view';
import { TextClassContext } from '@/components/ui/StyledText';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/constants/spacing';
import * as PopoverPrimitive from '@rn-primitives/popover';
import * as React from 'react';
import { Platform, StyleSheet, View, ViewProps } from 'react-native';
import { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';

/**
 * Popover Trigger Component
 * The element that triggers the popover to open/close
 */
const PopoverTrigger = PopoverPrimitive.Trigger;

/**
 * FullWindowOverlay wrapper - uses native overlay on iOS for proper z-index handling
 * On Android/Web, uses Fragment to avoid unnecessary nesting
 */
const FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;

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
  align = 'center',
  sideOffset = 4,
  portalHost,
  ...props
}: PopoverContentProps) {
  const { theme, getShadowStyle } = useTheme();

  const contentStyle = StyleSheet.flatten([
    {
      backgroundColor: theme.colors['base-100'],
      borderColor: theme.colors['base-300'],
      borderWidth: 2,
      borderRadius: spacing.radiusMd,
      padding: spacing.md,
      ...getShadowStyle('soft'),
    },
  ]);

  return (
    <PopoverPrimitive.Portal hostName={portalHost}>
      <FullWindowOverlay>
        <PopoverPrimitive.Overlay style={Platform.select({ native: StyleSheet.absoluteFill })}>
          <NativeOnlyAnimatedView enterDuration={200} exitDuration={150}>
            <TextClassContext.Provider value="">
              <PopoverPrimitive.Content
                align={align}
                sideOffset={sideOffset}
                style={contentStyle}
                {...props}
              />
            </TextClassContext.Provider>
          </NativeOnlyAnimatedView>
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
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.buttonPadding,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors['base-300'],
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
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.buttonPadding,
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
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.buttonPadding,
          borderTopWidth: 1,
          borderTopColor: theme.colors['base-300'],
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
