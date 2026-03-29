import * as React from "react";
import { Platform, StyleSheet, type TextStyle, View } from "react-native";
import { Icon } from "@/client/components/ui/Icon";
import { AnimatedView } from "@/client/components/ui/AnimatedView";
import { TextClassContext, TextColorContext } from "@/client/components/ui/StyledText";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { palette } from "@/client/constants/colors";
import * as SelectPrimitive from "@rn-primitives/select";
import { FullWindowOverlay as RNFullWindowOverlay } from "react-native-screens";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Platform-specific overlay
const FullWindowOverlay = Platform.OS === "ios" ? RNFullWindowOverlay : React.Fragment;

/**
 * SelectRoot Component
 * Manages select state and provides context for trigger and content
 */
const SelectRoot = SelectPrimitive.Root;

/**
 * Size variants for SelectTrigger
 */
type SelectSize = "sm" | "md" | "lg";

const SIZE_CONFIGS: Record<
  SelectSize,
  {
    height: number;
    fontSize: number;
    paddingHorizontal: number;
  }
> = {
  sm: {
    height: 32,
    fontSize: 12,
    paddingHorizontal: spacing.sm,
  },
  md: {
    height: 36,
    fontSize: 14,
    paddingHorizontal: spacing.inputPadding,
  },
  lg: {
    height: 40,
    fontSize: 14,
    paddingHorizontal: spacing.md,
  },
};

/**
 * SelectTrigger Component
 * Button that shows the current value and a chevron-down icon
 * Supports sm/md/lg sizes and error state
 */
type SelectTriggerProps = SelectPrimitive.TriggerProps & {
  size?: SelectSize;
  error?: boolean;
};

function SelectTrigger({
  size = "md",
  error = false,
  children,
  style: styleOverride,
  disabled,
  ...props
}: SelectTriggerProps) {
  const { theme } = useTheme();
  const sizeConfig = SIZE_CONFIGS[size];

  return (
    <SelectPrimitive.Trigger
      disabled={disabled}
      {...props}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        height: sizeConfig.height,
        paddingHorizontal: sizeConfig.paddingHorizontal,
        borderWidth: 1,
        borderColor: error ? theme.colors.destructive : theme.colors.border,
        borderRadius: spacing.radiusMd,
        backgroundColor: theme.colors.background,
        ...(Platform.OS === "web" && {
          cursor: disabled ? "not-allowed" : ("pointer" as any),
          outlineStyle: "none" as any,
        }),
        ...(disabled && { opacity: 0.5 }),
        ...(styleOverride && typeof styleOverride !== "function"
          ? StyleSheet.flatten(styleOverride)
          : {}),
      }}
    >
      {typeof children === "function" ? null : children}
      <Icon
        name="chevron-down"
        size={16}
        color={theme.colors.mutedForeground}
      />
    </SelectPrimitive.Trigger>
  );
}

/**
 * SelectValue Component
 * Displays the selected value text or placeholder
 */
type SelectValueProps = SelectPrimitive.ValueProps & {
  size?: SelectSize;
};

function SelectValue({
  size = "md",
  placeholder,
  style: styleOverride,
  ...props
}: SelectValueProps) {
  const { theme } = useTheme();
  const sizeConfig = SIZE_CONFIGS[size];

  return (
    <SelectPrimitive.Value
      placeholder={placeholder}
      {...props}
      style={{
        fontSize: sizeConfig.fontSize,
        color: theme.colors.text,
        flex: 1,
        ...(styleOverride && typeof styleOverride !== "function"
          ? StyleSheet.flatten(styleOverride)
          : {}),
      }}
    />
  );
}

/**
 * SelectContent Component
 * Dropdown overlay following the DropdownMenu.Content pattern
 * Uses portal + FullWindowOverlay on iOS, React.Fragment on other platforms
 */
type SelectContentProps = SelectPrimitive.ContentProps & {
  portalHost?: string;
};

function SelectContent({
  side,
  align = "start",
  sideOffset = 4,
  portalHost,
  style: styleOverride,
  ...props
}: SelectContentProps) {
  const { theme, getShadowStyle, getContrastingColor } = useTheme();
  const shadowStyle = StyleSheet.flatten(getShadowStyle("soft"));
  const insets = useSafeAreaInsets();

  const textColor = getContrastingColor(
    theme.colors.background,
    palette.white,
    palette.black
  );

  return (
    <SelectPrimitive.Portal hostName={portalHost}>
      <FullWindowOverlay>
        <SelectPrimitive.Overlay
          style={Platform.select({
            native: StyleSheet.absoluteFill,
            default: undefined,
          })}
        >
          <AnimatedView type="fade">
            <TextColorContext.Provider value={textColor}>
              <TextClassContext.Provider value="">
                <SelectPrimitive.Content
                  side={side}
                  align={align}
                  sideOffset={sideOffset}
                  insets={insets}
                  avoidCollisions={true}
                  {...props}
                  style={{
                    backgroundColor: theme.colors.background,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: spacing.radiusSm,
                    padding: spacing.xs,
                    minWidth: 128,
                    overflow: "hidden",
                    ...shadowStyle,
                    ...(Platform.OS === "web" && {
                      zIndex: 50,
                      cursor: "default" as any,
                    }),
                    ...(styleOverride && typeof styleOverride !== "function"
                      ? StyleSheet.flatten(styleOverride)
                      : {}),
                  }}
                />
              </TextClassContext.Provider>
            </TextColorContext.Provider>
          </AnimatedView>
        </SelectPrimitive.Overlay>
      </FullWindowOverlay>
    </SelectPrimitive.Portal>
  );
}

