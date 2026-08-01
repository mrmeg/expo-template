#!/usr/bin/env npx tsx
/**
 * Project init CLI — turns a fresh clone of the template into a named project.
 *
 * Usage:
 *   bun run init
 *   bun run init --name "Acme" --slug acme --scheme acme \
 *     --bundle-id com.acme.app --android-package com.acme.app \
 *     --auth clerk --templates list,pricing --yes
 *
 * What it does:
 *   1. Writes `.env` from `.env.example` with the five `EXPO_PUBLIC_APP_*`
 *      identity vars filled in (validated with `getAppIdentity()`'s own rules).
 *   2. Sets `EXPO_PUBLIC_AUTH_PROVIDER` for the chosen provider, leaving the
 *      unused provider's keys blank (blank already means "off").
 *   3. Optionally prunes unused screen templates: deletes
 *      `client/templates/<id>/`, its route re-export (resolved from
 *      `meta.route`, not the id), drops the matching import + `describe` block
 *      from `client/templates/__tests__/screens.test.tsx`, and regenerates the
 *      template registry. Templates that app code still imports (e.g. billing
 *      imports a type from `pricing/Screen`) are kept and reported.
 *   4. Offers to re-run `bunx expo prebuild --clean` so the committed
 *      `ios/`/`android/` projects pick up the new identity.
 *
 * Prompts use `node:readline/promises` — no prompt dependency. Pure helpers
 * (`deriveIdentityDefaults`, `rewriteEnvContent`, `buildPrunePlan`,
 * `stripTemplateTests`, …) are exported so the CLI behavior can be unit-tested
 * without touching the filesystem. `main()` only runs when this module is the
 * process entry point.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline/promises";

import { getAppIdentity } from "../app.identity";

// ---------------------------------------------------------------------------
// Output helpers (mirrors scripts/generate.ts)
// ---------------------------------------------------------------------------

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export const IDENTITY_FIELDS = [
  "name",
  "slug",
  "scheme",
  "iosBundleIdentifier",
  "androidPackage",
] as const;

export type IdentityField = (typeof IDENTITY_FIELDS)[number];

/** Env var that carries each identity field (see `.env.example` lines 9–13). */
export const IDENTITY_ENV_KEYS: Record<IdentityField, string> = {
  name: "EXPO_PUBLIC_APP_NAME",
  slug: "EXPO_PUBLIC_APP_SLUG",
  scheme: "EXPO_PUBLIC_APP_SCHEME",
  iosBundleIdentifier: "EXPO_PUBLIC_APP_IOS_BUNDLE_ID",
  androidPackage: "EXPO_PUBLIC_APP_ANDROID_PACKAGE",
};

/** Human-readable prompt label per field. */
const IDENTITY_PROMPTS: Record<IdentityField, string> = {
  name: "App name",
  slug: "Expo slug",
  scheme: "Deep-link scheme",
  iosBundleIdentifier: "iOS bundle identifier",
  androidPackage: "Android package",
};

export type IdentityValues = Record<IdentityField, string>;

