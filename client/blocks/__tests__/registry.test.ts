/**
 * Block registry contract.
 *
 * The blocks tier is codegen-backed the same way the template tier is, so it
 * inherits the same drift modes: duplicate ids (two gallery cards on one key),
 * an entry whose folder was deleted, an entry missing the `Block.tsx` the
 * gallery imports, or a `recipe` naming a component that no longer exists.
 *
 * Mirrors `client/showcase/__tests__/registry.test.ts` for the template tier.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { BLOCKS, COMPONENTS, getBlockCount } from "@/client/showcase/registry";
import type { BlockCategory } from "@/client/blocks/types";

const BLOCKS_DIR = path.resolve(__dirname, "..");

const CATEGORIES: BlockCategory[] = [
  "marketing",
  "data",
  "social-proof",
  "auth",
  "content",
];

describe("block registry — shape", () => {
  it("is non-empty", () => {
    expect(BLOCKS.length).toBeGreaterThan(0);
  });

  it("block ids are unique", () => {
    const ids = BLOCKS.map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("block ids are kebab-case, matching their folder name", () => {
    for (const block of BLOCKS) {
      expect(block.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("every block has a label and a description", () => {
    for (const block of BLOCKS) {
      expect(block.label.length).toBeGreaterThan(0);
      expect(block.description.length).toBeGreaterThan(0);
    }
  });

  it("every category is one of the documented values", () => {
    for (const block of BLOCKS) {
      expect(CATEGORIES).toContain(block.category);
    }
  });

  it("orders are unique, so the sort is deterministic without the id tiebreak", () => {
    const orders = BLOCKS.map((block) => block.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("is sorted by order then id", () => {
    const sorted = [...BLOCKS].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    expect(BLOCKS.map((block) => block.id)).toEqual(sorted.map((block) => block.id));
  });
});

describe("block registry — each block is a self-contained folder", () => {
  const blockFile = (id: string, file: string) => path.join(BLOCKS_DIR, id, file);

  it("every block id has Block.tsx and meta.ts", () => {
    const incomplete = BLOCKS.filter(
      (block) =>
        !fs.existsSync(blockFile(block.id, "Block.tsx")) ||
        !fs.existsSync(blockFile(block.id, "meta.ts")),
    );
    expect(incomplete.map((block) => block.id)).toEqual([]);
  });

  it("every block folder documents itself with a README", () => {
    const undocumented = BLOCKS.filter((block) => !fs.existsSync(blockFile(block.id, "README.md")));
    expect(undocumented.map((block) => block.id)).toEqual([]);
  });

  it("every folder with a meta.ts is registered (no orphan folders)", () => {
    const onDisk = fs
      .readdirSync(BLOCKS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "__tests__")
      .map((entry) => entry.name)
      .filter((name) => fs.existsSync(path.join(BLOCKS_DIR, name, "meta.ts")))
      .sort();

    expect([...BLOCKS.map((block) => block.id)].sort()).toEqual(onDisk);
  });
});

describe("block registry — recipes", () => {
  it("every recipe names at least one component", () => {
    for (const block of BLOCKS) {
      expect(block.recipe.length).toBeGreaterThan(0);
    }
  });

  it("every recipe entry resolves to a showcase component id", () => {
    const componentIds = new Set(COMPONENTS.map((component) => component.id));
    const unknown = BLOCKS.flatMap((block) =>
      block.recipe.filter((id) => !componentIds.has(id)).map((id) => `${block.id}: ${id}`),
    );

    expect(unknown).toEqual([]);
  });

  it("recipes have no duplicate entries", () => {
    for (const block of BLOCKS) {
      expect(new Set(block.recipe).size).toBe(block.recipe.length);
    }
  });
});

describe("block registry — derived helpers", () => {
  it("getBlockCount() matches BLOCKS.length", () => {
    expect(getBlockCount()).toBe(BLOCKS.length);
    expect(getBlockCount()).toBeGreaterThan(0);
  });
});
