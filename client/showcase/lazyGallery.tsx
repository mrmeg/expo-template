/**
 * Lazy entry points into the showcase cluster — see `gallery.tsx` for why the
 * cluster is one chunk. This is the ONLY module allowed to `import()` it, and
 * it does so through one specifier, so every consumer (the Explore tab and the
 * five gallery routes) shares a single async chunk instead of each hoisting the
 * shared previews into `__common`.
 *
 * Every shell is client-only: it renders its fallback on the server and during
 * the hydration pass, and mounts the lazy chunk in the first client render
 * after hydration. The previews used to be server-rendered too, but under Expo
 * Router's SSR the server renders the app inside `app/+html.tsx` while the
 * client hydrates `#root`, so React's `useId()` walks a different tree on each
 * side and every id differs. The kit defers its own ids (`useHydrated`); the
 * Radix-backed previews (Tabs, Accordion, Collapsible…) emit theirs on both
 * sides and logged "A tree hydrated but some attributes … didn't match" on
 * every gallery route. Rendering the cluster only on the client removes the
 * ids from the server HTML; see `docs/server-guide.md` → "useId diverges".
 * A client-side navigation shows the fallback for the first fetch only.
 */

import React, { Suspense } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { Hydrated } from "@mrmeg/expo-ui/components/Hydrated";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

import type { BlockStageProps, PreviewProps } from "./gallery";

/** The single split point. Do not add a second `import()` of this module. */
const loadGallery = () => import("@/client/showcase/gallery");

type GalleryModule = Awaited<ReturnType<typeof loadGallery>>;

/**
 * Server render and hydration pass: the fallback (the kit's `Hydrated` gate).
 * First client render after hydration: the lazy child inside its own
 * `Suspense`, so the chunk request starts once the tree is live and its ids
 * are the client's.
 */
export function ClientOnly({ fallback = null, children }: { fallback?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Hydrated fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </Hydrated>
  );
}

const PreviewLazy = React.lazy(async () => ({
  default: (await loadGallery()).Preview,
}));

const BlockStageLazy = React.lazy(async () => ({
  default: (await loadGallery()).BlockStage,
}));

type ClientOnlyProps = { fallback?: React.ReactNode };

/** A live component preview from the registry id, loaded on demand (client-only). */
export function LazyPreview({ fallback, ...props }: PreviewProps & ClientOnlyProps) {
  return (
    <ClientOnly fallback={fallback}>
      <PreviewLazy {...props} />
    </ClientOnly>
  );
}

/** A live block stage from the block id, loaded on demand (client-only). */
export function LazyBlockStage({ fallback, ...props }: BlockStageProps & ClientOnlyProps) {
  return (
    <ClientOnly fallback={fallback}>
      <BlockStageLazy {...props} />
    </ClientOnly>
  );
}

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
    <ClientOnly fallback={<GalleryLoading />}>
      <Screen />
    </ClientOnly>
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
