#!/usr/bin/env node
/**
 * Generate the `@mrmeg/expo-ui` component-docs artifacts from their sources.
 *
 * Sources, hand-written: `packages/ui/docs/components/<Family>.md` (one per
 * component family; frontmatter + rules) and `packages/ui/LLM_USAGE.md` (the
 * cross-cutting rules). From them this writes:
 *
 *   - the Use-Case Index table inside `packages/ui/LLM_USAGE.md`, between the
 *     `<!-- component-index:start -->` and `<!-- component-index:end -->` markers
 *   - `packages/ui/docs/components/index.md`, one line per family
 *   - `packages/ui/llms-full.md`, `LLM_USAGE.md` followed by every component doc
 *
 * It also fails (in both modes, before writing anything) when:
 *   - an export of `src/components/index.ts` is in no doc's `components` list
 *     and is not on `INTERNAL_COMPONENTS`;
 *   - a listed name is not a real component, or is listed twice;
 *   - a doc's frontmatter or `# <Family>` heading is malformed;
 *   - a file is over its size limit (`LIMITS`).
 *
 * The component list comes from the lint plugin's own extractor
 * (`packages/lint/lib/source.js`), the one behind `dist/design-system.json`.
 * That extractor reads the exported capitalised values of every module the
 * barrel `export *`s, plus compound members (`Dialog.Trigger`). It does not see
 * lowercase exports (hooks, helpers), types, `export … from` re-exports,
 * `export class`, modules the barrel does not `export *`, or the subpath-only
 * media components; the last two are checked only in reverse (a name a doc
 * lists must exist), never for completeness.
 *
 * Usage:
 *   node scripts/build-ui-docs.mjs           # via `bun run docs:ui`
 *   node scripts/build-ui-docs.mjs --check   # via `bun run docs:ui:check`; writes nothing
 */
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter, renderDocForBundle } from "./lib/uiComponentDocs.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const uiDir = join(root, "packages/ui");
const docsDir = join(uiDir, "docs/components");
const usagePath = join(uiDir, "LLM_USAGE.md");
const indexPath = join(docsDir, "index.md");
const fullPath = join(uiDir, "llms-full.md");
const llmsTxtPath = join(uiDir, "llms.txt");

/** Hard limits, in bytes (1 KB = 1000, as the spec counts). */
const LIMITS = {
  componentDoc: 8000,
  usage: 25000,
  llmsTxt: 3000,
};

/**
 * Barrel exports that have no `docs/components/<Family>.md`. Keep this short:
 * a component belongs in a doc's `components` list unless it is one of these.
 * Each reason says where the export is documented instead. An entry that is no
 * longer a barrel export, or that a doc also lists, fails the build.
 */
const INTERNAL_COMPONENTS = new Map([
  ["UIProvider", "provider: documented in LLM_USAGE.md, Required App Setup"],
]);

const INDEX_START = "<!-- component-index:start -->";
const INDEX_END = "<!-- component-index:end -->";
const GENERATED = "<!-- GENERATED FILE - do not edit. Rebuild with `bun run docs:ui`. -->";

const checkMode = process.argv.includes("--check");
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== "--check");
if (unknownArgs.length > 0) {
  console.error(`docs:ui: unknown argument(s) ${unknownArgs.join(" ")}. Usage: build-ui-docs.mjs [--check]`);
  process.exit(1);
}

const byteLength = (text) => Buffer.byteLength(text, "utf8");

/** Plain code-point order, so the output never depends on the locale. */
const compare = (a, b) => {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x !== y) return x < y ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
};

