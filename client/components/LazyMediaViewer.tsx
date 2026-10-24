/**
 * The app's way to render `@mrmeg/expo-ui/components/MediaViewer`.
 *
 * `MediaViewer` pulls in `Video` (so `expo-video`, the custom controls and the
 * scrubber), `Image` (`expo-image`), the zoom math and the gesture handling.
 * The media tab and the showcase cluster (the gallery preview and the Media
 * Lab) are separate async chunks, and Metro hoists any module reachable from
 * two of them into `__common`, which every route loads first. A static import
 * of the viewer from both would therefore put all of that into the first
 * download of routes that never open a lightbox.
 *
 * So the app reaches it only through `client/components/mediaChunk.ts`, the
 * one module behind every lazy import of the viewer and of `Video` (which the
 * viewer shares with `LazyVideo`: two separate chunks that both contain
 * `Video` would hoist it): one chunk, fetched the first time a viewer is
 * opened. Nothing is rendered, and nothing fetched, until `visible` has been
 * true once. `client/components/__tests__/mediaChunkSplitPoint.test.ts` fails
 * on any other value import. Types are fine: they are erased.
 *
 * The viewer is a `Modal`, which renders nothing on the server, so the server
 * and the hydration pass render nothing here either.
 */
import React, { Suspense, useState } from "react";
import type { MediaViewerProps } from "@mrmeg/expo-ui/components/MediaViewer";
import { Hydrated } from "@mrmeg/expo-ui/components/Hydrated";

/** The split point: the shared media chunk. Do not import `MediaViewer` any other way. */
const loadMediaViewer = () => import("@/client/components/mediaChunk");

const MediaViewerLazy = React.lazy(async () => ({ default: (await loadMediaViewer()).MediaViewer }));

/** `MediaViewer`, loaded on demand. Takes `MediaViewer`'s props. */
export function LazyMediaViewer(props: MediaViewerProps) {
  // Keep it mounted after the first open, so closing it plays the Modal's own exit.
  const [opened, setOpened] = useState(props.visible);
  if (props.visible && !opened) setOpened(true);
  if (!opened) return null;

  return (
    <Hydrated>
      <Suspense fallback={null}>
        <MediaViewerLazy {...props} />
      </Suspense>
    </Hydrated>
  );
}
