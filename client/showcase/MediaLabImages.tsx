import React, { memo, useMemo } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Card, CardDescription, CardHeader, CardTitle } from "@mrmeg/expo-ui/components/Card";
import { Image, type ImageFit, type ImageRadius } from "@mrmeg/expo-ui/components/Image";
import { StyledText } from "@mrmeg/expo-ui/components/StyledText";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

import type { ImagePosition, ImageSizing, LabEntry, SectionRendererProps, SourceKindEntry } from "./MediaLabScreen";
import type { MediaFixture } from "./mediaFixtures";

/**
 * The Images section of the Media Lab: every `kind: "image"` fixture through
 * `Image`, driven by the playground (fit, position, sizing mode, max height,
 * radius). It fills `renderers.image` in `MediaLabScreen.tsx`.
 *
 * The width preset is already applied by the lab's stage wrapper, so nothing
 * here applies it again. Only the types come from `MediaLabScreen`: a value
 * import would be a cycle, since the screen imports this file.
 */

/** Frame ratio for a fixture with no size in the manifest (SVG viewBox, broken files, the 404 path, remote sources). */
const FALLBACK_RATIO = 4 / 3;
/** The fixed box of the `fill` and `style` sizing modes, where fit and position show. */
const BOX_HEIGHT = 180;
/** What the playground's "Max height" switch caps a frame at. */
const MAX_HEIGHT = 160;

/** The scale set: its cells and the bounded height it scrolls in. */
const SCALE_GAP = spacing.sm;
const SCALE_CELL = 96;

/** The viewer-style `file://` and data URIs are strings; a bundled asset is a `require()` number. */
type Uri = string | number | null;

/** The raw pixels of the EXIF 6 fixture are landscape; it must display portrait. */
const ROTATED_BY_EXIF = new Set(["img-orient-exif6"]);

function naturalRatio(fixture: MediaFixture): number {
  const { width, height } = fixture;
  if (!width || !height) return FALLBACK_RATIO;
  return ROTATED_BY_EXIF.has(fixture.id) ? height / width : width / height;
}

function describeSize(fixture: MediaFixture): string {
  if (fixture.expectError) return "expects the error state";
  if (!fixture.width || !fixture.height) return "no intrinsic size";
  return ROTATED_BY_EXIF.has(fixture.id)
    ? `${fixture.width}×${fixture.height} stored, shown ${fixture.height}×${fixture.width}`
    : `${fixture.width}×${fixture.height}`;
}

interface FrameOptions {
  fit: ImageFit;
  position: ImagePosition;
  sizing: ImageSizing;
  /** The playground's max-height switch. */
  capped: boolean;
  radius: ImageRadius;
}

interface ImageTileProps extends FrameOptions {
  fixture: MediaFixture;
  uri: Uri;
}

/** One fixture, sized the way the playground says. */
const ImageTile = memo(function ImageTile({ fixture, uri, fit, position, sizing, capped, radius }: ImageTileProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const maxHeight = capped ? MAX_HEIGHT : undefined;
  const shared = { source: uri, alt: fixture.label, fit, position, radius, testID: `image-${fixture.id}` } as const;

  let frame: React.ReactNode;
  if (sizing === "ratio") {
    frame = <Image {...shared} aspectRatio={naturalRatio(fixture)} maxHeight={maxHeight} />;
  } else if (sizing === "auto") {
    frame = <Image {...shared} aspectRatio="auto" fallbackAspectRatio={1} maxHeight={maxHeight} />;
  } else if (sizing === "fill") {
    frame = (
      <View style={styles.box}>
        <Image {...shared} fill />
      </View>
    );
  } else {
    frame = <Image {...shared} style={styles.styled} maxHeight={maxHeight} />;
  }

  return (
    <View style={styles.tile} testID={`image-tile-${fixture.id}`}>
      <Card>
        <CardHeader>
          <CardTitle>{fixture.label}</CardTitle>
          <CardDescription>{describeSize(fixture)}</CardDescription>
        </CardHeader>
        <View style={styles.tileMedia}>{frame}</View>
      </Card>
    </View>
  );
});

/** The three responsive widths, as one `source` array. The file the browser or device picks is visible by its hue. */
const RESPONSIVE_IDS = ["img-responsive-400", "img-responsive-800", "img-responsive-1600"] as const;

function ResponsiveTile({ entries, options }: { entries: LabEntry[]; options: FrameOptions }) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);

  const sources = useMemo(() => {
    const found = RESPONSIVE_IDS.map((id) => entries.find((entry) => entry.fixture.id === id));
    if (found.some((entry) => !entry || typeof entry.uri !== "string")) return null;
    return (found as LabEntry[]).map((entry) => ({
      uri: entry.uri as string,
      width: entry.fixture.width,
      height: entry.fixture.height,
    }));
  }, [entries]);

  if (!sources) return null;
  const { fit, position, sizing, capped, radius } = options;
  const maxHeight = capped ? MAX_HEIGHT : undefined;
  const shared = { source: sources, alt: "Responsive source array", fit, position, radius, testID: "image-responsive-array" } as const;

  return (
    <View style={styles.tile} testID="image-tile-responsive-array">
      <Card>
        <CardHeader>
          <CardTitle>Responsive source array</CardTitle>
          <CardDescription>400, 800 and 1600 wide, tinted 0, 120 and 240 degrees: the hue says which was picked</CardDescription>
        </CardHeader>
        <View style={styles.tileMedia}>
          {sizing === "fill" ? (
            <View style={styles.box}>
              <Image {...shared} fill />
            </View>
          ) : sizing === "style" ? (
            <Image {...shared} style={styles.styled} maxHeight={maxHeight} />
          ) : (
            <Image
              {...shared}
              aspectRatio={sizing === "auto" ? "auto" : 16 / 9}
              fallbackAspectRatio={16 / 9}
              maxHeight={maxHeight}
            />
          )}
        </View>
      </Card>
    </View>
  );
}

