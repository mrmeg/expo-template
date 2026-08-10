/**
 * Showcase filter + search helpers.
 *
 * These are the pure functions behind the gallery chips and the Explore search
 * field, so they're tested directly against fixtures (behaviour) *and* against
 * the real registries (the wiring the galleries depend on: every category has
 * a label, every hit carries a usable route).
 */

import {
  ALL_CATEGORIES,
  BLOCK_CATEGORIES,
  BLOCK_CATEGORY_LABELS,
  COMPONENT_CATEGORIES,
  COMPONENT_CATEGORY_DESCRIPTIONS,
  COMPONENT_CATEGORY_LABELS,
  COMPONENT_CATEGORY_SHORT_LABELS,
  SHOWCASE_ROUTES,
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABELS,
  componentDetailRoute,
  countByCategory,
  filterBlocks,
  filterComponents,
  filterTemplates,
  groupComponentsByCategory,
  searchRegistries,
} from "../filters";
import { BLOCKS, COMPONENTS, SCREEN_TEMPLATES, type ComponentEntry } from "../registry";
import type { BlockEntry } from "@/client/blocks/types";
import type { ScreenTemplateEntry } from "@/client/templates/types";

// ---------------------------------------------------------------------------
// Fixtures — small, so an assertion failure names the cause, not the registry
// ---------------------------------------------------------------------------

const FIXTURE_COMPONENTS: ComponentEntry[] = [
  { id: "Button", importPath: "@mrmeg/expo-ui/components/Button", category: "form" },
  { id: "Switch", importPath: "@mrmeg/expo-ui/components/Switch", category: "form" },
  { id: "Badge", importPath: "@mrmeg/expo-ui/components/Badge", category: "feedback" },
  { id: "Tabs", importPath: "@mrmeg/expo-ui/components/Tabs", category: "navigation" },
];

const FIXTURE_BLOCKS: BlockEntry[] = [
  {
    id: "hero",
    label: "Hero",
    description: "Eyebrow, headline, and paired CTAs",
    category: "marketing",
    recipe: ["SectionHeader", "Button"],
    icon: "zap",
    order: 10,
  },
  {
    id: "stat-row",
    label: "Stat row",
    description: "Metric cards in a row",
    category: "data",
    recipe: ["StatCard", "SectionHeader"],
    icon: "bar-chart-2",
    order: 20,
  },
];

const FIXTURE_TEMPLATES: ScreenTemplateEntry[] = [
  {
    id: "pricing",
    route: "/(main)/(demos)/screen-pricing",
    label: "Pricing",
    description: "Plans & comparison",
    icon: "credit-card",
    order: 40,
    category: "marketing",
  },
  {
    id: "dashboard",
    route: "/(main)/(demos)/screen-dashboard",
    label: "Dashboard",
    description: "Metrics & activity feed",
    icon: "bar-chart-2",
    order: 80,
    category: "data",
  },
  {
    // No category — the copied-in-folder case the optional field exists for.
    id: "uncategorised",
    route: "/(main)/(demos)/screen-uncategorised",
    label: "Uncategorised",
    description: "Registered without a category",
    icon: "box",
    order: 999,
  },
];

// ---------------------------------------------------------------------------
// Category filtering
// ---------------------------------------------------------------------------

describe("filterComponents", () => {
  it("returns every entry for the All chip", () => {
    expect(filterComponents(ALL_CATEGORIES, FIXTURE_COMPONENTS).map((c) => c.id)).toEqual([
      "Button",
      "Switch",
      "Badge",
      "Tabs",
    ]);
  });

  it("returns only the chosen category, preserving registry order", () => {
    expect(filterComponents("form", FIXTURE_COMPONENTS).map((c) => c.id)).toEqual([
      "Button",
      "Switch",
    ]);
  });

  it("returns an empty list for a category with no entries", () => {
    expect(filterComponents("overlay", FIXTURE_COMPONENTS)).toEqual([]);
  });

  it("never hands back the input array, so a caller can't mutate the registry", () => {
    expect(filterComponents(ALL_CATEGORIES, FIXTURE_COMPONENTS)).not.toBe(FIXTURE_COMPONENTS);
  });

  it("defaults to the real COMPONENTS registry", () => {
    expect(filterComponents(ALL_CATEGORIES)).toHaveLength(COMPONENTS.length);
  });
});

describe("filterBlocks", () => {
  it("returns every entry for the All chip", () => {
    expect(filterBlocks(ALL_CATEGORIES, FIXTURE_BLOCKS)).toHaveLength(2);
  });

  it("returns only the chosen category", () => {
    expect(filterBlocks("data", FIXTURE_BLOCKS).map((b) => b.id)).toEqual(["stat-row"]);
  });

  it("defaults to the real BLOCKS registry", () => {
    expect(filterBlocks(ALL_CATEGORIES)).toHaveLength(BLOCKS.length);
  });
});

