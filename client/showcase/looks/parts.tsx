/* eslint-disable expo-ui/no-restyle -- tracking and case on text are the look-specific type the package cannot express (DemoDisplay); the demo applies them to the kit text it composes */
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent, type TextStyle, type ViewStyle } from "react-native";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Card } from "@mrmeg/expo-ui/components/Card";
import { Icon, type IconName } from "@mrmeg/expo-ui/components/Icon";
import { CaptionText, EyebrowText, StyledText, type FontSize } from "@mrmeg/expo-ui/components/StyledText";
import { spacing } from "@mrmeg/expo-ui/constants";
import { shapeRadius, useShape, useTheme } from "@mrmeg/expo-ui/hooks";

import { useLookDisplay, type SampleScreen } from "./context";

/** Pixel size of the kit's type steps the demo titles use (for em tracking). */
const STEP_PX: Partial<Record<FontSize, number>> = { xl: 22, xxl: 28, display: 34 };

/** The phone-sized preview frame (a device frame, not a layout box). */
export const FRAME_WIDTH = 390;
export const FRAME_HEIGHT = 844;
const FRAME_RADIUS = 28;
const GRID_CELL = 24;
const CORNER = 14;
const CORNER_INSET = 10;

/** Style keys React Native Web passes through to CSS that RN's types do not know. */
function webOnly(style: Record<string, string>): ViewStyle & TextStyle {
  return (Platform.OS === "web" ? style : {}) as ViewStyle & TextStyle;
}

function useBlur(): ViewStyle {
  const { glass } = useLookDisplay();
  return glass ? webOnly({ backdropFilter: glass.backdropFilter }) : {};
}

type OrbLayout = SampleScreen;
const ORBS: Record<OrbLayout, { size: number; left?: number; right?: number; top: number }[]> = {
  home: [
    { size: 300, right: -110, top: 96 },
    { size: 190, left: -70, top: 300 },
  ],
  settings: [
    { size: 260, left: -90, top: 60 },
    { size: 200, right: -80, top: 470 },
  ],
};

/**
 * One sample screen's canvas: the background plus the look's chrome (Strand's
 * grid and HUD corners, Glass's soft shapes). `framed` makes it a fixed
 * 390 x 844 phone frame; otherwise it fills its parent and grows with content.
 */
export function SampleFrame({
  screen,
  framed,
  children,
}: {
  screen: SampleScreen;
  framed: boolean;
  children: React.ReactNode;
}) {
  const { theme, scheme } = useTheme();
  const display = useLookDisplay();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) =>
    setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height });

  const gridLine = display.gridLine?.[scheme];
  const orbs = display.orbs?.[scheme];
  const columns = Math.ceil(size.width / GRID_CELL);
  const rows = Math.ceil(size.height / GRID_CELL);

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.frame,
        { backgroundColor: theme.colors.background },
        framed && {
          width: FRAME_WIDTH,
          height: FRAME_HEIGHT,
          borderRadius: FRAME_RADIUS,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.borderStrong,
        },
      ]}
    >
      {gridLine &&
        Array.from({ length: columns }, (_, i) => (
          <View key={`c${i}`} style={[styles.gridV, { left: i * GRID_CELL, backgroundColor: gridLine }]} />
        ))}
      {gridLine &&
        Array.from({ length: rows }, (_, i) => (
          <View key={`r${i}`} style={[styles.gridH, { top: i * GRID_CELL, backgroundColor: gridLine }]} />
        ))}
      {orbs &&
        ORBS[screen].map((orb, i) => (
          <View
            key={i}
            style={{
              pointerEvents: "none",
              position: "absolute",
              width: orb.size,
              height: orb.size,
              borderRadius: spacing.radiusFull,
              left: orb.left,
              right: orb.right,
              top: orb.top,
              backgroundColor: orbs[i],
            }}
          />
        ))}
      {display.chrome === "hud" && <HudCorners color={theme.colors.borderStrong} />}
      {children}
    </View>
  );
}

function HudCorners({ color }: { color: string }) {
  const corner = { position: "absolute", pointerEvents: "none", width: CORNER, height: CORNER, borderColor: color } as const;
  return (
    <>
      <View style={[corner, { left: CORNER_INSET, top: CORNER_INSET, borderLeftWidth: 1, borderTopWidth: 1 }]} />
      <View style={[corner, { right: CORNER_INSET, top: CORNER_INSET, borderRightWidth: 1, borderTopWidth: 1 }]} />
      <View style={[corner, { left: CORNER_INSET, bottom: CORNER_INSET, borderLeftWidth: 1, borderBottomWidth: 1 }]} />
      <View style={[corner, { right: CORNER_INSET, bottom: CORNER_INSET, borderRightWidth: 1, borderBottomWidth: 1 }]} />
    </>
  );
}

