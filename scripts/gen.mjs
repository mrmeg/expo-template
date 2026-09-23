#!/usr/bin/env node
/**
 * Run every generator, or every generator's freshness check.
 *
 * Each generator stays runnable on its own (`bun run gen:templates`, …); this is
 * the one command for "regenerate everything" and, with `--check`, the one gate
 * `verify` and CI run for every committed generated artifact. A generator added
 * here is checked everywhere; each entry needs a `<name>` and a `<name>:check`
 * root script.
 *
 * Usage:
 *   bun run gen            # regenerate every artifact
 *   bun run gen --check    # fail if any committed artifact is stale
 *   bun run gen --list     # print "<script>\t<artifacts>" per generator, run nothing
 */
import { spawnSync } from "node:child_process";

/**
 * In run order. The icon registry feeds the UI build; the LLM docs walk the
 * demo routes, screens, and components, so they go last.
 */
const GENERATORS = [
  { script: "ui:icons", artifacts: "packages/ui/src/components/iconRegistry.generated.ts" },
  { script: "gen:templates", artifacts: "client/templates/registry.generated.ts" },
  { script: "gen:blocks", artifacts: "client/blocks/registry.generated.ts" },
  { script: "docs:llms", artifacts: "llms-full.txt, llms-examples.txt" },
];

const argv = process.argv.slice(2);

if (argv.includes("-h") || argv.includes("--help")) {
  console.log(`
Usage:
  bun run gen [--check] [--list]

Generators, in order:
${GENERATORS.map(({ script, artifacts }) => `  ${script.padEnd(15)} ${artifacts}`).join("\n")}

Options:
  --check     Run each generator's :check script instead; fail if any artifact is stale
  --list      Print "<script>\\t<artifacts>" per generator without running anything
  -h, --help  Usage info
`);
  process.exit(0);
}

const unknown = argv.filter((arg) => !["--check", "--list"].includes(arg));
if (unknown.length > 0) {
  console.error(`gen: unknown argument(s) ${unknown.join(" ")}. See bun run gen --help.`);
  process.exit(1);
}

if (argv.includes("--list")) {
  for (const { script, artifacts } of GENERATORS) console.log(`${script}\t${artifacts}`);
  process.exit(0);
}

const check = argv.includes("--check");
const failed = [];

for (const { script } of GENERATORS) {
  const name = check ? `${script}:check` : script;
  console.log(`\n=== gen: bun run ${name}`);
  const result = spawnSync("bun", ["run", name], { stdio: "inherit" });
  if (result.error) console.error(`gen: failed to spawn bun: ${result.error.message}`);
  if (result.error || result.status !== 0) failed.push(name);
}

if (failed.length > 0) {
  console.error(`\ngen: ${failed.length} of ${GENERATORS.length} failed: ${failed.join(", ")}`);
  if (check) console.error("gen: regenerate with `bun run gen` and commit the result.");
  process.exit(1);
}

console.log(`\ngen: ${check ? "every generated artifact is fresh" : "regenerated every artifact"} (${GENERATORS.length} generators)`);
