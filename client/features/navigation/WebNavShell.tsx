import React, { useState, type PropsWithChildren } from "react";
import { Pressable, View } from "react-native";
import { usePathname } from "expo-router";
import { Drawer } from "@mrmeg/expo-ui/components/Drawer";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import { useDimensions, useTheme } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import { spacing, type Theme } from "@mrmeg/expo-ui/constants";

import { DrawerNavContent } from "@/client/features/navigation/DrawerNavContent";
import {
  detectNavRailCollapsedFromRequestScope,
  navRailCookieString,
  parseNavRailCollapsedCookie,
} from "@/shared/ssrNavRail";

/**
 * Web navigation shell (mockups/01–04 + 05-mobile.html frame 5).
 *
 * Above the breakpoint it docks the library `Drawer` as a persistent left
 * rail beside the content pane; below it, a slim top bar (hamburger +
 * wordmark) opens the same drawer as the animated overlay with a scrim.
 * Native never renders this component — the surface mapping is
 * native app = tabs, mobile web = overlay, desktop web = rail
 * (mockups/05-mobile.html "Surfaces").
 *
 * Breakpoint: `useDimensions().isLargeScreen` (width > SCREEN_SIZES.MEDIUM =
 * 1000 — the closest existing token to the 900px mockup; the spec forbids a
 * new constant). `useDimensions` is SSR-aware, so the server and the first
 * client render pick the same mode and hydration doesn't flash between them.
 *
 * The rail starts open and its header carries a sidebar toggle. Collapsing it
 * swaps in the same slim top bar the overlay mode uses, whose toggle docks the
 * rail again. The choice persists in a cookie (`shared/ssrNavRail.ts`) so the
 * server renders the remembered state on the next load.
 */

/** Rail width per the mockups' 248px drawer column. */
export const WEB_NAV_RAIL_WIDTH = 248;

function Wordmark() {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  return (
    <View style={styles.wordmark}>
      <View style={styles.wordmarkDot} />
      <SansSerifBoldText size="base" style={styles.wordmarkText}>@mrmeg/expo-ui</SansSerifBoldText>
    </View>
  );
}

/**
 * First-render value on both sides: the server reads the request's cookie, the
 * browser reads `document.cookie` — the same bytes, so hydration matches.
 */
function readNavRailCollapsed(): boolean {
  if (typeof document !== "undefined") return parseNavRailCollapsedCookie(document.cookie);
  return detectNavRailCollapsedFromRequestScope();
}

function TopBar({
  onOpen,
  icon,
  accessibilityLabel,
  testID,
}: {
  onOpen: () => void;
  icon: "menu" | "panel-left";
  accessibilityLabel: string;
  testID: string;
}) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  return (
    <View style={styles.topbar}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={styles.menuButton}
      >
        <Icon name={icon} size={18} color={theme.colors.text} />
      </Pressable>
      <Wordmark />
    </View>
  );
}

export function WebNavShell({ children }: PropsWithChildren) {
  const { isLargeScreen } = useDimensions();
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(readNavRailCollapsed);

  const setRailCollapsedPersisted = (collapsed: boolean) => {
    setRailCollapsed(collapsed);
    if (typeof document !== "undefined") document.cookie = navRailCookieString(collapsed);
  };

  // Close the overlay when the route changes: items call `onNavigate`, but
  // this also covers browser back/forward while the drawer is open. Adjusted
  // during render (React's "reset state when a prop changes" pattern) instead
  // of in an effect, which also keeps the new route from painting once with
  // the drawer still open.
  const [drawerPathname, setDrawerPathname] = useState(pathname);
  if (drawerPathname !== pathname) {
    setDrawerPathname(pathname);
    setDrawerOpen(false);
  }

  if (isLargeScreen && railCollapsed) {
    return (
      <View style={styles.overlayRoot} testID="web-nav-shell-collapsed">
        <TopBar
          onOpen={() => setRailCollapsedPersisted(false)}
          icon="panel-left"
          accessibilityLabel="Open sidebar"
          testID="web-nav-rail-open"
        />
        <View style={styles.pane}>{children}</View>
      </View>
    );
  }

  if (isLargeScreen) {
    return (
      <View style={styles.railRow} testID="web-nav-shell-rail">
        {/* The rail is pinned expanded: the mockups' desktop drawer is a
            permanent 248px sidebar, not an icon strip, so hover-expand and
            collapse are switched off (collapsed width = expanded width means
            even a stray `expanded` flip can't change layout). */}
        <Drawer
          variant="rail"
          side="left"
          expanded
          expandOnHover={false}
          collapsedWidth={WEB_NAV_RAIL_WIDTH}
          expandedWidth={WEB_NAV_RAIL_WIDTH}
        >
          <Drawer.Content testID="web-nav-rail">
            <DrawerNavContent
              onToggleSidebar={() => setRailCollapsedPersisted(true)}
              toggleSidebarLabel="Close sidebar"
            />
          </Drawer.Content>
        </Drawer>
        <View style={styles.pane}>{children}</View>
      </View>
    );
  }

  return (
    <View style={styles.overlayRoot} testID="web-nav-shell-overlay">
      <TopBar
        onOpen={() => setDrawerOpen(true)}
        icon="menu"
        accessibilityLabel="Open navigation"
        testID="web-nav-menu-button"
      />
      <View style={styles.pane}>{children}</View>
      <Drawer
        variant="overlay"
        side="left"
        width={WEB_NAV_RAIL_WIDTH}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      >
        <Drawer.Content style={styles.overlayContent} testID="web-nav-overlay">
          <DrawerNavContent
            onNavigate={() => setDrawerOpen(false)}
            onToggleSidebar={() => setDrawerOpen(false)}
            toggleSidebarLabel="Close navigation"
          />
        </Drawer.Content>
      </Drawer>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  ({
    railRow: {
      flex: 1,
      flexDirection: "row",
      backgroundColor: theme.colors.background,
    },
    overlayRoot: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    pane: {
      flex: 1,
      minWidth: 0,
    },
    topbar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    menuButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: spacing.radiusSm,
    },
    wordmark: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    wordmarkDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.accent,
    },
    wordmarkText: {
      color: theme.colors.text,
    },
    overlayContent: {
      padding: 0,
    },
  }) as const;

const themedStyles = createThemedStyles(createStyles);
