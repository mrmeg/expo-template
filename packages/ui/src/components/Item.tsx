import React, { Children, createContext, isValidElement, use } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  StyleProp,
  ViewStyle,
} from "react-native";
import { StyledText, CaptionText, EyebrowText, type TextProps } from "./StyledText";
import { Icon, type IconName, type ThemeColorName } from "./Icon";
import { useTheme } from "../hooks/useTheme";
import { useScalePress } from "../hooks/useScalePress";
import { useFocusVisible } from "../hooks/useFocusVisible";
import { spacing } from "../constants/spacing";
import { interaction } from "../constants/interaction";

// Default ItemMedia footprint (see ItemMedia's `size` prop).
const DEFAULT_MEDIA_SIZE = 40;

/**
 * What an `ItemGroup` tells each row it wraps: whether to draw the hairline
 * under itself. `null` outside a group, where the row's own `separator` prop
 * decides.
 */
interface ItemGroupRow {
  separator: boolean;
}

const ItemGroupRowContext = createContext<ItemGroupRow | null>(null);
const SEPARATED_ROW: ItemGroupRow = { separator: true };
const LAST_ROW: ItemGroupRow = { separator: false };

/**
 * Where a row's hairline starts: under the title when the row leads with an
 * `ItemMedia` (row padding + media + gap, so a custom `size` lines up too),
 * otherwise at the row padding.
 */
function separatorInset(children: React.ReactNode): number {
  for (const child of Children.toArray(children)) {
    if (isValidElement<ItemMediaProps>(child) && child.type === ItemMedia) {
      return spacing.rowPaddingX + (child.props.size ?? DEFAULT_MEDIA_SIZE) + spacing.rowGap;
    }
  }
  return spacing.rowPaddingX;
}

export interface ItemProps {
  children?: React.ReactNode;
  /** Makes the row pressable with scale feedback (mirrors Card's pattern). */
  onPress?: () => void;
  /** Disables press handling when `onPress` is set. */
  disabled?: boolean;
  /**
   * Renders a hairline divider below the row, starting under the title (past
   * the `ItemMedia` slot when there is one). Inside an `ItemGroup` the group
   * sets this for every row but the last; pass `false` to drop one row's line.
   */
  separator?: boolean;
  /** Custom style override for the row. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Item
 *
 * Grouped-list row container: compact row padding (`spacing.rowPaddingY` /
 * `spacing.rowPaddingX`) and gap, a 44pt min height on native (40 on web),
 * and an optional pressable scale interaction. Compose
 * with `ItemMedia`, `ItemContent` (+ `ItemTitle`/`ItemDescription`), and
 * `ItemActions`. Stack rows in an `ItemGroup`, which draws the separators;
 * the row's own padding is the screen's only horizontal inset, so don't wrap
 * rows in a padded or bordered container.
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
export function Item({ children, onPress, disabled, separator, style }: ItemProps) {
  const { theme, getFocusRingStyle } = useTheme();
  const groupRow = use(ItemGroupRowContext);
  const showSeparator = separator ?? groupRow?.separator ?? false;
  const { animatedStyle, pressHandlers } = useScalePress({
    disabled: !onPress || !!disabled,
    scaleTo: 0.98,
  });
  const focus = useFocusVisible();

  const row = (
    <View style={[styles.row, style]}>
      {children}
    </View>
  );

  const content = showSeparator ? (
    <View>
      {row}
      <View
        style={[
          styles.separator,
          { marginLeft: separatorInset(children), backgroundColor: theme.colors.border },
        ]}
      />
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
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        style={({ pressed }) => [
          { borderRadius: spacing.radiusSm },
          Platform.OS === "web" && { cursor: "pointer" as const, outlineStyle: "none" as any },
          pressed && { opacity: interaction.pressedOpacity },
          focus.focused && !disabled && getFocusRingStyle(),
        ]}
      >
        <Animated.View style={animatedStyle}>
          {content}
        </Animated.View>
      </Pressable>
    );
  }

  return content;
}

export interface ItemGroupProps {
  /**
   * Section label above the rows: an uppercase eyebrow in the muted color,
   * announced as a header.
   */
  title?: string;
  /** Supporting copy under the title. */
  description?: string;
  /** Helper text under the rows, e.g. what the settings above it do. */
  footer?: string;
  /**
   * The rows: `Item`s, or components that render one. Each direct child is
   * one row; the group draws the hairline under every row but the last.
   */
  children?: React.ReactNode;
  /** Style override for the group container (outer margins, width). */
  style?: StyleProp<ViewStyle>;
  /** Test id for the group container. */
  testID?: string;
}

