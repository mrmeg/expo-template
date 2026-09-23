/**
 * Reads the real design-system sources so rule messages can name the token,
 * preset, or size that actually exists today instead of a copy that drifts.
 *
 * Everything here is best-effort: a missing directory, a renamed export, or a
 * parse error degrades the affected fact to "unknown" and never throws. Rules
 * then fall back to a message that names the prop without its values.
 *
 * The parse result is cached per `uiSourceDir` and invalidated by file mtime.
 */

const fs = require("node:fs");
const path = require("node:path");

/**
 * Duplicated from `lib/settings.js` on purpose: `settings.js` reaches this file
 * through `lib/manifest.js`, so requiring it back would be a cycle. Only the
 * not-found text uses it, as a last-resort name for the directory.
 */
const DEFAULT_UI_SOURCE_DIR = "packages/ui/src";

/**
 * @typedef {object} TokenGroup
 * @property {{name: string, value: number}[]} entries source-ordered tokens
 * @property {number[]} values de-duplicated, ascending
 * @property {Map<number, string>} nameByValue first token declared per value
 */

/**
 * @typedef {object} ComponentInfo
 * @property {string} name exported name, e.g. `Button` or `Button.Text`
 * @property {string} file file name inside `components/`, e.g. `Button.tsx`
 * @property {boolean} hasSize whether the props type declares `size`
 * @property {string | null} variantProp `preset`, `variant`, or null
 * @property {string[] | null} variantValues resolved string-literal union
 * @property {string[] | null} sizeValues resolved string-literal union
 */

/**
 * @typedef {object} DesignSystem
 * @property {boolean} loaded false when nothing could be read
 * @property {Record<string, TokenGroup>} tokens keyed `spacing` | `radius` | `icon`
 * @property {Record<string, string>} palette palette key to literal color
 * @property {string[]} themeTokens `ThemeColors` keys
 * @property {Record<string, {paletteKey: string | null, value: string | null}>} lightTheme
 * @property {Record<string, {paletteKey: string | null, value: string | null}>} darkTheme
 * @property {string[] | null} fontVariants the `FontVariant` union, or null
 * @property {Map<string, ComponentInfo>} components
 * @property {import("./settings").DesignSystemOrigin | null} origin where these
 *   facts came from; `origin.error` says why an empty one is empty
 */

const SPACING_FILE = path.join("constants", "spacing.ts");
const COLORS_FILE = path.join("constants", "colors.ts");
const FONTS_FILE = path.join("constants", "fonts.ts");
const COMPONENTS_INDEX = path.join("components", "index.ts");

/**
 * How long a cached parse is trusted without re-reading mtimes. Every rule
 * calls the loader in `create()`, once per file, so a full run asked for ~53
 * `statSync` calls times four rules times every file — seconds of syscalls for
 * a design system that changes between runs, not during one. A fresh process
 * still checks once, and an edit is picked up on the next pass.
 */
const MTIME_CHECK_INTERVAL_MS = 2000;

/** @type {Map<string, {signature: string, checkedAt: number, data: DesignSystem}>} */
const cache = new Map();

/** @type {{parse: (code: string, options: object) => object} | null} */
let parser = null;

function getParser() {
  if (!parser) {
    // Resolved lazily: a consumer that never triggers a rule needing source
    // facts should not pay for loading the TypeScript parser.
    parser = require("@typescript-eslint/parser");
  }
  return parser;
}

/**
 * @param {string} file
 * @returns {object | null} the parsed program, or null on any failure
 */
function parseFile(file) {
  try {
    const code = fs.readFileSync(file, "utf8");
    return getParser().parse(code, {
      jsx: true,
      loc: false,
      range: false,
      comment: false,
      errorOnUnknownASTType: false,
    });
  } catch {
    return null;
  }
}

/**
 * mtime signature over every file the loader reads. Cheap enough to recompute
 * on each lint pass, so an edit to `spacing.ts` is picked up without a restart.
 *
 * @param {string} uiSourceDir
 * @returns {string}
 */