/** "01 / " in the accent color, Strand's HUD prefix; nothing in the other looks. */
function HudPrefix({ n }: { n: number }) {
  const { theme } = useTheme();
  const display = useLookDisplay();
  if (display.chrome !== "hud") return null;
  return (
    <StyledText size="sm" variant="mono" fontWeight="medium" style={{ color: theme.colors.accent }}>
      {String(n).padStart(2, "0")} /{" "}
    </StyledText>
  );
}

/** A section eyebrow in the look's label face, with the HUD number where the look has one. */
export function SectionLabel({ n, children }: { n: number; children: string }) {
  const { theme } = useTheme();
  const { labelVariant } = useLookDisplay();
  return (
    <EyebrowText variant={labelVariant} style={{ color: theme.colors.textDim }} accessibilityRole="header">
      <HudPrefix n={n} />
      {children}
    </EyebrowText>
  );
}

/** The screen's eyebrow + large title, with an optional trailing slot. */
export function ScreenHeader({
  n,
  eyebrow,
  title,
  trailing,
}: {
  n: number;
  eyebrow: string;
  title: string;
  trailing?: React.ReactNode;
}) {
  const { title: t } = useLookDisplay();
  const px = STEP_PX[t.size] ?? 28;
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <SectionLabel n={n}>{eyebrow}</SectionLabel>
        <StyledText
          size={t.size}
          fontWeight={t.weight}
          variant={t.variant}
          accessibilityRole="header"
          style={[
            { letterSpacing: t.tracking * px },
            t.uppercase && { textTransform: "uppercase" },
            t.wide && webOnly({ fontStretch: "125%" }),
          ]}
        >
          {title}
        </StyledText>
      </View>
      {trailing}
    </View>
  );
}

/**
 * Glass's translucent panel around a group of rows: the `card` fill, a light
 * edge, and (web) the backdrop blur. Other looks leave rows flat.
 */
export function ListPanel({ children }: { children: React.ReactNode }) {
  const { theme, scheme } = useTheme();
  const display = useLookDisplay();
  const radius = shapeRadius(useShape("card"))?.borderRadius ?? spacing.radiusLg;
  const blur = useBlur();
  if (!display.glass) return <>{children}</>;
  return (
    <View
      style={[
        {
          marginHorizontal: spacing.screenPadding,
          paddingVertical: spacing.xs,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: display.glass.panelBorder[scheme],
          backgroundColor: theme.colors.card,
          overflow: "hidden",
        },
        blur,
      ]}
    >
      {children}
    </View>
  );
}

/** Backdrop blur for a kit `Card` in the Glass look (empty elsewhere and off web). */
export function useCardBlur(): ViewStyle {
  return useBlur();
}

/**
 * A button whose label follows the look: the kit's own `text` unless the look
 * sets labels in a different face (Strand: tracked uppercase mono), in which
 * case the label is a `StyledText` child, which the button colors and sizes.
 */
export function ActionButton({
  text,
  preset,
  color,
  onPress,
  size = "md",
  fullWidth,
}: {
  text: string;
  preset?: "default" | "outline" | "ghost";
  color?: string;
  onPress?: () => void;
  size?: "sm" | "md";
  fullWidth?: boolean;
}) {
  const { labelVariant, tabLabels } = useLookDisplay();
  if (!labelVariant && !color) {
    return <Button preset={preset} size={size} fullWidth={fullWidth} text={text} onPress={onPress} />;
  }
  return (
    <Button preset={preset} size={size} fullWidth={fullWidth} onPress={onPress}>
      <StyledText
        selectable={false}
        size={size === "sm" ? "base" : "body"}
        fontWeight="medium"
        variant={labelVariant}
        style={[color ? { color } : undefined, tabLabels && styles.upperTracked]}
      >
        {text}
      </StyledText>
    </Button>
  );
}

