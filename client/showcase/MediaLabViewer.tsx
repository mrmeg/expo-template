import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@mrmeg/expo-ui/components/Item";
import type { MediaViewerItem } from "@mrmeg/expo-ui/components/MediaViewer";
import { StyledText } from "@mrmeg/expo-ui/components/StyledText";
import { LazyMediaViewer } from "@/client/components/LazyMediaViewer";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

import type { LabEntry, SectionRendererProps } from "./MediaLabScreen";

/**
 * The Viewer section of the Media Lab: the fixtures a gallery viewer opens as a
 * set, through `MediaViewer`. It fills `renderers.viewer` in `MediaLabScreen.tsx`.
 *
 * Three preset sets, each one button, plus "open the current filter as a set"
 * for the Images and Video sections' chips:
 *
 * - **All available images and videos (mixed):** every renderable image and
 *   video that is not one of the 60 list-scale thumbnails, in manifest order.
 *   It holds the cases the viewer is checked against: extreme aspects, the 48 MP
 *   picture for zoom, EXIF orientation 6, alpha PNG, animated GIF, the
 *   rotation-flagged video, HLS with captions, and the broken files (a broken
 *   one must show its error state inside its page, and paging must carry on).
 * - **The 60-thumbnail scale set:** paging performance and memory over many pages.
 * - **One item:** no counter, no arrows.
 *
 * Presets are rows of buttons, never a list: the lab is a vertical `ScrollView`,
 * and a vertical `FlatList` inside it logs a nested-VirtualizedList error on
 * native. (The viewer's own pager is a horizontal list in a `Modal`.) Only
 * types come from `MediaLabScreen`: a value import would be a cycle, since the
 * screen imports this file.
 */

const LANDSCAPE_POSTER = require("@/assets/media/landscape.jpg");
const PORTRAIT_POSTER = require("@/assets/media/portrait.jpg");

/** A video's own poster where the core set has one; every other clip shows black until it plays. */
const POSTERS: Record<string, number> = {
  "core-video-landscape": LANDSCAPE_POSTER,
  "core-video-portrait": PORTRAIT_POSTER,
};

/** The fixtures the viewer's checklist names. Shown as missing when the mixed set cannot include them. */
const CHECKLIST: { id: string; label: string }[] = [
  { id: "img-aspect-3x1", label: "panorama 3:1" },
  { id: "img-aspect-1x3", label: "strip 1:3" },
  { id: "img-aspect-21x9", label: "ultrawide 21:9" },
  { id: "img-size-48mp", label: "48 MP" },
  { id: "img-orient-exif6", label: "EXIF orientation 6" },
  { id: "img-fmt-png-alpha", label: "alpha PNG" },
  { id: "img-fmt-gif-animated", label: "animated GIF" },
  { id: "vid-rotate-90", label: "rotation-flagged video" },
  { id: "remote-hls-apple-adv-ts", label: "HLS with captions" },
  { id: "src-404", label: "a broken (404) image" },
];

const SCALE_CATEGORY = "scale";

/** What the viewer is told for one fixture, or `null` for what it cannot show (audio, or no origin to load from). */
export function toViewerItem(entry: LabEntry): MediaViewerItem | null {
  const { fixture, uri } = entry;
  if (uri === null) return null;
  if (fixture.kind === "image") {
    return { type: "image", key: fixture.id, source: uri, alt: fixture.label, title: fixture.label };
  }
  if (fixture.kind === "video") {
    return { type: "video", key: fixture.id, source: uri, title: fixture.label, poster: POSTERS[fixture.id] };
  }
  return null;
}

function toViewerItems(entries: LabEntry[]): MediaViewerItem[] {
  return entries.flatMap((entry) => {
    const item = toViewerItem(entry);
    return item ? [item] : [];
  });
}

const isAvailable = (entry: LabEntry) => entry.availability === "available";