function signatureFor(uiSourceDir) {
  /** @type {string[]} */
  const parts = [];
  for (const relative of [SPACING_FILE, COLORS_FILE, FONTS_FILE, COMPONENTS_INDEX]) {
    parts.push(relative + ":" + mtimeOf(path.join(uiSourceDir, relative)));
  }
  const componentsDir = path.join(uiSourceDir, "components");
  /** @type {string[]} */
  let names;
  try {
    names = fs.readdirSync(componentsDir).sort();
  } catch {
    names = [];
  }
  for (const name of names) {
    if (!/\.tsx?$/.test(name)) continue;
    parts.push(name + ":" + mtimeOf(path.join(componentsDir, name)));
  }
  return parts.join("|");
}

/**
 * @param {string} file
 * @returns {number} mtime in ms, or -1 when the file is unreadable
 */
function mtimeOf(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return -1;
  }
}

/**
 * @returns {DesignSystem} an empty, "nothing known" design system
 */
function emptyDesignSystem() {
  return {
    loaded: false,
    tokens: {
      spacing: emptyTokenGroup(),
      radius: emptyTokenGroup(),
      icon: emptyTokenGroup(),
    },
    palette: {},
    themeTokens: [],
    lightTheme: {},
    darkTheme: {},
    fontVariants: null,
    components: new Map(),
    origin: null,
  };
}

/** @returns {TokenGroup} */
function emptyTokenGroup() {
  return { entries: [], values: [], nameByValue: new Map() };
}

/**
 * @param {string} uiSourceDir absolute path to `packages/ui/src`
 * @returns {DesignSystem}
 */
function loadDesignSystem(uiSourceDir) {
  const now = Date.now();
  const cached = cache.get(uiSourceDir);
  // Within the throttle window the cached parse is used without touching the
  // filesystem at all.
  if (cached && now - cached.checkedAt < MTIME_CHECK_INTERVAL_MS) return cached.data;

  const signature = signatureFor(uiSourceDir);
  if (cached && cached.signature === signature) {
    cached.checkedAt = now;
    return cached.data;
  }

  let data;
  try {
    data = build(uiSourceDir);
  } catch {
    data = emptyDesignSystem();
  }
  data.origin = { kind: "source", path: uiSourceDir };
  cache.set(uiSourceDir, { signature, checkedAt: now, data });
  return data;
}

/**
 * Loads the facts the resolved origin points at. The manifest loader is required
 * lazily: `lib/manifest.js` needs `emptyDesignSystem` from this file, and a
 * top-level require here would make that a cycle.
 *
 * @param {import("./settings").Settings} settings
 * @returns {DesignSystem}
 */
function loadDesignSystemFor(settings) {
  const origin = (settings && settings.origin) || null;
  if (!origin || origin.kind === "none") return emptyDesignSystem();
  if (origin.kind === "source") return loadDesignSystem(origin.path);
  const { loadDesignSystemFromManifest } = require("./manifest");
  return loadDesignSystemFromManifest(origin.path);
}

/**
 * The design system is missing, not just partly unreadable: every fact the
 * rules quote is unknown, so the message names what was looked for instead of
 * pretending to lint against it.
 *
 * A configured manifest that could not be read gets its own text: the project
 * said where the facts are, so the reason it failed is the useful part. A
 * `source` origin that parsed nothing lands on the not-found text too — the
 * directory exists but holds no design system, which is the same dead end.
 *
 * @param {import("./settings").Settings} settings
 * @param {DesignSystem} [design] what the loader returned, for its `origin.error`
 * @returns {string}
 */
function designSystemNotFoundMessage(settings, design) {
  const origin = (settings && settings.origin) || { kind: "none" };
  if (origin.kind === "manifest") {
    const reason =
      (design && design.origin && design.origin.error) || "the manifest could not be read";
    return `Design-system manifest could not be read at \`${origin.path}\`: ${reason}.`;
  }
  const uiSourceDir =
    origin.uiSourceDir || origin.path || (settings && settings.uiSourceDir) || DEFAULT_UI_SOURCE_DIR;
  const skipped = origin.skippedSources;
  // Sources that exist but belong to another package: say whose, or the
  // reader will go looking for a directory that is plainly there.
  const sources = skipped
    ? `the sources at \`${skipped.path}\` are ${
      skipped.packageName ? `\`${skipped.packageName}\`'s` : "not in a named package"
    }, not @mrmeg/expo-ui's,`
    : `no sources at \`${uiSourceDir}\``;
  return (
    `Design-system facts were not found: ${sources} and no manifest ` +
    "resolvable as `@mrmeg/expo-ui/design-system.json`. Install an @mrmeg/expo-ui release that " +
    "ships the manifest, or set `settings[\"expo-ui\"].uiSourceDir` or " +
    "`settings[\"expo-ui\"].manifestPath`."
  );
}