/**
 * ItemGroup
 *
 * A flat grouped list: an optional eyebrow title and description, full-width
 * `Item` rows separated by inset hairlines, and optional footer text. No
 * border, radius, shadow, or fill: the header and footer sit on the row
 * padding (`spacing.rowPaddingX`), so the group needs no horizontal padding
 * from its parent. Space groups apart with `spacing.sectionSpacing`.
 *
 * @example
 * ```tsx
 * <ItemGroup title="Account" footer="Signed in as jane@example.com">
 *   <Item onPress={openProfile}>
 *     <ItemMedia icon="user" />
 *     <ItemContent>
 *       <ItemTitle>Edit profile</ItemTitle>
 *     </ItemContent>
 *     <ItemActions>
 *       <Icon name="chevron-right" size={18} color="mutedForeground" />
 *     </ItemActions>
 *   </Item>
 *   <Item>
 *     <ItemMedia icon="bell" />
 *     <ItemContent>
 *       <ItemTitle>Notifications</ItemTitle>
 *     </ItemContent>
 *     <ItemActions>
 *       <Switch checked={enabled} onCheckedChange={setEnabled} />
 *     </ItemActions>
 *   </Item>
 * </ItemGroup>
 * ```
 */
export function ItemGroup({ title, description, footer, children, style, testID }: ItemGroupProps) {
  const { theme } = useTheme();
  const rows = Children.toArray(children);
  // react-native-web renders an unlevelled header as h1; level the title as h2
  // there. Native has no heading levels and takes the role alone. Read at render
  // time (not module load) so tests can flip `Platform.OS`.
  const headingLevel = Platform.OS === "web" ? { "aria-level": 2 } : undefined;

  return (
    <View style={style} testID={testID}>
      {(!!title || !!description) && (
        <View style={styles.groupHeader}>
          {!!title && (
            <EyebrowText
              accessibilityRole="header"
              {...headingLevel}
              style={{ color: theme.colors.mutedForeground }}
            >
              {title}
            </EyebrowText>
          )}
          {!!description && (
            <CaptionText style={{ color: theme.colors.textDim }}>{description}</CaptionText>
          )}
        </View>
      )}

      {rows.map((row, index) => (
        <ItemGroupRowContext.Provider
          key={isValidElement(row) && row.key != null ? row.key : index}
          value={index < rows.length - 1 ? SEPARATED_ROW : LAST_ROW}
        >
          {row}
        </ItemGroupRowContext.Provider>
      ))}

      {!!footer && (
        <View style={styles.groupFooter}>
          <CaptionText style={{ color: theme.colors.mutedForeground }}>{footer}</CaptionText>
        </View>
      )}
    </View>
  );
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

const styles = /*#__PURE__*/ StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: Platform.select({ web: spacing.rowMinHeight, default: spacing.touchTarget }),
    paddingVertical: spacing.rowPaddingY,
    paddingHorizontal: spacing.rowPaddingX,
    gap: spacing.rowGap,
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
  },
  groupHeader: {
    paddingHorizontal: spacing.rowPaddingX,
    paddingBottom: spacing.xs,
    gap: spacing.xxs,
  },
  groupFooter: {
    paddingHorizontal: spacing.rowPaddingX,
    paddingTop: spacing.xs,
  },
});
