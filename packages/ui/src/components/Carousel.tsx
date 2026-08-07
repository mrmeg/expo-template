import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../hooks/useTheme";
import { useDimensions } from "../hooks/useDimensions";
import { spacing } from "../constants/spacing";
import { createThemedStyles } from "../lib/themedStyles";
import type { Theme } from "../constants/colors";

// ============================================================================
// Types
// ============================================================================

export interface CarouselProps {
  /** Slides to page through. Each child is wrapped in a fixed-width slide. */
  children?: React.ReactNode;
  /**
   * Slide width. Values `<= 1` are a fraction of the carousel's own width —
   * the default `0.85` leaves the next slide peeking. Values `> 1` are
   * absolute pixels.
   * @default 0.85
   */
  itemWidth?: number;
  /** Space between slides. @default spacing.md */
  gap?: number;
  /** Horizontal inset before the first and after the last slide. @default spacing.lg */
  contentPadding?: number;
  /** Render the dot indicators. Auto-hidden for a single slide. @default true */
  showDots?: boolean;
  /** Slide shown on mount. @default 0 */
  initialIndex?: number;
  /** Called with the new active index whenever it changes. */
  onIndexChange?: (index: number) => void;
  /** Snap to slide boundaries. @default true */
  snap?: boolean;
  /** Custom style override for the outer container. */
  style?: StyleProp<ViewStyle>;
  /** Custom style override for the scroll content row. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /**
   * testID prefix. Emits `<testID>`, `-scroll`, `-item-<i>`, `-dots`,
   * `-dot-<i>`, and `-status`.
   * @default "carousel"
   */
  testID?: string;
}

// ============================================================================
// Index math
// ============================================================================

/**
 * Active slide index for a horizontal scroll offset.
 *
 * `interval` is the slide pitch (item width + gap), so page `i` sits at
 * `i * interval` for both the native snap offsets and web's CSS scroll-snap
 * (see `scrollPaddingLeft` below). Clamped to `[0, count - 1]` so rubber-band
 * overscroll at either end can't report an out-of-range page. Returns `0` for
 * a degenerate interval — which is also the pre-measurement state on the
 * server.
 */
export function getCarouselIndex(offsetX: number, interval: number, count: number): number {
  if (!Number.isFinite(offsetX) || !Number.isFinite(interval)) return 0;
  if (interval <= 0 || count <= 0) return 0;
  const raw = Math.round(offsetX / interval);
  if (raw < 0) return 0;
  if (raw > count - 1) return count - 1;
  return raw;
}

/** Resolves the `itemWidth` prop against a container width (fraction vs px). */
export function resolveCarouselItemWidth(itemWidth: number, containerWidth: number): number {
  if (!Number.isFinite(itemWidth) || itemWidth <= 0) return 0;
  if (itemWidth > 1) return Math.round(itemWidth);
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 0;
  return Math.round(containerWidth * itemWidth);
}

function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.trunc(index)));
}

// ============================================================================
// Carousel
// ============================================================================

/**
 * Carousel Component
 *
 * Horizontally snapping row of slides with dot indicators and an optional
 * peek of the next slide. Children-based: every child becomes one slide at the
 * resolved item width.
 *
 * Built on `ScrollView` — not a virtualized list — on purpose: every slide is
 * in the server-rendered tree, so web SSR ships the real content instead of an
 * empty scroller that only fills in after measurement. Snapping uses the
 * platform scroller (`snapToInterval` on native, CSS scroll-snap on web); no
 * animation library is involved.
 *
 * @example
 * ```tsx
 * <Carousel itemWidth={0.8} onIndexChange={setPage}>
 *   {testimonials.map((t) => (
 *     <Card key={t.name}>
 *       <BodyText>{t.quote}</BodyText>
 *     </Card>
 *   ))}
 * </Carousel>
 * ```
 */
