import * as React from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import * as TabsPrimitive from "@rn-primitives/tabs";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";
import { StyledText, TextClassContext, TextColorContext } from "./StyledText";
import { Icon, type IconName } from "./Icon";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../constants/spacing";

// ============================================================================
// Size configs
// ============================================================================

const SIZE_CONFIGS = {
  sm: {
    height: 32,
    paddingHorizontal: spacing.sm,
    fontSize: 12,
    iconSize: spacing.iconSm,
  },
  md: {
    height: 36,
    paddingHorizontal: spacing.md,
    fontSize: 13,
    iconSize: spacing.iconMd,
  },
};

// ============================================================================
// Context
// ============================================================================

type TabsVariant = "underline" | "pill";
type TabsSize = "sm" | "md";

interface TabsContextValue {
  variant: TabsVariant;
  size: TabsSize;
}

const TabsContext = React.createContext<TabsContextValue>({
  variant: "underline",
  size: "md",
});

function useTabsContext() {
  return React.useContext(TabsContext);
}

// ============================================================================
// Tabs Root
// ============================================================================

export interface TabsProps extends TabsPrimitive.RootProps {
  variant?: TabsVariant;
  size?: TabsSize;
}

function TabsRoot({
  variant = "underline",
  size = "md",
  children,
  ...props
}: TabsProps) {
  return (
    <TabsContext.Provider value={{ variant, size }}>
      <TabsPrimitive.Root {...props}>
        {children}
      </TabsPrimitive.Root>
    </TabsContext.Provider>
  );
}

// ============================================================================
// TabsList
// ============================================================================

export interface TabsListProps extends TabsPrimitive.ListProps {
  style?: StyleProp<ViewStyle>;
}

function TabsList({ style, children, ...props }: TabsListProps) {
  const { theme } = useTheme();
  const { variant } = useTabsContext();

  const listStyle = variant === "pill"
    ? {
        flexDirection: "row" as const,
        backgroundColor: theme.colors.muted,
        borderRadius: spacing.radiusMd,
        padding: 2,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }
    : {
        flexDirection: "row" as const,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      };

  return (
    <TabsPrimitive.List
      style={StyleSheet.flatten([listStyle, style])}
      {...props}
    >
      {children}
    </TabsPrimitive.List>
  );
}

// ============================================================================
// TabsTrigger
// ============================================================================

export interface TabsTriggerProps extends TabsPrimitive.TriggerProps {
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}

function TabsTriggerInner({ icon, style, children, value, ...props }: TabsTriggerProps) {
  const { theme, getShadowStyle } = useTheme();
  const { variant, size } = useTabsContext();
  const sizeConfig = SIZE_CONFIGS[size];
  const reduceMotion = useReducedMotion();
  const isDisabled = props.disabled ?? false;

  // Determine selected state by comparing trigger value with root value
  const rootContext = TabsPrimitive.useRootContext();
  const isSelected = rootContext.value === value;

  const activeOpacity = useSharedValue(isSelected ? 1 : 0);

  React.useEffect(() => {
    activeOpacity.value = reduceMotion
      ? (isSelected ? 1 : 0)
      : withTiming(isSelected ? 1 : 0, { duration: 200 });
  }, [isSelected, reduceMotion]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: activeOpacity.value,
  }));

  const textColor = isDisabled
    ? theme.colors.mutedForeground
    : isSelected
      ? theme.colors.foreground
      : theme.colors.mutedForeground;

  const triggerBaseStyle: ViewStyle = {
    flex: 1,
    height: Platform.OS === "web" ? sizeConfig.height : spacing.touchTarget,
    paddingHorizontal: sizeConfig.paddingHorizontal,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    opacity: isDisabled ? 0.5 : 1,
    ...(Platform.OS === "web" && { cursor: isDisabled ? "default" : "pointer", outlineStyle: "none" } as any),
  };

  const pillActiveStyle: ViewStyle = isSelected && variant === "pill" ? {
    backgroundColor: theme.colors.background,
    borderRadius: spacing.radiusSm,
    ...getShadowStyle("subtle"),
  } : {};

  return (
    <TextColorContext.Provider value={textColor}>
      <TextClassContext.Provider value="">
        <TabsPrimitive.Trigger
          value={value}
          style={StyleSheet.flatten([triggerBaseStyle, pillActiveStyle, style])}
          {...props}
        >
          <View style={triggerContentStyles.container}>
            {icon && (
              <Icon
                name={icon}
                size={sizeConfig.iconSize}
                color={textColor}
                decorative
              />
            )}
            {typeof children === "string" ? (
              <StyledText style={{ fontSize: sizeConfig.fontSize }}>{children}</StyledText>
            ) : (
              children as React.ReactNode
            )}
          </View>
          {variant === "underline" && (
            <Animated.View
              style={[
                {
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  backgroundColor: theme.colors.foreground,
                },
                indicatorStyle,
              ]}
            />
          )}
        </TabsPrimitive.Trigger>
      </TextClassContext.Provider>
    </TextColorContext.Provider>
  );
}

const TabsTrigger = TabsTriggerInner;

// ============================================================================
// TabsContent
// ============================================================================

export interface TabsContentProps extends TabsPrimitive.ContentProps {
  style?: StyleProp<ViewStyle>;
}

function TabsContent({ style, children, ...props }: TabsContentProps) {
  return (
    <TabsPrimitive.Content
      style={StyleSheet.flatten([{ marginTop: spacing.md }, style])}
      {...props}
    >
      {children}
    </TabsPrimitive.Content>
  );
}

// ============================================================================
// Styles
// ============================================================================

const triggerContentStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
});

// ============================================================================
// Compound Export
// ============================================================================

const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
});

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
};

export type {
  TabsVariant,
  TabsSize,
};
