import { Icon } from "@/components/ui/Icon";
import { AnimatedView } from "@/components/ui/AnimatedView";
import { TextClassContext } from "@/components/ui/StyledText";
import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/constants/spacing";
import * as DropdownMenuPrimitive from "@rn-primitives/dropdown-menu";
import { Check, ChevronDown, ChevronRight, ChevronUp } from "lucide-react-native";
import * as React from "react";
import { Platform, StyleSheet, Text, type TextStyle, View } from "react-native";
import { FullWindowOverlay as RNFullWindowOverlay } from "react-native-screens";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Re-export primitives that don't need styling
const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

// Platform-specific overlay
const FullWindowOverlay = Platform.OS === "ios" ? RNFullWindowOverlay : React.Fragment;

/**
 * DropdownMenuSubTrigger Component
 * Trigger for sub-menus with automatic chevron icon
 * Shows ChevronRight on web, ChevronDown/ChevronUp on native based on open state
 */
type DropdownMenuSubTriggerProps = DropdownMenuPrimitive.SubTriggerProps & {
  inset?: boolean;
};

function DropdownMenuSubTrigger({
  inset = false,
  children,
  style: styleOverride,
  ...props
}: DropdownMenuSubTriggerProps) {
  const { theme } = useTheme();
  const { open } = DropdownMenuPrimitive.useSubContext();
  const icon = Platform.OS === "web" ? ChevronRight : open ? ChevronUp : ChevronDown;

  return (
    <TextClassContext.Provider value="">
      <DropdownMenuPrimitive.SubTrigger
        {...props}
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderRadius: spacing.radiusSm,
          paddingHorizontal: spacing.sm,
          paddingVertical: Platform.select({ web: spacing.xs, default: spacing.sm }),
          backgroundColor: open ? theme.colors.bgSecondary : "transparent",
          ...(Platform.OS === "web" && {
            cursor: "pointer" as any,
            outlineStyle: "none" as any,
          }),
          ...(inset && { paddingLeft: spacing.xl }),
          ...(styleOverride && typeof styleOverride !== "function"
            ? StyleSheet.flatten(styleOverride)
            : {}),
        }}
      >
        {typeof children === "function" ? null : children}
        <View style={{ marginLeft: "auto" as any }}>
          <Icon as={icon} size={16} color={theme.colors.textPrimary} />
        </View>
      </DropdownMenuPrimitive.SubTrigger>
    </TextClassContext.Provider>
  );
}

/**
 * DropdownMenuSubContent Component
 * Content container for sub-menus
 */
type DropdownMenuSubContentProps = DropdownMenuPrimitive.SubContentProps;

function DropdownMenuSubContent({
  style: styleOverride,
  ...props
}: DropdownMenuSubContentProps) {
  const { theme, getShadowStyle } = useTheme();
  const shadowStyle = StyleSheet.flatten(getShadowStyle("soft"));

  return (
    <AnimatedView type="fade">
      <DropdownMenuPrimitive.SubContent
        {...props}
        style={{
          backgroundColor: theme.colors.bgPrimary,
          borderWidth: 1,
          borderColor: theme.colors.bgTertiary,
          borderRadius: spacing.radiusMd,
          padding: spacing.xs,
          minWidth: 128,
          overflow: "hidden",
          ...shadowStyle,
          ...(Platform.OS === "web" && {
            zIndex: 50,
          }),
          ...(styleOverride && typeof styleOverride !== "function"
            ? StyleSheet.flatten(styleOverride)
            : {}),
        }}
      />
    </AnimatedView>
  );
}

/**
 * DropdownMenuContent Component
 * Main dropdown content with portal, overlay, and animation
 *
 * Positioning props:
 * - side: Which side of the trigger to position on ("top" | "bottom" | "left" | "right")
 * - align: Alignment relative to the trigger ("start" | "center" | "end")
 * - sideOffset: Distance from the trigger in pixels (default: 4)
 */
type DropdownMenuContentProps = DropdownMenuPrimitive.ContentProps & {
  portalHost?: string;
};