/** Kebab-case slug: `AcmeCorp` / `Acme Corp` → `acme-corp`. */
export function toSlug(name: string): string {
  return name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Deep-link scheme derived from the slug. Schemes must start with a letter
 * (`^[a-z][a-z0-9+\-.]*$`), so a digit-leading slug gets an `app-` prefix.
 */
export function toScheme(slug: string): string {
  if (slug === "") return "";
  return /^[a-z]/.test(slug) ? slug : `app-${slug}`;
}

/**
 * Reverse-DNS id from a name: `Acme Corp` → `com.acmecorp`. Segments must
 * start with a letter, so a digit-leading name gets an `app` prefix.
 */
export function toReverseDns(name: string, organization = "com"): string {
  const segment = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (segment === "") return "";
  return `${organization}.${/^[a-z]/.test(segment) ? segment : `app${segment}`}`;
}

/** Defaults for every identity field, derived from the app name. */
export function deriveIdentityDefaults(name: string): IdentityValues {
  const slug = toSlug(name);
  const reverseDns = toReverseDns(name);
  return {
    name: name.trim(),
    slug,
    scheme: toScheme(slug),
    iosBundleIdentifier: reverseDns,
    androidPackage: reverseDns,
  };
}

/**
 * Validate one field with `getAppIdentity()`'s own rules — passing a single
 * env var exercises exactly that field's regex and reuses its error copy, so
 * the CLI can never disagree with what `app.config.ts` will accept.
 *
 * Returns the error message, or `null` when the value is valid.
 */
export function validateIdentityValue(field: IdentityField, value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return `${IDENTITY_ENV_KEYS[field]} cannot be blank.`;
  }
  try {
    getAppIdentity({ [IDENTITY_ENV_KEYS[field]]: trimmed });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Every validation error across the five fields, in field order. */
export function validateIdentity(values: IdentityValues): string[] {
  return IDENTITY_FIELDS.map((field) => validateIdentityValue(field, values[field])).filter(
    (message): message is string => message !== null,
  );
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type AuthChoice = "clerk" | "cognito" | "none";

/** Accept the menu number or the provider name; `null` when unrecognized. */
export function parseAuthChoice(input: string): AuthChoice | null {
  const value = input.trim().toLowerCase();
  if (value === "1" || value === "clerk") return "clerk";
  if (value === "2" || value === "cognito") return "cognito";
  if (value === "3" || value === "none" || value === "") return "none";
  return null;
}

// ---------------------------------------------------------------------------
// .env rewriting
// ---------------------------------------------------------------------------

function quoteEnvValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

/**
 * Replace `KEY=` lines in a `.env`-shaped file, preserving comments, ordering,
 * and untouched keys. Keys absent from the source are appended at the end.
 */
export function rewriteEnvContent(source: string, updates: Record<string, string>): string {
  const pending = new Map(Object.entries(updates));
  const lines = source.split("\n").map((line) => {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line);
    if (!match) return line;
    const key = match[1];
    if (!pending.has(key)) return line;
    const value = pending.get(key)!;
    pending.delete(key);
    return `${key}=${quoteEnvValue(value)}`;
  });

  if (pending.size > 0) {
    if (lines.length > 0 && lines[lines.length - 1].trim() !== "") lines.push("");
    for (const [key, value] of pending) lines.push(`${key}=${quoteEnvValue(value)}`);
    lines.push("");
  }

  return lines.join("\n");
}

/** The `.env` keys init owns: five identity vars plus the auth selector. */
export function buildEnvUpdates(
  identity: IdentityValues,
  auth: AuthChoice,
): Record<string, string> {
  return {
    [IDENTITY_ENV_KEYS.name]: identity.name.trim(),
    [IDENTITY_ENV_KEYS.slug]: identity.slug.trim(),
    [IDENTITY_ENV_KEYS.scheme]: identity.scheme.trim(),
    [IDENTITY_ENV_KEYS.iosBundleIdentifier]: identity.iosBundleIdentifier.trim(),
    [IDENTITY_ENV_KEYS.androidPackage]: identity.androidPackage.trim(),
    EXPO_PUBLIC_AUTH_PROVIDER: auth === "none" ? "" : auth,
  };
}

// ---------------------------------------------------------------------------
// Screen template pruning
// ---------------------------------------------------------------------------

export interface TemplateMeta {
  /** Folder name under `client/templates/`. */
  id: string;
  /** Expo Router path from `meta.route`. */
  route: string;
}

/** Pull `id` + `route` out of a template's `meta.ts` source. */
export function parseTemplateMeta(source: string): TemplateMeta | null {
  const id = /\bid:\s*"([^"]+)"/.exec(source)?.[1];
  const route = /\broute:\s*"([^"]+)"/.exec(source)?.[1];
  if (!id || !route) return null;
  return { id, route };
}

