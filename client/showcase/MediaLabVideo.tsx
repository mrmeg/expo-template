import React, { memo, useCallback, useMemo, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Badge } from "@mrmeg/expo-ui/components/Badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@mrmeg/expo-ui/components/Card";
import { Image } from "@mrmeg/expo-ui/components/Image";
import { IconButton } from "@mrmeg/expo-ui/components/IconButton";
import { StyledText } from "@mrmeg/expo-ui/components/StyledText";
import { LazyVideo } from "@/client/components/LazyVideo";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { palette, spacing } from "@mrmeg/expo-ui/constants";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

import type { SectionRendererProps, VideoControlsMode, VideoFit } from "./MediaLabScreen";
import type { MediaFixture } from "./mediaFixtures";

/**
 * The Video section of the Media Lab: every `kind: "video"` fixture through
 * `Video`, driven by the playground (controls, fit, autoplay and muted, loop,
 * poster, radius, max height). It fills `renderers.video` in `MediaLabScreen.tsx`.
 *
 * At most one player is mounted at a time. A tile is a frame with a play
 * glyph (and the poster, when the playground has it on) until it is tapped;
 * tapping another tile unmounts the first. Thirty fixtures therefore never
 * create thirty players, and a previous tile stops playing.
 *
 * Tiles draw at `aspectRatio="auto"`: the lab checks what the video reports,
 * not what the manifest says, and prints the frame it ended up with. The
 * width preset is already applied by the lab's stage wrapper, so nothing here
 * applies it again. Only types come from `MediaLabScreen`: a value import
 * would be a cycle, since the screen imports this file.
 */

const LANDSCAPE_POSTER = require("@/assets/media/landscape.jpg");
const PORTRAIT_POSTER = require("@/assets/media/portrait.jpg");

/** A fixture's own poster where the core set has one; the landscape frame stands in for the rest. */
const POSTERS: Record<string, number> = {
  "core-video-landscape": LANDSCAPE_POSTER,
  "core-video-portrait": PORTRAIT_POSTER,
};

/** A tile with no size in the manifest (streams, audio-only, broken files) is drawn 16:9 until it is loaded. */
const FALLBACK_RATIO = 16 / 9;
/** What the playground's "Max height" switch caps a frame at. */
const MAX_HEIGHT = 160;

/** Coded landscape, flagged to display portrait: the frame must be portrait, so the placeholder is too. */
const ROTATED = new Set(["vid-rotate-90"]);

function declaredRatio(fixture: MediaFixture): number {
  const { width, height } = fixture;
  if (!width || !height) return FALLBACK_RATIO;
  return ROTATED.has(fixture.id) ? height / width : width / height;
}

