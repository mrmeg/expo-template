import React from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  StyleProp,
  ViewStyle,
} from "react-native";
import { StyledText, CaptionText, type TextProps } from "./StyledText";
import { Icon, type IconName, type ThemeColorName } from "./Icon";
import { useTheme } from "../hooks/useTheme";
import { useScalePress } from "../hooks/useScalePress";
import { spacing } from "../constants/spacing";

// Default ItemMedia footprint (see ItemMedia's `size` prop) — used to inset
// the optional separator past the media slot without needing a context.
const DEFAULT_MEDIA_SIZE = 40;
const SEPARATOR_INSET = spacing.md + DEFAULT_MEDIA_SIZE + spacing.md;

export interface ItemProps {
  children?: React.ReactNode;
  /** Makes the row pressable with scale feedback (mirrors Card's pattern). */
  onPress?: () => void;
  /** Disables press handling when `onPress` is set. */
  disabled?: boolean;
  /** Renders a hairline divider below the row, inset past the media slot. */
  separator?: boolean;
  /** Custom style override for the row. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Item
 *
 * Grouped-list row container: `spacing.md` padding and gap, a comfortable
 * 44pt min height, and an optional pressable scale interaction. Compose
 * with `ItemMedia`, `ItemContent` (+ `ItemTitle`/`ItemDescription`), and
 * `ItemActions`.
 *
 * @example
 * ```tsx
 * <Item onPress={() => {}} separator>
 *   <ItemMedia icon="bell" />
 *   <ItemContent>
 *     <ItemTitle>Notifications</ItemTitle>
 *     <ItemDescription>Push, email, and SMS alerts</ItemDescription>
 *   </ItemContent>
 *   <ItemActions>
 *     <Icon name="chevron-right" size={18} color="mutedForeground" />
 *   </ItemActions>
 * </Item>
 * ```
 */
export function Item({ children, onPress, disabled, separator = false, style }: ItemProps) {
  const { theme } = useTheme();
  const { animatedStyle, pressHandlers } = useScalePress({
    disabled: !onPress || !!disabled,
    scaleTo: 0.98,
    haptic: false,
  });

  const row = (
    <View style={[styles.row, style]}>
      {children}
    </View>
  );

  const content = separator ? (
    <View>
      {row}
      <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
    </View>
  ) : (
    row
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        {...pressHandlers}
        style={Platform.OS === "web" ? { cursor: "pointer" as const } : undefined}
      >
        <Animated.View style={animatedStyle}>
          {content}
        </Animated.View>
      </Pressable>
    );
  }

  return content;
}

export interface ItemMediaProps {
  /** Square size of the media slot in pixels. @default 40 */
  size?: number;
  /** Icon to center in the slot. Ignored if `children` is provided. */
  icon?: IconName;
  /** Icon color — theme color name or literal. @default "mutedForeground" */
  iconColor?: string | ThemeColorName;
  /** Icon size in pixels. @default 20 */
  iconSize?: number;
  /** Arbitrary content (e.g. an avatar image) rendered instead of the icon. */
  children?: React.ReactNode;
  /** Custom style override. */
  style?: StyleProp<ViewStyle>;
}

/**
 * ItemMedia
 *
 * Fixed-size leading slot for an `Item` row — an icon centered in a rounded
 * square by default, or arbitrary content (e.g. an avatar) via `children`.
 */
export function ItemMedia({ size = DEFAULT_MEDIA_SIZE, icon, iconColor = "mutedForeground", iconSize = 20, children, style }: ItemMediaProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: spacing.radiusMd,
          backgroundColor: theme.colors.muted,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      {children ?? (!!icon && <Icon name={icon} size={iconSize} color={iconColor} decorative />)}
    </View>
  );
}

export interface ItemContentProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * ItemContent
 *
 * Flex-1 vertical stack for an `Item` row's title/description (or any other
 * content). Sits between `ItemMedia` and `ItemActions`.
 */
export function ItemContent({ children, style }: ItemContentProps) {
  return <View style={[styles.content, style]}>{children}</View>;
}

/**
 * ItemTitle
 *
 * `Item` row title — label weight (medium) at body size.
 */
export function ItemTitle({ children, style, ...props }: TextProps) {
  return (
    <StyledText size="body" fontWeight="medium" {...props} style={style}>
      {children}
    </StyledText>
  );
}

/**
 * ItemDescription
 *
 * `Item` row secondary line — caption size in the muted `textDim` color.
 */
export function ItemDescription({ children, style, ...props }: TextProps) {
  const { theme } = useTheme();

  return (
    <CaptionText {...props} style={[{ color: theme.colors.textDim }, style]}>
      {children}
    </CaptionText>
  );
}

export interface ItemActionsProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * ItemActions
 *
 * Trailing row for an `Item` — centers and gaps its children (a chevron
 * icon, a `Switch`, value text, etc.).
 */
export function ItemActions({ children, style }: ItemActionsProps) {
  return <View style={[styles.actions, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: spacing.touchTarget,
    padding: spacing.md,
    gap: spacing.md,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.xxs,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: SEPARATOR_INSET,
  },
});