/** Every template folder that carries a parseable `meta.ts`, sorted by id. */
export function readTemplates(templatesDir: string): TemplateMeta[] {
  return fs
    .readdirSync(templatesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(templatesDir, entry.name, "meta.ts"))
    .filter((metaPath) => fs.existsSync(metaPath))
    .map((metaPath) => parseTemplateMeta(fs.readFileSync(metaPath, "utf8")))
    .filter((meta): meta is TemplateMeta => meta !== null)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Route re-export path for a template, derived from `meta.route`.
 * Most templates are `screen-<id>`, but `detail-hero` is not — deriving from
 * the id instead of the route would leave an orphaned route file behind.
 */
export function routeFileForTemplate(route: string): string {
  return path.posix.join("app", `${route.replace(/^\/+/, "")}.tsx`);
}

export interface PrunedTemplate {
  id: string;
  /** Repo-relative template folder to delete. */
  folder: string;
  /** Repo-relative route re-export to delete. */
  routeFile: string;
}

export interface PrunePlan {
  keep: TemplateMeta[];
  prune: PrunedTemplate[];
}

/** Split the discovered templates into kept + pruned (with paths to delete). */
export function buildPrunePlan(templates: TemplateMeta[], keepIds: string[]): PrunePlan {
  const keepSet = new Set(keepIds);
  return {
    keep: templates.filter((template) => keepSet.has(template.id)),
    prune: templates
      .filter((template) => !keepSet.has(template.id))
      .map((template) => ({
        id: template.id,
        folder: path.posix.join("client", "templates", template.id),
        routeFile: routeFileForTemplate(template.route),
      })),
  };
}

export interface SourceFile {
  /** Repo-relative, POSIX-separated path. */
  path: string;
  content: string;
}

/**
 * Map each pruned template id to the app files that import from its folder.
 *
 * Most templates are only reachable through their route re-export, but a few
 * are wired into app code — `client/features/billing/lib/pricing.ts` imports a
 * type from `client/templates/pricing/Screen`. Deleting that folder would break
 * `tsc`, so the CLI needs to see the reference before it removes anything.
 */
export function collectTemplateReferences(
  files: SourceFile[],
  prunedIds: string[],
): Record<string, string[]> {
  const pruned = new Set(prunedIds);
  const references: Record<string, string[]> = {};

  for (const file of files) {
    for (const match of file.content.matchAll(
      /["'](?:@\/)?client\/templates\/([a-z0-9-]+)\//g,
    )) {
      const id = match[1];
      if (!pruned.has(id)) continue;
      const seen = references[id] ?? (references[id] = []);
      if (!seen.includes(file.path)) seen.push(file.path);
    }
  }

  return references;
}

const SCAN_ROOTS = ["app", "client", "server", "shared"];
const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

/** Read the app sources that could reference a template, minus what's being deleted. */
export function readSourceFiles(projectRoot: string, ignorePaths: string[] = []): SourceFile[] {
  const ignored = new Set(ignorePaths);
  const files: SourceFile[] = [];

  const walk = (absolute: string, relative: string) => {
    if (ignored.has(relative)) return;
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const childAbsolute = path.join(absolute, entry.name);
      const childRelative = path.posix.join(relative, entry.name);
      if (ignored.has(childRelative)) continue;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(childAbsolute, childRelative);
        continue;
      }
      if (!SCAN_EXTENSIONS.has(path.extname(entry.name))) continue;
      files.push({ path: childRelative, content: fs.readFileSync(childAbsolute, "utf8") });
    }
  };

  for (const root of SCAN_ROOTS) {
    const absolute = path.join(projectRoot, root);
    if (fs.existsSync(absolute)) walk(absolute, root);
  }

  return files;
}