function DropdownMenuContent({
  side,
  align = "start",
  sideOffset = 4,
  portalHost,
  style: styleOverride,
  ...props
}: DropdownMenuContentProps) {
  const { theme, getShadowStyle } = useTheme();
  const shadowStyle = StyleSheet.flatten(getShadowStyle("soft"));
  const insets = useSafeAreaInsets();

  return (
    <DropdownMenuPrimitive.Portal hostName={portalHost}>
      <FullWindowOverlay>
        <DropdownMenuPrimitive.Overlay
          style={Platform.select({
            native: StyleSheet.absoluteFill,
            default: undefined,
          })}
        >
          <AnimatedView type="fade">
            <TextClassContext.Provider value="">
              <DropdownMenuPrimitive.Content
                side={side}
                align={align}
                sideOffset={sideOffset}
                insets={insets}
                avoidCollisions={true}
                {...props}
                style={{
                  backgroundColor: theme.colors.bgPrimary,
                  borderWidth: 1,
                  borderColor: theme.colors.bgTertiary,
                  borderRadius: spacing.radiusMd,
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
          </AnimatedView>
        </DropdownMenuPrimitive.Overlay>
      </FullWindowOverlay>
    </DropdownMenuPrimitive.Portal>
  );
}

/**
 * DropdownMenuItem Component
 * Standard menu item with optional destructive variant
 */
type DropdownMenuItemProps = DropdownMenuPrimitive.ItemProps & {
  inset?: boolean;
  variant?: "default" | "destructive";
};

function DropdownMenuItem({
  inset = false,
  variant = "default",
  style: styleOverride,
  ...props
}: DropdownMenuItemProps) {
  const { theme } = useTheme();

  return (
    <TextClassContext.Provider value="">
      <DropdownMenuPrimitive.Item
        {...props}
        style={{
          position: "relative",
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          borderRadius: spacing.radiusSm,
          paddingHorizontal: spacing.sm,
          paddingVertical: Platform.select({ web: spacing.xs, default: spacing.sm }),
          backgroundColor: "transparent",
          ...(Platform.OS === "web" && {
            cursor: props.disabled ? "not-allowed" : ("pointer" as any),
            outlineStyle: "none" as any,
          }),
          ...(props.disabled && { opacity: 0.5 }),
          ...(inset && { paddingLeft: spacing.xl }),
          ...(styleOverride && typeof styleOverride !== "function"
            ? StyleSheet.flatten(styleOverride)
            : {}),
        }}
      />
    </TextClassContext.Provider>
  );
}

/**
 * DropdownMenuCheckboxItem Component
 * Menu item with checkbox indicator
 */
type DropdownMenuCheckboxItemProps = DropdownMenuPrimitive.CheckboxItemProps;

function DropdownMenuCheckboxItem({
  children,
  style: styleOverride,
  ...props
}: DropdownMenuCheckboxItemProps) {
  const { theme } = useTheme();

  return (
    <TextClassContext.Provider value="">
      <DropdownMenuPrimitive.CheckboxItem
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
          <DropdownMenuPrimitive.ItemIndicator>
            <Icon
              as={Check}
              size={16}
              color={theme.colors.textPrimary}
              {...(Platform.OS === "web" && { style: { pointerEvents: "none" as any } })}
            />
          </DropdownMenuPrimitive.ItemIndicator>
        </View>
        {typeof children === "function" ? null : children}
      </DropdownMenuPrimitive.CheckboxItem>
    </TextClassContext.Provider>
  );
}

/**
 * DropdownMenuRadioItem Component
 * Menu item with radio button indicator
 */
type DropdownMenuRadioItemProps = DropdownMenuPrimitive.RadioItemProps;

function DropdownMenuRadioItem({
  children,
  style: styleOverride,
  ...props
}: DropdownMenuRadioItemProps) {
  const { theme } = useTheme();

  return (
    <TextClassContext.Provider value="">
      <DropdownMenuPrimitive.RadioItem
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
          <DropdownMenuPrimitive.ItemIndicator>
            <View
              style={{
                backgroundColor: theme.colors.textPrimary,
                height: 8,
                width: 8,
                borderRadius: 4,
              }}
            />
          </DropdownMenuPrimitive.ItemIndicator>
        </View>
        {typeof children === "function" ? null : children}
      </DropdownMenuPrimitive.RadioItem>
    </TextClassContext.Provider>
  );
}

/**
 * DropdownMenuLabel Component
 * Label for menu sections
 */
type DropdownMenuLabelProps = DropdownMenuPrimitive.LabelProps & {
  inset?: boolean;
};

function DropdownMenuLabel({
  inset = false,
  style: styleOverride,
  ...props
}: DropdownMenuLabelProps) {
  const { theme } = useTheme();

  return (
    <DropdownMenuPrimitive.Label
      {...props}
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: Platform.select({ web: spacing.xs, default: spacing.sm }),
        fontSize: 14,
        fontWeight: "500" as TextStyle["fontWeight"],
        color: theme.colors.textPrimary,
        ...(inset && { paddingLeft: spacing.xl }),
        ...(styleOverride && typeof styleOverride !== "function"
          ? StyleSheet.flatten(styleOverride)
          : {}),
      }}
    />
  );
}

/**
 * DropdownMenuSeparator Component
 * Visual divider between menu sections
 */
type DropdownMenuSeparatorProps = DropdownMenuPrimitive.SeparatorProps;

function DropdownMenuSeparator({
  style: styleOverride,
  ...props
}: DropdownMenuSeparatorProps) {
  const { theme } = useTheme();

  return (
    <DropdownMenuPrimitive.Separator
      {...props}
      style={{
        backgroundColor: theme.colors.bgTertiary,
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
 * DropdownMenuShortcut Component
 * Text component for displaying keyboard shortcuts
 */
interface DropdownMenuShortcutProps {
  children: React.ReactNode;
  style?: TextStyle;
}

function DropdownMenuShortcut({ style: styleOverride, ...props }: DropdownMenuShortcutProps) {
  const { theme } = useTheme();

  return (
    <Text
      {...props}
      style={[
        {
          marginLeft: "auto" as any,
          fontSize: 12,
          letterSpacing: 2,
          color: theme.colors.textPrimary,
          opacity: 0.6,
        },
        styleOverride,
      ]}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
