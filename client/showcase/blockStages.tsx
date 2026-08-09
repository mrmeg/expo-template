/**
 * Live block renderers for the galleries.
 *
 * `id` → the block component at its shipped defaults, keyed the same way
 * `previews.tsx` keys components. Kept out of `client/blocks/registry.generated.ts`
 * for the same reason: the generated registry is serializable data a script can
 * read, and the JSX that renders a block is not.
 *
 * A static map rather than a dynamic import so the bundler sees every block and
 * `tsc` catches a renamed export. `PREVIEWS`-style factories, not elements, so
 * each call site mounts its own instance.
 */

import React from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { CtaBannerBlock } from "@/client/blocks/cta-banner/Block";
import { FaqSectionBlock } from "@/client/blocks/faq-section/Block";
import { FeatureGridBlock } from "@/client/blocks/feature-grid/Block";
import { HeroBlock } from "@/client/blocks/hero/Block";
import { SignInFormBlock } from "@/client/blocks/sign-in-form/Block";
import { StatRowBlock } from "@/client/blocks/stat-row/Block";

/**
 * The one prop every block shares. Blocks own their outer padding (they're
 * screen sections, not widgets), so a host that puts a block inside its own
 * padded card overrides it here rather than fighting it with negative margins.
 */
export interface BlockStageProps {
  style?: StyleProp<ViewStyle>;
}

export const BLOCK_STAGES: Record<string, (props: BlockStageProps) => React.ReactElement> = {
  hero: (props) => <HeroBlock {...props} />,
  "feature-grid": (props) => <FeatureGridBlock {...props} />,
  "stat-row": (props) => <StatRowBlock {...props} />,
  "cta-banner": (props) => <CtaBannerBlock {...props} />,
  "faq-section": (props) => <FaqSectionBlock {...props} />,
  "sign-in-form": (props) => <SignInFormBlock {...props} />,
};

/** Whether a block id has a renderer — false only if a folder ships without one. */
export function hasBlockStage(id: string): boolean {
  return id in BLOCK_STAGES;
}

/** A live instance of the block, or `null` when the id has no renderer. */
export function renderBlockStage(
  id: string,
  props: BlockStageProps = {},
): React.ReactElement | null {
  const stage = BLOCK_STAGES[id];
  return stage ? stage(props) : null;
}
