#!/usr/bin/env node
/**
 * expo-ui-agents — write the installed @mrmeg packages' agent docs into an
 * app's AGENTS.md.
 *
 * Agents follow rules that are already in their context far more reliably than
 * rules they have to decide to go and read. This CLI inlines the compact
 * `llms.txt` of every installed @mrmeg package, with the version-matched doc
 * paths in `node_modules`, between two markers in the root AGENTS.md:
 *
 *   <!-- @mrmeg/packages:start --> ... <!-- @mrmeg/packages:end -->
 *
 * The block is deterministic (fixed package order, relative `node_modules/…`
 * paths, no dates), so `--check` is a plain comparison CI can run after a
 * package bump. Bytes outside the markers are never changed: a first run
 * inserts the block just before `## Agent Workflow` (or appends it), and a
 * later run replaces the marked span in place.
 *
 * It reads the app's package.json and each installed package's package.json and
 * llms.txt by file path, so a package `exports` map cannot hide them. Node >=
 * 20, no dependencies.
 *
 * Usage: expo-ui-agents [--check] [--file <path>]; see --help.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const USAGE = `
Usage:
  expo-ui-agents [--check] [--file <path>]

Writes (or refreshes) a marked section into AGENTS.md: the compact llms.txt of
each installed @mrmeg package, its version, and the doc files that ship in that
version. Packages are taken from package.json dependencies + devDependencies and
read from node_modules; one that is listed but not installed is skipped with a
warning. Everything outside the markers stays byte-identical.

Options:
  --file <path>  File to write (default AGENTS.md in the working directory; created if absent)
  --check        Exit 1 if the section is missing or stale; write nothing
  -h, --help     Usage info

Run it from the app root, after installing, and again after upgrading a package.
Add \`expo-ui-agents --check\` to CI to catch a bump that left the section stale.
`;

const START = "<!-- @mrmeg/packages:start -->";
const END = "<!-- @mrmeg/packages:end -->";

/** Stable order; the section lists the installed ones in this order. */
const PACKAGES = ["@mrmeg/expo-ui", "@mrmeg/expo-media", "@mrmeg/expo-purchases", "@mrmeg/eslint-plugin-expo-ui"];
const LINT_PACKAGE = "@mrmeg/eslint-plugin-expo-ui";

/** Doc files named in `Docs:` when the installed version ships them, in this order. */
const DOC_CANDIDATES = ["LLM_USAGE.md", "llms-full.md", "docs/components/index.md", "README.md"];

const VALUE_OPTIONS = new Set(["--file"]);
const FLAG_OPTIONS = new Set(["--check", "-h", "--help"]);

class CliError extends Error {}

function fail(message) {
  throw new CliError(message);
}

/** Paths in messages: relative to the working directory, `/`-separated. */
function label(path) {
  return relative(process.cwd(), path).split(sep).join("/") || ".";
}

