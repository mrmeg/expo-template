/**
 * Lazy entry points into the showcase cluster — see `gallery.tsx` for why the
 * cluster is one chunk. This is the ONLY module allowed to `import()` it, and
 * it does so through one specifier, so every consumer (the Explore tab and the
 * five gallery routes) shares a single async chunk instead of each hoisting the
 * shared previews into `__common`.
 *
 * Every export renders inside a `Suspense` boundary. On the server the import
 * resolves synchronously, so streamed HTML already carries the previews; the
 * browser keeps that markup in place while the chunk downloads and hydrates
 * the boundary when it lands. A client-side navigation shows the fallback for
 * the first fetch only.
 */

import React, { Suspense } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

import type { BlockStageProps, PreviewProps } from "./gallery";

/** The single split point. Do not add a second `import()` of this module. */
const loadGallery = () => import("@/client/showcase/gallery");

type GalleryModule = Awaited<ReturnType<typeof loadGallery>>;

/** A live component preview from the registry id, loaded on demand. */
export const LazyPreview = React.lazy(async () => ({
  default: (await loadGallery()).Preview,
}));

/** A live block stage from the block id, loaded on demand. */
export const LazyBlockStage = React.lazy(async () => ({
  default: (await loadGallery()).BlockStage,
}));

export type { BlockStageProps, PreviewProps };

export type GalleryScreenName =
  | "ComponentsGalleryScreen"
  | "ComponentDetailScreen"
  | "BlocksGalleryScreen"
  | "ShowcaseScreen"
  | "ThemedShowcaseScreen";

type GalleryScreenComponent = React.ComponentType<Record<string, never>>;

const lazyScreen = (name: GalleryScreenName) =>
  React.lazy(async () => ({
    default: ((await loadGallery()) as GalleryModule)[name] as GalleryScreenComponent,
  }));

// One lazy boundary per screen, created once at module scope so React keeps
// the resolved component across re-renders and navigations.
const SCREENS: Record<GalleryScreenName, React.LazyExoticComponent<GalleryScreenComponent>> = {
  ComponentsGalleryScreen: lazyScreen("ComponentsGalleryScreen"),
  ComponentDetailScreen: lazyScreen("ComponentDetailScreen"),
  BlocksGalleryScreen: lazyScreen("BlocksGalleryScreen"),
  ShowcaseScreen: lazyScreen("ShowcaseScreen"),
  ThemedShowcaseScreen: lazyScreen("ThemedShowcaseScreen"),
};

/**
 * Route body for a gallery screen. Route files under `app/(main)/(demos)` stay
 * one line each: `export default () => <GalleryRoute screen="…" />`.
 */
export function GalleryRoute({ screen }: { screen: GalleryScreenName }) {
  const Screen = SCREENS[screen];
  return (
    <Suspense fallback={<GalleryLoading />}>
      <Screen />
    </Suspense>
  );
}

function GalleryLoading() {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  return (
    <View style={styles.loading} testID="gallery-loading">
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    loading: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.background,
    },
  });

const themedStyles = createThemedStyles(createStyles);
