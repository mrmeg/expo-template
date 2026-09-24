import { AnimatedView } from "./AnimatedView";
import { TextClassContext, TextColorContext } from "./StyledText.context";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../constants/spacing";
import { useScalePress } from "../hooks/useScalePress";
import { resolvePopoverPlacement } from "../lib/popoverPlacement";
import * as PopoverPrimitive from "@rn-primitives/popover";
import * as React from "react";
import {
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewProps,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay as RNFullWindowOverlay } from "react-native-screens";
import { palette } from "../constants/colors";

/**
 * Popover Trigger Component
 * The element that triggers the popover to open/close. Its ref exposes
 * `open()` / `close()` for driving the popover from outside.
 */
type PopoverTriggerProps = PopoverPrimitive.TriggerProps &
  React.RefAttributes<PopoverPrimitive.TriggerRef>;

/** What a `PopoverTrigger` ref holds: the pressable plus `open()` / `close()`. */
type PopoverTriggerRef = PopoverPrimitive.TriggerRef;

function PopoverTrigger({ disabled, ...props }: PopoverTriggerProps) {
  const { animatedStyle: scaleStyle, pressHandlers } = useScalePress({
    disabled: !!disabled,
    scaleTo: 0.97,
    haptic: false,
  });

  return (
    <Animated.View style={scaleStyle}>
      <PopoverPrimitive.Trigger
        disabled={disabled}
        {...props}
        onPressIn={pressHandlers.onPressIn}
        onPressOut={pressHandlers.onPressOut}
      />
    </Animated.View>
  );
}

/**
 * FullWindowOverlay wrapper - uses native overlay on iOS for proper z-index handling
 * On Android/Web, uses Fragment to avoid unnecessary nesting
 */
const FullWindowOverlay = Platform.OS === "ios" ? RNFullWindowOverlay : React.Fragment;

interface PopoverContentProps extends PopoverPrimitive.ContentProps {
  /**
   * Optional portal host name for custom portal mounting
   */
  portalHost?: string;
  /**
   * Scroll the children once they outgrow the room on the popover's side
   * (default). Pass `false` for content that brings its own list: a `FlatList`
   * inside a vertical ScrollView warns. The height cap still applies, but the
   * popover can no longer measure its full height, so it stays on `side`.
   */
  scrollable?: boolean;
}

/**
 * Radix measures the viewport room on web and exposes it on the content
 * element; the primitive's web Content applies no size cap of its own.
 */
const WEB_PLACEMENT_STYLE = {
  maxWidth: "var(--radix-popover-content-available-width)",
  maxHeight: "var(--radix-popover-content-available-height)",
} as unknown as ViewStyle;

const claimNoTouch = () => false;

/**
 * Popover Content Component
 * The content that appears in the popover overlay. `side` is a preference: on
 * native the popover opens on the other side when the content does not fit
 * and there is more room there, caps its height to the room, and scrolls.
 * A `style` merges over the themed surface; `insets` default to the safe area.
 */
function PopoverContent({
  portalHost,
  insets,
  ...props
}: PopoverContentProps) {
  const { theme, getContrastingColor } = useTheme();
  const safeAreaInsets = useSafeAreaInsets();

  // Calculate text color for popover content based on background
  const textColor = getContrastingColor(
    theme.colors.popover,
    palette.white,
    palette.black
  );

  const card = (
    /*
      The primitive Content is `position: absolute` against the screen, so an
      unsized fade wrapper lays out at zero size and the card sits outside its
      parent's bounds. Android dispatches ACTION_DOWN and accessibility only to
      children inside their parent's bounds, so native controls (a `Switch`)
      inside the popover ignored taps and the content was missing from the
      accessibility tree. Fill the overlay; `box-none` keeps tap-away working.
      Not collapsable: the fade is native-driven, and without this the wrapper
      sometimes stayed at opacity 0 on iOS once the card relaid out (a flip or
      a new cap), leaving an invisible popover.
    */
    <AnimatedView
      type="fade"
      enterDuration={200}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      collapsable={false}
    >
      <TextColorContext.Provider value={textColor}>
        <TextClassContext.Provider value="">
          <PopoverCard insets={insets ?? safeAreaInsets} {...props} />
        </TextClassContext.Provider>
      </TextColorContext.Provider>
    </AnimatedView>
  );

  return (
    <PopoverPrimitive.Portal hostName={portalHost}>
      <FullWindowOverlay>
        {Platform.OS === "web" ? (
          // Radix dismisses outside presses on web; the Overlay is inert there.
          <PopoverPrimitive.Overlay>{card}</PopoverPrimitive.Overlay>
        ) : (
          /*
            Native: the Overlay sits behind the card instead of around it. Around
            it, the Content had to claim the JS responder so presses inside did
            not reach the Overlay and close the popover, and iOS will not drag a
            ScrollView while an ancestor is the JS responder
            (RCTScrollViewComponentView _shouldDisableScrollInteraction), so
            nothing inside the popover could scroll.
          */
          <>
            <PopoverPrimitive.Overlay style={StyleSheet.absoluteFill} />
            {card}
          </>
        )}
      </FullWindowOverlay>
    </PopoverPrimitive.Portal>
  );
}

