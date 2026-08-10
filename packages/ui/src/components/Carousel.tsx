import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
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
   *
   * Caveat for fractional values: "the carousel's own width" is only known
   * after the first `onLayout`. Until then it is seeded from the viewport
   * width, so a carousel inside a horizontally constrained parent (a padded
   * column, a `MaxWidthContainer`, a sidebar pane) renders its first frame —
   * and the server-rendered HTML — with slides sized to the *window* and
   * corrects on layout. Pass an absolute `itemWidth` (`> 1`) when the parent
   * is narrower than the viewport and that first frame matters.
   * @default 0.85
   */
  itemWidth?: number;
  /** Space between slides. @default spacing.md */
  gap?: number;
  /** Horizontal inset before the first and after the last slide. @default spacing.lg */
  contentPadding?: number;
  /**
   * Render the dot indicators. Auto-hidden for a single slide. Dots are
   * pressable and scroll to their slide.
   * @default true
   */
  showDots?: boolean;
  /** Slide shown on mount. @default 0 */
  initialIndex?: number;
  /**
   * Called with the new active index whenever it changes.
   *
   * On native this is once per settle: momentum end, or drag end for a release
   * that stops at rest. On web it is once per page *crossed*, because
   * react-native-web emits no momentum events and throttled scroll ticks are
   * the only channel — a wheel scroll spanning three pages reports all three.
   * Consecutive duplicate indices are always suppressed. Also fires on a dot
   * press, and when `children` shrink below the active index and it has to be
   * re-clamped.
   */
  onIndexChange?: (index: number) => void;
  /** Snap to slide boundaries. @default true */
  snap?: boolean;
  /** Custom style override for the outer container. */
  style?: StyleProp<ViewStyle>;
  /** Custom style override for the scroll content row. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /**
   * testID prefix. Emits `<testID>`, `-scroll`, `-item-<i>`, `-dots`,
   * `-dot-<i>` (the pressable), `-dot-<i>-indicator` (the visible dot), and
   * `-status`.
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
 * Slides sized by a fractional `itemWidth` measure against the viewport until
 * the first `onLayout` lands — see the `itemWidth` caveat on `CarouselProps`.
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
  // state: web's throttled ticks report the same page many times over, and
  // onIndexChange must fire once per page.
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

  const isWeb = Platform.OS === "web";

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      commitIndex(getCarouselIndex(event.nativeEvent.contentOffset.x, interval, count));
    },
    [commitIndex, count, interval]
  );

  // Native fallback for a drag that releases with the content at rest: no
  // momentum follows, so `onMomentumScrollEnd` never arrives and the settle
  // would go unreported.
  //
  // Gated on velocity because an ungated drag-end handler is exactly the
  // double-fire this replaced: a flick past a slide midpoint that snaps back
  // reports the midpoint page on release and the original page on settle. A
  // release that *will* glide reports a non-zero velocity (points/ms on iOS,
  // density-scaled px/s on Android — either way, orders of magnitude above
  // this epsilon), and momentum end is left to speak for it. A release at rest
  // reports 0, and there `getCarouselIndex`'s round-to-nearest already agrees
  // with where `snapToInterval` would land, so the two paths can't disagree.
  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const velocityX = event.nativeEvent.velocity?.x ?? 0;
      if (Math.abs(velocityX) > 0.01) return;
      handleScroll(event);
    },
    [handleScroll]
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

  // Re-clamp when children shrink. Without this the status line reads "5 of 3"
  // with no active dot until the next scroll, because activeIndex is only
  // seeded once and the scroller — already past the new content width — emits
  // nothing on its own. Scrolling back is what makes the offset agree with the
  // reported page again.
  useEffect(() => {
    if (count <= 0 || activeIndexRef.current < count) return;
    const clamped = count - 1;
    commitIndex(clamped);
    if (interval > 0) {
      scrollRef.current?.scrollTo({ x: clamped * interval, animated: false });
    }
  }, [commitIndex, count, interval]);

  const handleDotPress = useCallback(
    (index: number) => {
      commitIndex(index);
      if (interval > 0) {
        scrollRef.current?.scrollTo({ x: index * interval, animated: true });
      }
    },
    [commitIndex, interval]
  );

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
        // Index source, split by platform:
        //
        // Web — react-native-web emits no momentum events at all, so throttled
        // scroll ticks are the only channel that keeps the dots live for
        // wheel/trackpad scrolling. `scrollEventThrottle` must be > 0 there or
        // RNW delivers a single event.
        //
        // Native — momentum end is the settle, with a velocity-gated
        // `onScrollEndDrag` covering the drag that releases at rest (no
        // momentum-end event follows). Subscribing to `onScroll` as well would
        // cost a JS callback every frame of every drag to compute a page the
        // settle reports anyway.
        {...(isWeb
          ? { scrollEventThrottle: 16, onScroll: handleScroll }
          : { onMomentumScrollEnd: handleScroll, onScrollEndDrag: handleScrollEndDrag })}
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
        // The `tab`/`tablist` roles are honest because the dots really are
        // activatable: each one is a Pressable that scrolls to its slide. The
        // press target is the wrapper (DOT_HIT_SIZE) plus DOT_HIT_SLOP, not the
        // 8px dot, so the visual scale stays a dot while the touch target
        // clears the platform minimum.
        <View testID={`${testID}-dots`} style={styles.dots} accessibilityRole="tablist">
          {items.map((_, index) => (
            <Pressable
              key={index}
              testID={`${testID}-dot-${index}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: index === activeIndex }}
              // react-native-web (0.21) never maps accessibilityState to the
              // DOM — only the aria-* props reach createDOMProps — so without
              // this the web tree exposes five tabs with no selected one.
              // Native maps aria-selected back into accessibilityState, so the
              // two props agree rather than conflict.
              aria-selected={index === activeIndex}
              accessibilityLabel={`Slide ${index + 1} of ${count}`}
              hitSlop={DOT_HIT_SLOP}
              onPress={() => handleDotPress(index)}
              style={styles.dotButton}
            >
              <View
                testID={`${testID}-dot-${index}-indicator`}
                style={[styles.dot, index === activeIndex ? styles.dotActive : styles.dotInactive]}
              />
            </Pressable>
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

// Press target around each 8px dot. The square is what separates the dots
// visually (the row itself has no gap, so neighboring targets are flush — no
// dead strip between them), and `DOT_HIT_SLOP` extends it vertically to
// `spacing.touchTarget` (24 + 2 x 10 = 44). The slop is vertical-only on
// purpose: horizontal slop would overlap the neighboring dot's target and make
// which dot a tap lands on ambiguous.
const DOT_HIT_SIZE = 24;
const DOT_HIT_SLOP = {
  top: (spacing.touchTarget - DOT_HIT_SIZE) / 2,
  bottom: (spacing.touchTarget - DOT_HIT_SIZE) / 2,
  left: 0,
  right: 0,
};

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
      // No `gap`: the DOT_HIT_SIZE squares carry the visual spacing, and a gap
      // would open an unpressable strip between adjacent targets. marginTop
      // absorbs the wrapper's own vertical padding so the row sits where the
      // pre-Pressable dots did.
      marginTop: spacing.md - (DOT_HIT_SIZE - DOT_SIZE) / 2,
    },
    dotButton: {
      width: DOT_HIT_SIZE,
      height: DOT_HIT_SIZE,
      alignItems: "center",
      justifyContent: "center",
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
