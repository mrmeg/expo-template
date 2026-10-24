/**
 * The one module behind every lazy import of the kit's media components.
 *
 * `Video` (with `expo-video`, the custom controls and the scrubber) and
 * `MediaViewer` (which draws a `Video` per video page) are both reached from
 * more than one async chunk: the media tab and the showcase cluster. Metro
 * hoists any module reachable from two async chunks into `__common`, which
 * every route loads first, and two separate `import()` targets that share
 * `Video` would hoist it. Behind this one module there is one chunk, fetched
 * when a player or a viewer is first rendered, by `LazyVideo` and
 * `LazyMediaViewer`, the only importers (see `docs/bundle-analysis.md` and
 * `client/components/__tests__/mediaChunkSplitPoint.test.ts`).
 *
 * Nothing in the eager graph imports this file.
 */
export { Video } from "@mrmeg/expo-ui/components/Video";
export { MediaViewer } from "@mrmeg/expo-ui/components/MediaViewer";
