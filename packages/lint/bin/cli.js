#!/usr/bin/env node
/**
 * `expo-ui-lint` — the design-system rules on demand, over the paths the design
 * system actually governs.
 *
 * `bun run lint` (`expo lint`) covers `app/` only, caches results in
 * `.expo/cache/eslint/` under a key that ignores this plugin's rule bodies and
 * `packages/ui/src`, and reports every other ESLint rule alongside these four —
 * which in `client/` means the design-system findings arrive buried in unrelated
 * react-hooks errors. This runs ESLint with the project's own flat config, never
 * from cache, and keeps only `expo-ui/*` messages.
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { ESLint } = require("eslint");

const plugin = require("../index.js");
const { resolveOrigin } = require("../lib/settings.js");
const { designSystemNotFoundMessage, loadDesignSystemFor } = require("../lib/source.js");

const RULE_PREFIX = "expo-ui/";
const RULE_NAMES = ["no-raw-colors", "no-arbitrary-values", "no-restyle", "no-raw-primitives"];
const DEFAULT_PATHS = ["app", "client", "shared"];
const EXPO_LINT_CACHE = path.join(".expo", "cache", "eslint");

/** Where the doctor's fixture claims to live: inside the design system's scope, unwritten. */
const SMOKE_PATH = path.join("app", "__expo_ui_doctor__.tsx");

/** One file that trips each of the four rules, with the counts it must produce. */
const SMOKE_FIXTURE = [
  'import { Text } from "react-native";',
  'import { Slider } from "@expo/ui/community/slider";',
  'import { Button } from "@mrmeg/expo-ui";',
  "",
  "export default function Doctor() {",
  '  return <Button style={{ backgroundColor: "#f00", padding: 13 }} />;',
  "}",
  "",
].join("\n");

const SMOKE_EXPECTED = {
  "no-raw-colors": 1,
  "no-arbitrary-values": 1,
  "no-restyle": 2,
  "no-raw-primitives": 2,
};

const USAGE = `expo-ui-lint — design-system lint for @mrmeg/expo-ui

Usage: expo-ui-lint [options] [paths...]

  Lints the given paths (default: ${DEFAULT_PATHS.join(" ")}) with the project's ESLint
  config and reports only expo-ui/* messages. Never uses the ESLint cache.

Options:
  --all             Report every ESLint message, not just expo-ui/*
  --changed         Lint only changed .ts/.tsx files (branch diff + working tree
                    + untracked); paths are ignored
  --staged          Lint only staged .ts/.tsx files; paths are ignored
  --base <ref>      Base ref for --changed (default: origin/dev, else dev)
  --rules           List the design-system rules and what each catches
  --clear-cache     Delete .expo/cache/eslint (the expo lint result cache)
  --doctor [file]   Check the plugin, the config wiring, and the design system —
                    sources on disk, or the manifest an installed @mrmeg/expo-ui
                    ships. Reads the config off the first path given, or off a
                    .tsx file under app/ when no path is named
  -h, --help        Show this help

Exit codes:
  0  no design-system errors (or nothing to lint)
  1  design-system errors found, or a failed --doctor check
  2  bad usage, or the lint run itself failed`;

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

/**
 * @param {string[]} argv
 * @returns {{paths: string[], all: boolean, changed: boolean, staged: boolean, base: string | null, rules: boolean, clearCache: boolean, doctor: boolean, help: boolean, unknown: string | null}}
 */
function parseArgs(argv) {
  const options = {
    paths: [],
    all: false,
    changed: false,
    staged: false,
    base: null,
    rules: false,
    clearCache: false,
    doctor: false,
    help: false,
    unknown: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--all") options.all = true;
    else if (argument === "--changed") options.changed = true;
    else if (argument === "--staged") options.staged = true;
    else if (argument === "--base") options.base = argv[++index] || null;
    else if (argument === "--rules") options.rules = true;
    else if (argument === "--clear-cache") options.clearCache = true;
    else if (argument === "--doctor") options.doctor = true;
    else if (argument === "-h" || argument === "--help") options.help = true;
    else if (argument.startsWith("-")) {
      options.unknown = argument;
      return options;
    } else options.paths.push(argument);
  }
  return options;
}

