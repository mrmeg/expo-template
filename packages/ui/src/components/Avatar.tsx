import React, { use, useState } from "react";
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../constants/spacing";
import { Icon, type IconName } from "./Icon";
import { StyledText } from "./StyledText";
import { createThemedStyles } from "../lib/themedStyles";
import type { Theme } from "../constants/colors";

/** Named size tokens, or an explicit pixel diameter. */
export type AvatarSize = "sm" | "md" | "lg" | number;

export type AvatarShape = "circle" | "square";

const SIZE_TOKENS = {
  sm: spacing.iconLg,             // 32
  md: spacing.iconLg + spacing.sm, // 40
  lg: spacing.iconXl,             // 48
} as const;

type AvatarSizeToken = keyof typeof SIZE_TOKENS;

function isSizeToken(size: AvatarSize): size is AvatarSizeToken {
  return typeof size === "string";
}

function resolveSize(size: AvatarSize): number {
  return isSizeToken(size) ? SIZE_TOKENS[size] : size;
}

/** Rounded-square radius scales with the avatar so 32px and 88px read the same. */
function squareRadius(px: number): number {
  return Math.round(px / 4);
}

/** Initials/icon scale with the avatar rather than jumping between text tokens. */
function contentSize(px: number): { fontSize: number; iconSize: number } {
  return { fontSize: Math.round(px * 0.4), iconSize: Math.round(px * 0.5) };
}

/** Overlap for stacked avatars — 30% keeps ~70% of each face visible. */
function overlap(px: number): number {
  return -Math.round(px * 0.3);
}

/**
 * Derive 1–2 initials from a display name.
 *
 * First + last word (middle names are skipped, as in most avatar stacks), one
 * initial for a single-word name, and `""` when there is nothing to derive —
 * callers treat that as "fall through to the icon".
 *
 * Grapheme-aware by way of `Array.from`, so an accented character written as
 * base + combining mark keeps its accent and an astral code point (emoji) is
 * not sliced into a lone surrogate. `toLocaleUpperCase` is deliberate: a
 * locale-sensitive uppercase is right for names.
 */
export function getAvatarInitials(name?: string): string {
  if (!name) return "";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  const picked = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];

  return picked
    .map((word) => {
      const [first] = Array.from(word.normalize("NFC"));
      return first ?? "";
    })
    .join("")
    .toLocaleUpperCase();
}

/**
 * Identity of an image source by content, not object identity.
 *
 * `source={{ uri }}` allocates a new object on every render, so a failure
 * flag keyed on object identity would reset immediately and loop
 * image → error → image. Returns `null` when there is no usable image.
 */
function getSourceKey(source?: ImageSourcePropType): string | null {
  if (source == null) return null;
  if (typeof source === "number") return `asset:${source}`;
  if (Array.isArray(source)) {
    const key = source.map((entry) => entry?.uri ?? "").filter(Boolean).join("|");
    return key || null;
  }
  return source.uri || null;
}

type AvatarGroupContextValue = {
  size: AvatarSize;
  shape: AvatarShape;
  ring: boolean;
};

const AvatarGroupContext = React.createContext<AvatarGroupContextValue | null>(null);

