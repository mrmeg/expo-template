/**
 * What every task's `check.mjs` is built from: it loads the source files an
 * agent changed, parses them with the TypeScript compiler, and answers "does
 * this import X from @mrmeg/expo-ui", "is X rendered", and "does a Card wrap a
 * section". Deterministic, no model involved.
 *
 * A `check.mjs` is a CLI so the runner (against a trial's app) and the Jest test
 * (against the committed good and bad reference solutions) run it the same way:
 *
 *   node check.mjs <appDir> [--changed <changed-files.json>]
 *
 * With `--changed`, only those app-relative files are read; without it, every
 * `.ts`/`.tsx` file under `appDir` is (a reference solution holds only the files
 * a solution writes). It prints `{ taskId, pass, assertions }` as JSON and exits 0
 * when every non-advisory assertion passes, 1 when one fails.
 *
 * An advisory assertion is reported but does not decide `pass`: it measures a
 * rule the docs themselves leave ambiguous.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SKIPPED_DIRS = new Set(["node_modules", ".expo", ".git", "dist"]);
const GENERATED_FILES = new Set(["client/icons.generated.ts"]);

/** `@mrmeg/expo-ui` and its public subpaths, never `/dist`. */
export const UI_PACKAGE = /^@mrmeg\/expo-ui(\/(?!dist(\/|$)).*)?$/;
export const MEDIA_PACKAGE = /^@mrmeg\/expo-media(\/.*)?$/;
export const PURCHASES_PACKAGE = /^@mrmeg\/expo-purchases(\/.*)?$/;

/** Icon libraries the design system replaces with `Icon` and `client/icons.json`. */
const ICON_LIBRARIES = [
  "lucide-react-native",
  "lucide-react",
  "@expo/vector-icons",
  "react-native-vector-icons",
  "@react-native-vector-icons",
  "phosphor-react-native",
  "react-native-heroicons",
  "@tabler/icons-react-native",
];

/** React Native primitives the package wraps (`StyledText`, `TextInput`, `Switch`, `Button`, `Screen`, `Image`, ...). */
const RAW_PRIMITIVES = new Set([
  "Text",
  "TextInput",
  "Switch",
  "Button",
  "SafeAreaView",
  "KeyboardAvoidingView",
  "StatusBar",
  "Image",
]);

/**
 * Pressables. The package has `Button`, `IconButton` and `Item`, but its own lint
 * (`expo-ui/no-raw-primitives`) leaves `Pressable` available, so a raw one is
 * advisory rather than a failure.
 */
const RAW_PRESSABLES = new Set([
  "Pressable",
  "TouchableOpacity",
  "TouchableHighlight",
  "TouchableWithoutFeedback",
  "TouchableNativeFeedback",
]);

/** Toast and sheet libraries, and React Native's own overlays, which `notify`, `Dialog` and `BottomSheet` replace. */
const OVERLAY_LIBRARIES = [
  "react-native-toast-message",
  "react-native-toast-notifications",
  "react-native-root-toast",
  "react-native-flash-message",
  "sonner-native",
  "burnt",
  "@gorhom/bottom-sheet",
  "react-native-modal",
  "react-native-modalize",
  "react-native-actions-sheet",
];
const RAW_OVERLAYS = new Set(["Modal", "Alert", "ToastAndroid"]);
const HAND_ROLLED_NAME = /^(Toast|Snackbar|ActionSheet|BottomSheet|Sheet)\w*$/;

/** What a `Card` must not contain: it holds one item, never a form, a row group, or a settings section. */
const SECTION_CONTENT = new Set([
  "Item",
  "ItemGroup",
  "TextInput",
  "Switch",
  "Checkbox",
  "RadioGroup",
  "Select",
  "SectionHeader",
  "ThemeSelector",
  "SegmentedControl",
  "ToggleGroup",
  "Card",
]);

/** Every `.ts`/`.tsx` file under `dir`, app-relative with `/` separators. */
function walkSources(dir, base = dir, found = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIPPED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkSources(full, base, found);
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".d.ts")) {
      found.push(relative(base, full).split("\\").join("/"));
    }
  }
  return found;
}

