/**
 * Template registry contract.
 *
 * Catches the drift modes the spec calls out:
 *   - Duplicate ids/routes (would render two cards on the same key, or
 *     two Explore links pointing at the same screen).
 *   - Documented templates that point at routes whose source files have
 *     since been deleted (a stale registry entry would 404 in Explore).
 *   - Component count drifting away from the actual `packages/ui/src/components/`
 *     listing — the count drives the "X components" badge in Explore.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import {
  COMPONENTS,
  DEMOS,
  SCREEN_TEMPLATES,
  getComponentCount,
} from "../registry";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

describe("template registry — uniqueness", () => {
  it("screen template ids are unique", () => {
    const ids = SCREEN_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("screen template routes are unique", () => {
    const routes = SCREEN_TEMPLATES.map((t) => t.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("demo ids are unique", () => {
    const ids = DEMOS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("demo routes are unique", () => {
    const routes = DEMOS.map((d) => d.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("component ids are unique", () => {
    const ids = COMPONENTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("template registry — routes resolve to files on disk", () => {
  function routeToFilePath(route: string): string {
    // /(main)/(demos)/screen-settings → app/(main)/(demos)/screen-settings.tsx
    const stripped = route.replace(/^\//, "");
    return path.join(REPO_ROOT, "app", `${stripped}.tsx`);
  }

  it("every screen template route points to a real .tsx file", () => {
    const missing = SCREEN_TEMPLATES.filter(
      (t) => !fs.existsSync(routeToFilePath(t.route)),
    );
    expect(missing.map((t) => t.route)).toEqual([]);
  });

  it("every demo route points to a real .tsx file", () => {
    const missing = DEMOS.filter((d) => !fs.existsSync(routeToFilePath(d.route)));
    expect(missing.map((d) => d.route)).toEqual([]);
  });
});

describe("template registry — each template is a self-contained folder", () => {
  const templateFile = (id: string, file: string) =>
    path.join(REPO_ROOT, "client", "templates", id, file);

  it("every template id has Screen.tsx, demo.tsx, and meta.ts", () => {
    const incomplete = SCREEN_TEMPLATES.filter(
      (t) =>
        !fs.existsSync(templateFile(t.id, "Screen.tsx")) ||
        !fs.existsSync(templateFile(t.id, "demo.tsx")) ||
        !fs.existsSync(templateFile(t.id, "meta.ts")),
    );
    expect(incomplete.map((t) => t.id)).toEqual([]);
  });

  it("the generated registry is sorted by order then id", () => {
    const sorted = [...SCREEN_TEMPLATES].sort(
      (a, b) => a.order - b.order || a.id.localeCompare(b.id),
    );
    expect(SCREEN_TEMPLATES.map((t) => t.id)).toEqual(sorted.map((t) => t.id));
  });
});

describe("template registry — components", () => {
  it("getComponentCount() matches COMPONENTS.length", () => {
    expect(getComponentCount()).toBe(COMPONENTS.length);
    expect(getComponentCount()).toBeGreaterThan(0);
  });

  it("every component import path resolves to a .tsx file in packages/ui/src/components/", () => {
    const missing = COMPONENTS.filter((c) => {
      const componentName = c.importPath.replace(/^@mrmeg\/expo-ui\/components\//, "");
      return !fs.existsSync(path.join(REPO_ROOT, "packages/ui/src/components", `${componentName}.tsx`));
    });
    expect(missing.map((c) => c.importPath)).toEqual([]);
  });

  it("import paths use the package component namespace", () => {
    for (const entry of COMPONENTS) {
      expect(entry.importPath).toMatch(/^@mrmeg\/expo-ui\/components\/[A-Z][A-Za-z0-9]+$/);
    }
  });
});
