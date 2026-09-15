/**
 * Resolves a style value to the concrete style properties it contributes.
 *
 * App code writes styles four ways: inline object literals, arrays of them,
 * conditional branches, and references into a module-scope sheet built by
 * `StyleSheet.create({...})` or by `createThemedStyles(factory)` read back as
 * `themedStyles(theme).name`. All four resolve here.
 *
 * Anything else — a spread, an imported object, an arbitrary call result — is
 * skipped silently. A rule that cannot see the properties reports nothing, so
 * the resolver's blind spots cost coverage, never a false positive.
 */

const { findVariable } = require("./components");

const MAX_DEPTH = 8;

/**
 * Wrappers that carry the same value as the expression inside them. A
 * `ChainExpression` is what wraps `sheet?.card`, so without it an optional
 * member read resolves to nothing and the whole style is invisible.
 */
const TRANSPARENT_WRAPPERS = new Set([
  "ChainExpression",
  "ParenthesizedExpression",
  "TSAsExpression",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
]);

/**
 * @param {object} node
 * @returns {object} the expression behind `x as const` / `x!` / `x?.y`
 */
function unwrap(node) {
  let current = node;
  while (current && TRANSPARENT_WRAPPERS.has(current.type)) {
    current = current.expression;
  }
  return current;
}

/**
 * @param {object} node a Property node
 * @returns {string | null}
 */
function staticPropertyName(node) {
  if (!node || node.type !== "Property" || node.computed) return null;
  if (node.key.type === "Identifier") return node.key.name;
  if (node.key.type === "Literal" && typeof node.key.value === "string") return node.key.value;
  return null;
}

/**
 * @param {object} identifier
 * @param {import("eslint").Rule.RuleContext} context
 * @returns {object | null} the initializer of the variable it refers to
 */
function variableInit(identifier, context) {
  const sourceCode = context.sourceCode || context.getSourceCode();
  let scope;
  try {
    scope = sourceCode.getScope(identifier);
  } catch {
    return null;
  }
  const variable = findVariable(scope, identifier.name);
  if (!variable || variable.defs.length !== 1) return null;
  const def = variable.defs[0];
  if (def.type !== "Variable") return null;
  // A rebound variable could hold anything by the time the style is read.
  const writes = variable.references.filter((reference) => reference.isWrite());
  if (writes.length > 1) return null;
  const declarator = def.node;
  if (!declarator || declarator.type !== "VariableDeclarator") return null;
  return unwrap(declarator.init);
}

/**
 * @param {object} node
 * @returns {boolean} true for `StyleSheet.create(...)`
 */
function isStyleSheetCreate(node) {
  return Boolean(
    node &&
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      !node.callee.computed &&
      node.callee.property.type === "Identifier" &&
      node.callee.property.name === "create" &&
      node.callee.object.type === "Identifier" &&
      node.callee.object.name === "StyleSheet",
  );
}

/**
 * @param {object} node
 * @returns {boolean} true for `createThemedStyles(...)`
 */
function isCreateThemedStyles(node) {
  return Boolean(
    node &&
      node.type === "CallExpression" &&
      ((node.callee.type === "Identifier" && node.callee.name === "createThemedStyles") ||
        (node.callee.type === "MemberExpression" &&
          !node.callee.computed &&
          node.callee.property.type === "Identifier" &&
          node.callee.property.name === "createThemedStyles")),
  );
}

/**
 * @param {object} fn a function node
 * @param {import("eslint").Rule.RuleContext} context
 * @param {number} depth
 * @returns {object | null} the sheet object the function returns
 */
function returnedSheet(fn, context, depth) {
  if (!fn || depth > MAX_DEPTH) return null;
  if (fn.type !== "ArrowFunctionExpression" && fn.type !== "FunctionExpression") return null;
  const body = fn.body;
  if (!body) return null;
  if (body.type !== "BlockStatement") return resolveSheet(unwrap(body), context, depth + 1);
  for (const statement of body.body) {
    if (statement.type === "ReturnStatement" && statement.argument) {
      return resolveSheet(unwrap(statement.argument), context, depth + 1);
    }
  }
  return null;
}

/**
 * Resolves a node to the object that holds *named* styles — the argument of
 * `StyleSheet.create`, or the object a `createThemedStyles` factory returns.
 *
 * @param {object} node
 * @param {import("eslint").Rule.RuleContext} context
 * @param {number} depth
 * @returns {object | null} an ObjectExpression
 */