/** The leftmost identifier and property path of a JSX tag name: `Button.Icon` is `Button`, ["Icon"]. */
function tagParts(tagName) {
  const path = [];
  let node = tagName;
  while (ts.isPropertyAccessExpression(node)) {
    path.unshift(node.name.text);
    node = node.expression;
  }
  return { root: ts.isIdentifier(node) ? node.text : null, path };
}

/**
 * Whether an identifier reads a binding, rather than naming an import specifier,
 * a property (`a.b`'s `b`), or an object key (`{ b: 1 }`'s `b`).
 */
function isReference(identifier) {
  const parent = identifier.parent;
  if (!parent) return false;
  if (ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent)) return false;
  if (ts.isPropertyAccessExpression(parent) && parent.name === identifier) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === identifier) return false;
  if (ts.isJsxAttribute(parent) && parent.name === identifier) return false;
  return true;
}

function analyze(path, text) {
  const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
  /** local name -> { specifier, imported, typeOnly } */
  const bindings = new Map();
  /** Every module specifier the file imports, re-exports, requires, or `import()`s. */
  const specifiers = [];
  /** Names the file declares itself (functions, classes, variables). */
  const declared = new Set();
  /** @type {{ node: import("typescript").Node, tag: import("typescript").JsxTagNameExpression }[]} */
  const elements = [];
  /** Property reads and calls of `notify`-style objects: `["notify", "success"]`. */
  const memberCalls = [];
  const calls = [];
  /** local name -> how many times it is referenced (called, passed, or read), outside the import itself */
  const references = new Map();

  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      specifiers.push(specifier);
      const clause = node.importClause;
      if (clause) {
        const typeOnly = Boolean(clause.isTypeOnly);
        if (clause.name) bindings.set(clause.name.text, { specifier, imported: "default", typeOnly });
        const named = clause.namedBindings;
        if (named && ts.isNamedImports(named)) {
          for (const element of named.elements) {
            bindings.set(element.name.text, {
              specifier,
              imported: (element.propertyName ?? element.name).text,
              typeOnly: typeOnly || Boolean(element.isTypeOnly),
            });
          }
        } else if (named && ts.isNamespaceImport(named)) {
          bindings.set(named.name.text, { specifier, imported: "*", typeOnly });
        }
      }
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const first = node.arguments[0];
      const isRequire = ts.isIdentifier(callee) && callee.text === "require";
      if ((callee.kind === ts.SyntaxKind.ImportKeyword || isRequire) && first && ts.isStringLiteralLike(first)) {
        specifiers.push(first.text);
      }
      if (ts.isIdentifier(callee)) calls.push(callee.text);
      else if (ts.isPropertyAccessExpression(callee)) {
        const { root, path: rest } = tagParts(callee);
        if (root) memberCalls.push([root, ...rest]);
      }
    } else if (ts.isFunctionDeclaration(node) && node.name) declared.add(node.name.text);
    else if (ts.isClassDeclaration(node) && node.name) declared.add(node.name.text);
    else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declared.add(node.name.text);
    else if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      elements.push({ node, tag: node.tagName });
    }
    if (ts.isIdentifier(node) && isReference(node)) references.set(node.text, (references.get(node.text) ?? 0) + 1);
    ts.forEachChild(node, visit);
  }
  visit(sf);

  return { path, text, sf, bindings, specifiers, declared, elements, memberCalls, calls, references };
}

/** What a JSX tag renders: the import it resolves to, or a local component. */
function resolveTag(source, tag) {
  const { root, path } = tagParts(tag);
  if (!root) return { specifier: null, imported: null, local: null };
  const binding = source.bindings.get(root);
  if (!binding) return { specifier: null, imported: null, local: root };
  // `RN.Text`: a namespace import names the export with the first property.
  if (binding.imported === "*") return { specifier: binding.specifier, imported: path[0] ?? "*", local: root };
  return { specifier: binding.specifier, imported: binding.imported, local: root };
}

/**
 * The files a check reads, with the queries tasks are written in.
 *
 * @param {string} appDir
 * @param {string[] | null} changed app-relative paths, or null for every source file
 */