/**
 * `meta.messages` entry for the diagnostic above. Every rule spreads it in so
 * the report reads the same wherever it comes from.
 */
const DESIGN_SYSTEM_MISSING_MESSAGES = { designSystemMissing: "{{message}}" };

/**
 * Program visitor that reports the not-found diagnostic once per file. Rules
 * degrade to weaker advice — or to silence — without the sources, which is
 * invisible unless someone says so.
 *
 * @param {import("eslint").Rule.RuleContext} context
 * @param {DesignSystem} design
 * @param {import("./settings").Settings} settings
 * @returns {(node: object) => void}
 */
function reportMissingDesignSystem(context, design, settings) {
  return (node) => {
    if (design.loaded) return;
    context.report({
      node,
      messageId: "designSystemMissing",
      data: { message: designSystemNotFoundMessage(settings, design) },
    });
  };
}

/**
 * @param {string} uiSourceDir
 * @returns {DesignSystem}
 */
function build(uiSourceDir) {
  const result = emptyDesignSystem();
  const spacingProgram = parseFile(path.join(uiSourceDir, SPACING_FILE));
  if (spacingProgram) {
    readSpacingTokens(spacingProgram, result);
    result.loaded = true;
  }
  const colorsProgram = parseFile(path.join(uiSourceDir, COLORS_FILE));
  if (colorsProgram) {
    readColors(colorsProgram, result);
    result.loaded = true;
  }
  const fontsProgram = parseFile(path.join(uiSourceDir, FONTS_FILE));
  if (fontsProgram) {
    readFontVariants(fontsProgram, result);
    result.loaded = true;
  }
  const componentsDir = path.join(uiSourceDir, "components");
  const indexProgram = parseFile(path.join(componentsDir, "index.ts"));
  if (indexProgram) {
    readComponents(indexProgram, componentsDir, result);
    result.loaded = true;
  }
  return result;
}

// ---------------------------------------------------------------------------
// AST helpers
// ---------------------------------------------------------------------------

/**
 * @param {object} node
 * @returns {object} the object expression behind `{...} as const`, or the node
 */
function unwrap(node) {
  let current = node;
  while (
    current &&
    (current.type === "TSAsExpression" ||
      current.type === "TSSatisfiesExpression" ||
      current.type === "TSNonNullExpression" ||
      current.type === "TSTypeAssertion")
  ) {
    current = current.expression;
  }
  return current;
}

/**
 * @param {object} node a Property node
 * @returns {string | null} its static key name
 */
function propertyName(node) {
  if (!node || node.type !== "Property" || node.computed) return null;
  if (node.key.type === "Identifier") return node.key.name;
  if (node.key.type === "Literal" && typeof node.key.value === "string") {
    return node.key.value;
  }
  return null;
}

/**
 * @param {object} objectExpression
 * @param {string} name
 * @returns {object | null} the named property's value node
 */
function propertyValue(objectExpression, name) {
  if (!objectExpression || objectExpression.type !== "ObjectExpression") return null;
  for (const property of objectExpression.properties) {
    if (propertyName(property) === name) return unwrap(property.value);
  }
  return null;
}

/**
 * Walks a Program body and collects module-scope declarations by name.
 *
 * @param {object} program
 * @returns {{values: Map<string, object>, types: Map<string, object>}}
 */
