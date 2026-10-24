/**
 * The app's way to render `@mrmeg/expo-ui/components/Video`.
 *
 * `Video` pulls in `expo-video`, the custom controls and the scrubber. The
 * showcase cluster (previews and the Media Lab) and the media tab (through
 * `MediaViewer`) are separate async chunks, and Metro hoists any module
 * reachable from two of them into `__common`, which every route loads first.
 * A static import of `Video` from both would therefore put all of that into the
 * first download of routes that never play a video.
 *
 * So the app reaches `Video` only through `client/components/mediaChunk.ts`,
 * the one module behind every lazy import of it and of `MediaViewer`: one
 * chunk, fetched when a player is first rendered.
 * `client/components/__tests__/mediaChunkSplitPoint.test.ts` fails on any other
 * value import. Types are fine: they are erased.
 *
 * Every use is client-only (a gallery behind `ClientOnly`), so the server and
 * the hydration pass render the black frame at the final size and the player
 * mounts after. An app that wants the player in its server HTML imports `Video`
 * directly.
 */
import React, { Suspense } from "react";
import { StyleSheet, View } from "react-native";
import type { VideoProps } from "@mrmeg/expo-ui/components/Video";
import { Hydrated } from "@mrmeg/expo-ui/components/Hydrated";
import { palette, spacing } from "@mrmeg/expo-ui/constants";
import { mediaFrameStyle, parseAspectRatio } from "@mrmeg/expo-ui/lib";

/** The split point: the shared media chunk. Do not import `Video` any other way. */
const loadVideo = () => import("@/client/components/mediaChunk");

const VideoLazy = React.lazy(async () => ({ default: (await loadVideo()).Video }));

export type LazyVideoProps = VideoProps & {
  /** Shown while the chunk loads. Defaults to a black frame at the video's size (16:9 for `"auto"`). */
  fallback?: React.ReactNode;
};

const FALLBACK_RATIO = 16 / 9;

/** A black frame laid out like the `Video` that replaces it, so nothing shifts when the chunk arrives. */
function FramePlaceholder({ aspectRatio, maxWidth, maxHeight, fill, radius = "none", style, testID }: VideoProps) {
  const ratio = aspectRatio === "auto" ? undefined : parseAspectRatio(aspectRatio);
  const layout = fill ? mediaFrameStyle({ fill: true }) : mediaFrameStyle({ aspectRatio: ratio ?? FALLBACK_RATIO, maxWidth, maxHeight });
  return <View style={[styles.frame, radiusStyles[radius] ?? radiusStyles.none, layout, StyleSheet.flatten(style)]} testID={testID ? `${testID}-loading-frame` : undefined} />;
}

/** `Video`, loaded on demand. Takes `Video`'s props. */
export function LazyVideo({ fallback, ...props }: LazyVideoProps) {
  const placeholder = fallback ?? <FramePlaceholder {...props} />;
  return (
    <Hydrated fallback={placeholder}>
      <Suspense fallback={placeholder}>
        <VideoLazy {...props} />
      </Suspense>
    </Hydrated>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: palette.black, overflow: "hidden" },
});

/** The same tokens `Video` rounds its frame with. */
const radiusStyles = StyleSheet.create({
  none: { borderRadius: spacing.radiusNone },
  xs: { borderRadius: spacing.radiusXs },
  sm: { borderRadius: spacing.radiusSm },
  md: { borderRadius: spacing.radiusMd },
  lg: { borderRadius: spacing.radiusLg },
  xl: { borderRadius: spacing.radiusXl },
  "2xl": { borderRadius: spacing.radius2xl },
  full: { borderRadius: spacing.radiusFull },
});
