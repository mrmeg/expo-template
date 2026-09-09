/**
 * The showcase cluster's single split point (web bundle layout).
 *
 * Everything that renders a live `@mrmeg/expo-ui` instance for the sake of
 * showing it off — the preview map, the block stages, the seeded component
 * details, and the five gallery screens — is reachable from here and ONLY from
 * here. Consumers never import this module statically; they go through
 * `client/showcase/lazyGallery.tsx`, which holds the one `import()` of this
 * specifier.
 *
 * Why it matters: Metro hoists any module reachable from two or more async
 * route chunks into the eagerly loaded `__common` chunk. The Explore tab, the
 * component gallery, the detail screen and the kitchen sink all render the same
 * previews, so before this barrel existed the 36 previewed components (plus
 * Radix, vaul, floating-ui and the rest of their web engines) were downloaded by
 * every route on first render — the settings tab paid for `DropdownMenu`. With
 * one `import()` the whole cluster is one async chunk that only visitors who
 * look at a preview fetch, and that they fetch once.
 *
 * Adding a new gallery surface: import it here and reach it through
 * `lazyGallery.tsx`. `client/showcase/__tests__/gallerySplitPoint.test.ts` fails
 * on any static import of these modules from outside `client/showcase/`.
 */

import React from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { renderBlockStage } from "./blockStages";
import { renderPreview } from "./previews";

export { renderPreview } from "./previews";
export { renderBlockStage } from "./blockStages";
export { getComponentDetail, importSnippet, COMPONENT_DETAILS } from "./details";

export { default as ComponentsGalleryScreen } from "./ComponentsGalleryScreen";
export { default as ComponentDetailScreen } from "./ComponentDetailScreen";
export { default as BlocksGalleryScreen } from "./BlocksGalleryScreen";
export { default as ShowcaseScreen } from "./ShowcaseScreen";
export { default as ThemedShowcaseScreen } from "./ThemedShowcaseScreen";

export interface PreviewProps {
  /** Registry id, e.g. `"Button"`. */
  id: string;
  /** Rendered when the id has no preview; defaults to nothing. */
  missing?: React.ReactNode;
}

/** Component form of `renderPreview`, so it can sit behind `React.lazy`. */
export function Preview({ id, missing = null }: PreviewProps) {
  return renderPreview(id) ?? <>{missing}</>;
}

export interface BlockStageProps {
  /** Block id from `client/blocks/registry.generated.ts`. */
  id: string;
  style?: StyleProp<ViewStyle>;
}

/** Component form of `renderBlockStage`, so it can sit behind `React.lazy`. */
export function BlockStage({ id, style }: BlockStageProps) {
  return renderBlockStage(id, { style });
}