export function loadSources(appDir, changed = null) {
  const paths = (changed ?? walkSources(appDir))
    .filter((path) => /\.(ts|tsx)$/.test(path) && !GENERATED_FILES.has(path))
    .filter((path) => existsSync(join(appDir, path)));
  const sources = paths.sort().map((path) => analyze(path, readFileSync(join(appDir, path), "utf8")));

  return {
    appDir,
    files: sources.map((source) => source.path),
    sources,

    /** Whether a changed file exists at `path`. */
    hasFile: (path) => sources.some((source) => source.path === path),

    /** Source of the file at `path`, or null. */
    file: (path) => sources.find((source) => source.path === path) ?? null,

    /** Names imported from a module matching `pattern` (type imports excluded). */
    importedNames(pattern) {
      const names = new Set();
      for (const source of sources) {
        for (const binding of source.bindings.values()) {
          if (!binding.typeOnly && pattern.test(binding.specifier)) names.add(binding.imported);
        }
      }
      return names;
    },

    /** Whether `name` is imported from a module matching `pattern`. */
    imports(pattern, name) {
      return this.importedNames(pattern).has(name);
    },

    /** Every module specifier any file loads. */
    specifiers: () => sources.flatMap((source) => source.specifiers),

    /** How many JSX elements render one of `names` imported from a module matching `pattern`. */
    jsxCount(pattern, names) {
      const wanted = new Set(names);
      let count = 0;
      for (const source of sources) {
        for (const { tag } of source.elements) {
          const resolved = resolveTag(source, tag);
          if (resolved.specifier && pattern.test(resolved.specifier) && wanted.has(resolved.imported)) count += 1;
        }
      }
      return count;
    },

    /** How many calls or member calls match, e.g. `notify.success(...)` is `["notify", "success"]`. */
    memberCallCount(root, methods = null) {
      let count = 0;
      for (const source of sources) {
        for (const [name, method] of source.memberCalls) {
          const binding = source.bindings.get(name);
          if (name === root || binding?.imported === root) {
            if (!methods || methods.includes(method)) count += 1;
          }
        }
      }
      return count;
    },

    /** Calls of a bare function (`notify({ ... })`, `useMediaPicker()`), counted by imported name. */
    callCount(pattern, name) {
      let count = 0;
      for (const source of sources) {
        for (const callee of source.calls) {
          const binding = source.bindings.get(callee);
          if (binding && pattern.test(binding.specifier) && binding.imported === name) count += 1;
        }
      }
      return count;
    },

    /**
     * How many times `name`, imported from a module matching `pattern`, is
     * referenced: called, or passed along (`onPress={signOut}`, `mutationFn: submit`).
     * A call is the common case, but a function handed over by name is wired up too.
     */
    referenceCount(pattern, name) {
      let count = 0;
      for (const source of sources) {
        for (const [local, binding] of source.bindings) {
          if (pattern.test(binding.specifier) && binding.imported === name) count += source.references.get(local) ?? 0;
        }
      }
      return count;
    },

    /** Whether any file's text matches `pattern`. */
    textMatches: (pattern) => sources.some((source) => pattern.test(source.text)),

    /** Descriptions of every `Card` that wraps a section's worth of content. */
    cardsAroundSections() {
      const offenders = [];
      for (const source of sources) {
        const visit = (node) => {
          if (ts.isJsxElement(node)) {
            const opening = resolveTag(source, node.openingElement.tagName);
            if (opening.specifier && UI_PACKAGE.test(opening.specifier) && opening.imported === "Card") {
              const inside = new Set();
              const walk = (child) => {
                if (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) {
                  const resolved = resolveTag(source, child.tagName);
                  if (resolved.specifier && UI_PACKAGE.test(resolved.specifier) && SECTION_CONTENT.has(resolved.imported)) {
                    inside.add(resolved.imported);
                  }
                }
                ts.forEachChild(child, walk);
              };
              for (const child of node.children) walk(child);
              if (inside.size > 0) {
                const { line } = source.sf.getLineAndCharacterOfPosition(node.getStart());
                offenders.push(`${source.path}:${line + 1} Card wraps ${[...inside].join(", ")}`);
              }
            }
          }
          ts.forEachChild(node, visit);
        };
        visit(source.sf);
      }
      return offenders;
    },

    /** `import { X } from "react-native"` for each X in `names`, as `file: X`. */
    reactNativeImports(names) {
      const found = [];
      for (const source of sources) {
        for (const [local, binding] of source.bindings) {
          if (!binding.typeOnly && /^react-native(-web)?$/.test(binding.specifier) && names.has(binding.imported)) {
            found.push(`${source.path}: ${binding.imported}${local === binding.imported ? "" : ` as ${local}`}`);
          }
        }
      }
      return found;
    },

    /** Names a file declares itself that look like a hand-rolled toast or sheet. */
    handRolledOverlays() {
      const found = [];
      for (const source of sources) {
        for (const name of source.declared) {
          if (HAND_ROLLED_NAME.test(name) && !source.bindings.has(name)) found.push(`${source.path}: declares ${name}`);
        }
      }
      return found;
    },
  };
}