export function Carousel({
  children,
  itemWidth = 0.85,
  gap = spacing.md,
  contentPadding = spacing.lg,
  showDots = true,
  initialIndex = 0,
  onIndexChange,
  snap = true,
  style: styleOverride,
  contentContainerStyle,
  testID = "carousel",
}: CarouselProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const items = React.Children.toArray(children);
  const count = items.length;

  // Width source of truth: the measured container after mount, seeded from the
  // viewport so the server and the client's first render agree. `useDimensions`
  // reads the SSR viewport context rather than `window`, which is what keeps
  // that seed hydration-safe (docs/ssr-hydration.md §4).
  const { width: viewportWidth } = useDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const containerWidth = measuredWidth ?? viewportWidth;
  const slideWidth = resolveCarouselItemWidth(itemWidth, containerWidth);
  const interval = slideWidth + gap;

  const [activeIndex, setActiveIndex] = useState(() => clampIndex(initialIndex, count));
  // Mirrors activeIndex so the scroll handler can dedupe without re-reading
  // state: one settle emits many scroll events, onIndexChange must fire once.
  const activeIndexRef = useRef(activeIndex);
  const scrollRef = useRef<ScrollView | null>(null);
  const hasScrolledToInitial = useRef(false);

  const commitIndex = useCallback(
    (next: number) => {
      if (next === activeIndexRef.current) return;
      activeIndexRef.current = next;
      setActiveIndex(next);
      onIndexChange?.(next);
    },
    [onIndexChange]
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      commitIndex(getCarouselIndex(event.nativeEvent.contentOffset.x, interval, count));
    },
    [commitIndex, count, interval]
  );

  const handleLayout = useCallback((event: { nativeEvent: { layout: { width: number } } }) => {
    const next = event.nativeEvent.layout.width;
    if (!(next > 0)) return;
    setMeasuredWidth((current) =>
      current !== null && Math.abs(current - next) < 1 ? current : next
    );
  }, []);

  // Jump to initialIndex once, after the first real layout — the seeded
  // viewport width would put the offset in the wrong place. `contentOffset` is
  // iOS-only, so drive it imperatively for Android/web parity.
  const targetIndex = clampIndex(initialIndex, count);
  useEffect(() => {
    if (hasScrolledToInitial.current || measuredWidth === null || interval <= 0) return;
    hasScrolledToInitial.current = true;
    if (targetIndex === 0) return;
    scrollRef.current?.scrollTo({ x: targetIndex * interval, animated: false });
  }, [interval, measuredWidth, targetIndex]);

  const isWeb = Platform.OS === "web";
  const useCssSnap = isWeb && snap;
  const dotsVisible = showDots && count > 1;

  return (
    <View style={[styles.container, styleOverride]} onLayout={handleLayout} testID={testID}>
      <ScrollView
        ref={scrollRef}
        testID={`${testID}-scroll`}
        horizontal
        showsHorizontalScrollIndicator={false}
        // Native snapping. react-native-web drops these (they aren't in its
        // forwarded-prop list), so web uses the CSS scroll-snap styles instead.
        snapToInterval={snap && interval > 0 ? interval : undefined}
        snapToAlignment="start"
        decelerationRate={snap ? "fast" : "normal"}
        // react-native-web only emits scroll ticks when the throttle is > 0 and
        // never emits momentum events — this is what keeps the dots live for
        // wheel/trackpad scrolling.
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleScroll}
        style={
          useCssSnap
            ? [webStyles.scroller, { scrollPaddingLeft: contentPadding } as ViewStyle]
            : undefined
        }
        contentContainerStyle={[{ paddingHorizontal: contentPadding, gap }, contentContainerStyle]}
      >
        {items.map((child, index) => (
          <View
            key={React.isValidElement(child) && child.key != null ? child.key : index}
            testID={`${testID}-item-${index}`}
            style={[slideWidth > 0 && { width: slideWidth }, useCssSnap && webStyles.item]}
          >
            {child}
          </View>
        ))}
      </ScrollView>

      {count > 1 && (
        // Page announcement ("2 of 5"). A live region announces on *content*
        // change, so this is a real — visually clipped — text node, not an
        // accessibilityLabel (changing a label announces nothing). `aria-live`
        // is RN's cross-platform spelling: View maps it to
        // accessibilityLiveRegion on Android, RNW emits aria-live on web. iOS
        // has no live-region equivalent; the dots below carry the state there.
        <View testID={`${testID}-status`} style={styles.status} aria-live="polite">
          <Text style={styles.statusText}>{`${activeIndex + 1} of ${count}`}</Text>
        </View>
      )}

      {dotsVisible && (
        <View testID={`${testID}-dots`} style={styles.dots} accessibilityRole="tablist">
          {items.map((_, index) => (
            <View
              key={index}
              testID={`${testID}-dot-${index}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: index === activeIndex }}
              accessibilityLabel={`Slide ${index + 1} of ${count}`}
              style={[styles.dot, index === activeIndex ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const DOT_SIZE = 8;

// Web-only CSS scroll-snap. `scrollPaddingLeft` is applied inline at the call
// site (it tracks the contentPadding prop) so the leading inset survives the
// browser snapping slide 0 to the scrollport start — which also makes page `i`
// land on `i * interval`, matching the native snap offsets.
const webStyles = StyleSheet.create({
  scroller: { scrollSnapType: "x mandatory" } as ViewStyle,
  item: { scrollSnapAlign: "start" } as ViewStyle,
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      width: "100%",
    },
    // Clipped to 1x1 rather than removed: screen readers skip
    // display:none/opacity:0 nodes, and there is no visual affordance to show.
    status: {
      position: "absolute",
      width: 1,
      height: 1,
      overflow: "hidden",
    },
    statusText: {
      fontSize: 1,
      color: "transparent",
    },
    dots: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    dot: {
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: spacing.radiusFull,
    },
    dotActive: {
      backgroundColor: theme.colors.accent,
    },
    dotInactive: {
      backgroundColor: theme.colors.border,
    },
  });

const themedStyles = createThemedStyles(createStyles);