// ---------------------------------------------------------------------------
// Result filtering
// ---------------------------------------------------------------------------

/**
 * @param {import("eslint").Linter.LintMessage} message
 * @param {boolean} all
 * @returns {boolean}
 */
function keepMessage(message, all) {
  if (!all) return typeof message.ruleId === "string" && message.ruleId.startsWith(RULE_PREFIX);
  // A file outside the config's `files` globs draws a ruleId-less "File ignored"
  // warning. It is noise about the run, not about the code.
  if (!message.ruleId && String(message.message).startsWith("File ignored")) return false;
  return true;
}

/**
 * Drops the messages we do not report, then recomputes the counts the formatter
 * prints — a stale `errorCount` would show a total the listing does not contain.
 *
 * @param {import("eslint").ESLint.LintResult[]} results
 * @param {boolean} all
 * @returns {import("eslint").ESLint.LintResult[]}
 */
function filterResults(results, all) {
  const kept = [];
  for (const result of results) {
    const messages = result.messages.filter((message) => keepMessage(message, all));
    if (messages.length === 0) continue;
    kept.push({
      ...result,
      messages,
      errorCount: messages.filter((message) => message.severity === 2).length,
      warningCount: messages.filter((message) => message.severity === 1).length,
      fatalErrorCount: messages.filter((message) => message.fatal).length,
      fixableErrorCount: messages.filter((message) => message.severity === 2 && message.fix).length,
      fixableWarningCount: messages.filter((message) => message.severity === 1 && message.fix)
        .length,
    });
  }
  return kept;
}

// ---------------------------------------------------------------------------
// Changed files
// ---------------------------------------------------------------------------

/**
 * @param {string[]} args
 * @returns {string} stdout, or "" when git failed
 */
function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

/**
 * @param {string} ref
 * @returns {boolean}
 */
function refExists(ref) {
  return git(["rev-parse", "--verify", "--quiet", ref]).trim() !== "";
}

/**
 * @param {string[]} outputs newline-separated git path lists
 * @returns {string[]} de-duplicated repo-relative paths
 */
function pathsFrom(outputs) {
  const seen = new Set();
  for (const output of outputs) {
    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (trimmed) seen.add(trimmed);
    }
  }
  return [...seen];
}

/**
 * The three-dot diff is empty on the base branch itself, so the working-tree and
 * untracked sets are always included — otherwise this reports nothing for work
 * done directly on `dev`.
 *
 * @param {{staged: boolean, base: string | null}} options
 * @returns {{files: string[], base: string | null}} absolute paths that still exist
 */