/** A metric tile for looks that set figures in their own face (the kit's `StatCard` otherwise). */
export function StatTile({
  label,
  value,
  unit,
  change,
}: {
  label: string;
  value: string;
  unit?: string;
  change: { value: string; direction: "up" | "down" };
}) {
  const { theme } = useTheme();
  const display = useLookDisplay();
  const figure = display.figure;
  const tone = change.direction === "up" ? theme.colors.success : theme.colors.destructive;
  const px = (figure && STEP_PX[figure.size]) ?? 28;
  return (
    <Card>
      <View style={styles.tile}>
        {display.chrome === "hud" && <View style={[styles.hudDot, { backgroundColor: theme.colors.accent }]} />}
        <CaptionText
          selectable={false}
          variant={display.labelVariant}
          style={[{ color: theme.colors.textDim, letterSpacing: 0.96 }, styles.upper]}
        >
          {label}
        </CaptionText>
        <View style={styles.figureRow}>
          <StyledText
            selectable={false}
            size={figure?.size ?? "xxl"}
            fontWeight={figure?.weight ?? "bold"}
            variant={figure?.variant}
            style={{ color: theme.colors.foreground, fontVariant: ["tabular-nums"], letterSpacing: (figure?.tracking ?? 0) * px }}
          >
            {value}
          </StyledText>
          {!!unit && (
            <StyledText selectable={false} size="base" style={[styles.unit, { color: theme.colors.textDim }]}>
              {unit}
            </StyledText>
          )}
        </View>
        <View style={styles.changeRow}>
          <Icon
            name={change.direction === "up" ? "trending-up" : "trending-down"}
            size={spacing.iconSm}
            color={tone}
            decorative
          />
          <StyledText selectable={false} size="sm" style={{ color: tone }}>
            {change.value}
          </StyledText>
        </View>
      </View>
    </Card>
  );
}

const TABS: { key: string; label: string; icon: IconName; screen?: SampleScreen }[] = [
  { key: "explore", label: "Explore", icon: "compass", screen: "home" },
  { key: "library", label: "Library", icon: "image" },
  { key: "profile", label: "Profile", icon: "user" },
  { key: "settings", label: "Settings", icon: "settings", screen: "settings" },
];

/**
 * A mock bottom tab bar (not the app's real one): Glass floats it as a capsule,
 * Strand marks the active tab with an accent bar, the others with a dot or
 * nothing. Pressing a tab moves the highlight; Explore and Settings also switch
 * the sample when the host passes `onNavigate`.
 */
export function MockTabBar({
  active,
  onNavigate,
}: {
  active: SampleScreen;
  onNavigate?: (screen: SampleScreen) => void;
}) {
  const { theme, scheme } = useTheme();
  const display = useLookDisplay();
  const blur = useBlur();
  const [selected, setSelected] = useState(active === "home" ? "explore" : "settings");
  const glass = display.glass;
  const floating = display.chrome === "glass";

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.tabBar,
        floating
          ? {
            marginHorizontal: spacing.screenPadding,
            marginBottom: spacing.lg,
            borderRadius: spacing.radiusFull,
            borderWidth: 1,
            borderColor: glass?.panelBorder[scheme],
            backgroundColor: glass?.tabBar[scheme],
          }
          : { borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.background },
        blur,
      ]}
    >
      {TABS.map((tab) => {
        const on = tab.key === selected;
        const color = on ? theme.colors.foreground : theme.colors.textDim;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tab.label}
            onPress={() => {
              setSelected(tab.key);
              if (tab.screen) onNavigate?.(tab.screen);
            }}
            style={styles.tab}
          >
            {on && display.chrome === "hud" && <View style={[styles.hudBar, { backgroundColor: theme.colors.accent }]} />}
            <Icon name={tab.icon} size={spacing.iconMd} color={color} decorative />
            <StyledText
              selectable={false}
              size="xs"
              variant={display.labelVariant}
              fontWeight={on ? "semibold" : "medium"}
              style={[{ color }, display.tabLabels && styles.upperTracked]}
            >
              {tab.label}
            </StyledText>
            {on && display.tabDot && <View style={[styles.tabDot, { backgroundColor: theme.colors.accent }]} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", overflow: "hidden" },
  gridV: { position: "absolute", pointerEvents: "none", top: 0, bottom: 0, width: 1 },
  gridH: { position: "absolute", pointerEvents: "none", left: 0, right: 0, height: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
  },
  headerText: { flex: 1, gap: spacing.xs },
  upper: { textTransform: "uppercase" },
  upperTracked: { textTransform: "uppercase", letterSpacing: 1.2 },
  tile: { padding: spacing.cardPadding, gap: spacing.xs },
  hudDot: { position: "absolute", top: 10, right: 10, width: 6, height: 6 },
  figureRow: { flexDirection: "row", alignItems: "flex-end" },
  unit: { marginLeft: spacing.xxs, marginBottom: spacing.xxs },
  changeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xxs },
  tabBar: { flexDirection: "row", paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  tab: { flex: 1, alignItems: "center", gap: spacing.xs, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  tabDot: { position: "absolute", bottom: 0, width: 4, height: 4, borderRadius: spacing.radiusFull },
  hudBar: { position: "absolute", top: -spacing.sm - 1, left: 10, right: 10, height: 2 },
});