/**
 * The 60 list-scale thumbnails, in a horizontal `FlatList` strip that windows
 * and recycles on its own. Horizontal on purpose: a vertical list inside the
 * lab's vertical `ScrollView` breaks windowing and logs React Native's
 * "VirtualizedLists should never be nested" error on native.
 */
function ScaleStrip({ entries, options }: { entries: LabEntry[]; options: FrameOptions }) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const { fit, position, radius } = options;
  const itemLength = SCALE_CELL + SCALE_GAP;

  return (
    <View style={styles.gutter} testID="image-scale">
      <StyledText semantic="subheading" accessibilityRole="header">List scale</StyledText>
      <StyledText semantic="caption" style={styles.dim}>
        {`${entries.length} thumbnails in a horizontal FlatList with recyclingKey. Scroll sideways.`}
      </StyledText>
      <FlatList
        horizontal
        data={entries}
        keyExtractor={(entry) => entry.fixture.id}
        renderItem={({ item }) => (
          <Image
            source={item.uri}
            alt={item.fixture.label}
            fit={fit}
            position={position}
            radius={radius}
            recyclingKey={item.fixture.id}
            style={styles.scaleCell}
            testID={`scale-image-${item.fixture.id}`}
          />
        )}
        getItemLayout={(_data, index) => ({ length: itemLength, offset: itemLength * index, index })}
        contentContainerStyle={styles.scaleContent}
        style={styles.scaleList}
        initialNumToRender={12}
        windowSize={5}
        showsHorizontalScrollIndicator
        testID="scale-grid"
      />
    </View>
  );
}

/** Bundled, public path, remote, data URI and the picked `file://` URI, each handed to `Image` as a source. */
function SourceKindTiles({ sourceKinds, options }: { sourceKinds: SourceKindEntry[]; options: FrameOptions }) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const { fit, position, radius } = options;

  return (
    <View style={styles.gutter} testID="image-source-kinds">
      <StyledText semantic="subheading" accessibilityRole="header">Source kinds</StyledText>
      <View style={styles.kinds}>
        {sourceKinds.map((kind) => (
          <View key={kind.id} style={styles.kind} testID={`image-source-${kind.id}`}>
            <Card>
              <View style={styles.kindBody}>
                {kind.uri === null ? (
                  <View style={styles.kindEmpty}>
                    <StyledText semantic="caption" style={styles.dim}>no origin</StyledText>
                  </View>
                ) : (
                  <Image
                    source={kind.uri}
                    alt={kind.label}
                    fit={fit}
                    position={position}
                    radius={radius}
                    aspectRatio={4 / 3}
                    testID={`source-image-${kind.id}`}
                  />
                )}
                <StyledText semantic="caption" style={styles.dim}>{kind.label}</StyledText>
              </View>
            </Card>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The Images section's renderer: `renderers.image`. */
export function ImageSection({ entries, playground, sourceKinds }: SectionRendererProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);

  const options = useMemo<FrameOptions>(
    () => ({
      fit: playground.imageFit,
      position: playground.imagePosition,
      sizing: playground.imageSizing,
      capped: playground.maxHeight,
      radius: playground.radius,
    }),
    [playground.imageFit, playground.imagePosition, playground.imageSizing, playground.maxHeight, playground.radius],
  );

  const tiles = useMemo(() => entries.filter((entry) => entry.fixture.category !== "scale"), [entries]);
  const scale = useMemo(() => entries.filter((entry) => entry.fixture.category === "scale"), [entries]);

  return (
    <View style={styles.section} testID="image-section">
      {entries.length === 0 ? (
        <View style={styles.gutter}>
          <StyledText semantic="caption" style={styles.dim} testID="image-empty">
            No image fixtures to render. Run `bun run media:fixtures` for the generated set.
          </StyledText>
        </View>
      ) : null}

      {tiles.length > 0 ? (
        <View style={styles.grid} testID="image-grid">
          {tiles.map((entry) => (
            <ImageTile key={entry.fixture.id} fixture={entry.fixture} uri={entry.uri} {...options} />
          ))}
          <ResponsiveTile entries={entries} options={options} />
        </View>
      ) : null}

      {scale.length > 0 ? <ScaleStrip entries={scale} options={options} /> : null}

      <SourceKindTiles sourceKinds={sourceKinds} options={options} />
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
      flexBasis: 240,
      minWidth: 0,
      maxWidth: 480,
    },
    tileMedia: {
      paddingHorizontal: spacing.cardPadding,
      paddingBottom: spacing.cardPadding,
    },
    box: {
      width: "100%",
      height: BOX_HEIGHT,
    },
    styled: {
      width: "100%",
      height: BOX_HEIGHT,
    },
    scaleList: {
      height: SCALE_CELL,
    },
    scaleContent: {
      gap: SCALE_GAP,
    },
    scaleCell: {
      width: SCALE_CELL,
      height: SCALE_CELL,
    },
    kinds: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    kind: {
      width: 144,
    },
    kindBody: {
      padding: spacing.sm,
      gap: spacing.xs,
    },
    kindEmpty: {
      alignItems: "center",
      justifyContent: "center",
      aspectRatio: 4 / 3,
    },
    dim: {
      color: theme.colors.textDim,
    },
  });

const themedStyles = createThemedStyles(createStyles);
