import type { IconName } from "@mrmeg/expo-ui/components/Icon";

/**
 * Loose grouping used by the templates gallery's filter chips.
 *
 * Deliberately optional on `ScreenTemplateEntry`: the codegen only collects
 * `meta` objects, so a template folder copied in from elsewhere without a
 * category still registers and still renders — it just lands outside every
 * category chip (the "All" chip always includes it).
 */
export type ScreenTemplateCategory =
  | "marketing"
  | "data"
  | "content"
  | "forms-auth"
  | "states";

/**
 * Metadata for a screen template.
 *
 * Each template folder under `client/templates/<id>/` exports a `meta` of this
 * shape from its `meta.ts`. The registry codegen
 * (`scripts/generate-template-registry.ts`) collects every `meta` into
 * `registry.generated.ts`, so adding or removing a template is a one-folder
 * change — no central list to edit.
 */
export interface ScreenTemplateEntry {
  /** Stable identifier, used as React key and for tests. Matches the folder name. */
  id: string;
  /** Route path that Expo Router renders for the demo. */
  route: string;
  /** Display label in the Explore grid. */
  label: string;
  /** One-line description shown beneath the label. */
  description: string;
  /** Feather icon name from `@mrmeg/expo-ui/components/Icon`. */
  icon: IconName;
  /** Position in the Explore grid; lower sorts first. */
  order: number;
  /**
   * Optional grouping for the templates gallery's filter chips. Entries
   * without one still render under "All" — see `ScreenTemplateCategory`.
   */
  category?: ScreenTemplateCategory;
}