/**
 * Rebuild the plan so pruned templates that app code still imports stay.
 *
 * Deleting a referenced folder leaves the project failing `tsc`, which is
 * strictly worse than keeping a template the adopter didn't ask for — so the
 * CLI keeps it and reports which file forced the decision. `retained` maps each
 * kept-anyway id to the files that reference it.
 */
export function resolvePrunePlan(
  templates: TemplateMeta[],
  keepIds: string[],
  files: SourceFile[],
): { plan: PrunePlan; retained: Record<string, string[]> } {
  const initial = buildPrunePlan(templates, keepIds);
  const references = collectTemplateReferences(
    files,
    initial.prune.map((pruned) => pruned.id),
  );
  const retained = Object.fromEntries(
    Object.entries(references).filter(([, referencedBy]) => referencedBy.length > 0),
  );
  const retainedIds = Object.keys(retained);

  if (retainedIds.length === 0) return { plan: initial, retained };
  return { plan: buildPrunePlan(templates, [...keepIds, ...retainedIds]), retained };
}

export interface TemplateSelection {
  ids: string[];
  /** Tokens that matched no template — surfaced instead of silently ignored. */
  unknown: string[];
}

/**
 * Parse a keep-list: comma/space separated template ids or 1-based menu
 * numbers. Blank or `all` keeps everything; `none` prunes everything.
 */
export function parseTemplateSelection(
  input: string,
  templates: TemplateMeta[],
): TemplateSelection {
  const trimmed = input.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "all") {
    return { ids: templates.map((template) => template.id), unknown: [] };
  }
  if (trimmed.toLowerCase() === "none") return { ids: [], unknown: [] };

  const ids: string[] = [];
  const unknown: string[] = [];
  for (const token of trimmed.split(/[,\s]+/).filter(Boolean)) {
    if (/^\d+$/.test(token)) {
      const byIndex = templates[Number(token) - 1];
      if (byIndex) ids.push(byIndex.id);
      else unknown.push(token);
      continue;
    }
    const byId = templates.find((template) => template.id === token);
    if (byId) ids.push(byId.id);
    else unknown.push(token);
  }

  return { ids: [...new Set(ids)], unknown };
}

// ---------------------------------------------------------------------------
// screens.test.tsx surgery
// ---------------------------------------------------------------------------

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Advance past a string / template literal starting at `index`. */
function skipString(source: string, index: number): number {
  const quote = source[index];
  let i = index + 1;
  while (i < source.length) {
    const char = source[i];
    if (char === "\\") {
      i += 2;
      continue;
    }
    if (char === quote) return i + 1;
    if (quote === "`" && char === "$" && source[i + 1] === "{") {
      let depth = 1;
      i += 2;
      while (i < source.length && depth > 0) {
        if (source[i] === "{") depth += 1;
        else if (source[i] === "}") depth -= 1;
        i += 1;
      }
      continue;
    }
    i += 1;
  }
  return source.length;
}

/**
 * End offset (exclusive, trailing blank lines consumed) of the balanced
 * statement starting at `start`. Skips strings and comments; regex literals
 * containing unbalanced brackets are out of scope for this file.
 */
function findStatementEnd(source: string, start: number): number {
  let depth = 0;
  let opened = false;
  let i = start;

  while (i < source.length) {
    const char = source[i];

    if (char === "\"" || char === "'" || char === "`") {
      i = skipString(source, i);
      continue;
    }
    if (char === "/" && source[i + 1] === "/") {
      const newline = source.indexOf("\n", i);
      if (newline === -1) return -1;
      i = newline;
      continue;
    }
    if (char === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end === -1) return -1;
      i = end + 2;
      continue;
    }
    if (char === "(" || char === "{" || char === "[") {
      depth += 1;
      opened = true;
      i += 1;
      continue;
    }
    if (char === ")" || char === "}" || char === "]") {
      depth -= 1;
      i += 1;
      if (opened && depth === 0) {
        if (source[i] === ";") i += 1;
        while (source[i] === "\r" || source[i] === "\n") i += 1;
        return i;
      }
      continue;
    }
    i += 1;
  }

  return -1;
}