function resolveSheet(node, context, depth) {
  const current = unwrap(node);
  if (!current || depth > MAX_DEPTH) return null;

  if (current.type === "ObjectExpression") return current;

  if (current.type === "Identifier") {
    const init = variableInit(current, context);
    return init ? resolveSheet(init, context, depth + 1) : null;
  }

  if (current.type === "CallExpression") {
    if (isStyleSheetCreate(current)) {
      return current.arguments.length > 0
        ? resolveSheet(current.arguments[0], context, depth + 1)
        : null;
    }
    if (isCreateThemedStyles(current)) {
      const factory = unwrap(current.arguments[0]);
      if (!factory) return null;
      if (factory.type === "Identifier") {
        const init = variableInit(factory, context);
        return init ? returnedSheet(init, context, depth + 1) : null;
      }
      return returnedSheet(factory, context, depth + 1);
    }
    // `themedStyles(theme)` — the callee is the reader `createThemedStyles`
    // returned, or `createThemedStyles(factory)(theme)` written inline.
    const callee = unwrap(current.callee);
    if (callee && callee.type === "Identifier") {
      const init = variableInit(callee, context);
      if (init && isCreateThemedStyles(init)) return resolveSheet(init, context, depth + 1);
      return null;
    }
    if (callee && callee.type === "CallExpression" && isCreateThemedStyles(callee)) {
      return resolveSheet(callee, context, depth + 1);
    }
  }

  return null;
}

/**
 * Resolves a node to a single style object.
 *
 * @param {object} node
 * @param {import("eslint").Rule.RuleContext} context
 * @param {number} depth
 * @returns {object | null} an ObjectExpression
 */
function resolveStyleObject(node, context, depth) {
  const current = unwrap(node);
  if (!current || depth > MAX_DEPTH) return null;

  if (current.type === "ObjectExpression") return current;

  if (current.type === "Identifier") {
    const init = variableInit(current, context);
    if (!init) return null;
    const resolved = unwrap(init);
    return resolved && resolved.type === "ObjectExpression"
      ? resolved
      : resolveStyleObject(resolved, context, depth + 1);
  }

  if (current.type === "MemberExpression" && !current.computed) {
    const name = current.property.type === "Identifier" ? current.property.name : null;
    if (!name) return null;
    const sheet = resolveSheet(current.object, context, depth + 1);
    if (!sheet) return null;
    for (const property of sheet.properties) {
      if (staticPropertyName(property) === name) {
        const value = unwrap(property.value);
        return value && value.type === "ObjectExpression"
          ? value
          : resolveStyleObject(value, context, depth + 1);
      }
    }
  }

  return null;
}

/**
 * @param {object} node the value of a style attribute or a nested style value
 * @param {import("eslint").Rule.RuleContext} context
 * @param {number} [depth]
 * @returns {{key: string, keyNode: object, valueNode: object, property: object}[]}
 */
function resolveStyleEntries(node, context, depth) {
  const level = depth || 0;
  const current = unwrap(node);
  if (!current || level > MAX_DEPTH) return [];

  if (current.type === "ArrayExpression") {
    /** @type {object[]} */
    let entries = [];
    for (const element of current.elements) {
      if (!element || element.type === "SpreadElement") continue;
      entries = entries.concat(resolveStyleEntries(element, context, level + 1));
    }
    return entries;
  }

  if (current.type === "ConditionalExpression") {
    return resolveStyleEntries(current.consequent, context, level + 1).concat(
      resolveStyleEntries(current.alternate, context, level + 1),
    );
  }

  if (current.type === "LogicalExpression") {
    // `cond && styles.x` contributes only its right side; `a || b` and `a ?? b`
    // can both land.
    const branches =
      current.operator === "&&" ? [current.right] : [current.left, current.right];
    /** @type {object[]} */
    let entries = [];
    for (const branch of branches) {
      entries = entries.concat(resolveStyleEntries(branch, context, level + 1));
    }
    return entries;
  }

  const object = resolveStyleObject(current, context, level);
  if (!object) return [];

  /** @type {{key: string, keyNode: object, valueNode: object, property: object}[]} */
  const result = [];
  for (const property of object.properties) {
    const key = staticPropertyName(property);
    if (!key) continue;
    result.push({
      key,
      keyNode: property.key,
      valueNode: unwrap(property.value),
      property,
    });
  }
  return result;
}

module.exports = {
  resolveStyleEntries,
  resolveStyleObject,
  resolveSheet,
  isStyleSheetCreate,
  isCreateThemedStyles,
  staticPropertyName,
  unwrap,
};