/** The three presets over the whole manifest, whatever the section's chips say. */
export function presetSets(allEntries: LabEntry[]) {
  const available = allEntries.filter(isAvailable);
  const mixed = toViewerItems(available.filter(({ fixture }) => fixture.kind !== "audio" && fixture.category !== SCALE_CATEGORY));
  const scale = toViewerItems(available.filter(({ fixture }) => fixture.category === SCALE_CATEGORY));
  const landscape = available.find(({ fixture }) => fixture.id === "core-landscape");
  const one = landscape ? toViewerItems([landscape]) : [];
  const missing = CHECKLIST.filter(({ id }) => !mixed.some((item) => item.key === id)).map(({ label }) => label);
  return { mixed, scale, one, missing };
}

interface OpenSet {
  items: MediaViewerItem[];
  visible: boolean;
}

interface SetRowProps {
  id: string;
  title: string;
  description: string;
  items: MediaViewerItem[];
  onOpen: (items: MediaViewerItem[]) => void;
}

/** One set: its title, what it holds, and the button that opens it. Disabled while it is empty. */
function SetRow({ id, title, description, items, onOpen }: SetRowProps) {
  return (
    <Item testID={`viewer-set-${id}`}>
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription testID={`viewer-set-${id}-count`}>{`${items.length} ${items.length === 1 ? "item" : "items"}`}</ItemDescription>
        <ItemDescription>{description}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          size="sm"
          text="Open"
          disabled={items.length === 0}
          accessibilityLabel={`Open ${title}`}
          onPress={() => onOpen(items)}
          testID={`viewer-open-${id}`}
        />
      </ItemActions>
    </Item>
  );
}

/** The Viewer section's renderer: `renderers.viewer`. */
export function ViewerSection({ allEntries, filtered }: SectionRendererProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const [session, setSession] = useState<OpenSet>({ items: [], visible: false });

  const sets = useMemo(() => presetSets(allEntries), [allEntries]);
  const imageFilter = useMemo(() => toViewerItems(filtered.image), [filtered.image]);
  const videoFilter = useMemo(() => toViewerItems(filtered.video), [filtered.video]);

  const open = useCallback((items: MediaViewerItem[]) => setSession({ items, visible: true }), []);
  const close = useCallback(() => setSession((current) => ({ ...current, visible: false })), []);

  return (
    <View style={styles.section} testID="viewer-section">
      <View style={styles.gutter}>
        <StyledText semantic="caption" style={styles.dim}>
          Each set opens the viewer. On every surface, go through all three: zoom clamps at the panorama's and the strip's
          edges; double-tap at the corners of the 48 MP picture; a broken file shows its error state inside the page and
          paging carries on; a video page stops when you page away.
        </StyledText>
        {sets.missing.length > 0 ? (
          <StyledText semantic="caption" style={styles.dim} testID="viewer-missing">
            {`Not in the mixed set (not generated or unreachable): ${sets.missing.join(", ")}`}
          </StyledText>
        ) : null}
      </View>

      <ItemGroup title="Sets" testID="viewer-sets">
        <SetRow
          id="mixed"
          title="All available images and videos (mixed)"
          description="Extreme aspects, 48 MP, EXIF orientation 6, alpha PNG, animated GIF, rotation-flagged video, HLS with captions, broken files."
          items={sets.mixed}
          onOpen={open}
        />
        <SetRow
          id="scale"
          title="The 60-thumbnail scale set"
          description="Paging performance and memory over many pages."
          items={sets.scale}
          onOpen={open}
        />
        <SetRow id="one" title="One item" description="No counter, no arrows." items={sets.one} onOpen={open} />
      </ItemGroup>

      <ItemGroup title="Current filter" description="The Images and Video sections' chips, opened as a set." testID="viewer-filters">
        <SetRow
          id="images-filter"
          title="Open the Images filter as a set"
          description="Narrow the Images section with its chips first."
          items={imageFilter}
          onOpen={open}
        />
        <SetRow
          id="video-filter"
          title="Open the Video filter as a set"
          description="Narrow the Video section with its chips first."
          items={videoFilter}
          onOpen={open}
        />
      </ItemGroup>

      <LazyMediaViewer items={session.items} visible={session.visible} onClose={close} />
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
    dim: {
      color: theme.colors.textDim,
    },
  });

const themedStyles = createThemedStyles(createStyles);