function removeDescribeBlock(source: string, name: string): string {
  const marker = new RegExp(`^describe\\((["'\`])${escapeRegExp(name)}\\1`, "m");
  const match = marker.exec(source);
  if (!match) return source;
  const end = findStatementEnd(source, match.index);
  if (end === -1) return source;
  return source.slice(0, match.index) + source.slice(end);
}

export interface StrippedTestFile {
  content: string;
  /** Template ids whose import was found and removed. */
  removedIds: string[];
  /** False when nothing testable is left — the caller should delete the file. */
  hasTests: boolean;
}

/**
 * Drop `import { XScreen } from "../<id>/Screen";` plus the matching
 * `describe("XScreen", …)` block for each pruned id. Only 7 of the 17
 * templates appear in this suite, so unknown ids are a no-op.
 */
export function stripTemplateTests(source: string, prunedIds: string[]): StrippedTestFile {
  let content = source;
  const removedIds: string[] = [];

  for (const id of prunedIds) {
    const importRe = new RegExp(
      `^import \\{([^}]*)\\} from "\\.\\./${escapeRegExp(id)}/Screen";[ \\t]*\\r?\\n`,
      "m",
    );
    const match = importRe.exec(content);
    if (!match) continue;

    content = content.replace(importRe, "");
    const symbols = match[1]
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => entry.replace(/^type\s+/, "").split(/\s+as\s+/).pop()!);

    for (const symbol of symbols) {
      content = removeDescribeBlock(content, symbol);
    }
    removedIds.push(id);
  }

  content = content.replace(/\n{3,}/g, "\n\n");

  return {
    content,
    removedIds,
    hasTests: /\b(?:describe|it|test)\s*\(/.test(content),
  };
}

// ---------------------------------------------------------------------------
// CLI arguments
// ---------------------------------------------------------------------------

export interface CliOptions {
  name?: string;
  slug?: string;
  scheme?: string;
  iosBundleIdentifier?: string;
  androidPackage?: string;
  auth?: string;
  /** Raw `--templates` value; `undefined` means "don't prune". */
  templates?: string;
  yes: boolean;
  force: boolean;
  /** `true` = run prebuild, `false` = skip it, `undefined` = ask. */
  prebuild?: boolean;
  help: boolean;
  unknownFlags: string[];
}

/** Option keys that take a string value — keeps the flag table type-safe. */
type StringOptionKey =
  | "name"
  | "slug"
  | "scheme"
  | "iosBundleIdentifier"
  | "androidPackage"
  | "auth"
  | "templates";

const VALUE_FLAGS: Record<string, StringOptionKey> = {
  "--name": "name",
  "--slug": "slug",
  "--scheme": "scheme",
  "--bundle-id": "iosBundleIdentifier",
  "--android-package": "androidPackage",
  "--auth": "auth",
  "--templates": "templates",
};

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { yes: false, force: false, help: false, unknownFlags: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.indexOf("=");
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const inlineValue = eq === -1 ? undefined : arg.slice(eq + 1);

    if (flag === "--help" || flag === "-h") {
      options.help = true;
      continue;
    }
    if (flag === "--yes" || flag === "-y") {
      options.yes = true;
      continue;
    }
    if (flag === "--force") {
      options.force = true;
      continue;
    }
    if (flag === "--prebuild") {
      options.prebuild = true;
      continue;
    }
    if (flag === "--no-prebuild" || flag === "--skip-prebuild") {
      options.prebuild = false;
      continue;
    }

    const key = VALUE_FLAGS[flag];
    if (key) {
      options[key] = inlineValue ?? argv[++i] ?? "";
      continue;
    }

    options.unknownFlags.push(flag);
  }

  return options;
}

/**
 * Identity values for a non-interactive run: flags win, the rest fall back to
 * values derived from the name.
 */
