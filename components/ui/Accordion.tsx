import { Icon } from '@/components/ui/Icon';
import { TextClassContext } from '@/components/ui/StyledText';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/constants/spacing';
import * as AccordionPrimitive from '@rn-primitives/accordion';
import { ChevronDown } from 'lucide-react-native';
import * as React from 'react';
import { Animated, Platform, Pressable, View, ViewStyle } from 'react-native';

/**
 * Accordion Root Component
 * Container for accordion items with support for single or multiple open items
 *
 * Usage:
 * <Accordion type="single" collapsible>
 *   <AccordionItem value="item-1">
 *     <AccordionTrigger>Title</AccordionTrigger>
 *     <AccordionContent>Content</AccordionContent>
 *   </AccordionItem>
 * </Accordion>
 */
function Accordion({
  children,
  style,
  ...props
}: Omit<AccordionPrimitive.RootProps, 'asChild'> &
  React.RefAttributes<AccordionPrimitive.RootRef> & {
    style?: ViewStyle;
  }) {
  return (
    <AccordionPrimitive.Root
      {...(props as AccordionPrimitive.RootProps)}
      asChild={Platform.OS !== 'web'}>
      <View style={style}>
        {children}
      </View>
    </AccordionPrimitive.Root>
  );
}

/**
 * Accordion Item Component
 * Individual accordion item with border styling
 */
function AccordionItem({
  children,
  value,
  style: styleOverride,
  ...props
}: AccordionPrimitive.ItemProps & React.RefAttributes<AccordionPrimitive.ItemRef>) {
  const { theme } = useTheme();

  return (
    <AccordionPrimitive.Item
      value={value}
      asChild
      {...props}>
      <View
        style={[
          {
            borderBottomWidth: 1,
            borderBottomColor: theme.colors['base-300'],
            overflow: 'hidden',
          },
          // Spread array styles from primitives to prevent nested arrays on web
          ...(styleOverride && typeof styleOverride !== 'function'
            ? (Array.isArray(styleOverride) ? styleOverride : [styleOverride])
            : []
          ),
        ]}>
        {children}
      </View>
    </AccordionPrimitive.Item>
  );
}

const Trigger = Platform.OS === 'web' ? View : Pressable;

/**
 * Accordion Trigger Component
 * Clickable header that expands/collapses the content
 * Includes animated chevron icon
 */
function AccordionTrigger({
  children,
  style: styleOverride,
  ...props
}: AccordionPrimitive.TriggerProps & {
  children?: React.ReactNode;
} & React.RefAttributes<AccordionPrimitive.TriggerRef>) {
  const { theme } = useTheme();
  const { isExpanded } = AccordionPrimitive.useItemContext();
  const rotateAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: isExpanded ? 250 : 200,
      useNativeDriver: true,
    }).start();
  }, [isExpanded, rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <TextClassContext.Provider value="">
      <AccordionPrimitive.Header>
        <AccordionPrimitive.Trigger {...props} asChild>
          <Trigger
            style={[
              {
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: spacing.md,
                borderRadius: spacing.radiusMd,
                paddingVertical: spacing.md,
                ...(Platform.OS === 'web' && { cursor: 'pointer' as any }),
              },
              // Spread array styles from primitives to prevent nested arrays on web
              ...(styleOverride && typeof styleOverride !== 'function'
                ? (Array.isArray(styleOverride) ? styleOverride : [styleOverride])
                : []
              ),
            ]}>
            <>{children}</>
            <Animated.View style={{ transform: [{ rotate }] }}>
              <Icon
                as={ChevronDown}
                size={16}
                color={theme.colors['base-content']}
              />
            </Animated.View>
          </Trigger>
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
    </TextClassContext.Provider>
  );
}

/**
 * Accordion Content Component
 * Expandable content area with animations
 */
function AccordionContent({
  children,
  style: styleOverride,
  ...props
}: AccordionPrimitive.ContentProps & React.RefAttributes<AccordionPrimitive.ContentRef>) {
  return (
    <TextClassContext.Provider value="">
      <AccordionPrimitive.Content {...props}>
        <View
          style={[
            {
              paddingBottom: spacing.md,
              overflow: 'hidden',
            },
            // Spread array styles from primitives to prevent nested arrays on web
            ...(styleOverride && typeof styleOverride !== 'function'
              ? (Array.isArray(styleOverride) ? styleOverride : [styleOverride])
              : []
            ),
          ]}>
          {children}
        </View>
      </AccordionPrimitive.Content>
    </TextClassContext.Provider>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
