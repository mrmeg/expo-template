/**
 * Showcase filtering + search.
 *
 * Pure functions over the three registries (`COMPONENTS`, `BLOCKS`,
 * `SCREEN_TEMPLATES`) that the galleries and the Explore search field share.
 * Nothing here touches React or the theme, so the filter behaviour is unit
 * tested directly rather than through a rendered screen.
 *
 * Category *labels* live here too: `registry.ts` stays serializable data, and
 * a category's display string is presentation, not registry content.
 */

import type { BlockCategory, BlockEntry } from "@/client/blocks/types";
import type {
  ScreenTemplateCategory,
  ScreenTemplateEntry,
} from "@/client/templates/types";

import {
  BLOCKS,
  COMPONENTS,
  SCREEN_TEMPLATES,
  type ComponentCategory,
  type ComponentEntry,
} from "./registry";

// ---------------------------------------------------------------------------
// Category presentation
// ---------------------------------------------------------------------------

/** Chip/section order for component categories, matching mockups/02-components.html. */
export const COMPONENT_CATEGORIES: ComponentCategory[] = [
  "form",
  "feedback",
  "navigation",
  "overlay",
  "layout",
  "typography",
];

export const COMPONENT_CATEGORY_LABELS: Record<ComponentCategory, string> = {
  form: "Form",
  feedback: "Feedback",
  navigation: "Navigation",
  overlay: "Overlay",
  layout: "Layout",
  typography: "Typography",
};

/** Compact labels for the two-up card meta row, where width is tight. */
export const COMPONENT_CATEGORY_SHORT_LABELS: Record<ComponentCategory, string> = {
  form: "form",
  feedback: "fdbk",
  navigation: "nav",
  overlay: "overlay",
  layout: "layout",
  typography: "type",
};

export const COMPONENT_CATEGORY_DESCRIPTIONS: Record<ComponentCategory, string> = {
  form: "Inputs, choices, and actions. All controlled, all keyboard-aware.",
  feedback: "Status, progress, and loading states.",
  navigation: "Disclosure and view switching.",
  overlay: "Sheets, dialogs, and floating surfaces — native-feeling on every platform.",
  layout: "Structure for lists, cards, and metrics.",
  typography: "Text and iconography, themed and font-overridable per host app.",
};

/** Chip order for block categories, matching mockups/03-blocks.html. */
export const BLOCK_CATEGORIES: BlockCategory[] = [
  "marketing",
  "data",
  "social-proof",
  "auth",
  "content",
];

export const BLOCK_CATEGORY_LABELS: Record<BlockCategory, string> = {
  marketing: "Marketing",
  data: "Data",
  "social-proof": "Social proof",
  auth: "Auth",
  content: "Content",
};

/** Chip order for template categories, matching mockups/04-templates.html. */
export const TEMPLATE_CATEGORIES: ScreenTemplateCategory[] = [
  "marketing",
  "data",
  "content",
  "forms-auth",
  "states",
];

export const TEMPLATE_CATEGORY_LABELS: Record<ScreenTemplateCategory, string> = {
  marketing: "Marketing",
  data: "Data",
  content: "Content",
  "forms-auth": "Forms & auth",
  states: "States",
};

// ---------------------------------------------------------------------------
// Category filtering
// ---------------------------------------------------------------------------

/** The "All" chip every gallery leads with. */
export const ALL_CATEGORIES = "all" as const;

export type CategoryFilter<T extends string> = T | typeof ALL_CATEGORIES;

export function filterComponents(
  category: CategoryFilter<ComponentCategory>,
  entries: ComponentEntry[] = COMPONENTS,
): ComponentEntry[] {
  return category === ALL_CATEGORIES
    ? [...entries]
    : entries.filter((entry) => entry.category === category);
}

export function filterBlocks(
  category: CategoryFilter<BlockCategory>,
  entries: BlockEntry[] = BLOCKS,
): BlockEntry[] {
  return category === ALL_CATEGORIES
    ? [...entries]
    : entries.filter((entry) => entry.category === category);
}

