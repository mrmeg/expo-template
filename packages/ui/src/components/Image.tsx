import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import {
  Image as ExpoImage,
  type ImageContentFit,
  type ImageContentPosition,
  type ImageErrorEventData,
  type ImageLoadEventData,
  type ImageProps as ExpoImageProps,
  type ImageSource,
} from "expo-image";
import type { Theme } from "../constants/colors";
import { spacing } from "../constants/spacing";
import { useReducedMotion } from "../hooks/useReduceMotion";
import { useTheme } from "../hooks/useTheme";
import { mediaFrameStyle, useMediaAspectRatio, type MediaAspectRatio } from "../lib/mediaFrame";
import { createThemedStyles } from "../lib/themedStyles";
import { Icon } from "./Icon";

/** How the picture fills its frame. `expo-image`'s `contentFit`: `cover` (default), `contain`, `fill`, `none`, `scale-down`. */
export type ImageFit = ImageContentFit;

/** Corner radius, from the `spacing.radius*` scale. */
export type ImageRadius = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";

export interface ImageProps {
  /**
   * What to draw: a URL, a `require()`d asset, an `expo-image` source object
   * (`{ uri, cacheKey, headers }`), or an array of sources with `width` set
   * for a responsive pick. `null` leaves the frame in its loading look.
   */
  source: ImageSource | ImageSource[] | string | number | null;
  /**
   * Required. Describe the image; pass `""` for a decorative one, which assistive
   * technology then skips. Omitting it at runtime (a JS caller) is treated as
   * decorative and warns once in development.
   */
  alt: string;
  /** How the picture fills the frame. @default "cover" */
  fit?: ImageFit;
  /** Focal point for `cover` and `none` crops, for example `"top"` to keep heads in a portrait cropped wide. @default "center" */
  position?: ImageContentPosition;
  /**
   * The frame's shape. A number, `"16:9"` or `{ width, height }` makes the
   * frame as wide as its parent at that ratio. `"auto"` starts at
   * `fallbackAspectRatio` and switches to the picture's own ratio once it loads.
   * Leave it out to size the frame with `style` (width, height, flex), as with
   * a raw `expo-image`.
   */
  aspectRatio?: MediaAspectRatio | "auto";
  /** The ratio `"auto"` draws at until the picture loads, and for an `aspectRatio` that does not parse. @default 1 */
  fallbackAspectRatio?: number;
  /** Largest frame width, in points. Centers the frame when it is narrower than its parent. */
  maxWidth?: number;
  /**
   * Largest frame height, in points. With an `aspectRatio` it is enforced
   * through the width, so the frame stays centered instead of letterboxed;
   * without one it is a plain `maxHeight` on the frame.
   */
  maxHeight?: number;
  /** Absolutely fill the parent (which must be positioned; React Native views are by default). Wins over `aspectRatio`. */
  fill?: boolean;
  /** Corner radius. Applied to the frame and to the image, since Android drops a parent's clip on a child image in some cases. @default "none" */
  radius?: ImageRadius;
  /**
   * Shown while the picture loads: a blurhash string (bare, or with
   * `blurhash:/`), a thumbhash string (it must carry the `thumbhash:/` prefix;
   * a bare string is read as a blurhash), or a low-resolution source (a URL
   * string or `{ uri }`).
   */
  placeholder?: string | ImageSource;
  /** How the placeholder fills the frame. Defaults to `fit`, so it does not jump when the picture arrives. */
  placeholderFit?: ImageFit;
  /** Cross-dissolve length, in ms. Forced to 0 when the user prefers reduced motion. @default 200 */
  transition?: number;
  /** Replaces the default error state (a centered `image-off` icon). Drawn over the muted frame. */
  fallback?: React.ReactNode;
  /** Load order hint. On web it reaches the `<img>`'s `fetchpriority`. @default "normal" */
  priority?: "low" | "normal" | "high";
  /** `expo-image`'s cache policy: `none`, `disk`, `memory`, `memory-disk`. */
  cachePolicy?: ExpoImageProps["cachePolicy"];
  /** Set to the item's id in a recycled list (FlashList, FlatList) so a reused cell shows a blank frame, not the previous picture. */
  recyclingKey?: string | null;
  /** The picture decoded: its natural size in pixels (after EXIF rotation). */
  onLoad?: (e: { width: number; height: number }) => void;
  /** The picture failed to load. The payload is `expo-image`'s error event. */
  onError?: (error: unknown) => void;
  /** Layout of the frame: margins, width, height, flex. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Registered at module scope so web server rendering serializes them (see
 * `docs/server-guide.md`). None of these depend on the theme.
 */
const geometry = /*#__PURE__*/ StyleSheet.create({
  frame: { overflow: "hidden" },
  // The explicit 100% size stays alongside the inset: react-native-web does
  // not resolve an image's size from the inset box (see `Avatar`).
  image: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  layer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  centered: { alignItems: "center", justifyContent: "center" },
});

const radiusStyles = /*#__PURE__*/ StyleSheet.create({
  none: { borderRadius: spacing.radiusNone },
  xs: { borderRadius: spacing.radiusXs },
  sm: { borderRadius: spacing.radiusSm },
  md: { borderRadius: spacing.radiusMd },
  lg: { borderRadius: spacing.radiusLg },
  xl: { borderRadius: spacing.radiusXl },
  "2xl": { borderRadius: spacing.radius2xl },
  full: { borderRadius: spacing.radiusFull },
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // The frame's surface while loading and in the error state only.
    surface: { backgroundColor: theme.colors.muted },
  });

const themedStyles = /*#__PURE__*/ createThemedStyles(createStyles);

/** Error glyph size: 24 pt, or 16 pt in a frame smaller than this. */
const SMALL_FRAME = 48;
const ERROR_ICON = 24;
const ERROR_ICON_SMALL = 16;

const MISSING_ALT_WARNING =
  "Image: `alt` is required. Describe the image, or pass \"\" for a decorative one. An image without it is treated as decorative.";

/**
 * Identity of a source by content. `source={{ uri, cacheKey }}` allocates a new
 * object on every render, so load and error state keyed on object identity
 * would reset immediately. `null` means "no image".
 */
function getSourceKey(source: ImageProps["source"]): string | null {
  if (source == null) return null;
  if (typeof source === "number") return `asset:${source}`;
  if (typeof source === "string") return source === "" ? null : `uri:${source}`;

  if (Array.isArray(source)) {
    const keys = source.map((entry) => getSourceKey(entry) ?? "").filter(Boolean);
    return keys.length > 0 ? keys.join("|") : null;
  }

  if (source.uri) return `uri:${source.uri}${source.cacheKey ? `#${source.cacheKey}` : ""}`;

  // A descriptor with no uri (a resolved asset, a hash). Sorted keys, so two
  // literals written in a different order still match. `{}` carries no image.
  const fields = Object.keys(source).sort() as (keyof typeof source)[];
  if (fields.length === 0) return null;
  return fields.map((field) => `${field}=${JSON.stringify(source[field])}`).join("&");
}

/** A string that is a location, not a hash. A blurhash alphabet has no `/`, so a leading `/` or `./` cannot be one. */
const LOCATION_LIKE = /^(?:[a-z][a-z0-9+.-]*:\/\/|data:|file:|blob:|\/|\.{1,2}\/)/i;

/**
 * `expo-image` reads a string source as a URL unless it carries a `blurhash:/`
 * or `thumbhash:/` scheme, so a bare hash would be fetched as a path. A string
 * placeholder that is not a location is a hash: hand it over as one.
 */
function resolvePlaceholder(placeholder: ImageProps["placeholder"]): ExpoImageProps["placeholder"] {
  if (typeof placeholder !== "string") return placeholder;
  if (placeholder.startsWith("thumbhash:/")) return { thumbhash: placeholder };
  if (placeholder.startsWith("blurhash:/")) return { blurhash: placeholder };
  if (placeholder === "") return null;
  return LOCATION_LIKE.test(placeholder) ? { uri: placeholder } : { blurhash: placeholder };
}

/**
 * The frame's accessibility props. A described image is one accessible
 * element named by `alt`; a decorative one is hidden. On web, react-native-web
 * turns these into `role="img"` + `aria-label`, and `aria-hidden` hides the
 * decorative frame.
 */
function frameAccessibilityProps(alt: string | undefined): ViewProps {
  if (typeof alt !== "string" || alt.trim() === "") {
    return {
      accessible: false,
      // Android: "no" would still expose a custom `fallback` inside the frame.
      importantForAccessibility: "no-hide-descendants",
      accessibilityElementsHidden: true,
      ...(Platform.OS === "web" && { "aria-hidden": true }),
    };
  }
  return { accessible: true, accessibilityRole: "image", accessibilityLabel: alt };
}

/**
 * Image
 *
 * A picture that sizes itself from an aspect ratio instead of fixed pixels.
 * Built on `expo-image` (an optional peer: `npx expo install expo-image`), so
 * it caches, decodes animated GIF/WebP/APNG, and honors EXIF rotation. Import
 * it from `@mrmeg/expo-ui/components/Image`; it is not in the barrel.
 *
 * The frame is a `View` that clips (`overflow: hidden`) and carries the
 * radius. It paints `theme.colors.muted` while loading and when the load
 * failed, then goes transparent, so a transparent PNG, WebP, SVG or AVIF
 * shows the surface behind it in both themes. `contain`, `scale-down` and
 * `none` letterboxing is transparent too. A failed load shows `fallback`, or
 * an `image-off` icon (24 pt, 16 pt in a frame under 48 pt). A new `source`
 * clears the failure.
 *
 * Pick how the frame is sized:
 *
 * - `aspectRatio={16 / 9}`, `"16:9"` or `{ width, height }`: full width of the
 *   parent at that ratio, capped by `maxWidth` / `maxHeight` and centered.
 *   Prefer this whenever the size is known (an upload's metadata): the box is
 *   pure style, so a server-rendered page already carries the final layout.
 * - `aspectRatio="auto"`: draws at `fallbackAspectRatio`, then moves to the
 *   picture's natural ratio once it loads. That is one layout shift, once per
 *   mount (a later source does not move it again; change `key` to re-measure).
 * - `fill`: absolutely fills a positioned parent that you size.
 * - none of these: you size the frame with `style`, as with a raw `expo-image`.
 *
 * ```tsx
 * <Image source={photo.url} alt={photo.title} aspectRatio={{ width: photo.width, height: photo.height }} radius="md" />
 * <Image source={cover} alt="" aspectRatio="16:9" maxHeight={240} fit="cover" position="top" />
 * <Image source={{ uri, cacheKey: key }} alt="" style={{ width: 96, height: 96 }} recyclingKey={key} />
 * ```
 *
 * Web notes: `expo-image` adds its `<img>` after the component mounts, so a
 * server-rendered response carries the sized, muted frame, not the `<img>`
 * (a low-resolution `placeholder` URL is the one exception). The `<img>` gets
 * `alt` from `alt`, `fetchpriority` from `priority`, and `loading="lazy"`.
 */
export function Image({
  source,
  alt,
  fit = "cover",
  position = "center",
  aspectRatio,
  fallbackAspectRatio = 1,
  maxWidth,
  maxHeight,
  fill,
  radius = "none",
  placeholder,
  placeholderFit,
  transition = 200,
  fallback,
  priority,
  cachePolicy,
  recyclingKey,
  onLoad,
  onError,
  style,
  testID,
}: ImageProps) {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const { ratio, reportNaturalSize } = useMediaAspectRatio(aspectRatio, fallbackAspectRatio);

  // Load and error state are keyed by the source's content, so a new source
  // starts again from "loading" without an effect and an inline `{ uri }`
  // does not reset itself on every render.
  const key = getSourceKey(source);
  const [load, setLoad] = useState<{ key: string | null; status: "loading" | "loaded" | "error" }>({
    key,
    status: "loading",
  });
  const status = load.key === key ? load.status : "loading";

  const handleLoad = useCallback(
    (event: ImageLoadEventData) => {
      const width = event?.source?.width ?? 0;
      const height = event?.source?.height ?? 0;
      setLoad({ key, status: "loaded" });
      reportNaturalSize(width, height);
      onLoad?.({ width, height });
    },
    [key, onLoad, reportNaturalSize],
  );

  const handleError = useCallback(
    (event: ImageErrorEventData) => {
      setLoad({ key, status: "error" });
      onError?.(event);
    },
    [key, onError],
  );

  const warned = useRef(false);
  useEffect(() => {
    if (!__DEV__ || typeof alt === "string" || warned.current) return;
    warned.current = true;
    console.warn(MISSING_ALT_WARNING);
  }, [alt]);

  const layout = fill
    ? mediaFrameStyle({ fill: true })
    : mediaFrameStyle({ aspectRatio: ratio, maxWidth, maxHeight });
  const callerStyle = Array.isArray(style) ? style : [style];
  const withSurface = status !== "loaded";
  const radiusStyle = radiusStyles[radius] ?? radiusStyles.none;
  const described = typeof alt === "string" && alt.trim() !== "";

  return (
    <View
      testID={testID}
      {...frameAccessibilityProps(alt)}
      style={[geometry.frame, radiusStyle, layout, withSurface && themedStyles(theme).surface, ...callerStyle]}
    >
      {status === "error" ? null : (
        <ExpoImage
          source={source}
          style={[geometry.image, radiusStyle]}
          contentFit={fit}
          contentPosition={position}
          placeholder={resolvePlaceholder(placeholder)}
          placeholderContentFit={placeholderFit ?? fit}
          transition={reducedMotion ? 0 : transition}
          priority={priority}
          cachePolicy={cachePolicy}
          recyclingKey={recyclingKey}
          // On web this becomes the `<img>`'s `alt` (`expo-image` reads
          // `accessibilityLabel` for the main node and `alt` only for the
          // placeholder). Natively the frame is the accessible element, and a
          // second labelled view inside it would be a second focus stop.
          accessibilityLabel={Platform.OS === "web" ? (described ? alt : "") : undefined}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
      {status === "error" ? <ErrorState fallback={fallback} testID={testID ? `${testID}-error` : undefined} /> : null}
    </View>
  );
}

/** The failed-load layer: `fallback`, or a centered icon sized from the frame. */
function ErrorState({ fallback, testID }: { fallback: React.ReactNode; testID?: string }) {
  const [small, setSmall] = useState(false);
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSmall(Math.min(width, height) < SMALL_FRAME);
  }, []);

  if (fallback !== undefined && fallback !== null) {
    return (
      <View style={geometry.layer} testID={testID}>
        {fallback}
      </View>
    );
  }

  return (
    <View style={[geometry.layer, geometry.centered]} onLayout={handleLayout} testID={testID}>
      <Icon name="image-off" size={small ? ERROR_ICON_SMALL : ERROR_ICON} color="mutedForeground" />
    </View>
  );
}
