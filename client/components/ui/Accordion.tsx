import { useEffect, useState } from "react";
import { Platform, Pressable, View, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";
import { Icon } from "@/client/components/ui/Icon";
import { TextClassContext } from "@/client/components/ui/StyledText";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import * as AccordionPrimitive from "@rn-primitives/accordion";

type BaseAccordionRootProps = Omit<React.ComponentProps<typeof View>, "style"> &
  React.RefAttributes<AccordionPrimitive.RootRef> & {
    disabled?: boolean;
    collapsible?: boolean;
    dir?: "ltr" | "rtl";
    orientation?: "vertical" | "horizontal";
    style?: ViewStyle;
  };

type WebSingleAccordionRootProps = BaseAccordionRootProps & {
  type: "single";
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string | undefined) => void;
};

type WebMultipleAccordionRootProps = BaseAccordionRootProps & {
  type: "multiple";
  defaultValue?: string[];
  value?: string[];
  onValueChange?: (value: string[]) => void;
};

type AccordionRootProps = WebSingleAccordionRootProps | WebMultipleAccordionRootProps;

function normalizeSingleValue(value: string | undefined): string {
  return value ?? "";
}

function denormalizeSingleValue(value: string): string | undefined {
  return value === "" ? undefined : value;
}

function normalizeMultipleValue(value: string[] | undefined): string[] {
  return value ?? [];
}

function WebSingleAccordionRoot(props: WebSingleAccordionRootProps) {
  const isControlled = Object.prototype.hasOwnProperty.call(props, "value");
  const [uncontrolledValue, setUncontrolledValue] = useState(() =>
    normalizeSingleValue(props.defaultValue)
  );
  const normalizedValue = isControlled
    ? normalizeSingleValue(props.value)
    : uncontrolledValue;

  const handleValueChange = (nextValue: string | undefined) => {
    const normalizedNextValue = normalizeSingleValue(nextValue);

    if (!isControlled) {
      setUncontrolledValue(normalizedNextValue);
    }

    props.onValueChange?.(denormalizeSingleValue(normalizedNextValue));
  };

  const {
    children,
    style,
    type: _type,
    defaultValue: _defaultValue,
    onValueChange: _onValueChange,
    value: _value,
    ...rootProps
  } = props;

  return (
    <AccordionPrimitive.Root
      {...(rootProps as any)}
      type="single"
      value={normalizedValue}
      onValueChange={handleValueChange}
      asChild={false}>
      <View style={style}>
        {children}
      </View>
    </AccordionPrimitive.Root>
  );
}

function WebMultipleAccordionRoot(props: WebMultipleAccordionRootProps) {
  const isControlled = Object.prototype.hasOwnProperty.call(props, "value");
  const [uncontrolledValue, setUncontrolledValue] = useState(() =>
    normalizeMultipleValue(props.defaultValue)
  );
  const normalizedValue = isControlled
    ? normalizeMultipleValue(props.value)
    : uncontrolledValue;

  const handleValueChange = (nextValue: string[]) => {
    const normalizedNextValue = normalizeMultipleValue(nextValue);

    if (!isControlled) {
      setUncontrolledValue(normalizedNextValue);
    }

    props.onValueChange?.(normalizedNextValue);
  };

  const {
    children,
    style,
    type: _type,
    defaultValue: _defaultValue,
    onValueChange: _onValueChange,
    value: _value,
    ...rootProps
  } = props;

  return (
    <AccordionPrimitive.Root
      {...(rootProps as any)}
      type="multiple"
      value={normalizedValue}
      onValueChange={handleValueChange}
      asChild={false}>
      <View style={style}>
        {children}
      </View>
    </AccordionPrimitive.Root>
  );
}

function WebAccordionRoot(props: AccordionRootProps) {
  if (props.type === "multiple") {
    return <WebMultipleAccordionRoot {...props} />;
  }

  return <WebSingleAccordionRoot {...props} />;
}

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
}: AccordionRootProps) {
  if (Platform.OS === "web" as any) {
    return (
      <WebAccordionRoot {...props} style={style}>
        {children}
      </WebAccordionRoot>
    );
  }

  return (
    <AccordionPrimitive.Root
      {...(props as AccordionPrimitive.RootProps)}
      asChild>
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
            borderBottomColor: theme.colors.border,
            overflow: "hidden",
          },
          // Spread array styles from primitives to prevent nested arrays on web
          ...(styleOverride && typeof styleOverride !== "function"
            ? (Array.isArray(styleOverride) ? styleOverride : [styleOverride])
            : []
          ),
        ]}>
        {children}
      </View>
    </AccordionPrimitive.Item>
  );
}

const Trigger = Platform.OS === "web" ? View : Pressable;

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
  const reduceMotion = useReducedMotion();
  const { isExpanded } = AccordionPrimitive.useItemContext();
  const rotation = useSharedValue(isExpanded ? 1 : 0);

  useEffect(() => {
    const target = isExpanded ? 1 : 0;
    if (reduceMotion) {
      rotation.value = target;
      return;
    }
    rotation.value = withTiming(target, {
      duration: isExpanded ? 200 : 150,
    });
  }, [isExpanded, reduceMotion]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  return (
    <TextClassContext.Provider value="">
      <AccordionPrimitive.Header>
        <AccordionPrimitive.Trigger {...props} asChild>
          <Trigger
            style={[
              {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing.md,
                borderRadius: spacing.radiusMd,
                paddingVertical: spacing.md,
                ...(Platform.OS === "web" && { cursor: "pointer" as any }),
              },
              // Spread array styles from primitives to prevent nested arrays on web
              ...(styleOverride && typeof styleOverride !== "function"
                ? (Array.isArray(styleOverride) ? styleOverride : [styleOverride])
                : []
              ),
            ]}>
            <>{children}</>
            <Animated.View style={chevronStyle}>
              <Icon
                name="chevron-down"
                size={16}
                color={theme.colors.textDim}
                decorative
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
              paddingBottom: spacing.sm,
              overflow: "hidden",
            },
            // Spread array styles from primitives to prevent nested arrays on web
            ...(styleOverride && typeof styleOverride !== "function"
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