/**
 * Templates in a category. Entries with no `category` only ever appear under
 * "All" — the field is optional so a copied-in template folder still registers.
 */
export function filterTemplates(
  category: CategoryFilter<ScreenTemplateCategory>,
  entries: ScreenTemplateEntry[] = SCREEN_TEMPLATES,
): ScreenTemplateEntry[] {
  return category === ALL_CATEGORIES
    ? [...entries]
    : entries.filter((entry) => entry.category === category);
}

/**
 * `{ [category]: count }` for the chip/section badges. Every category in
 * `keys` gets an entry, including the zero counts — a category that drops to
 * zero should render "0", not vanish and silently shift the chip row.
 */
export function countByCategory<C extends string>(
  entries: { category?: C }[],
  keys: readonly C[],
): Record<C, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<C, number>;
  for (const entry of entries) {
    if (entry.category && entry.category in counts) counts[entry.category] += 1;
  }
  return counts;
}

/**
 * Components grouped into the mockup's category sections, in
 * `COMPONENT_CATEGORIES` order. Empty categories are dropped so the gallery
 * never renders a heading with nothing under it.
 */
export function groupComponentsByCategory(
  entries: ComponentEntry[] = COMPONENTS,
): { category: ComponentCategory; entries: ComponentEntry[] }[] {
  return COMPONENT_CATEGORIES.map((category) => ({
    category,
    entries: entries.filter((entry) => entry.category === category),
  })).filter((group) => group.entries.length > 0);
}

// ---------------------------------------------------------------------------
// Explore previews
// ---------------------------------------------------------------------------

/**
 * The components shown in Explore's horizontal rail, in this order.
 *
 * A hand-picked shortlist rather than "the first N of `COMPONENTS`": the rail
 * is the first thing an adopter sees, so it leads with the primitives every app
 * needs. The order matches mockups/01-home.html §Scale 01. Ids that leave the
 * registry are skipped by `pickComponents`, so a rename can't blank the rail.
 */
export const EXPLORE_RAIL_IDS = [
  "Button",
  "Switch",
  "InputOTP",
  "Slider",
  "Badge",
  "Tabs",
  "Progress",
  "Skeleton",
] as const;

/**
 * The block Explore spotlights. `stat-row` per mockups/05-mobile.html frame 1 —
 * it's the block that reads clearly at a glance and shows the recipe idea
 * (StatCard + SectionHeader) in one line.
 */
export const EXPLORE_BLOCK_SPOTLIGHT_ID = "stat-row";

/**
 * How many templates Explore previews before deferring to the gallery.
 *
 * Four, per mockups/01-home.html §Scale 03. Templates are sorted by `order`,
 * so this is the four lowest-ordered ones — deliberately including Pricing
 * (order 40), which `.maestro/templates.yml` taps to prove the generated
 * registry end to end.
 */
export const EXPLORE_TEMPLATE_PREVIEW_COUNT = 4;

/**
 * Registry entries for the given ids, in the order asked for, skipping ids
 * that aren't in the registry. Used for hand-picked shortlists (the Explore
 * rail) where the order is editorial rather than registry order.
 */
export function pickComponents(
  ids: readonly string[],
  entries: ComponentEntry[] = COMPONENTS,
): ComponentEntry[] {
  return ids
    .map((id) => entries.find((entry) => entry.id === id))
    .filter((entry): entry is ComponentEntry => entry !== undefined);
}

/**
 * The spotlight block, falling back to the first registered block if the
 * spotlight id ever leaves the registry — Explore renders a block section
 * either way rather than dropping a tier out of the three-scale story.
 */
export function pickSpotlightBlock(
  id: string = EXPLORE_BLOCK_SPOTLIGHT_ID,
  entries: BlockEntry[] = BLOCKS,
): BlockEntry | undefined {
  return entries.find((entry) => entry.id === id) ?? entries[0];
}