export function resolveIdentityFromOptions(options: CliOptions): IdentityValues {
  const name = (options.name ?? "").trim();
  const defaults = deriveIdentityDefaults(name);
  return {
    name,
    slug: (options.slug ?? defaults.slug).trim(),
    scheme: (options.scheme ?? defaults.scheme).trim(),
    iosBundleIdentifier: (options.iosBundleIdentifier ?? defaults.iosBundleIdentifier).trim(),
    androidPackage: (options.androidPackage ?? defaults.androidPackage).trim(),
  };
}

// ---------------------------------------------------------------------------
// Interactive prompts
// ---------------------------------------------------------------------------

type Prompter = readline.Interface;

async function ask(rl: Prompter, question: string, fallback = ""): Promise<string> {
  const suffix = fallback ? ` ${colors.gray}(${fallback})${colors.reset}` : "";
  const answer = await rl.question(`${question}${suffix}: `);
  const trimmed = answer.trim();
  return trimmed === "" ? fallback : trimmed;
}

async function confirm(rl: Prompter, question: string, defaultYes: boolean): Promise<boolean> {
  const answer = (await rl.question(`${question} ${defaultYes ? "[Y/n]" : "[y/N]"}: `))
    .trim()
    .toLowerCase();
  if (answer === "") return defaultYes;
  return answer === "y" || answer === "yes";
}

async function promptIdentity(rl: Prompter, options: CliOptions): Promise<IdentityValues> {
  log("\nApp identity", "blue");
  log("  Written to .env as the five EXPO_PUBLIC_APP_* vars.", "gray");

  let name = (options.name ?? "").trim();
  while (name === "") {
    name = await ask(rl, IDENTITY_PROMPTS.name);
    if (name === "") log("  App name is required.", "red");
  }

  const values: IdentityValues = { ...deriveIdentityDefaults(name), name };
  const overrides: Partial<IdentityValues> = {
    slug: options.slug,
    scheme: options.scheme,
    iosBundleIdentifier: options.iosBundleIdentifier,
    androidPackage: options.androidPackage,
  };

  for (const field of IDENTITY_FIELDS) {
    if (field === "name") continue;
    const preset = overrides[field]?.trim();
    if (preset) {
      values[field] = preset;
      const error = validateIdentityValue(field, preset);
      if (error) {
        log(`  ${error}`, "red");
        values[field] = await promptField(rl, field, values[field]);
      }
      continue;
    }
    values[field] = await promptField(rl, field, values[field]);
  }

  return values;
}

async function promptField(
  rl: Prompter,
  field: IdentityField,
  fallback: string,
): Promise<string> {
  for (;;) {
    const value = await ask(rl, `  ${IDENTITY_PROMPTS[field]}`, fallback);
    const error = validateIdentityValue(field, value);
    if (!error) return value;
    log(`  ${error}`, "red");
  }
}

async function promptAuth(rl: Prompter): Promise<AuthChoice> {
  log("\nAuth provider", "blue");
  log("  1) Clerk", "gray");
  log("  2) Cognito", "gray");
  log("  3) None (auth stays disabled)", "gray");
  for (;;) {
    const answer = await ask(rl, "  Choose", "3");
    const choice = parseAuthChoice(answer);
    if (choice) return choice;
    log("  Enter 1, 2, or 3.", "red");
  }
}

async function promptTemplates(rl: Prompter, templates: TemplateMeta[]): Promise<string[]> {
  log("\nScreen templates", "blue");
  templates.forEach((template, index) => {
    log(`  ${String(index + 1).padStart(2, " ")}) ${template.id}`, "gray");
  });
  log("  Enter the ones to KEEP (numbers or ids). Blank keeps all, \"none\" removes all.", "gray");

  for (;;) {
    const answer = await ask(rl, "  Keep");
    const selection = parseTemplateSelection(answer, templates);
    if (selection.unknown.length === 0) return selection.ids;
    log(`  Unknown template(s): ${selection.unknown.join(", ")}`, "red");
  }
}

