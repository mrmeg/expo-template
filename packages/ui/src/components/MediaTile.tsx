import React, { memo } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { palette, type Theme } from "../constants/colors";
import { spacing } from "../constants/spacing";
import { useTheme, withAlpha } from "../hooks/useTheme";
import { translateText } from "../lib/i18n";
import { createThemedStyles } from "../lib/themedStyles";
import { Checkbox } from "./Checkbox";
import { Icon, type IconName } from "./Icon";
import { Image } from "./Image";
import { SansSerifText } from "./StyledText";

/** What a tile stands for. It picks the press behavior and the icon shown when there is no picture. */
export type MediaTileKind = "image" | "video" | "file";

/** A picture for the tile: an image's own URI, or a video's poster. */
export interface MediaTileSource {
  uri: string;
  /**
   * Cache identity when `uri` changes between renders for the same picture
   * (signed URLs re-sign on every fetch). Use something stable per picture,
   * such as its storage key.
   */
  cacheKey?: string;
}

/** Builds a screen-reader label from the tile's name, so each language can order the words its own way. */
export type MediaTileLabel = (name: string) => string;

export interface MediaTileProps {
  /** Passed back to every callback. Also the recycling key in a list. */
  id: string;
  /** Image, video or other file. */
  kind: MediaTileKind;
  /**
   * The picture, or a video's poster: a `{ uri, cacheKey }`, or a `require()`d
   * asset. Without it the tile draws `fallbackIcon` on the muted surface.
   */
  source?: MediaTileSource | number;
  /** Edge length of the square, in points. Size it with `mediaGridLayout`. */
  size: number;
  /** One line under the tile, medium weight. */
  title?: string;
  /** One muted line under `title`. */
  subtitle?: string;
  /** Draws the selection ring over the picture. The ring does not resize it. @default false */
  selected?: boolean;
  /** Images and files: the tile was pressed. Videos: the centered play button was pressed. Without it the tile is not interactive. */
  onPress?: (id: string) => void;
  /** Renders the checkbox chip, top left, only when set. */
  onToggleSelect?: (id: string) => void;
  /** Renders the delete chip, top right, only when set. */
  onDelete?: (id: string) => void;
  /** Disables the tile's controls, for example while a delete is in flight. @default false */
  disabled?: boolean;
  /** The name screen readers use in the labels below. Defaults to `title`, then to the kind. */
  accessibilityLabel?: string;
  /** Label for the tile's press target (images and files). @default name => `Open ${name}` */
  openLabel?: MediaTileLabel;
  /** Label for a video's play button. @default name => `Play ${name}` */
  playLabel?: MediaTileLabel;
  /** Label for the selection checkbox. @default name => `Select ${name}` */
  selectLabel?: MediaTileLabel;
  /** Label for the delete button. @default name => `Delete ${name}` */
  deleteLabel?: MediaTileLabel;
  /**
   * Glyph on the delete chip. Any registered `Icon` name; the built-in default
   * is `x`, so pass your app's `trash` for a bin.
   * @default "x"
   */
  deleteIcon?: IconName;
  /**
   * Glyph drawn when there is no `source`. Defaults to `play` for a video and
   * `image-off` otherwise; pass your app's `video` or `file` glyph to say more.
   */
  fallbackIcon?: IconName;
  /** Style for the tile's outer column (margins, flex). */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const defaultOpenLabel: MediaTileLabel = (name) => translateText("media.tile.open", `Open ${name}`, { name }) ?? `Open ${name}`;
const defaultPlayLabel: MediaTileLabel = (name) => translateText("media.tile.play", `Play ${name}`, { name }) ?? `Play ${name}`;
const defaultSelectLabel: MediaTileLabel = (name) =>
  translateText("media.tile.select", `Select ${name}`, { name }) ?? `Select ${name}`;
const defaultDeleteLabel: MediaTileLabel = (name) =>
  translateText("media.tile.delete", `Delete ${name}`, { name }) ?? `Delete ${name}`;

/** Size of the play button's disc, and of the glyph in the fallback and on the chips. */
const PLAY_BUTTON = 40;
const FALLBACK_ICON = 32;
const CHIP_ICON = 16;
const RING_WIDTH = 3;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    thumbnail: {
      borderRadius: spacing.radiusSm,
      overflow: "hidden",
      backgroundColor: theme.colors.muted,
    },
    fallback: {
      justifyContent: "center",
      alignItems: "center",
    },
    playOverlay: {
      ...StyleSheet.absoluteFill,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: withAlpha(palette.black, 0.25),
    },
    playButton: {
      width: PLAY_BUTTON,
      height: PLAY_BUTTON,
      borderRadius: spacing.radiusFull,
      backgroundColor: theme.colors.primary,
      justifyContent: "center",
      alignItems: "center",
      paddingLeft: spacing.xxs, // Offsets the play glyph's optical center.
    },
    selectedRing: {
      ...StyleSheet.absoluteFill,
      pointerEvents: "none",
      borderRadius: spacing.radiusSm,
      borderWidth: RING_WIDTH,
      borderColor: theme.colors.primary,
    },
    // Scrim chips behind the checkbox and delete control keep them legible on
    // any photo.
    chip: {
      position: "absolute",
      top: spacing.xs,
      padding: spacing.xs,
      borderRadius: spacing.radiusSm,
      backgroundColor: withAlpha(palette.black, 0.45),
    },
    chipStart: {
      left: spacing.xs,
    },
    chipEnd: {
      right: spacing.xs,
    },
    title: {
      color: theme.colors.foreground,
      marginTop: spacing.xs,
    },
    subtitle: {
      color: theme.colors.mutedForeground,
    },
  });