function parseArgs(argv) {
  const options = { file: "AGENTS.md" };
  const flags = new Set();
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [key, inlineValue] = arg.startsWith("--") && arg.includes("=") ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg, undefined];
    if (VALUE_OPTIONS.has(key)) {
      const value = inlineValue ?? argv[(index += 1)];
      if (!value || value.startsWith("--")) fail(`${key} needs a value`);
      options[key.slice(2)] = value;
    } else if (FLAG_OPTIONS.has(key) && inlineValue === undefined) {
      flags.add(key);
    } else if (arg.startsWith("-")) {
      fail(`unknown option ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  return { options, flags, positional };
}

// --- Installed packages --------------------------------------------------------

function readJson(path, what) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return fail(`${what} (${label(path)}) is not readable JSON: ${error.message}`);
  }
}

/** Names of the @mrmeg packages the app's package.json lists, in the section's order. */
function listedPackages(root) {
  const manifestPath = join(root, "package.json");
  if (!existsSync(manifestPath)) fail(`${label(manifestPath)} not found. Run expo-ui-agents from the app root.`);
  const manifest = readJson(manifestPath, "package.json");
  const names = new Set();
  for (const field of ["dependencies", "devDependencies"]) {
    const group = manifest?.[field];
    if (group && typeof group === "object") for (const name of Object.keys(group)) names.add(name);
  }
  return PACKAGES.filter((name) => names.has(name));
}

/**
 * One installed package, or null when `node_modules` has no readable
 * package.json with a version for it. `llms.txt` is optional (the lint plugin
 * ships none), and so is every doc file.
 */
function readInstalled(root, name) {
  const dir = join(root, "node_modules", ...name.split("/"));
  const manifestPath = join(dir, "package.json");
  if (!existsSync(manifestPath)) return null;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return null;
  }
  if (typeof manifest?.version !== "string" || manifest.version === "") return null;
  const llmsPath = join(dir, "llms.txt");
  return {
    name,
    version: manifest.version,
    llms: existsSync(llmsPath) ? readFileSync(llmsPath, "utf8") : null,
    docs: DOC_CANDIDATES.filter((doc) => existsSync(join(dir, ...doc.split("/")))).map((doc) => `node_modules/${name}/${doc}`),
  };
}

function installedPackages(root) {
  const listed = listedPackages(root);
  if (listed.length === 0) {
    fail(`package.json lists none of ${PACKAGES.join(", ")} in dependencies or devDependencies; there is nothing to write.`);
  }
  const installed = [];
  for (const name of listed) {
    const found = readInstalled(root, name);
    if (found) installed.push(found);
    else console.error(`expo-ui-agents: ${name} is listed in package.json but not installed (no node_modules/${name}/package.json); skipping it.`);
  }
  if (installed.length === 0) fail("none of the listed @mrmeg packages is installed. Run your package manager's install first.");
  return installed;
}

// --- Section -------------------------------------------------------------------

/** An `llms.txt` without its H1 (the package name, which the section's `###` heading carries). */
function llmsBody(text) {
  const lines = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
  let index = 0;
  while (index < lines.length && lines[index].trim() === "") index += 1;
  if (index < lines.length && /^# /.test(lines[index])) {
    index += 1;
    while (index < lines.length && lines[index].trim() === "") index += 1;
  }
  return lines.slice(index).join("\n").trimEnd();
}

/** The marked block with LF line breaks and no trailing newline; a pure function of the installed packages. */
function renderSection(installed) {
  const paragraphs = [
    "## @mrmeg packages",
    "Generated by `expo-ui-agents`; edit the packages, not this block. Rerun it after upgrading one (`bunx expo-ui-agents`; CI: `bunx expo-ui-agents --check`).",
    `Installed: ${installed.map((pkg) => `${pkg.name}@${pkg.version}`).join(", ")}`,
  ];
  for (const pkg of installed) {
    paragraphs.push(`### ${pkg.name}`);
    const body = pkg.llms === null ? "" : llmsBody(pkg.llms);
    if (body !== "") paragraphs.push(body);
    if (pkg.docs.length > 0) paragraphs.push(`Docs: ${pkg.docs.map((doc) => `\`${doc}\``).join(", ")}`);
  }
  if (installed.some((pkg) => pkg.name === LINT_PACKAGE)) {
    paragraphs.push("After UI edits run `bunx expo-ui-lint --changed` (add `--base main` where the repo has no `dev` branch).");
  }
  return `${START}\n${paragraphs.join("\n\n")}\n${END}`;
}

// --- Placing the section in the file ---------------------------------------------

/**
 * The file's lines with offsets (`end` excludes the line break, including a
 * CR) and whether each sits inside, or opens or closes, a fenced code block.
 */
function scanLines(text) {
  const lines = [];
  let fence = null;
  let start = 0;
  while (start < text.length) {
    const newline = text.indexOf("\n", start);
    const stop = newline === -1 ? text.length : newline;
    const content = text.slice(start, stop).replace(/\r$/, "");
    const opener = /^ {0,3}(`{3,}|~{3,})/.exec(content);
    let inFence = true;
    if (fence === null) {
      if (opener) fence = { char: opener[1][0], length: opener[1].length };
      else inFence = false;
    } else if (opener && opener[1][0] === fence.char && opener[1].length >= fence.length && content.slice(opener[0].length).trim() === "") {
      fence = null;
    }
    lines.push({ content, start, end: start + content.length, inFence });
    start = stop + 1;
  }
  return lines;
}