function changedFiles(options) {
  const root = git(["rev-parse", "--show-toplevel"]).trim() || process.cwd();

  if (options.staged) {
    const staged = pathsFrom([git(["diff", "--name-only", "--cached", "--diff-filter=ACMR"])]);
    return { files: existingSources(root, staged), base: null };
  }

  const base = options.base || (refExists("origin/dev") ? "origin/dev" : "dev");
  const outputs = [
    refExists(base) ? git(["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`]) : "",
    git(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]),
    git(["ls-files", "--others", "--exclude-standard"]),
  ];
  return { files: existingSources(root, pathsFrom(outputs)), base };
}

/**
 * @param {string} root
 * @param {string[]} relatives
 * @returns {string[]} absolute `.ts`/`.tsx` paths that are still on disk
 */
function existingSources(root, relatives) {
  const files = [];
  for (const relative of relatives) {
    if (!/\.tsx?$/.test(relative)) continue;
    const absolute = path.resolve(root, relative);
    // A file deleted or renamed away since the diff was taken would fail the run.
    if (fs.existsSync(absolute)) files.push(absolute);
  }
  return files.sort();
}

/**
 * Files with no `expo-ui/*` rule enabled have nothing to say here, and passing
 * them would make `--all` report the rest of the config on out-of-scope code.
 *
 * @param {ESLint} eslint
 * @param {string[]} files absolute paths
 * @returns {Promise<string[]>}
 */
async function inScope(eslint, files) {
  const kept = [];
  for (const file of files) {
    if (await eslint.isPathIgnored(file)) continue;
    let config;
    try {
      config = await eslint.calculateConfigForFile(file);
    } catch {
      continue;
    }
    const rules = (config && config.rules) || {};
    if (Object.keys(rules).some((rule) => rule.startsWith(RULE_PREFIX))) kept.push(file);
  }
  return kept;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** @returns {number} exit code */
function listRules() {
  const width = Math.max(...RULE_NAMES.map((name) => RULE_PREFIX.length + name.length));
  for (const name of Object.keys(plugin.rules)) {
    const description =
      (plugin.rules[name].meta && plugin.rules[name].meta.docs
        ? plugin.rules[name].meta.docs.description
        : "") || "";
    const label = RULE_PREFIX + name;
    console.log(description ? `${label.padEnd(width)}  ${description}` : label);
  }
  return 0;
}

/**
 * @param {string} cwd
 * @returns {number} exit code
 */
function clearCache(cwd) {
  const cache = path.join(cwd, EXPO_LINT_CACHE);
  const existed = fs.existsSync(cache);
  fs.rmSync(cache, { recursive: true, force: true });
  console.log(
    existed ? `removed ${EXPO_LINT_CACHE}` : `${EXPO_LINT_CACHE} did not exist, nothing to remove`,
  );
  return 0;
}

/**
 * @param {{paths: string[], all: boolean, changed: boolean, staged: boolean, base: string | null}} options
 * @param {string} cwd
 * @returns {Promise<number>} exit code
 */
async function lint(options, cwd) {
  const eslint = new ESLint({ cwd, cache: false, errorOnUnmatchedPattern: false });

  let targets = options.paths.length > 0 ? options.paths : DEFAULT_PATHS;
  if (options.changed || options.staged) {
    const { files } = changedFiles(options);
    targets = await inScope(eslint, files);
    if (targets.length === 0) {
      console.log("no changed .ts/.tsx files");
      return 0;
    }
  }

  const results = await eslint.lintFiles(targets);
  if (results.length === 0) {
    // A mistyped path lints nothing, and "no violations" would read as a pass.
    console.log(`nothing to lint (no files matched: ${targets.join(" ")})`);
    return 0;
  }
  const filtered = filterResults(results, options.all);

  const formatter = await eslint.loadFormatter("stylish");
  const output = await formatter.format(filtered);
  if (output.trim()) process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);

  const violations = filtered.reduce((total, result) => total + result.messages.length, 0);
  const errors = filtered.reduce((total, result) => total + result.errorCount, 0);
  const label = options.all ? "violations" : "design-system violations";
  console.log(
    violations === 0
      ? `✓ no ${label} (${results.length} ${results.length === 1 ? "file" : "files"})`
      : `✗ ${violations} ${label} in ${filtered.length} ${filtered.length === 1 ? "file" : "files"}`,
  );
  return errors > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Doctor
// ---------------------------------------------------------------------------

/**
 * @param {string} cwd
 * @param {string | null} [requestedSample] a file named after `--doctor`, whose
 *   config is read instead of searching `app/`
 * @returns {Promise<number>} exit code
 */
async function doctor(cwd, requestedSample = null) {
  /** @type {string[]} */
  const lines = [];
  let ok = true;

  /**
   * @param {boolean} passed
   * @param {string} text
   */
  const report = (passed, text) => {
    if (!passed) ok = false;
    lines.push(`${passed ? "ok  " : "FAIL"} ${text}`);
  };

  const eslint = new ESLint({ cwd, cache: false, errorOnUnmatchedPattern: false });

  // 1. The plugin the config will load, from where the config will load it.
  let pluginDir = null;
  try {
    const entry = require.resolve("@mrmeg/eslint-plugin-expo-ui", { paths: [cwd] });
    pluginDir = path.dirname(entry);
    const version = readJson(path.join(pluginDir, "package.json")).version || "unknown";
    report(true, `plugin: ${entry} (v${version})`);
    // The resolved copy, not the one next to this file: they are the same package
    // in this repo, and the doctor is here for the case where they are not.
    const exported = Object.keys(require(entry).rules).sort();
    const expected = [...RULE_NAMES].sort();
    report(
      exported.join(",") === expected.join(","),
      `rules exported: ${exported.length}/4 — ${exported.join(", ")}`,
    );
  } catch (error) {
    report(false, `plugin: cannot resolve @mrmeg/eslint-plugin-expo-ui from ${cwd} — ${error.message}`);
  }

  // 2. Config wiring, read off a real source file rather than the plugin's defaults.
  const sample = resolveSample(cwd, requestedSample, report);
  let config = null;
  if (sample) {
    try {
      config = await eslint.calculateConfigForFile(sample);
    } catch (error) {
      report(false, `config: calculateConfigForFile(${sample}) failed — ${error.message}`);
    }
  }
  if (config) {
    const enabled = Object.entries(config.rules || {})
      .filter(([rule]) => rule.startsWith(RULE_PREFIX))
      .map(([rule, entry]) => `${rule}=${severityName(entry)}`);
    const errorCount = enabled.filter((entry) => entry.endsWith("=error")).length;
    report(
      errorCount >= 4,
      `config: ${path.relative(cwd, sample)} — ${errorCount}/4 rules at error — ${enabled.join(", ") || "none enabled"}`,
    );
  }

  // 3. The design system the messages quote, resolved the way the rules resolve
  // it — sources, a configured manifest, or an installed package's manifest.
  const rawSettings = (config && config.settings && config.settings["expo-ui"]) || {};
  const origin = resolveOrigin({ rawSettings, cwd, filename: sample || "" });
  const settings = { origin, uiSourceDir: origin.uiSourceDir || origin.path || "" };
  const design = loadDesignSystemFor(settings);
  if (!design.loaded) {
    report(false, `design system: ${designSystemNotFoundMessage(settings, design)}`);
  } else {
    const counts = {
      spacing: design.tokens.spacing.entries.length,
      palette: Object.keys(design.palette).length,
      "theme colors": design.themeTokens.length,
      "font variants": design.fontVariants ? design.fontVariants.length : 0,
      components: design.components.size,
    };
    const summary = Object.entries(counts)
      .map(([name, count]) => `${count} ${name}`)
      .join(", ");
    report(
      Object.values(counts).every((count) => count > 0),
      `design system: ${describeOrigin(design.origin)} — ${summary}`,
    );
  }

  // 4. The rules on a file that must trip all four: config, plugin, and design
  // system are only wired if this reports what it has always reported.
  try {
    const results = await eslint.lintText(SMOKE_FIXTURE, { filePath: path.join(cwd, SMOKE_PATH) });
    const observed = {};
    for (const name of RULE_NAMES) observed[name] = 0;
    for (const result of results) {
      for (const message of result.messages) {
        const name = String(message.ruleId).replace(RULE_PREFIX, "");
        if (name in observed) observed[name] += 1;
      }
    }
    const observedList = RULE_NAMES.map((name) => observed[name]).join("/");
    const expectedList = RULE_NAMES.map((name) => SMOKE_EXPECTED[name]).join("/");
    report(
      observedList === expectedList,
      `smoke fixture: ${RULE_NAMES.join("/")} = ${observedList} (expected ${expectedList})`,
    );
  } catch (error) {
    report(false, `smoke fixture: lint failed — ${error.message}`);
  }

  // 5. Informational: the cache that replays yesterday's messages.
  lines.push(`ok   ${cacheStatus(cwd)}`);

  for (const line of lines) console.log(line);
  return ok ? 0 : 1;
}

/**
 * @param {string} cwd
 * @returns {string}
 */
function cacheStatus(cwd) {
  const cache = path.join(cwd, EXPO_LINT_CACHE);
  const hint = "`bun run lint --no-cache` or `--clear-cache` refreshes it";
  try {
    const age = Math.round((Date.now() - fs.statSync(cache).mtimeMs) / 60000);
    return `expo lint cache: ${EXPO_LINT_CACHE} exists, ${age} min old — ${hint}`;
  } catch {
    return `expo lint cache: ${EXPO_LINT_CACHE} absent — the next \`bun run lint\` rebuilds it`;
  }
}

/**
 * The file the config check is read off. A path named after `--doctor` answers
 * the question for the project's own layout — another repo may have no `app/`,
 * or several config blocks. A named file that is missing or is not TypeScript is
 * a failed check rather than a silent fallback: the report would otherwise be
 * about a different file than the one asked about.
 *
 * @param {string} cwd
 * @param {string | null} requested a path given on the command line
 * @param {(passed: boolean, text: string) => void} report
 * @returns {string | null} an absolute path, or null when the check already failed
 */
function resolveSample(cwd, requested, report) {
  if (requested) {
    const absolute = path.resolve(cwd, requested);
    if (!/\.tsx?$/.test(absolute)) {
      report(false, `config: \`${requested}\` is not a .ts/.tsx file — name a source file the config governs`);
      return null;
    }
    if (!isFile(absolute)) {
      report(false, `config: \`${requested}\` does not exist (resolved to ${absolute})`);
      return null;
    }
    return absolute;
  }

  const found = sampleAppFile(cwd);
  if (!found) {
    report(false, "config: no .tsx file found under app/ — run from the project root, or name a file after --doctor");
  }
  return found;
}

/**
 * @param {string} cwd
 * @returns {string | null} an absolute path to a `.tsx` file under `app/`
 */
function sampleAppFile(cwd) {
  const layout = path.join(cwd, "app", "_layout.tsx");
  if (fs.existsSync(layout)) return layout;

  // Shallow walk: a route file near the top of `app/` resolves the same config
  // block as a deep one, so there is no reason to walk the whole tree.
  const queue = [path.join(cwd, "app")];
  for (let depth = 0; depth < 3 && queue.length > 0; depth += 1) {
    const next = [];
    for (const dir of queue) {
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".tsx")) return path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== "node_modules") next.push(path.join(dir, entry.name));
      }
    }
    queue.length = 0;
    queue.push(...next);
  }
  return null;
}