/**
 * SelectItem Component
 * Individual option in the select dropdown
 * Shows a check icon on the left when selected
 */
type SelectItemProps = SelectPrimitive.ItemProps;

function SelectItem({
  children,
  style: styleOverride,
  ...props
}: SelectItemProps) {
  const { theme } = useTheme();

  return (
    <TextClassContext.Provider value="">
      <SelectPrimitive.Item
        {...props}
        style={{
          position: "relative",
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          borderRadius: spacing.radiusSm,
          paddingVertical: Platform.select({ web: spacing.xs, default: spacing.sm }),
          paddingLeft: spacing.xl,
          paddingRight: spacing.sm,
          backgroundColor: "transparent",
          ...(Platform.OS === "web" && {
            cursor: props.disabled ? "not-allowed" : ("pointer" as any),
            outlineStyle: "none" as any,
          }),
          ...(props.disabled && { opacity: 0.5 }),
          ...(styleOverride && typeof styleOverride !== "function"
            ? StyleSheet.flatten(styleOverride)
            : {}),
        }}
      >
        <View
          style={{
            position: "absolute",
            left: spacing.sm,
            height: 14,
            width: 14,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SelectPrimitive.ItemIndicator>
            <Icon
              name="check"
              size={16}
              color={theme.colors.text}
              {...(Platform.OS === "web" && { style: { pointerEvents: "none" as any } })}
            />
          </SelectPrimitive.ItemIndicator>
        </View>
        <SelectPrimitive.ItemText />
        {typeof children === "function" ? null : children}
      </SelectPrimitive.Item>
    </TextClassContext.Provider>
  );
}

/**
 * SelectGroup Component
 * Groups related select items together
 */
type SelectGroupProps = SelectPrimitive.GroupProps;

function SelectGroup({
  style: styleOverride,
  ...props
}: SelectGroupProps) {
  return (
    <SelectPrimitive.Group
      {...props}
      style={{
        ...(styleOverride && typeof styleOverride !== "function"
          ? StyleSheet.flatten(styleOverride)
          : {}),
      }}
    />
  );
}

/**
 * SelectLabel Component
 * Label for a group of select items
 */
type SelectLabelProps = SelectPrimitive.LabelProps;

function SelectLabel({
  style: styleOverride,
  ...props
}: SelectLabelProps) {
  const { theme } = useTheme();

  return (
    <SelectPrimitive.Label
      {...props}
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: Platform.select({ web: spacing.xs, default: spacing.sm }),
        fontSize: 14,
        fontWeight: "500" as TextStyle["fontWeight"],
        color: theme.colors.text,
        ...(styleOverride && typeof styleOverride !== "function"
          ? StyleSheet.flatten(styleOverride)
          : {}),
      }}
    />
  );
}

/**
 * SelectSeparator Component
 * Visual divider between select item groups
 */
type SelectSeparatorProps = SelectPrimitive.SeparatorProps;

function SelectSeparator({
  style: styleOverride,
  ...props
}: SelectSeparatorProps) {
  const { theme } = useTheme();

  return (
    <SelectPrimitive.Separator
      {...props}
      style={{
        backgroundColor: theme.colors.border,
        marginHorizontal: -spacing.xs,
        marginVertical: spacing.xs,
        height: 1,
        ...(styleOverride && typeof styleOverride !== "function"
          ? StyleSheet.flatten(styleOverride)
          : {}),
      }}
    />
  );
}

/**
 * Select Component with Sub-components
 * Properly typed interface for dot notation access (e.g., Select.Trigger)
 */
const Select = Object.assign(SelectRoot, {
  Trigger: SelectTrigger,
  Value: SelectValue,
  Content: SelectContent,
  Item: SelectItem,
  Group: SelectGroup,
  Label: SelectLabel,
  Separator: SelectSeparator,
});

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
};

export type {
  SelectSize,
  SelectTriggerProps,
  SelectValueProps,
  SelectContentProps,
  SelectItemProps,
  SelectGroupProps,
  SelectLabelProps,
  SelectSeparatorProps,
};