/**
 * The marked span `[start, end)` (first marker's line start to last marker's
 * line end), null when neither marker is there. The markers match on their own
 * line wherever they are, fenced or not: a block that moved into an unclosed
 * fence must still be found, or every run would append another.
 */
function findBlock(lines, file) {
  const starts = lines.filter((line) => line.content.trim() === START);
  const ends = lines.filter((line) => line.content.trim() === END);
  if (starts.length === 0 && ends.length === 0) return null;
  if (starts.length !== 1 || ends.length !== 1 || ends[0].start < starts[0].start) {
    fail(
      `${label(file)} has ${starts.length} \`${START}\` and ${ends.length} \`${END}\` marker line(s) ` +
        "(expected one of each, start first). Fix or remove them by hand; nothing was written."
    );
  }
  return { start: starts[0].start, end: ends[0].end };
}

/** The file's line break: CRLF when its first line break is one, else LF. */
function lineBreak(text) {
  const newline = text.indexOf("\n");
  return newline > 0 && text[newline - 1] === "\r" ? "\r\n" : "\n";
}

/** What must precede the block so it starts after a blank line (nothing in an empty file). */
function leadIn(before, eol) {
  if (before === "" || /\n\r?\n$/.test(before)) return "";
  return before.endsWith("\n") ? eol : eol + eol;
}

/**
 * The file with the block placed: replaced in place when marked, otherwise
 * inserted before `## Agent Workflow` (outside fenced code), otherwise
 * appended. Only the marked span changes in a replacement; an insertion or
 * append adds bytes and removes none.
 */
function placeSection(text, section, file) {
  const lines = scanLines(text);
  const eol = lineBreak(text);
  const rendered = eol === "\n" ? section : section.replace(/\n/g, eol);
  const block = findBlock(lines, file);
  if (block) return text.slice(0, block.start) + rendered + text.slice(block.end);

  const workflow = lines.find((line) => !line.inFence && /^## Agent Workflow[ \t]*$/.test(line.content));
  if (workflow) {
    const before = text.slice(0, workflow.start);
    return before + leadIn(before, eol) + rendered + eol + eol + text.slice(workflow.start);
  }
  return text + leadIn(text, eol) + rendered + eol;
}

/** The marked block as it stands in the file, line breaks normalised to LF; null when absent. */
function currentSection(text, file) {
  const block = findBlock(scanLines(text), file);
  return block ? text.slice(block.start, block.end).replace(/\r\n/g, "\n") : null;
}

// --- main ------------------------------------------------------------------------

function run({ options, flags }) {
  const root = process.cwd();
  const file = resolve(options.file);
  const installed = installedPackages(root);
  const section = renderSection(installed);
  const summary = installed.map((pkg) => `${pkg.name}@${pkg.version}`).join(", ");
  const text = existsSync(file) ? readFileSync(file, "utf8") : null;

  if (flags.has("--check")) {
    const current = text === null ? null : currentSection(text, file);
    if (current === section) {
      console.log(`${label(file)} is up to date (${summary}).`);
      return 0;
    }
    const state = text === null ? `${label(file)} is missing` : current === null ? `${label(file)} has no @mrmeg packages section` : `the @mrmeg packages section in ${label(file)} is stale`;
    console.error(`expo-ui-agents: ${state}. Run \`bunx expo-ui-agents\` and commit the result.`);
    return 1;
  }

  const next = placeSection(text ?? "", section, file);
  if (text !== null && next === text) {
    console.log(`${label(file)} already up to date (${summary}).`);
    return 0;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, next);
  console.log(`Wrote ${label(file)} (${summary}).`);
  return 0;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.has("-h") || args.flags.has("--help")) {
    console.log(USAGE);
    process.exit(0);
  }
  if (args.positional.length > 0) fail(`unexpected argument(s) ${args.positional.join(" ")}`);
  process.exit(run(args));
} catch (error) {
  if (!(error instanceof CliError)) throw error;
  console.error(`expo-ui-agents: ${error.message}`);
  console.error("Run expo-ui-agents --help for usage.");
  process.exit(1);
}