describe("filterTemplates", () => {
  it("includes category-less entries under the All chip", () => {
    expect(filterTemplates(ALL_CATEGORIES, FIXTURE_TEMPLATES).map((t) => t.id)).toContain(
      "uncategorised",
    );
  });

  it("excludes category-less entries from every named category", () => {
    for (const category of TEMPLATE_CATEGORIES) {
      const ids = filterTemplates(category, FIXTURE_TEMPLATES).map((t) => t.id);
      expect(ids).not.toContain("uncategorised");
    }
  });

  it("returns only the chosen category", () => {
    expect(filterTemplates("marketing", FIXTURE_TEMPLATES).map((t) => t.id)).toEqual([
      "pricing",
    ]);
  });

  it("defaults to the real SCREEN_TEMPLATES registry", () => {
    expect(filterTemplates(ALL_CATEGORIES)).toHaveLength(SCREEN_TEMPLATES.length);
  });
});

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

describe("countByCategory", () => {
  it("counts entries per category", () => {
    expect(countByCategory(FIXTURE_COMPONENTS, COMPONENT_CATEGORIES)).toMatchObject({
      form: 2,
      feedback: 1,
      navigation: 1,
    });
  });

  it("keeps zero-count categories in the result so the chip row is stable", () => {
    const counts = countByCategory(FIXTURE_COMPONENTS, COMPONENT_CATEGORIES);
    expect(counts.overlay).toBe(0);
    expect(Object.keys(counts).sort()).toEqual([...COMPONENT_CATEGORIES].sort());
  });

  it("ignores entries whose category is absent from the key list", () => {
    const counts = countByCategory(FIXTURE_TEMPLATES, TEMPLATE_CATEGORIES);
    expect(counts.marketing).toBe(1);
    expect(counts.data).toBe(1);
    // The uncategorised fixture contributed to nothing.
    expect(Object.values(counts).reduce((sum, n) => sum + n, 0)).toBe(2);
  });

  it("sums to the registry length when every entry is categorised", () => {
    const counts = countByCategory(COMPONENTS, COMPONENT_CATEGORIES);
    expect(Object.values(counts).reduce((sum, n) => sum + n, 0)).toBe(COMPONENTS.length);
  });
});

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