/** Registered at module scope so web server rendering serializes them (see `docs/server-guide.md`). */
const themedStyles = /*#__PURE__*/ createThemedStyles(createStyles);

/** A source's identity by content: a bundled asset by its id, a remote one by `uri` and `cacheKey`. */
function sourceKey(source: MediaTileProps["source"]): string | undefined {
  if (source === undefined) return undefined;
  if (typeof source === "number") return `asset:${source}`;
  return `${source.uri}#${source.cacheKey ?? ""}`;
}

/**
 * Props compared for `memo`. `source` is usually an inline `{ uri, cacheKey }`,
 * a new object every render, so it is compared by its fields; every other prop
 * is a primitive or a callback and compares by identity.
 */
function areTilePropsEqual(previous: MediaTileProps, next: MediaTileProps): boolean {
  const { source: previousSource, ...previousRest } = previous;
  const { source: nextSource, ...nextRest } = next;
  if (sourceKey(previousSource) !== sourceKey(nextSource)) return false;
  const keys = new Set([...Object.keys(previousRest), ...Object.keys(nextRest)]) as Set<keyof typeof previousRest>;
  for (const key of keys) if (!Object.is(previousRest[key], nextRest[key])) return false;
  return true;
}

function MediaTileView({
  id,
  kind,
  source,
  size,
  title,
  subtitle,
  selected = false,
  onPress,
  onToggleSelect,
  onDelete,
  disabled = false,
  accessibilityLabel,
  openLabel = defaultOpenLabel,
  playLabel = defaultPlayLabel,
  selectLabel = defaultSelectLabel,
  deleteLabel = defaultDeleteLabel,
  deleteIcon = "x",
  fallbackIcon,
  style,
  testID,
}: MediaTileProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const name = accessibilityLabel ?? title ?? kind;
  const isVideo = kind === "video";
  const square = { width: size, height: size };

  const picture = source ? (
    <Image
      source={typeof source === "number" ? source : { uri: source.uri, cacheKey: source.cacheKey }}
      alt={onPress && !isVideo ? "" : name}
      fit="cover"
      recyclingKey={id}
      style={square}
      testID={testID ? `${testID}-image` : undefined}
    />
  ) : (
    <View style={[styles.fallback, square]}>
      <Icon
        name={fallbackIcon ?? (isVideo ? "play" : "image-off")}
        size={FALLBACK_ICON}
        color={isVideo ? "primary" : "mutedForeground"}
        decorative
      />
    </View>
  );

  return (
    <View style={[{ width: size }, style]} testID={testID}>
      <View style={[styles.thumbnail, square]}>
        {onPress && !isVideo ? (
          <Pressable
            onPress={() => onPress(id)}
            disabled={disabled}
            accessibilityRole={kind === "image" ? "imagebutton" : "button"}
            accessibilityLabel={openLabel(name)}
          >
            {picture}
          </Pressable>
        ) : (
          picture
        )}

        {/* Play button for videos: the whole tile is its target, the disc is its look. */}
        {isVideo && onPress ? (
          <Pressable
            style={styles.playOverlay}
            onPress={() => onPress(id)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={playLabel(name)}
          >
            <View style={styles.playButton}>
              <Icon name="play" size={20} color="primaryForeground" decorative />
            </View>
          </Pressable>
        ) : null}

        {/* Selection ring: drawn over the picture so selecting does not resize it. */}
        {selected ? <View style={styles.selectedRing} testID="media-tile-ring" /> : null}

        {onToggleSelect ? (
          <View style={[styles.chip, styles.chipStart]}>
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect(id)}
              disabled={disabled}
              accessibilityLabel={selectLabel(name)}
            />
          </View>
        ) : null}

        {onDelete ? (
          <Pressable
            style={[styles.chip, styles.chipEnd]}
            onPress={() => onDelete(id)}
            disabled={disabled}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel={deleteLabel(name)}
          >
            <Icon name={deleteIcon} size={CHIP_ICON} color="destructive" decorative />
          </Pressable>
        ) : null}
      </View>

      {title ? (
        <SansSerifText size="base" fontWeight="medium" style={styles.title} numberOfLines={1}>
          {title}
        </SansSerifText>
      ) : null}
      {subtitle ? (
        <SansSerifText size="sm" style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </SansSerifText>
      ) : null}
    </View>
  );
}

/**
 * MediaTile
 *
 * One square tile of a media grid: a picture (or a video's poster, or an icon
 * when there is none), an optional play button, selection ring, checkbox chip
 * and delete chip drawn over it, and one title and one subtitle line under it.
 * Presentational: it holds no state and knows nothing about where the picture
 * lives. Every callback gets the tile's `id`.
 *
 * Every prop is a primitive or a stable reference, and the component is
 * memoized, so in a `FlatList` only the tiles whose props changed re-render
 * when the selection or a sibling changes. Pass callbacks that do not change
 * identity per render (`useCallback`, or `useKeySelection`'s).
 *
 * Subpath-only, like `Image` it draws with: import it from
 * `@mrmeg/expo-ui/components/MediaTile`, and install `expo-image`.
 *
 * @example
 * ```tsx
 * <MediaTile
 *   id={photo.key}
 *   kind="image"
 *   source={{ uri: photo.url, cacheKey: photo.key }}
 *   size={tileSize}
 *   title={photo.name}
 *   subtitle="1.2 MB"
 *   selected={selection.isSelected(photo.key)}
 *   onPress={openViewer}
 *   onToggleSelect={selection.toggle}
 *   onDelete={confirmDelete}
 * />
 * ```
 */
export const MediaTile = memo(MediaTileView, areTilePropsEqual);