export interface AvatarProps {
  /** Image to display. Falls back to initials (then the icon) if it fails to load. */
  source?: ImageSourcePropType;
  /** Display name; supplies the fallback initials and the default accessibility label. */
  name?: string;
  /** Feather icon rendered when there is no image and no derivable initials. @default "user" */
  icon?: IconName;
  /** Size token or explicit pixel diameter. Inherited from `AvatarGroup` when unset. @default "md" */
  size?: AvatarSize;
  /** Inherited from `AvatarGroup` when unset. @default "circle" */
  shape?: AvatarShape;
  /**
   * Accessibility label. Defaults to `name`; when neither is set the avatar is
   * decorative and stays out of the accessibility tree.
   */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Avatar Component
 *
 * A circular (or rounded-square) profile image with a graceful fallback chain:
 * image → initials → icon. A broken or slow-failing image downgrades to
 * initials at runtime, so a dead URL never leaves an empty hole.
 *
 * Usage:
 * ```tsx
 * <Avatar source={{ uri: user.avatarUrl }} name={user.fullName} />
 * <Avatar name="Ada Lovelace" size="lg" />
 * <Avatar icon="camera" shape="square" />
 * ```
 */
function Avatar({
  source,
  name,
  icon,
  size,
  shape,
  accessibilityLabel,
  style: styleOverride,
}: AvatarProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const group = use(AvatarGroupContext);

  const px = resolveSize(size ?? group?.size ?? "md");
  const resolvedShape = shape ?? group?.shape ?? "circle";

  const sourceKey = getSourceKey(source);
  // Keyed on the source's content, so a retry with a new URL clears the
  // failure while a re-rendered identical URL keeps it.
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const showImage = sourceKey !== null && failedKey !== sourceKey;

  const initials = getAvatarInitials(name);
  const label = accessibilityLabel ?? name;

  return (
    <AvatarSurface
      px={px}
      shape={resolvedShape}
      ring={group?.ring ?? false}
      accessibilityLabel={label}
      style={[styles.fallback, styleOverride]}
    >
      {showImage ? (
        <Image
          source={source as ImageSourcePropType}
          resizeMode="cover"
          style={geometry.image}
          onError={() => setFailedKey(sourceKey)}
        />
      ) : initials ? (
        <AvatarLabel px={px} style={styles.fallbackText}>
          {initials}
        </AvatarLabel>
      ) : (
        <Icon
          name={icon ?? "user"}
          size={contentSize(px).iconSize}
          color="mutedForeground"
          decorative
        />
      )}
    </AvatarSurface>
  );
}

/**
 * Shared chrome for an avatar-shaped tile — used by `Avatar` and by
 * `AvatarGroup`'s `+N` overflow tile so both stay the same size, shape, and
 * ring without duplicating the geometry rules.
 */
function AvatarSurface({
  px,
  shape,
  ring,
  accessibilityLabel,
  style,
  children,
}: {
  px: number;
  shape: AvatarShape;
  ring: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const token = SIZE_TOKEN_FOR_PX[px];

  return (
    <View
      // Only join the accessibility tree when there is something to announce;
      // an unlabeled avatar is decorative next to the name it sits beside.
      accessible={accessibilityLabel ? true : undefined}
      // RN's role name is "image"; RNW maps it to aria-role "img" on the web.
      accessibilityRole={accessibilityLabel ? "image" : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[
        geometry.base,
        // Token sizes hit a pre-registered rule; a custom pixel size falls back
        // to an inline style (which always ships in the SSR HTML).
        token
          ? geometry[shape === "circle" ? `${token}Circle` : `${token}Square`]
          : { width: px, height: px, borderRadius: shape === "circle" ? spacing.radiusFull : squareRadius(px) },
        ring && geometry.ring,
        ring && styles.ring,
        style,
      ]}
    >
      {children}
    </View>
  );
}

function AvatarLabel({
  px,
  style,
  children,
}: {
  px: number;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
}) {
  return (
    <StyledText
      accessible={false}
      selectable={false}
      fontWeight="semibold"
      style={[geometry.labelText, { fontSize: contentSize(px).fontSize }, style]}
    >
      {children}
    </StyledText>
  );
}

export interface AvatarGroupProps {
  children?: React.ReactNode;
  /** Maximum number of avatars to render; the rest collapse into a `+N` tile. */
  max?: number;
  /** Size applied to child avatars that don't set their own. @default "md" */
  size?: AvatarSize;
  /** Shape applied to child avatars that don't set their own. @default "circle" */
  shape?: AvatarShape;
  /** Defaults to `"<n> avatars"`, counting the collapsed overflow. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * AvatarGroup Component
 *
 * Overlapping stack of avatars, each ringed in the theme `background` color so
 * the stack reads on any surface. Earlier avatars sit on top; anything past
 * `max` collapses into a `+N` tile.
 *
 * Usage:
 * ```tsx
 * <AvatarGroup max={3}>
 *   {members.map((m) => <Avatar key={m.id} source={{ uri: m.avatarUrl }} name={m.name} />)}
 * </AvatarGroup>
 * ```
 */
function AvatarGroup({
  children,
  max,
  size = "md",
  shape = "circle",
  accessibilityLabel,
  style: styleOverride,
}: AvatarGroupProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);

  // toArray drops null/undefined/false children so a conditionally rendered
  // avatar doesn't inflate the count or the overflow tally.
  const items = React.Children.toArray(children);
  const visible = max != null && max >= 0 ? items.slice(0, max) : items;
  const overflowCount = items.length - visible.length;

  const px = resolveSize(size);
  const token = SIZE_TOKEN_FOR_PX[px];
  const stackStyle = token ? geometry[`${token}Stack`] : { marginLeft: overlap(px) };
  const totalTiles = visible.length + (overflowCount > 0 ? 1 : 0);

  const contextValue = React.useMemo<AvatarGroupContextValue>(
    () => ({ size, shape, ring: true }),
    [size, shape],
  );

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? `${items.length} avatars`}
      style={[geometry.group, styleOverride]}
    >
      <AvatarGroupContext.Provider value={contextValue}>
        {visible.map((child, index) => (
          <View
            // toArray assigns every child a stable key, so reordering the list
            // moves the wrapper with its avatar instead of remounting both.
            key={React.isValidElement(child) ? child.key : index}
            // Earlier avatars paint over later ones, so the stack reads
            // left-to-right instead of the DOM's later-wins order.
            style={[index > 0 && stackStyle, { zIndex: totalTiles - index }]}
          >
            {child}
          </View>
        ))}
        {overflowCount > 0 ? (
          <View style={[visible.length > 0 && stackStyle, { zIndex: 0 }]}>
            <AvatarSurface px={px} shape={shape} ring style={styles.overflow}>
              <AvatarLabel px={px} style={styles.overflowText}>
                {`+${overflowCount}`}
              </AvatarLabel>
            </AvatarSurface>
          </View>
        ) : null}
      </AvatarGroupContext.Provider>
    </View>
  );
}