/** Collects assertions. */
function createReport() {
  const assertions = [];
  return {
    assertions,
    /**
     * @param {string} id stable slug the test and the summary key on
     * @param {boolean} pass
     * @param {string} [detail] what was found, shown when it fails
     * @param {{ advisory?: boolean }} [options]
     */
    check(id, pass, detail = "", options = {}) {
      assertions.push({ id, pass: Boolean(pass), advisory: Boolean(options.advisory), detail: pass ? "" : detail });
    },
  };
}

/**
 * Forbidden patterns every task shares: the ways an agent that never found the
 * package's own pieces rebuilds them.
 *
 * @param {ReturnType<typeof loadSources>} app
 * @param {ReturnType<typeof createReport>} report
 */
export function commonChecks(app, report) {
  const dist = app.specifiers().filter((specifier) => /^@mrmeg\/[^/]+\/dist(\/|$)/.test(specifier));
  report.check("no-dist-imports", dist.length === 0, `imports ${dist.join(", ")}`);

  const icons = app
    .specifiers()
    .filter((specifier) => ICON_LIBRARIES.some((library) => specifier === library || specifier.startsWith(`${library}/`)));
  report.check("no-icon-libraries", icons.length === 0, `imports ${[...new Set(icons)].join(", ")}`);

  const raw = app.reactNativeImports(RAW_PRIMITIVES);
  report.check("no-raw-primitives", raw.length === 0, `react-native primitives the package wraps: ${raw.join("; ")}`);

  const pressables = app.reactNativeImports(RAW_PRESSABLES);
  report.check(
    "no-raw-pressable",
    pressables.length === 0,
    `react-native pressables (Button, IconButton and Item are the package's): ${pressables.join("; ")}`,
    { advisory: true },
  );

  const cards = app.cardsAroundSections();
  report.check("no-card-around-sections", cards.length === 0, cards.join("; "));

  const overlays = [
    ...app
      .specifiers()
      .filter((specifier) => OVERLAY_LIBRARIES.some((library) => specifier === library || specifier.startsWith(`${library}/`)))
      .map((specifier) => `imports ${specifier}`),
    ...app.reactNativeImports(RAW_OVERLAYS),
    ...app.handRolledOverlays(),
  ];
  report.check("no-hand-rolled-overlays", overlays.length === 0, overlays.join("; "));
}

/**
 * The `check.mjs` entry point: parse the CLI, run `define`, print the verdict.
 *
 * @param {string} metaUrl the task's `import.meta.url`
 * @param {(app: ReturnType<typeof loadSources>, report: ReturnType<typeof createReport>) => void} define
 */
export function runCheckCli(metaUrl, define) {
  const taskId = basename(dirname(fileURLToPath(metaUrl)));
  const argv = process.argv.slice(2);
  const appDir = argv[0];
  if (!appDir || appDir.startsWith("--")) {
    console.error(`Usage: node check.mjs <appDir> [--changed <changed-files.json>]`);
    process.exit(2);
  }
  const changedIndex = argv.indexOf("--changed");
  const changed = changedIndex >= 0 ? JSON.parse(readFileSync(argv[changedIndex + 1], "utf8")) : null;

  const app = loadSources(appDir, changed);
  const report = createReport();
  define(app, report);

  const pass = report.assertions.every((assertion) => assertion.pass || assertion.advisory);
  console.log(JSON.stringify({ taskId, pass, files: app.files, assertions: report.assertions }, null, 2));
  process.exit(pass ? 0 : 1);
}