// ---------------------------------------------------------------------------
// Filesystem + command execution
// ---------------------------------------------------------------------------

function applyPrune(projectRoot: string, plan: PrunePlan): void {
  for (const pruned of plan.prune) {
    const folder = path.join(projectRoot, pruned.folder);
    if (fs.existsSync(folder)) {
      fs.rmSync(folder, { recursive: true, force: true });
      log(`Removed: ${pruned.folder}/`, "yellow");
    }
    const routeFile = path.join(projectRoot, pruned.routeFile);
    if (fs.existsSync(routeFile)) {
      fs.rmSync(routeFile);
      log(`Removed: ${pruned.routeFile}`, "yellow");
    }
  }

  const testFileRelative = path.posix.join("client", "templates", "__tests__", "screens.test.tsx");
  const testFile = path.join(projectRoot, testFileRelative);
  if (!fs.existsSync(testFile)) return;

  const stripped = stripTemplateTests(
    fs.readFileSync(testFile, "utf8"),
    plan.prune.map((pruned) => pruned.id),
  );
  if (stripped.removedIds.length === 0) return;

  if (!stripped.hasTests) {
    fs.rmSync(testFile);
    log(`Removed: ${testFileRelative} (no templates left to test)`, "yellow");
    return;
  }

  fs.writeFileSync(testFile, stripped.content);
  log(`Updated: ${testFileRelative} (dropped ${stripped.removedIds.join(", ")})`, "yellow");
}