// ---------------------------------------------------------------------------
// Gallery routes
// ---------------------------------------------------------------------------

/**
 * The gallery screens, one per scale, plus the original kitchen-sink showcase
 * (still linked from the components gallery header).
 *
 * Template destinations are NOT here — every screen template carries its own
 * `route` in `meta.ts`, and navigating by that field is what keeps the
 * registry the single source of truth (`detail-hero` is not `screen-*`).
 */
export const SHOWCASE_ROUTES = {
  components: "/(main)/(demos)/components",
  blocks: "/(main)/(demos)/blocks",
  templates: "/(main)/(demos)/templates",
  kitchenSink: "/(main)/(demos)/showcase",
} as const;

/** Detail route for one component id, e.g. `Button` → `.../components/Button`. */
export function componentDetailRoute(id: string): string {
  return `${SHOWCASE_ROUTES.components}/${id}`;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export type SearchHitKind = "component" | "block" | "template";

export interface SearchHit {
  /** Which tier the hit came from — drives the badge and the destination. */
  kind: SearchHitKind;
  /** Registry id, unique within a tier. */
  id: string;
  /** Display label. */
  label: string;
  /** One-line supporting copy, when the tier has one. */
  description?: string;
  /** Human-readable category label, when the entry has a category. */
  categoryLabel?: string;
  /**
   * Where tapping the hit goes. Components get their detail route, blocks the
   * blocks gallery, and templates their own `meta.route` — never a path
   * assembled from the id.
   */
  route: string;
}

/** Case- and whitespace-insensitive substring test used by every field. */
function matches(haystack: string | undefined, needle: string): boolean {
  return !!haystack && haystack.toLowerCase().includes(needle);
}

/**
 * Client-side search across all three registries, ordered components → blocks
 * → templates so the smallest scale (and the most common lookup, a component
 * name) surfaces first.
 *
 * A blank or whitespace-only query returns `[]` rather than everything: the
 * Explore field shows results *instead of* the three-scale sections, so an
 * empty query has to mean "not searching".
 */
export function searchRegistries(
  query: string,
  registries: {
    components?: ComponentEntry[];
    blocks?: BlockEntry[];
    templates?: ScreenTemplateEntry[];
  } = {},
): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const {
    components = COMPONENTS,
    blocks = BLOCKS,
    templates = SCREEN_TEMPLATES,
  } = registries;

  const hits: SearchHit[] = [];

  for (const entry of components) {
    if (matches(entry.id, needle) || matches(entry.category, needle)) {
      hits.push({
        kind: "component",
        id: entry.id,
        label: entry.id,
        description: entry.importPath,
        categoryLabel: COMPONENT_CATEGORY_LABELS[entry.category],
        route: componentDetailRoute(entry.id),
      });
    }
  }

  for (const entry of blocks) {
    const inRecipe = entry.recipe.some((component) => matches(component, needle));
    if (
      matches(entry.id, needle) ||
      matches(entry.label, needle) ||
      matches(entry.description, needle) ||
      matches(entry.category, needle) ||
      inRecipe
    ) {
      hits.push({
        kind: "block",
        id: entry.id,
        label: entry.label,
        description: entry.description,
        categoryLabel: BLOCK_CATEGORY_LABELS[entry.category],
        route: SHOWCASE_ROUTES.blocks,
      });
    }
  }

  for (const entry of templates) {
    if (
      matches(entry.id, needle) ||
      matches(entry.label, needle) ||
      matches(entry.description, needle) ||
      matches(entry.category, needle)
    ) {
      hits.push({
        kind: "template",
        id: entry.id,
        label: entry.label,
        description: entry.description,
        categoryLabel: entry.category
          ? TEMPLATE_CATEGORY_LABELS[entry.category]
          : undefined,
        route: entry.route,
      });
    }
  }

  return hits;
}
