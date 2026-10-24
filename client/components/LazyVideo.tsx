/**
 * The one place the app loads `@mrmeg/expo-ui/components/Video`.
 *
 * `Video` pulls in `expo-video`, the custom controls and the scrubber. The
 * media tab (through `VideoPlayer`) and the showcase cluster (previews and the
 * Media Lab) are separate async chunks, and Metro hoists any module reachable
 * from two of them into `__common`, which every route loads first. A static
 * import of `Video` from both would therefore put all of that into the first
 * download of routes that never play a video.
 *
 * So both reach it here, through one `import()` specifier: one `Video` chunk,
 * fetched when a player is first rendered. `client/components/__tests__/lazyVideo.test.ts`
 * fails on any other value import. Types are fine: they are erased.
 *
 * Every use is client-only (a modal that opens on a tap, a gallery behind
 * `ClientOnly`), so the server and the hydration pass render the black frame at
 * the final size and the player mounts after. An app that wants the player in
 * its server HTML imports `Video` directly.
 */
import React, { Suspense } from "react";
import { StyleSheet, View } from "react-native";
import type { VideoProps } from "@mrmeg/expo-ui/components/Video";
import { Hydrated } from "@mrmeg/expo-ui/components/Hydrated";
import { palette } from "@mrmeg/expo-ui/constants";
import { mediaFrameStyle, parseAspectRatio } from "@mrmeg/expo-ui/lib";

/** The single split point. Do not add a second `import()` of this module. */
const loadVideo = () => import("@mrmeg/expo-ui/components/Video");

const VideoLazy = React.lazy(async () => ({ default: (await loadVideo()).Video }));

export type LazyVideoProps = VideoProps & {
  /** Shown while the chunk loads. Defaults to a black frame at the video's size (16:9 for `"auto"`). */
  fallback?: React.ReactNode;
};

const FALLBACK_RATIO = 16 / 9;

/** A black frame laid out like the `Video` that replaces it, so nothing shifts when the chunk arrives. */
function FramePlaceholder({ aspectRatio, maxWidth, maxHeight, fill, style, testID }: VideoProps) {
  const ratio = aspectRatio === "auto" ? undefined : parseAspectRatio(aspectRatio);
  const layout = fill ? mediaFrameStyle({ fill: true }) : mediaFrameStyle({ aspectRatio: ratio ?? FALLBACK_RATIO, maxWidth, maxHeight });
  return <View style={[styles.frame, layout, StyleSheet.flatten(style)]} testID={testID ? `${testID}-loading-frame` : undefined} />;
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
