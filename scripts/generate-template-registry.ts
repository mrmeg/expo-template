#!/usr/bin/env npx tsx
/**
 * Template registry generator.
 *
 * Scans `client/templates/<id>/meta.ts` and writes
 * `client/templates/registry.generated.ts` — a committed barrel that
 * `client/showcase/registry.ts` re-exports as `SCREEN_TEMPLATES`. This makes
 * adding/removing a screen template a one-folder change: drop a folder with a
 * `meta.ts`, run `bun run gen:templates`, done.
 *
 * The scan/render/CLI logic lives in `scripts/lib/registryCodegen.ts` and is
 * shared with the blocks tier (`scripts/generate-block-registry.ts`), so the
 * two committed registries can't drift in shape or `--check` behavior.
 *
 * Usage:
 *   bun run gen:templates          # write the file
 *   bun run gen:templates --check  # exit 1 if the file is stale (CI guard)
 */

import * as path from "path";

import { runRegistryCli, type RegistryTarget } from "./lib/registryCodegen";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const TEMPLATES_DIR = path.join(PROJECT_ROOT, "client", "templates");

export const TEMPLATE_REGISTRY: RegistryTarget = {
  entriesDir: TEMPLATES_DIR,
  outputFile: path.join(TEMPLATES_DIR, "registry.generated.ts"),
  generatorPath: "scripts/generate-template-registry.ts",
  packageScript: "gen:templates",
  entryNoun: "template",
  entryNounPlural: "templates",
  entryType: "ScreenTemplateEntry",
  exportName: "SCREEN_TEMPLATES",
  collectionLabel: "Screen templates",
  sourceDir: "client/templates",
};

if (require.main === module) {
  runRegistryCli(TEMPLATE_REGISTRY, process.argv, PROJECT_ROOT);
}
