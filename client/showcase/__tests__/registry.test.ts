/**
 * Template registry contract.
 *
 * Catches the drift modes the spec calls out:
 *   - Duplicate ids/routes (would render two cards on the same key, or
 *     two Explore links pointing at the same screen).
 *   - Documented templates that point at routes whose source files have
 *     since been deleted (a stale registry entry would 404 in Explore).
 *   - Component count drifting away from the actual `client/components/ui/`
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

describe("template registry — components", () => {
  it("getComponentCount() matches COMPONENTS.length", () => {
    expect(getComponentCount()).toBe(COMPONENTS.length);
    expect(getComponentCount()).toBeGreaterThan(0);
  });

  it("every component import path resolves to a .tsx file in client/components/ui/", () => {
    const missing = COMPONENTS.filter((c) => {
      const relative = c.importPath.replace(/^@\//, "");
      return !fs.existsSync(path.join(REPO_ROOT, `${relative}.tsx`));
    });
    expect(missing.map((c) => c.importPath)).toEqual([]);
  });

  it("import paths use the @/ alias and live under client/components/ui/", () => {
    for (const entry of COMPONENTS) {
      expect(entry.importPath).toMatch(/^@\/client\/components\/ui\/[A-Z][A-Za-z0-9]+$/);
    }
  });
});
