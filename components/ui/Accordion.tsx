import { Icon } from '@/components/ui/Icon';
import { TextClassContext } from '@/components/ui/StyledText';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/constants/spacing';
import * as AccordionPrimitive from '@rn-primitives/accordion';
import { ChevronDown } from 'lucide-react-native';
import { Platform, Pressable, View, ViewStyle } from 'react-native';
import Animated, {
  FadeOutUp,
  LayoutAnimationConfig,
  LinearTransition,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

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
    <LayoutAnimationConfig skipEntering>
      <AccordionPrimitive.Root
        {...(props as AccordionPrimitive.RootProps)}
        asChild={Platform.OS !== 'web'}>
        <Animated.View layout={LinearTransition.duration(200)} style={style}>
          {children}
        </Animated.View>
      </AccordionPrimitive.Root>
    </LayoutAnimationConfig>
  );
}

/**
 * Accordion Item Component
 * Individual accordion item with border styling
 */
function AccordionItem({
  children,
  className,
  value,
  style: styleOverride,
  ...props
}: AccordionPrimitive.ItemProps & React.RefAttributes<AccordionPrimitive.ItemRef>) {
  const { theme } = useTheme();

  return (
    <AccordionPrimitive.Item
      className={cn(
        'border-border border-b',
        Platform.select({ web: 'last:border-b-0' }),
        className
      )}
      value={value}
      asChild
      {...props}>
      <Animated.View
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
        ]}
        layout={Platform.select({ native: LinearTransition.duration(200) })}>
        {children}
      </Animated.View>
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
  className,
  children,
  style: styleOverride,
  ...props
}: AccordionPrimitive.TriggerProps & {
  children?: React.ReactNode;
} & React.RefAttributes<AccordionPrimitive.TriggerRef>) {
  const { theme } = useTheme();
  const { isExpanded } = AccordionPrimitive.useItemContext();

  const progress = useDerivedValue(
    () => (isExpanded ? withTiming(1, { duration: 250 }) : withTiming(0, { duration: 200 })),
    [isExpanded]
  );

  const chevronStyle = useAnimatedStyle(
    () => ({
      transform: [{ rotate: `${progress.value * 180}deg` }],
    }),
    [progress]
  );

  return (
    <TextClassContext.Provider value={cn('text-left text-sm font-medium')}>
      <AccordionPrimitive.Header>
        <AccordionPrimitive.Trigger {...props} asChild>
          <Trigger
            className={cn(
              'flex-row items-start justify-between gap-4 rounded-md py-4 disabled:opacity-50',
              Platform.select({
                web: 'focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 outline-none transition-all hover:underline focus-visible:ring-[3px] disabled:pointer-events-none [&[data-state=open]>svg]:rotate-180',
              }),
              className
            )}
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
            <Animated.View style={chevronStyle}>
              <Icon
                as={ChevronDown}
                size={16}
                className={cn(
                  'text-muted-foreground shrink-0',
                  Platform.select({
                    web: 'pointer-events-none translate-y-0.5 transition-transform duration-200',
                  })
                )}
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
  className,
  children,
  style: styleOverride,
  ...props
}: AccordionPrimitive.ContentProps & React.RefAttributes<AccordionPrimitive.ContentRef>) {
  const { isExpanded } = AccordionPrimitive.useItemContext();

  return (
    <TextClassContext.Provider value="text-sm">
      <AccordionPrimitive.Content
        className={cn(
          'overflow-hidden',
          Platform.select({
            web: isExpanded ? 'animate-accordion-down' : 'animate-accordion-up',
          })
        )}
        {...props}>
        <Animated.View
          exiting={Platform.select({ native: FadeOutUp.duration(200) })}
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
          ]}
          className={cn(className)}>
          {children}
        </Animated.View>
      </AccordionPrimitive.Content>
    </TextClassContext.Provider>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
