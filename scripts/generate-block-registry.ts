#!/usr/bin/env npx tsx
/**
 * Block registry generator.
 *
 * Scans `client/blocks/<id>/meta.ts` and writes
 * `client/blocks/registry.generated.ts` — a committed barrel that
 * `client/showcase/registry.ts` re-exports as `BLOCKS`. Same contract as the
 * template tier: adding or removing a block is a one-folder change (drop a
 * folder with a `meta.ts`, run `bun run gen:blocks`).
 *
 * The scan/render/CLI logic is shared with the template generator via
 * `scripts/lib/registryCodegen.ts`.
 *
 * Usage:
 *   bun run gen:blocks          # write the file
 *   bun run gen:blocks --check  # exit 1 if the file is stale (CI guard)
 */

import * as path from "path";

import { runRegistryCli, type RegistryTarget } from "./lib/registryCodegen";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const BLOCKS_DIR = path.join(PROJECT_ROOT, "client", "blocks");

export const BLOCK_REGISTRY: RegistryTarget = {
  entriesDir: BLOCKS_DIR,
  outputFile: path.join(BLOCKS_DIR, "registry.generated.ts"),
  generatorPath: "scripts/generate-block-registry.ts",
  packageScript: "gen:blocks",
  entryNoun: "block",
  entryNounPlural: "blocks",
  entryType: "BlockEntry",
  exportName: "BLOCKS",
  collectionLabel: "Blocks",
  sourceDir: "client/blocks",
};

if (require.main === module) {
  runRegistryCli(BLOCK_REGISTRY, process.argv, PROJECT_ROOT);
}
