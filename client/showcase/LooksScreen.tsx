import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@mrmeg/expo-ui/components/Item";
import { SegmentedControl } from "@mrmeg/expo-ui/components/SegmentedControl";
import { spacing } from "@mrmeg/expo-ui/constants";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { applyLook, refinedLook, useThemeStore, type Look } from "@mrmeg/expo-ui/state";

import { DEMO_LOOKS, type DemoLook } from "./looks";
import { LookDisplayContext, type SampleScreen } from "./looks/context";
import { HomeSample } from "./looks/HomeSample";
import { loadLookFonts } from "./looks/loadLookFonts";
import { FRAME_WIDTH } from "./looks/parts";
import { SettingsSample } from "./looks/SettingsSample";

/**
 * Looks
 *
 * Pick one of five looks and see two real app screens (Home and Settings),
 * built from `@mrmeg/expo-ui` components, rendered in it, in light and dark.
 * A look is `applyLook(look)`: the same override slots an app would set by hand.
 * The selection is in memory only: on mount the app keeps whatever look it has
 * (the package default, Refined), and leaving restores it, the way the Themed
 * Showcase restores its palette.
 */

/** Side by side from here up; a segmented control below it. */
const WIDE_BREAKPOINT = 900;
const COLUMN_MAX_WIDTH = 640;
const SAMPLE_MAX_WIDTH = 480;

const SCREENS: SampleScreen[] = ["home", "settings"];
const SCREEN_LABELS: Record<SampleScreen, string> = { home: "Home", settings: "Settings" };
const SCHEMES = ["Light", "Dark"];

export default function LooksScreen() {
  const { theme, scheme, setTheme } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;

  const [selectedId, setSelectedId] = useState(refinedLook.id);
  const [loading, setLoading] = useState(false);
  const [screen, setScreen] = useState<SampleScreen>("home");

  // What RootLayout set, restored on unmount: `applyLook` never resets the serif.
  const initialSerif = useRef(useThemeStore.getState().serifPreset);
  const mounted = useRef(true);
  const busy = useRef(false);

  const restore = useCallback(() => {
    applyLook(refinedLook);
    useThemeStore.getState().setSerifPreset(initialSerif.current);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      restore();
    };
  }, [restore]);

  const select = useCallback(
    async (demo: DemoLook) => {
      if (busy.current) return;
      busy.current = true;
      setLoading(true);
      try {
        await loadLookFonts(demo);
      } catch {
        // A font that fails to load (offline, blocked) falls back; the look still applies.
      } finally {
        busy.current = false;
        if (mounted.current) {
          // Newsreader is only registered when the root layout loaded it.
          const look: Look =
            demo.look.serif && initialSerif.current !== demo.look.serif ? { ...demo.look, serif: undefined } : demo.look;
          applyLook(look);
          setSelectedId(demo.look.id);
          setLoading(false);
        } else {
          // The screen went away mid-load, and a native preset switch lands after its await.
          restore();
        }
      }
    },
    [restore],
  );

  const selected = DEMO_LOOKS.find((demo) => demo.look.id === selectedId) ?? DEMO_LOOKS[0];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surfaceSunken }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <ItemGroup title="Look">
            {DEMO_LOOKS.map((demo) => {
              const on = demo.look.id === selectedId;
              return (
                <Item
                  key={demo.look.id}
                  onPress={() => select(demo)}
                  disabled={loading}
                  accessibilityLabel={`${demo.look.name}, ${demo.look.description ?? ""}`}
                  testID={`look-${demo.look.id}`}
                >
                  <ItemContent>
                    <ItemTitle>{demo.look.name}</ItemTitle>
                    {!!demo.look.description && <ItemDescription>{demo.look.description}</ItemDescription>}
                  </ItemContent>
                  <ItemActions>{on && <Icon name="check" size={20} color="foreground" decorative />}</ItemActions>
                </Item>
              );
            })}
          </ItemGroup>

          <View style={styles.gutter}>
            <SegmentedControl
              values={SCHEMES}
              value={scheme === "dark" ? "Dark" : "Light"}
              onValueChange={(value) => setTheme(value === "Dark" ? "dark" : "light")}
            />
          </View>

          {!wide && (
            <View style={styles.gutter}>
              <SegmentedControl
                values={SCREENS.map((key) => SCREEN_LABELS[key])}
                value={SCREEN_LABELS[screen]}
                onValueChange={(value) => setScreen(value === "Settings" ? "settings" : "home")}
              />
            </View>
          )}
        </View>

        <LookDisplayContext.Provider value={selected.display}>
          {wide ? (
            <View style={styles.pair}>
              <View style={styles.framed}>
                <HomeSample framed />
              </View>
              <View style={styles.framed}>
                <SettingsSample framed />
              </View>
            </View>
          ) : (
            <View style={styles.sample}>
              {screen === "home" ? (
                <HomeSample framed={false} onNavigate={setScreen} />
              ) : (
                <SettingsSample framed={false} onNavigate={setScreen} />
              )}
            </View>
          )}
        </LookDisplayContext.Provider>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingVertical: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sectionSpacing },
  // The picker's rows carry the 16 pt inset; the controls pad their own wrapper.
  column: { width: "100%", maxWidth: COLUMN_MAX_WIDTH, alignSelf: "center", gap: spacing.sectionSpacing },
  gutter: { paddingHorizontal: spacing.screenPadding },
  sample: { width: "100%", maxWidth: SAMPLE_MAX_WIDTH, alignSelf: "center" },
  pair: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.xl },
  framed: { width: FRAME_WIDTH },
});