async function loadFamilies(problems) {
  const files = (await readdir(docsDir)).filter((file) => file.endsWith(".md") && file !== "index.md").sort(compare);
  const families = [];
  for (const file of files) {
    const name = file.slice(0, -3);
    const label = `docs/components/${file}`;
    const text = await readFile(join(docsDir, file), "utf8");
    const { data, body } = parseFrontmatter(text, label, problems);

    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) problems.push(`${label}: file name must be an identifier-like family name`);
    if (!body.startsWith(`# ${name}\n`)) problems.push(`${label}: the body must start with a "# ${name}" heading`);
    if (byteLength(text) > LIMITS.componentDoc) {
      problems.push(`${label}: ${byteLength(text)} bytes is over the ${LIMITS.componentDoc}-byte limit; split the family`);
    }

    const components = data.components;
    if (!Array.isArray(components) || components.length === 0) problems.push(`${label}: "components" must list at least one name`);
    if (typeof data["use-for"] !== "string" || data["use-for"] === "") problems.push(`${label}: "use-for" is required`);
    if ("instead-of" in data && (typeof data["instead-of"] !== "string" || data["instead-of"] === "")) {
      problems.push(`${label}: "instead-of" must be a non-empty string when present`);
    }
    const also = data.also ?? [];
    for (const extra of also) {
      if (!Array.isArray(components) || !components.includes(extra)) problems.push(`${label}: "also" names ${extra}, which is not in "components"`);
    }

    families.push({
      name,
      file,
      text,
      body,
      components: Array.isArray(components) ? components : [],
      also,
      useFor: typeof data["use-for"] === "string" ? data["use-for"] : "",
      insteadOf: typeof data["instead-of"] === "string" ? data["instead-of"] : "",
    });
  }
  return families;
}

/** Barrel components, as the lint plugin's extractor reads them. */
function loadBarrelComponents(problems) {
  const require = createRequire(import.meta.url);
  const { loadDesignSystem } = require(join(root, "packages/lint/lib/source.js"));
  const design = loadDesignSystem(join(uiDir, "src"));
  if (!design.loaded || design.components.size === 0) {
    // Fail closed: an extractor that read nothing would pass the coverage check.
    problems.push("component extractor (packages/lint/lib/source.js) read no components from packages/ui/src; nothing to check");
    return new Set();
  }
  return new Set(design.components.keys());
}

function checkCoverage(families, barrel, problems) {
  /** @type {Map<string, string>} */
  const owner = new Map();
  for (const family of families) {
    for (const name of family.components) {
      const previous = owner.get(name);
      if (previous) problems.push(`${name} is listed in both docs/components/${previous}.md and docs/components/${family.file}`);
      else owner.set(name, family.name);

      // A listed name must be real: a barrel export, or a source file (the
      // subpath-only media components and `ErrorBoundary`, which the extractor
      // does not read).
      if (!barrel.has(name) && !existsSync(join(uiDir, "src/components", `${name}.tsx`))) {
        problems.push(`docs/components/${family.file}: "${name}" is not a component export (no barrel export, no src/components/${name}.tsx)`);
      }
    }
  }

  for (const [name] of INTERNAL_COMPONENTS) {
    if (!barrel.has(name)) problems.push(`INTERNAL_COMPONENTS names ${name}, which is no longer a barrel export; remove it`);
    if (owner.has(name)) problems.push(`${name} is on INTERNAL_COMPONENTS and listed in docs/components/${owner.get(name)}.md; pick one`);
  }

  const uncovered = [];
  for (const name of [...barrel].sort(compare)) {
    if (owner.has(name) || INTERNAL_COMPONENTS.has(name)) continue;
    // `Dialog.Trigger` is `Dialog`'s member: covered when its root is.
    const dot = name.indexOf(".");
    if (dot !== -1 && owner.has(name.slice(0, dot))) continue;
    uncovered.push(name);
  }
  if (uncovered.length > 0) {
    problems.push(
      `exported but in no docs/components/*.md "components" list: ${uncovered.join(", ")}. ` +
        "Add each to the doc of the family it belongs to, or create docs/components/<Family>.md.",
    );
  }
}

const escapeCell = (text) => text.replaceAll("|", "\\|");

function familyCell(family, prefix) {
  const link = `[${family.name}](${prefix}${family.name}.md)`;
  return [link, ...family.also.map((name) => `\`${name}\``)].join(", ");
}

function renderIndexTable(families) {
  return [
    "| Component | Use for |",
    "|---|---|",
    ...families.map((family) => `| ${escapeCell(familyCell(family, "docs/components/"))} | ${escapeCell(family.useFor)} |`),
  ].join("\n");
}