/**
 * @param {unknown} entry a flat-config rule entry
 * @returns {string}
 */
function severityName(entry) {
  const severity = Array.isArray(entry) ? entry[0] : entry;
  if (severity === 2 || severity === "error") return "error";
  if (severity === 1 || severity === "warn") return "warn";
  return "off";
}

/**
 * @param {string} file
 * @returns {Record<string, any>}
 */
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

/**
 * @param {import("../lib/settings.js").DesignSystemOrigin} origin the loaded one,
 *   which carries the manifest's package and version
 * @returns {string}
 */
function describeOrigin(origin) {
  if (origin && origin.kind === "manifest") {
    // A hand-edited manifest can hold anything here; an object interpolated raw
    // would print `[object Object]` in a line the reader trusts.
    const name =
      typeof origin.package === "string" && origin.package ? origin.package : "unknown package";
    const version =
      typeof origin.version === "string" && origin.version ? origin.version : "unknown version";
    return `manifest ${name}@${version} at ${origin.path}`;
  }
  return `sources at ${origin ? origin.path : "unknown"}`;
}

/**
 * @param {string} file
 * @returns {boolean}
 */
function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** @returns {Promise<number>} exit code */
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();

  if (options.unknown) {
    console.error(`expo-ui-lint: unknown option \`${options.unknown}\`\n`);
    console.error(USAGE);
    return 2;
  }
  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  if (options.rules) return listRules();

  if (options.clearCache) {
    clearCache(cwd);
    // On its own it is a maintenance command; with anything else it is a prelude.
    const alone = !options.doctor && !options.changed && !options.staged && options.paths.length === 0;
    if (alone) return 0;
  }

  // With `--doctor`, a positional path names the file the config is read off
  // rather than a path to lint.
  if (options.doctor) return doctor(cwd, options.paths[0] || null);
  return lint(options, cwd);
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`expo-ui-lint: ${(error && error.message) || error}`);
    process.exit(2);
  },
);