/** px → token, so a size passed as a raw number still hits the registered rules. */
const SIZE_TOKEN_FOR_PX: Record<number, AvatarSizeToken | undefined> = {
  [SIZE_TOKENS.sm]: "sm",
  [SIZE_TOKENS.md]: "md",
  [SIZE_TOKENS.lg]: "lg",
};

// Geometry carries no theme values, so a plain module-scope sheet is enough to
// get these rules into the server-rendered <head>. Only colors go through
// createThemedStyles below. See docs/ssr-hydration.md.
const geometry = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  labelText: {
    // The tile is the touch/visual target; text must not add its own metrics.
    includeFontPadding: false,
    textAlign: "center",
    userSelect: "none",
  },
  ring: {
    borderWidth: spacing.xxs,
  },
  group: {
    flexDirection: "row",
    alignItems: "center",
  },
  smCircle: { width: SIZE_TOKENS.sm, height: SIZE_TOKENS.sm, borderRadius: spacing.radiusFull },
  mdCircle: { width: SIZE_TOKENS.md, height: SIZE_TOKENS.md, borderRadius: spacing.radiusFull },
  lgCircle: { width: SIZE_TOKENS.lg, height: SIZE_TOKENS.lg, borderRadius: spacing.radiusFull },
  smSquare: { width: SIZE_TOKENS.sm, height: SIZE_TOKENS.sm, borderRadius: squareRadius(SIZE_TOKENS.sm) },
  mdSquare: { width: SIZE_TOKENS.md, height: SIZE_TOKENS.md, borderRadius: squareRadius(SIZE_TOKENS.md) },
  lgSquare: { width: SIZE_TOKENS.lg, height: SIZE_TOKENS.lg, borderRadius: squareRadius(SIZE_TOKENS.lg) },
  smStack: { marginLeft: overlap(SIZE_TOKENS.sm) },
  mdStack: { marginLeft: overlap(SIZE_TOKENS.md) },
  lgStack: { marginLeft: overlap(SIZE_TOKENS.lg) },
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    fallback: {
      backgroundColor: theme.colors.muted,
    },
    fallbackText: {
      color: theme.colors.mutedForeground,
    },
    ring: {
      borderColor: theme.colors.background,
    },
    overflow: {
      backgroundColor: theme.colors.accent,
    },
    overflowText: {
      color: theme.colors.accentForeground,
    },
  });

const themedStyles = createThemedStyles(createStyles);

export { Avatar, AvatarGroup };