function renderUsage(usage, families, problems) {
  const start = usage.indexOf(INDEX_START);
  const end = usage.indexOf(INDEX_END);
  if (start === -1 || end === -1 || end < start || usage.indexOf(INDEX_START, start + 1) !== -1) {
    problems.push(`packages/ui/LLM_USAGE.md must contain exactly one ${INDEX_START} … ${INDEX_END} pair`);
    return usage;
  }
  return `${usage.slice(0, start + INDEX_START.length)}\n${renderIndexTable(families)}\n${usage.slice(end)}`;
}

function renderComponentIndex(families) {
  const lines = families.map((family) => {
    const instead = family.insteadOf ? ` Instead of: ${family.insteadOf}.` : "";
    return `- ${familyCell(family, "")}: ${family.useFor}.${instead}`;
  });
  return [
    "# @mrmeg/expo-ui Component Docs",
    "",
    GENERATED,
    "",
    "One file per component family. Open only the files for the components you use;",
    "the cross-cutting rules (imports, app setup, theme, screen layout) are in",
    "[`LLM_USAGE.md`](../../LLM_USAGE.md).",
    "",
    ...lines,
    "",
  ].join("\n");
}

function renderFull(usage, families) {
  const docs = families.map(
    (family) => `---\n\n<!-- Source: docs/components/${family.file} -->\n\n${renderDocForBundle(family.text, `docs/components/${family.file}`)}`,
  );
  return `${[GENERATED, "<!-- Sources: LLM_USAGE.md, then docs/components/*.md (frontmatter restated as three lines under each heading) -->", usage.trim(), ...docs].join("\n\n")}\n`;
}

const problems = [];
const families = await loadFamilies(problems);
checkCoverage(families, loadBarrelComponents(problems), problems);

const usageSource = await readFile(usagePath, "utf8");
const usage = renderUsage(usageSource, families, problems);
if (byteLength(usage) > LIMITS.usage) {
  problems.push(`packages/ui/LLM_USAGE.md: ${byteLength(usage)} bytes is over the ${LIMITS.usage}-byte limit; move component rules into docs/components/`);
}
const llmsTxt = await readFile(llmsTxtPath, "utf8");
if (byteLength(llmsTxt) > LIMITS.llmsTxt) {
  problems.push(`packages/ui/llms.txt: ${byteLength(llmsTxt)} bytes is over the ${LIMITS.llmsTxt}-byte limit`);
}
const indexOutput = renderComponentIndex(families);
if (byteLength(indexOutput) > LIMITS.componentDoc) {
  problems.push(`packages/ui/docs/components/index.md: ${byteLength(indexOutput)} bytes is over the ${LIMITS.componentDoc}-byte limit`);
}

if (problems.length > 0) {
  console.error(`docs:ui: ${problems.length} problem${problems.length > 1 ? "s" : ""}:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const outputs = [
  { path: usagePath, name: "packages/ui/LLM_USAGE.md", content: usage },
  { path: indexPath, name: "packages/ui/docs/components/index.md", content: indexOutput },
  { path: fullPath, name: "packages/ui/llms-full.md", content: renderFull(usage, families) },
];

async function read(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null; // a missing output counts as stale
  }
}

const stale = [];
for (const output of outputs) {
  if ((await read(output.path)) !== output.content) stale.push(output);
}

if (checkMode) {
  if (stale.length > 0) {
    console.error(`docs:ui: ${stale.map((output) => output.name).join(", ")} ${stale.length > 1 ? "are" : "is"} stale. Run \`bun run docs:ui\` and commit the result.`);
    process.exit(1);
  }
  console.log(`docs:ui: ${outputs.length} generated files are up to date (${families.length} component docs).`);
} else {
  for (const output of stale) await writeFile(output.path, output.content);
  console.log(
    `docs:ui: ${families.length} component docs; wrote ${stale.length ? stale.map((output) => output.name).join(", ") : "nothing (already up to date)"}.`,
  );
}