function collectModuleScope(program) {
  /** @type {Map<string, object>} */
  const values = new Map();
  /** @type {Map<string, object>} */
  const types = new Map();

  /** @param {object} statement */
  const visit = (statement) => {
    if (!statement) return;
    if (statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration") {
      visit(statement.declaration);
      return;
    }
    if (statement.type === "FunctionDeclaration" && statement.id) {
      values.set(statement.id.name, statement);
      return;
    }
    if (statement.type === "ClassDeclaration" && statement.id) {
      values.set(statement.id.name, statement);
      return;
    }
    if (statement.type === "VariableDeclaration") {
      for (const declarator of statement.declarations) {
        if (declarator.id && declarator.id.type === "Identifier") {
          values.set(declarator.id.name, declarator);
        }
      }
      return;
    }
    if (statement.type === "TSInterfaceDeclaration" && statement.id) {
      types.set(statement.id.name, statement);
      return;
    }
    if (statement.type === "TSTypeAliasDeclaration" && statement.id) {
      types.set(statement.id.name, statement);
    }
  };

  for (const statement of program.body) visit(statement);
  return { values, types };
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/**
 * `spacing` members split into groups by key prefix: `radius*` are radii,
 * `icon*` are icon sizes, everything else is the spacing scale.
 *
 * @param {object} program
 * @param {DesignSystem} result
 */
function readSpacingTokens(program, result) {
  const scope = collectModuleScope(program);
  const declarator = scope.values.get("spacing");
  if (!declarator || declarator.type !== "VariableDeclarator") return;
  const object = unwrap(declarator.init);
  if (!object || object.type !== "ObjectExpression") return;

  for (const property of object.properties) {
    const name = propertyName(property);
    if (!name) continue;
    const value = numericLiteral(unwrap(property.value));
    if (value === null) continue;
    const group = /^radius/.test(name)
      ? result.tokens.radius
      : /^icon/.test(name)
        ? result.tokens.icon
        : result.tokens.spacing;
    group.entries.push({ name, value });
    if (!group.nameByValue.has(value)) group.nameByValue.set(value, name);
  }
  for (const key of Object.keys(result.tokens)) {
    const group = result.tokens[key];
    group.values = [...group.nameByValue.keys()].sort((a, b) => a - b);
  }
}

/**
 * @param {object} node
 * @returns {number | null}
 */
function numericLiteral(node) {
  if (node && node.type === "Literal" && typeof node.value === "number") {
    return node.value;
  }
  return null;
}

/**
 * @param {object} program
 * @param {DesignSystem} result
 */
function readColors(program, result) {
  const scope = collectModuleScope(program);

  const paletteDeclarator = scope.values.get("palette");
  if (paletteDeclarator && paletteDeclarator.type === "VariableDeclarator") {
    const object = unwrap(paletteDeclarator.init);
    if (object && object.type === "ObjectExpression") {
      for (const property of object.properties) {
        const name = propertyName(property);
        const value = unwrap(property.value);
        if (name && value && value.type === "Literal" && typeof value.value === "string") {
          result.palette[name] = value.value;
        }
      }
    }
  }

  const themeColors = scope.types.get("ThemeColors");
  if (themeColors && themeColors.type === "TSInterfaceDeclaration") {
    for (const member of themeColors.body.body) {
      if (member.type === "TSPropertySignature" && member.key && member.key.type === "Identifier") {
        result.themeTokens.push(member.key.name);
      }
    }
  }

  result.lightTheme = readThemeColors(scope, "lightTheme", result.palette);
  result.darkTheme = readThemeColors(scope, "darkTheme", result.palette);
  if (result.themeTokens.length === 0) {
    result.themeTokens = Object.keys(result.lightTheme);
  }
}

/**
 * @param {{values: Map<string, object>}} scope
 * @param {string} name `lightTheme` or `darkTheme`
 * @param {Record<string, string>} palette
 * @returns {Record<string, {paletteKey: string | null, value: string | null}>}
 */
function readThemeColors(scope, name, palette) {
  /** @type {Record<string, {paletteKey: string | null, value: string | null}>} */
  const map = {};
  const declarator = scope.values.get(name);
  if (!declarator || declarator.type !== "VariableDeclarator") return map;
  const colors = propertyValue(unwrap(declarator.init), "colors");
  if (!colors || colors.type !== "ObjectExpression") return map;

  for (const property of colors.properties) {
    const token = propertyName(property);
    if (!token) continue;
    const value = unwrap(property.value);
    if (
      value &&
      value.type === "MemberExpression" &&
      !value.computed &&
      value.object.type === "Identifier" &&
      value.object.name === "palette" &&
      value.property.type === "Identifier"
    ) {
      const paletteKey = value.property.name;
      map[token] = { paletteKey, value: palette[paletteKey] || null };
    } else if (value && value.type === "Literal" && typeof value.value === "string") {
      map[token] = { paletteKey: null, value: value.value };
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

/**
 * `FontVariant` is the font-family union behind a text component's `variant`
 * prop. It is declared in `constants/fonts.ts` and imported by
 * `StyledText.tsx`, so the per-file union resolver cannot reach it from the
 * component — it is read here instead, and the text-typography message names
 * the families that exist today.
 *
 * @param {object} program parsed `constants/fonts.ts`
 * @param {DesignSystem} result
 */
function readFontVariants(program, result) {
  const scope = collectModuleScope(program);
  const declaration = scope.types.get("FontVariant");
  if (!declaration || declaration.type !== "TSTypeAliasDeclaration") return;
  result.fontVariants = stringUnion(scope, declaration.typeAnnotation, 0);
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * @param {object} indexProgram parsed `components/index.ts`
 * @param {string} componentsDir
 * @param {DesignSystem} result
 */
function readComponents(indexProgram, componentsDir, result) {
  /** @type {string[]} */
  const modules = [];
  for (const statement of indexProgram.body) {
    if (
      statement.type === "ExportAllDeclaration" &&
      statement.source &&
      typeof statement.source.value === "string"
    ) {
      modules.push(statement.source.value);
    }
  }

  for (const specifier of modules) {
    const relative = specifier.replace(/^\.\//, "");
    const file = resolveModuleFile(componentsDir, relative);
    if (!file) continue;
    const program = parseFile(path.join(componentsDir, file));
    if (!program) continue;
    readComponentModule(program, file, result);
  }
}

/**
 * @param {string} dir
 * @param {string} relative
 * @returns {string | null} the file name that exists, `.tsx` first
 */
function resolveModuleFile(dir, relative) {
  for (const extension of [".tsx", ".ts"]) {
    const candidate = relative + extension;
    try {
      if (fs.statSync(path.join(dir, candidate)).isFile()) return candidate;
    } catch {
      // try the next extension
    }
  }
  return null;
}

/**
 * Collects every value exported by one component module, plus the compound
 * members that `Object.assign(Root, { Member })` attaches, and records the
 * props facts (`size`, variant prop and its union) for each.
 *
 * @param {object} program
 * @param {string} file
 * @param {DesignSystem} result
 */
function readComponentModule(program, file, result) {
  const scope = collectModuleScope(program);
  /** @type {Map<string, string>} exported name to local name */
  const exported = new Map();

  for (const statement of program.body) {
    if (statement.type !== "ExportNamedDeclaration") continue;
    if (statement.exportKind === "type") continue;
    if (statement.source) continue; // re-export from elsewhere: not resolvable here
    if (statement.declaration) {
      const declaration = statement.declaration;
      if (declaration.type === "FunctionDeclaration" && declaration.id) {
        exported.set(declaration.id.name, declaration.id.name);
      } else if (declaration.type === "VariableDeclaration") {
        for (const declarator of declaration.declarations) {
          if (declarator.id && declarator.id.type === "Identifier") {
            exported.set(declarator.id.name, declarator.id.name);
          }
        }
      }
      continue;
    }
    for (const specifier of statement.specifiers || []) {
      if (specifier.exportKind === "type") continue;
      const local = specifier.local && specifier.local.name;
      const name = specifier.exported && specifier.exported.name;
      if (local && name) exported.set(name, local);
    }
  }

  for (const [name, local] of exported) {
    if (!/^[A-Z]/.test(name)) continue; // hooks and helpers are not components
    record(result, name, file, scope, local);

    const members = compoundMembers(scope, local);
    for (const [memberName, memberLocal] of members) {
      record(result, name + "." + memberName, file, scope, memberLocal);
    }
  }
}

/**
 * @param {DesignSystem} result
 * @param {string} name
 * @param {string} file
 * @param {{values: Map<string, object>, types: Map<string, object>}} scope
 * @param {string} local
 */
function record(result, name, file, scope, local) {
  if (result.components.has(name)) return;
  const props = propsFacts(scope, local);
  result.components.set(name, {
    name,
    file,
    hasSize: props.hasSize,
    variantProp: props.variantProp,
    variantValues: props.variantValues,
    sizeValues: props.sizeValues,
  });
}

/**
 * @param {{values: Map<string, object>}} scope
 * @param {string} local
 * @returns {Map<string, string>} member name to local component name
 */
function compoundMembers(scope, local) {
  /** @type {Map<string, string>} */
  const members = new Map();
  const declarator = scope.values.get(local);
  if (!declarator || declarator.type !== "VariableDeclarator") return members;
  const init = unwrap(declarator.init);
  if (!isObjectAssign(init)) return members;
  const object = unwrap(init.arguments[1]);
  if (!object || object.type !== "ObjectExpression") return members;
  for (const property of object.properties) {
    const name = propertyName(property);
    const value = unwrap(property.value);
    if (name && value && value.type === "Identifier") members.set(name, value.name);
  }
  return members;
}

/**
 * @param {object} node
 * @returns {boolean}
 */
function isObjectAssign(node) {
  return Boolean(
    node &&
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      !node.callee.computed &&
      node.callee.object.type === "Identifier" &&
      node.callee.object.name === "Object" &&
      node.callee.property.type === "Identifier" &&
      node.callee.property.name === "assign" &&
      node.arguments.length >= 2,
  );
}

/**
 * Follows aliases and `Object.assign` wrappers down to the function that
 * declares the props, then reads its props type.
 *
 * @param {{values: Map<string, object>, types: Map<string, object>}} scope
 * @param {string} local
 * @returns {{hasSize: boolean, variantProp: string | null, variantValues: string[] | null, sizeValues: string[] | null}}
 */
function propsFacts(scope, local) {
  const unknown = { hasSize: false, variantProp: null, variantValues: null, sizeValues: null };
  const fn = resolveFunction(scope, local, 0);
  if (!fn) return unknown;
  const parameter = (fn.params || [])[0];
  const annotation =
    parameter && parameter.typeAnnotation && parameter.typeAnnotation.typeAnnotation;
  const members = typeMembers(scope, annotation, 0);
  if (!members) return unknown;

  const sizeType = members.get("size") || null;
  const variantProp = members.has("preset")
    ? "preset"
    : members.has("variant")
      ? "variant"
      : null;
  return {
    hasSize: members.has("size"),
    variantProp,
    variantValues: variantProp ? stringUnion(scope, members.get(variantProp), 0) : null,
    sizeValues: sizeType ? stringUnion(scope, sizeType, 0) : null,
  };
}

/**
 * @param {{values: Map<string, object>}} scope
 * @param {string} local
 * @param {number} depth
 * @returns {object | null} a function-like node
 */
function resolveFunction(scope, local, depth) {
  if (depth > 6) return null;
  const declaration = scope.values.get(local);
  if (!declaration) return null;
  if (declaration.type === "FunctionDeclaration") return declaration;
  if (declaration.type !== "VariableDeclarator") return null;
  const init = unwrap(declaration.init);
  if (!init) return null;
  if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression") return init;
  if (init.type === "Identifier") return resolveFunction(scope, init.name, depth + 1);
  if (isObjectAssign(init)) {
    const base = unwrap(init.arguments[0]);
    if (base && base.type === "Identifier") return resolveFunction(scope, base.name, depth + 1);
    if (base && (base.type === "ArrowFunctionExpression" || base.type === "FunctionExpression")) {
      return base;
    }
    return null;
  }
  if (init.type === "CallExpression") {
    // `forwardRef(fn)`, `memo(fn)`, `React.forwardRef(fn)`, ...
    for (const argument of init.arguments) {
      const value = unwrap(argument);
      if (!value) continue;
      if (value.type === "ArrowFunctionExpression" || value.type === "FunctionExpression") {
        return value;
      }
      if (value.type === "Identifier") {
        const nested = resolveFunction(scope, value.name, depth + 1);
        if (nested) return nested;
      }
    }
  }
  return null;
}

/**
 * @param {{types: Map<string, object>}} scope
 * @param {object | null | undefined} typeNode
 * @param {number} depth
 * @returns {Map<string, object> | null} prop name to its type node
 */
function typeMembers(scope, typeNode, depth) {
  if (!typeNode || depth > 6) return null;
  if (typeNode.type === "TSTypeLiteral") return membersOf(typeNode.members);
  if (typeNode.type === "TSIntersectionType" || typeNode.type === "TSUnionType") {
    /** @type {Map<string, object>} */
    const merged = new Map();
    for (const part of typeNode.types) {
      const partMembers = typeMembers(scope, part, depth + 1);
      if (!partMembers) continue;
      for (const [name, value] of partMembers) if (!merged.has(name)) merged.set(name, value);
    }
    return merged.size > 0 ? merged : null;
  }
  if (typeNode.type === "TSTypeReference" && typeNode.typeName.type === "Identifier") {
    const declaration = scope.types.get(typeNode.typeName.name);
    if (!declaration) return null;
    if (declaration.type === "TSInterfaceDeclaration") {
      const own = membersOf(declaration.body.body) || new Map();
      for (const heritage of declaration.extends || []) {
        const parent =
          heritage.expression && heritage.expression.type === "Identifier"
            ? typeMembers(
              scope,
              { type: "TSTypeReference", typeName: heritage.expression },
              depth + 1,
            )
            : null;
        if (!parent) continue;
        for (const [name, value] of parent) if (!own.has(name)) own.set(name, value);
      }
      return own.size > 0 ? own : null;
    }
    if (declaration.type === "TSTypeAliasDeclaration") {
      return typeMembers(scope, declaration.typeAnnotation, depth + 1);
    }
  }
  return null;
}

/**
 * @param {object[]} members TSPropertySignature list
 * @returns {Map<string, object> | null}
 */
function membersOf(members) {
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const member of members || []) {
    if (member.type !== "TSPropertySignature") continue;
    if (!member.key || member.key.type !== "Identifier") continue;
    map.set(
      member.key.name,
      (member.typeAnnotation && member.typeAnnotation.typeAnnotation) || null,
    );
  }
  return map.size > 0 ? map : null;
}

/**
 * Resolves a string-literal union, following one type alias in the same file.
 *
 * @param {{types: Map<string, object>}} scope
 * @param {object | null | undefined} typeNode
 * @param {number} depth
 * @returns {string[] | null} the union values, or null when unresolvable
 */
function stringUnion(scope, typeNode, depth) {
  if (!typeNode || depth > 6) return null;
  if (typeNode.type === "TSLiteralType") {
    const literal = typeNode.literal;
    if (literal && literal.type === "Literal" && typeof literal.value === "string") {
      return [literal.value];
    }
    return null;
  }
  if (typeNode.type === "TSUnionType") {
    /** @type {string[]} */
    const values = [];
    for (const part of typeNode.types) {
      const resolved = stringUnion(scope, part, depth + 1);
      if (!resolved) return null;
      for (const value of resolved) if (!values.includes(value)) values.push(value);
    }
    return values.length > 0 ? values : null;
  }
  if (typeNode.type === "TSTypeReference" && typeNode.typeName.type === "Identifier") {
    const declaration = scope.types.get(typeNode.typeName.name);
    if (declaration && declaration.type === "TSTypeAliasDeclaration") {
      return stringUnion(scope, declaration.typeAnnotation, depth + 1);
    }
  }
  return null;
}

module.exports = {
  DESIGN_SYSTEM_MISSING_MESSAGES,
  designSystemNotFoundMessage,
  loadDesignSystem,
  loadDesignSystemFor,
  reportMissingDesignSystem,
  // exported for tests and for `lib/manifest.js`
  emptyDesignSystem,
};