function formatLength(seconds: number): string {
  if (seconds < 60 && !Number.isInteger(seconds)) return `${seconds} s`;
  const whole = Math.round(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const ss = String(whole % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function describe(fixture: MediaFixture): string {
  const parts: string[] = [fixture.tier];
  if (fixture.expectError) parts.push("expects the error state");
  if (fixture.width && fixture.height) {
    parts.push(
      ROTATED.has(fixture.id)
        ? `${fixture.width}×${fixture.height} stored, must show ${fixture.height}×${fixture.width}`
        : `${fixture.width}×${fixture.height}`,
    );
  }
  if (fixture.durationSec !== undefined) parts.push(formatLength(fixture.durationSec));
  return parts.join(" · ");
}

interface PlayerOptions {
  controls: VideoControlsMode;
  fit: VideoFit;
  /** The playground's "Autoplay, muted" switch: both, from the first frame. */
  autoplayMuted: boolean;
  loop: boolean;
  poster: boolean;
  radius: "none" | "sm" | "md" | "lg";
  capped: boolean;
}

interface VideoTileProps extends PlayerOptions {
  fixture: MediaFixture;
  uri: string | number | null;
  active: boolean;
  onActivate: (id: string) => void;
}

/** One fixture: a placeholder until tapped, then a `Video` with the playground's options. */
const VideoTile = memo(function VideoTile({
  fixture,
  uri,
  active,
  onActivate,
  controls,
  fit,
  autoplayMuted,
  loop,
  poster,
  radius,
  capped,
}: VideoTileProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);

  const activate = useCallback(() => onActivate(fixture.id), [onActivate, fixture.id]);
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setFrame({ width: Math.round(width), height: Math.round(height) });
  }, []);

  const posterSource = poster ? (POSTERS[fixture.id] ?? LANDSCAPE_POSTER) : undefined;

  return (
    <View style={styles.tile} testID={`video-tile-${fixture.id}`}>
      <Card>
        <CardHeader>
          <CardTitle>{fixture.label}</CardTitle>
          <CardDescription>{describe(fixture)}</CardDescription>
        </CardHeader>
        <View style={styles.tileMedia}>
          {active && uri !== null ? (
            <View onLayout={handleLayout} testID={`video-active-${fixture.id}`}>
              {/* Keyed by the options a player only reads at creation, so changing one remounts it. */}
              <LazyVideo
                key={`${controls}:${autoplayMuted}:${loop}`}
                source={uri}
                controls={controls}
                fit={fit}
                aspectRatio="auto"
                maxHeight={capped ? MAX_HEIGHT : undefined}
                radius={radius}
                poster={posterSource}
                autoPlay={autoplayMuted}
                muted={autoplayMuted}
                loop={loop}
                title={fixture.label}
                testID={`video-${fixture.id}`}
              />
            </View>
          ) : (
            <View
              style={[styles.placeholder, { aspectRatio: declaredRatio(fixture) }, capped && { maxHeight: MAX_HEIGHT }]}
              testID={`video-placeholder-${fixture.id}`}
            >
              {posterSource !== undefined ? <Image source={posterSource} alt="" fill fit={fit} /> : null}
              <IconButton
                icon="play"
                preset="secondary"
                shape="circle"
                size="lg"
                accessibilityLabel={`Load ${fixture.label}`}
                onPress={activate}
                testID={`video-load-${fixture.id}`}
              />
            </View>
          )}
          <View style={styles.status}>
            {fixture.expectError ? <Badge variant="secondary" text="expects error" /> : null}
            <StyledText semantic="caption" style={styles.dim} testID={`video-frame-${fixture.id}`}>
              {active && frame
                ? `Frame ${frame.width}×${frame.height} (${frame.height > frame.width ? "portrait" : frame.height === frame.width ? "square" : "landscape"})`
                : fixture.note ?? "Tap to mount a player"}
            </StyledText>
          </View>
        </View>
      </Card>
    </View>
  );
});

/** The Video section's renderer: `renderers.video`. */
export function VideoSection({ entries, playground }: SectionRendererProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const [activeId, setActiveId] = useState<string | null>(null);

  const options = useMemo<PlayerOptions>(
    () => ({
      controls: playground.videoControls,
      fit: playground.videoFit,
      autoplayMuted: playground.autoplayMuted,
      loop: playground.loop,
      poster: playground.poster,
      radius: playground.radius,
      capped: playground.maxHeight,
    }),
    [
      playground.videoControls,
      playground.videoFit,
      playground.autoplayMuted,
      playground.loop,
      playground.poster,
      playground.radius,
      playground.maxHeight,
    ],
  );

  return (
    <View style={styles.section} testID="video-section">
      <View style={styles.gutter}>
        <StyledText semantic="caption" style={styles.dim}>
          One player at a time: tap a tile to mount it. Tiles draw at aspectRatio="auto", so the frame shows what the video reported.
        </StyledText>
      </View>

      {entries.length === 0 ? (
        <View style={styles.gutter}>
          <StyledText semantic="caption" style={styles.dim} testID="video-empty">
            No video fixtures to render. Run `bun run media:fixtures` for the generated set.
          </StyledText>
        </View>
      ) : (
        <View style={styles.grid} testID="video-grid">
          {entries.map((entry) => (
            <VideoTile
              key={entry.fixture.id}
              fixture={entry.fixture}
              uri={entry.uri}
              active={activeId === entry.fixture.id}
              onActivate={setActiveId}
              {...options}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    section: {
      gap: spacing.md,
    },
    gutter: {
      paddingHorizontal: spacing.screenPadding,
      gap: spacing.xs,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
      paddingHorizontal: spacing.screenPadding,
    },
    // Tiles share a row until they would fall under a readable width, then wrap.
    tile: {
      flexGrow: 1,
      flexBasis: 280,
      minWidth: 0,
      maxWidth: 520,
    },
    tileMedia: {
      paddingHorizontal: spacing.cardPadding,
      paddingBottom: spacing.cardPadding,
      gap: spacing.xs,
    },
    placeholder: {
      width: "100%",
      alignSelf: "center",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      borderRadius: spacing.radiusMd,
      backgroundColor: palette.black,
    },
    status: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    dim: {
      color: theme.colors.textDim,
    },
  });

const themedStyles = createThemedStyles(createStyles);
