import React, { memo, useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AudioPlayer } from "@mrmeg/expo-ui/components/AudioPlayer";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@mrmeg/expo-ui/components/Card";
import { StyledText } from "@mrmeg/expo-ui/components/StyledText";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { createThemedStyles, formatMediaTime } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

import type { AudioVariant, SectionRendererProps } from "./MediaLabScreen";
import type { MediaFixture } from "./mediaFixtures";

/**
 * The Audio section of the Media Lab: every `kind: "audio"` fixture through
 * `AudioPlayer`, in the playground's `variant`. It fills `renderers.audio` in
 * `MediaLabScreen.tsx`.
 *
 * Only the types come from `MediaLabScreen`: a value import would be a cycle,
 * since the screen imports this file.
 *
 * Cost: each tile owns a player, and on web an `HTMLAudioElement` that starts
 * loading its file when the tile mounts. The tiles stay idle and are released
 * with the section. Remote streams are the exception: they wait for a tap,
 * because a live stream would otherwise open a connection on every visit.
 */

/** A bundled picture for the `full` layout's `artwork` prop, the same for every tile. */
const ARTWORK = require("@/assets/media/square.jpg");

/** What each fixture's tile says beyond the manifest's own note. */
const TILE_NOTES: Record<string, string> = {
  "aud-meta-id3-cover":
    "The artwork is the artwork prop (square.jpg). The cover embedded in the file's ID3 tag is not read by AudioPlayer.",
  "remote-live-mp3-bbc": "A live stream has no duration: expect Live in place of the time and a disabled scrubber.",
  "aud-dur-1h05": "Expect h:mm:ss in both readouts, and a far seek to land where the thumb is dropped.",
  "aud-fmt-mp3-vbr": "Duration and a far seek must land correctly even without a VBR header.",
  "aud-fmt-mp3-cbr": "Duration and a far seek must land correctly.",
  "aud-fmt-webm-opus": "Chrome's recorder output, and the format most likely to fail on iOS: play it there.",
  "aud-fmt-ogg-opus": "Safari and iOS support for Ogg Opus is the thing to check.",
  "aud-dur-1s5": "A voice note: check it in the Compact variant.",
};

function describeAudio(fixture: MediaFixture): string {
  const parts: string[] = [`${fixture.tier} · ${fixture.category}`];
  if (fixture.durationSec !== undefined) parts.push(formatMediaTime(fixture.durationSec, fixture.durationSec));
  if (fixture.expectError) parts.push("expects the error state");
  return parts.join(" · ");
}

interface AudioTileProps {
  fixture: MediaFixture;
  uri: string | number | null;
  variant: AudioVariant;
  loop: boolean;
}

/** One fixture. A remote stream stays unloaded until the button is pressed. */
const AudioTile = memo(function AudioTile({ fixture, uri, variant, loop }: AudioTileProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const gated = fixture.tier === "remote";
  const [loaded, setLoaded] = useState(!gated);
  const [error, setError] = useState<string | null>(null);
  const onError = useCallback((message: string) => setError(message), []);
  // The manifest's own note is in the fixture list below; this one is what to look for in the player.
  const note = TILE_NOTES[fixture.id];

  return (
    <View style={styles.tile} testID={`audio-tile-${fixture.id}`}>
      <Card>
        <CardHeader>
          <CardTitle>{fixture.label}</CardTitle>
          <CardDescription>{describeAudio(fixture)}</CardDescription>
        </CardHeader>
        <View style={styles.tileMedia}>
          {loaded ? (
            <AudioPlayer
              source={uri}
              variant={variant}
              title={fixture.label}
              subtitle={describeAudio(fixture)}
              artwork={ARTWORK}
              showMute
              loop={loop}
              onError={onError}
              testID={`audio-${fixture.id}`}
            />
          ) : (
            <Button
              preset="outline"
              size="sm"
              text="Load stream"
              onPress={() => setLoaded(true)}
              accessibilityHint="Creates the player and starts loading the stream"
              testID={`audio-load-${fixture.id}`}
            />
          )}
          {note ? (
            <StyledText semantic="caption" style={styles.dim} testID={`audio-note-${fixture.id}`}>
              {note}
            </StyledText>
          ) : null}
          {fixture.expectError ? (
            <StyledText semantic="caption" style={error ? styles.reached : styles.dim} testID={`audio-outcome-${fixture.id}`}>
              {error ? `Reached the error state: ${error}` : "Expects the error state: none reported yet"}
            </StyledText>
          ) : null}
        </View>
      </Card>
    </View>
  );
});

/** The Audio section's renderer: `renderers.audio`. */
export function AudioSection({ entries, playground }: SectionRendererProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);

  if (entries.length === 0) {
    return (
      <View style={styles.gutter}>
        <StyledText semantic="caption" style={styles.dim} testID="audio-empty">
          No audio fixtures to render. Run `bun run media:fixtures` for the generated set.
        </StyledText>
      </View>
    );
  }

  return (
    <View style={styles.grid} testID="audio-grid">
      {entries.map((entry) => (
        <AudioTile
          key={entry.fixture.id}
          fixture={entry.fixture}
          uri={entry.uri}
          variant={playground.audioVariant}
          loop={playground.loop}
        />
      ))}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    gutter: {
      paddingHorizontal: spacing.screenPadding,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
      paddingHorizontal: spacing.screenPadding,
    },
    // Tiles share a row until they would fall under a width the full layout can use, then wrap.
    tile: {
      flexGrow: 1,
      flexBasis: 320,
      minWidth: 0,
      maxWidth: 560,
    },
    tileMedia: {
      paddingHorizontal: spacing.cardPadding,
      paddingBottom: spacing.cardPadding,
      gap: spacing.sm,
    },
    dim: {
      color: theme.colors.textDim,
    },
    reached: {
      color: theme.colors.success,
    },
  });

const themedStyles = createThemedStyles(createStyles);