describe("groupComponentsByCategory", () => {
  it("emits groups in COMPONENT_CATEGORIES order", () => {
    const groups = groupComponentsByCategory(FIXTURE_COMPONENTS);
    expect(groups.map((g) => g.category)).toEqual(["form", "feedback", "navigation"]);
  });

  it("drops empty categories rather than rendering a bare heading", () => {
    const groups = groupComponentsByCategory([FIXTURE_COMPONENTS[0]]);
    expect(groups).toHaveLength(1);
    expect(groups[0].entries.map((c) => c.id)).toEqual(["Button"]);
  });

  it("accounts for every real component — nothing in the package is invisible", () => {
    const grouped = groupComponentsByCategory().flatMap((group) => group.entries);
    expect(grouped).toHaveLength(COMPONENTS.length);
    expect(grouped.map((c) => c.id)).toContain("SegmentedControl");
  });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const FIXTURE_REGISTRIES = {
  components: FIXTURE_COMPONENTS,
  blocks: FIXTURE_BLOCKS,
  templates: FIXTURE_TEMPLATES,
};

describe("searchRegistries", () => {
  it("returns nothing for an empty or whitespace-only query", () => {
    expect(searchRegistries("", FIXTURE_REGISTRIES)).toEqual([]);
    expect(searchRegistries("   ", FIXTURE_REGISTRIES)).toEqual([]);
  });

  it("matches component ids case-insensitively", () => {
    const hits = searchRegistries("bUtt", FIXTURE_REGISTRIES);
    // The component itself, plus the block whose recipe uses it.
    expect(hits.map((h) => `${h.kind}:${h.id}`)).toEqual(["component:Button", "block:hero"]);
  });

  it("matches a component's category name", () => {
    const hits = searchRegistries("feedback", FIXTURE_REGISTRIES);
    expect(hits.map((h) => `${h.kind}:${h.id}`)).toEqual(["component:Badge"]);
  });

  it("matches a template's label and description", () => {
    expect(searchRegistries("plans", FIXTURE_REGISTRIES).map((h) => h.id)).toEqual(["pricing"]);
    expect(searchRegistries("Dashboard", FIXTURE_REGISTRIES).map((h) => h.id)).toEqual([
      "dashboard",
    ]);
  });

  it("matches a block through its recipe, so 'StatCard' finds the stat row", () => {
    const hits = searchRegistries("statcard", FIXTURE_REGISTRIES);
    expect(hits.map((h) => `${h.kind}:${h.id}`)).toEqual(["block:stat-row"]);
  });

  it("matches on category name", () => {
    const hits = searchRegistries("marketing", FIXTURE_REGISTRIES);
    expect(hits.map((h) => `${h.kind}:${h.id}`)).toEqual(["block:hero", "template:pricing"]);
  });

  it("orders hits components → blocks → templates", () => {
    // "a" appears in every tier's fixtures.
    const kinds = searchRegistries("a", FIXTURE_REGISTRIES).map((h) => h.kind);
    const firstBlock = kinds.indexOf("block");
    const firstTemplate = kinds.indexOf("template");
    expect(kinds[0]).toBe("component");
    expect(firstBlock).toBeGreaterThan(0);
    expect(firstTemplate).toBeGreaterThan(firstBlock);
  });

  it("returns nothing for a query that matches nothing", () => {
    expect(searchRegistries("zzzznope", FIXTURE_REGISTRIES)).toEqual([]);
  });

  it("routes a component hit to its detail screen", () => {
    const [hit] = searchRegistries("Button", FIXTURE_REGISTRIES);
    expect(hit.route).toBe(`${SHOWCASE_ROUTES.components}/Button`);
  });

  it("routes a block hit to the blocks gallery", () => {
    const [hit] = searchRegistries("hero", FIXTURE_REGISTRIES);
    expect(hit.route).toBe(SHOWCASE_ROUTES.blocks);
  });

  it("routes a template hit through the entry's own route field", () => {
    const [hit] = searchRegistries("pricing", FIXTURE_REGISTRIES);
    // Not a path built from the id: `detail-hero` proves ids aren't routes.
    expect(hit.route).toBe(FIXTURE_TEMPLATES[0].route);
  });

  it("uses each template's registered route, including the non screen-* one", () => {
    const hit = searchRegistries("detail-hero").find((h) => h.kind === "template");
    const entry = SCREEN_TEMPLATES.find((t) => t.id === "detail-hero");
    expect(hit?.route).toBe(entry?.route);
    expect(hit?.route).not.toContain("screen-detail-hero");
  });

  it("labels each hit's category for the result badge", () => {
    const hits = searchRegistries("Button", FIXTURE_REGISTRIES);
    expect(hits[0].categoryLabel).toBe("Form");
  });

  it("leaves categoryLabel undefined for a template with no category", () => {
    const [hit] = searchRegistries("uncategorised", FIXTURE_REGISTRIES);
    expect(hit.categoryLabel).toBeUndefined();
  });

  it("searches the real registries by default", () => {
    const hits = searchRegistries("SegmentedControl");
    expect(hits.map((h) => `${h.kind}:${h.id}`)).toContain("component:SegmentedControl");
  });
});

// ---------------------------------------------------------------------------
// Presentation tables stay in sync with the registries
// ---------------------------------------------------------------------------

describe("category tables cover every registry category", () => {
  it("COMPONENT_CATEGORIES lists every category the registry uses", () => {
    const used = new Set(COMPONENTS.map((c) => c.category));
    expect([...used].sort()).toEqual([...COMPONENT_CATEGORIES].sort());
  });

  it("BLOCK_CATEGORIES is a superset of the categories BLOCKS uses", () => {
    for (const block of BLOCKS) {
      expect(BLOCK_CATEGORIES).toContain(block.category);
    }
  });

  it("TEMPLATE_CATEGORIES covers every category SCREEN_TEMPLATES uses", () => {
    for (const template of SCREEN_TEMPLATES) {
      if (template.category) expect(TEMPLATE_CATEGORIES).toContain(template.category);
    }
  });

  it("every listed category has a label (and components a short label + description)", () => {
    for (const category of COMPONENT_CATEGORIES) {
      expect(COMPONENT_CATEGORY_LABELS[category]).toBeTruthy();
      expect(COMPONENT_CATEGORY_SHORT_LABELS[category]).toBeTruthy();
      expect(COMPONENT_CATEGORY_DESCRIPTIONS[category]).toBeTruthy();
    }
    for (const category of BLOCK_CATEGORIES) {
      expect(BLOCK_CATEGORY_LABELS[category]).toBeTruthy();
    }
    for (const category of TEMPLATE_CATEGORIES) {
      expect(TEMPLATE_CATEGORY_LABELS[category]).toBeTruthy();
    }
  });
});

describe("componentDetailRoute", () => {
  it("hangs the component id off the components gallery route", () => {
    expect(componentDetailRoute("BottomSheet")).toBe(
      "/(main)/(demos)/components/BottomSheet",
    );
  });
});