function run(command: string, args: string[], cwd: string): boolean {
  log(`\n$ ${command} ${args.join(" ")}`, "gray");
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  return result.status === 0;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function showHelp() {
  log("\nUsage: bun run init [options]\n", "blue");
  log("Interactive by default. Pass --yes for a fully non-interactive run.\n", "gray");
  log("Options:", "yellow");
  log("  --name <name>              App display name (required with --yes)");
  log("  --slug <slug>              Expo slug (default: kebab-cased name)");
  log("  --scheme <scheme>          Deep-link scheme (default: slug)");
  log("  --bundle-id <id>           iOS bundle identifier (default: com.<name>)");
  log("  --android-package <id>      Android package (default: com.<name>)");
  log("  --auth clerk|cognito|none  Auth provider (default: none)");
  log("  --templates <ids>          Screen templates to KEEP, or \"none\"/\"all\"");
  log("  --prebuild                 Run `bunx expo prebuild --clean` afterwards");
  log("  --no-prebuild              Skip prebuild (prints the command instead)");
  log("  --force                    Overwrite an existing .env");
  log("  --yes, -y                  Non-interactive; accept defaults");
  log("\nExamples:", "yellow");
  log("  bun run init");
  log("  bun run init --name \"Acme\" --auth clerk --templates list,pricing --yes");
  log("");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    showHelp();
    return;
  }
  if (options.unknownFlags.length > 0) {
    log(`Error: Unknown option(s) ${options.unknownFlags.join(", ")}.`, "red");
    showHelp();
    process.exit(1);
  }

  const projectRoot = path.resolve(__dirname, "..");
  const envExamplePath = path.join(projectRoot, ".env.example");
  const envPath = path.join(projectRoot, ".env");
  const templatesDir = path.join(projectRoot, "client", "templates");

  if (!fs.existsSync(envExamplePath)) {
    log("Error: .env.example is missing — run this from a template checkout.", "red");
    process.exit(1);
  }
  if (fs.existsSync(envPath) && !options.force) {
    log("Error: .env already exists. Re-run with --force to overwrite it.", "red");
    process.exit(1);
  }

  const interactive = !options.yes && Boolean(process.stdin.isTTY);
  const templates = fs.existsSync(templatesDir) ? readTemplates(templatesDir) : [];

  let identity: IdentityValues;
  let auth: AuthChoice;
  let keepIds: string[];
  const rl = interactive
    ? readline.createInterface({ input: process.stdin, output: process.stdout })
    : null;

  try {
    if (rl) {
      log("\nExpo template init", "blue");
      identity = await promptIdentity(rl, options);
      auth = options.auth ? parseAuthChoice(options.auth) ?? (await promptAuth(rl)) : await promptAuth(rl);
      keepIds =
        options.templates === undefined
          ? await promptTemplates(rl, templates)
          : parseTemplateSelection(options.templates, templates).ids;
    } else {
      identity = resolveIdentityFromOptions(options);
      const parsedAuth = parseAuthChoice(options.auth ?? "none");
      if (!parsedAuth) {
        log(`Error: Unknown --auth value "${options.auth}". Use clerk, cognito, or none.`, "red");
        process.exit(1);
      }
      auth = parsedAuth;
      const selection = parseTemplateSelection(
        options.templates ?? "all",
        templates,
      );
      if (selection.unknown.length > 0) {
        log(`Error: Unknown template(s): ${selection.unknown.join(", ")}.`, "red");
        process.exit(1);
      }
      keepIds = selection.ids;
    }

    const errors = validateIdentity(identity);
    if (errors.length > 0) {
      for (const message of errors) log(`Error: ${message}`, "red");
      process.exit(1);
    }

    // Scan app sources for imports out of the folders we're about to delete,
    // ignoring the template tree and route re-exports (those go away too).
    const sources = readSourceFiles(projectRoot, [
      path.posix.join("client", "templates"),
      ...buildPrunePlan(templates, keepIds).prune.map((pruned) => pruned.routeFile),
    ]);
    const { plan, retained } = resolvePrunePlan(templates, keepIds, sources);

    log("\nPlan", "blue");
    for (const field of IDENTITY_FIELDS) {
      log(`  ${IDENTITY_ENV_KEYS[field]}=${identity[field]}`, "gray");
    }
    log(`  Auth provider: ${auth}`, "gray");
    log(
      plan.prune.length === 0
        ? `  Screen templates: keeping all ${plan.keep.length}`
        : `  Screen templates: keeping ${plan.keep.length}, removing ${plan.prune.length} (${plan.prune
          .map((pruned) => pruned.id)
          .join(", ")})`,
      "gray",
    );
    for (const [id, referencedBy] of Object.entries(retained)) {
      log(`  Keeping "${id}" anyway — imported by ${referencedBy.join(", ")}.`, "yellow");
    }

    if (rl && !(await confirm(rl, "\nApply this?", true))) {
      log("Aborted — nothing was written.", "yellow");
      return;
    }

    const envContent = rewriteEnvContent(
      fs.readFileSync(envExamplePath, "utf8"),
      buildEnvUpdates(identity, auth),
    );
    fs.writeFileSync(envPath, envContent);
    log("\nWrote: .env", "green");

    if (plan.prune.length > 0) {
      applyPrune(projectRoot, plan);
      if (!run("bun", ["run", "gen:templates"], projectRoot)) {
        log("Error: `bun run gen:templates` failed — regenerate the registry manually.", "red");
        process.exit(1);
      }
    }

    const shouldPrebuild =
      options.prebuild ?? (rl ? await confirm(rl, "\nRun `bunx expo prebuild --clean` now?", false) : false);

    if (shouldPrebuild) {
      if (!run("bunx", ["expo", "prebuild", "--clean"], projectRoot)) {
        log("Error: prebuild failed. Re-run `bunx expo prebuild --clean` after fixing it.", "red");
        process.exit(1);
      }
    } else {
      log("\nSkipped prebuild. Regenerate native projects with:", "yellow");
      log("  bunx expo prebuild --clean", "gray");
    }

    log("\nDone. Next: bun install && npx expo start", "green");
    log("");
  } finally {
    rl?.close();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    log(`Error: ${error instanceof Error ? error.message : String(error)}`, "red");
    process.exit(1);
  });
}