type PopoverCardProps = Omit<PopoverContentProps, "portalHost">;

/**
 * The positioned card. Rendered inside the portal, so it mounts on open and
 * its measurements start fresh every time.
 */
function PopoverCard({
  side,
  align = "center",
  sideOffset = 4,
  insets,
  avoidCollisions = true,
  scrollable = true,
  style,
  children,
  testID,
  ...props
}: PopoverCardProps) {
  const { theme, getShadowStyle } = useTheme();
  const { triggerPosition, contentLayout } = PopoverPrimitive.useRootContext();
  const [scrollFrameHeight, setScrollFrameHeight] = React.useState<number>();
  const [scrollContentHeight, setScrollContentHeight] = React.useState<number>();

  const isWeb = Platform.OS === "web";
  const wrapsInScroll = scrollable && !props.asChild;
  // The card's own chrome (padding, border) plus the uncapped scroll content.
  const naturalHeight =
    wrapsInScroll &&
    contentLayout &&
    scrollFrameHeight !== undefined &&
    scrollContentHeight !== undefined
      ? contentLayout.height - scrollFrameHeight + scrollContentHeight
      : undefined;

  let placementSide = side;
  let placementStyle: ViewStyle = WEB_PLACEMENT_STYLE;
  if (!isWeb) {
    const placement = resolvePopoverPlacement({
      side,
      sideOffset,
      trigger: triggerPosition ?? null,
      screenHeight: Dimensions.get("screen").height,
      insets: insets ?? {},
      naturalHeight,
      avoidCollisions,
    });
    placementSide = placement.side;
    // Hide the first measured frame while it may still flip. The key is
    // omitted otherwise, so the primitive's hidden-until-measured style holds.
    const mayStillFlip =
      wrapsInScroll && avoidCollisions && !!triggerPosition && naturalHeight === undefined;
    placementStyle = {
      ...(placement.maxHeight !== undefined ? { maxHeight: placement.maxHeight } : null),
      ...(mayStillFlip ? { opacity: 0 } : null),
    };
  }

  const contentStyle = StyleSheet.flatten([
    {
      backgroundColor: theme.colors.popover,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: spacing.radiusMd,
      padding: spacing.xs,
      ...getShadowStyle("soft"),
    },
    placementStyle,
    style,
  ]) ?? undefined;

  return (
    <PopoverPrimitive.Content
      side={placementSide}
      align={align}
      sideOffset={sideOffset}
      insets={insets}
      avoidCollisions={avoidCollisions}
      testID={testID}
      // The Overlay no longer wraps the card on native, so the card need not
      // claim presses; claiming them is what stopped inner ScrollViews on iOS.
      {...(isWeb ? null : { onStartShouldSetResponder: claimNoTouch })}
      {...props}
      style={contentStyle}
    >
      {wrapsInScroll ? (
        <ScrollView
          testID={testID ? `${testID}-scroll` : undefined}
          alwaysBounceVertical={false}
          keyboardShouldPersistTaps="handled"
          onLayout={(event) => setScrollFrameHeight(event.nativeEvent.layout.height)}
          onContentSizeChange={(_width, height) => setScrollContentHeight(height)}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </PopoverPrimitive.Content>
  );
}

/**
 * Popover Header Component
 * Optional header section for the popover content
 */
interface PopoverHeaderProps extends ViewProps {
  children: React.ReactNode;
}

function PopoverHeader({ children, style, ...props }: PopoverHeaderProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          paddingHorizontal: spacing.xs,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

/**
 * Popover Body Component
 * Main content area of the popover
 */
interface PopoverBodyProps extends ViewProps {
  children: React.ReactNode;
}

function PopoverBody({ children, style, ...props }: PopoverBodyProps) {
  return (
    <View
      style={[
        {
          paddingHorizontal: spacing.xs,
          paddingVertical: spacing.sm,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

/**
 * Popover Footer Component
 * Optional footer section for the popover content
 */
interface PopoverFooterProps extends ViewProps {
  children: React.ReactNode;
}

function PopoverFooter({ children, style, ...props }: PopoverFooterProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          paddingHorizontal: spacing.xs,
          paddingVertical: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

/**
 * Popover Root Component
 * Manages popover state and provides context for trigger and content
 */
const PopoverRoot: typeof PopoverPrimitive.Root = PopoverPrimitive.Root;

type PopoverComponent = typeof PopoverRoot & {
  Trigger: typeof PopoverTrigger;
  Content: typeof PopoverContent;
  Header: typeof PopoverHeader;
  Body: typeof PopoverBody;
  Footer: typeof PopoverFooter;
};

/**
 * Popover Component with Sub-components
 * Properly typed interface for dot notation access (e.g., Popover.Trigger).
 * The annotation is what keeps declaration emit portable — see Dialog.tsx (TS2883).
 */
const Popover: PopoverComponent = Object.assign(PopoverRoot, {
  Trigger: PopoverTrigger,
  Content: PopoverContent,
  Header: PopoverHeader,
  Body: PopoverBody,
  Footer: PopoverFooter,
});

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverFooter,
};
export type { PopoverTriggerRef };
