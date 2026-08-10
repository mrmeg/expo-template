import type { IconName } from "@mrmeg/expo-ui/components/Icon";

/**
 * Block categories.
 *
 * One union in one place — the gallery filters off it, and every `meta.ts`
 * types its `category` against it, so a typo fails `tsc` instead of silently
 * creating a one-block category. Grow the union here when a new grouping earns
 * its place.
 */
export type BlockCategory =
  | "marketing"
  | "data"
  | "social-proof"
  | "auth"
  | "content";

/**
 * Metadata for a block.
 *
 * Blocks are the middle tier between a component (`packages/ui`) and a full
 * screen template (`client/templates`): a composed section you drop into a
 * screen. Each block folder under `client/blocks/<id>/` exports a `meta` of
 * this shape from its `meta.ts`, and the registry codegen
 * (`scripts/generate-block-registry.ts`) collects every `meta` into
 * `registry.generated.ts` — so adding or removing a block is a one-folder
 * change with no central list to edit.
 *
 * Unlike `ScreenTemplateEntry` there is no `route`: a block is not a screen,
 * so it has no demo route of its own. The gallery renders the block component
 * inline.
 */
export interface BlockEntry {
  /** Stable identifier, used as React key and for tests. Matches the folder name. */
  id: string;
  /** Display label in the blocks gallery. */
  label: string;
  /** One-line description shown beneath the label. */
  description: string;
  /** Grouping used by the gallery's category filter. */
  category: BlockCategory;
  /**
   * Component ids from the showcase registry (`COMPONENTS`) that this block
   * composes, e.g. `["StatCard", "SectionHeader"]`. Data, not UI: the gallery
   * renders it as the "built from" strip beneath the preview, which is what
   * makes a block teach its own composition.
   */
  recipe: string[];
  /** Feather icon name from `@mrmeg/expo-ui/components/Icon`. */
  icon: IconName;
  /** Position in the gallery; lower sorts first. */
  order: number;
}
