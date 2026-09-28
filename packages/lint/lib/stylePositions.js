/**
 * Finds the object literals a file uses as styles, so the value rules police
 * style properties and nothing else.
 *
 * A key name alone is not enough: chart data (`{ color: "#f00", value: 3 }`),
 * a Google Maps theme, or a palette table carries `color` and `padding` keys
 * without being a style. An object counts as a style when it reaches one of
 * these positions, directly or through the arrays, conditionals, variables,
 * sheet members, and local functions that lead to it:
 *
 * - a `style` or `*Style` JSX prop, on any element;
 * - a `style` or `*Style` property of an object (navigation options:
 *   `headerStyle`, `tabBarStyle`, `contentStyle`, …);
 * - a named style of `StyleSheet.create({...})` or of a
 *   `createThemedStyles(theme => ({...}))` factory;
 * - an argument of `StyleSheet.flatten` / `StyleSheet.compose`, or the object a
 *   `useAnimatedStyle` worklet returns;
 * - a value typed as a style: `const s: ViewStyle = {...}`,
 *   `{...} as TextStyle`, `{...} satisfies ViewStyle`, or a function whose
 *   return type is one.
 *
 * A style that is a map of states rather than of properties —
 * `labelStyle={{ default: { color }, selected: { color } }}` on native tabs —
 * has its state objects checked as the styles.
 *
 * Anything the resolver cannot follow — an import, a spread, an arbitrary call
 * result — is skipped, like everywhere else in this plugin: a blind spot costs
 * coverage, never a false positive.
 */

const { categorize } = require("./categories");
const { findVariable } = require("./components");
const { isCreateThemedStyles, isStyleSheetCreate, resolveSheet, staticPropertyName, unwrap } = require("./styles");

const MAX_DEPTH = 8;

/** `style`, `contentContainerStyle`, `headerStyle`, `textStyle`, … */
const STYLE_NAME = /^style$|Style$/;

/** `ViewStyle`, `TextStyle`, `ImageStyle`, `StyleProp<…>`, `React.CSSProperties`, … */
const STYLE_TYPE_NAME = /^(?:StyleProp|[A-Za-z]*Style|CSSProperties)$/;

/** Hooks whose first argument returns the value they hand back. */
const MEMO_HOOKS = new Set(["useMemo"]);

/** Style helpers whose first argument is a function that returns a style. */
const STYLE_WORKLETS = new Set(["useAnimatedStyle"]);

/** `StyleSheet` methods whose arguments are styles. */
const STYLE_SHEET_STYLE_ARGUMENTS = new Set(["flatten", "compose"]);

/**
 * @param {object} callee
 * @returns {string | null} `useMemo` for both `useMemo(...)` and `React.useMemo(...)`
 */
function calleeName(callee) {
  const node = unwrap(callee);
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
    return node.property.name;
  }
  return null;
}

/**
 * @param {object} node a CallExpression
 * @returns {boolean} true for `StyleSheet.flatten(...)` / `StyleSheet.compose(...)`
 */
function isStyleSheetStyleCall(node) {
  const callee = unwrap(node.callee);
  return Boolean(
    callee &&
      callee.type === "MemberExpression" &&
      !callee.computed &&
      callee.object.type === "Identifier" &&
      callee.object.name === "StyleSheet" &&
      callee.property.type === "Identifier" &&
      STYLE_SHEET_STYLE_ARGUMENTS.has(callee.property.name),
  );
}

/**
 * @param {object | null | undefined} typeNode a TS type annotation's type
 * @returns {boolean} true when the type is (or unions/intersects) a style type
 */
function isStyleType(typeNode) {
  if (!typeNode) return false;
  if (typeNode.type === "TSTypeAnnotation") return isStyleType(typeNode.typeAnnotation);
  if (typeNode.type === "TSUnionType" || typeNode.type === "TSIntersectionType") {
    return typeNode.types.some(isStyleType);
  }
  if (typeNode.type !== "TSTypeReference") return false;
  let name = typeNode.typeName;
  while (name && name.type === "TSQualifiedName") name = name.right;
  return Boolean(name && name.type === "Identifier" && STYLE_TYPE_NAME.test(name.name));
}

/**
 * The declaration a plain identifier binds, when it is bound once and never
 * reassigned. Destructured bindings are skipped: their initializer is the
 * whole object, not the value of the binding.
 *
 * @param {object} identifier
 * @param {import("eslint").Rule.RuleContext} context
 * @returns {object | null} a VariableDeclarator, FunctionDeclaration, or null
 */
function bindingOf(identifier, context) {
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
  if (def.type === "FunctionName") return def.node;
  if (def.type !== "Variable") return null;
  const writes = variable.references.filter((reference) => reference.isWrite());
  if (writes.length > 1) return null;
  const declarator = def.node;
  if (!declarator || declarator.type !== "VariableDeclarator" || declarator.id.type !== "Identifier") {
    return null;
  }
  return declarator;
}

/**
 * @param {object} fn a function node
 * @returns {object[]} the expressions it returns, not counting nested functions
 */
function returnedExpressions(fn) {
  if (!fn || !fn.body) return [];
  if (fn.body.type !== "BlockStatement") return [fn.body];
  /** @type {object[]} */
  const returned = [];
  const visit = (node) => {
    if (!node || typeof node.type !== "string") return;
    if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    ) {
      return;
    }
    if (node.type === "ReturnStatement") {
      if (node.argument) returned.push(node.argument);
      return;
    }
    for (const key of Object.keys(node)) {
      if (key === "parent") continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child.type === "string") visit(child);
    }
  };
  fn.body.body.forEach(visit);
  return returned;
}

/**
 * @param {object} node
 * @returns {boolean}
 */
function isFunction(node) {
  return Boolean(
    node &&
      (node.type === "ArrowFunctionExpression" ||
        node.type === "FunctionExpression" ||
        node.type === "FunctionDeclaration"),
  );
}

/**
 * The per-state styles of a state map: an object none of whose keys is a style
 * property, and whose values are object literals (`{ default: {...},
 * selected: {...} }`). Empty for an ordinary style object.
 *
 * @param {object} object an ObjectExpression in a style position
 * @returns {object[]} ObjectExpressions
 */
function stateStyles(object) {
  /** @type {object[]} */
  const states = [];
  for (const property of object.properties) {
    const key = staticPropertyName(property);
    if (!key || categorize(key)) return [];
    const value = unwrap(property.value);
    if (!value || value.type !== "ObjectExpression") return [];
    states.push(value);
  }
  return states;
}

/**
 * The object literals a style value can evaluate to.
 *
 * @param {object} node a style value: an object, array, conditional, reference, call, …
 * @param {import("eslint").Rule.RuleContext} context
 * @param {number} depth
 * @param {object[]} out collected ObjectExpressions
 * @param {Set<object>} visited nodes already followed, against cycles
 */
function collectStyleObjects(node, context, depth, out, visited) {
  const current = unwrap(node);
  if (!current || depth > MAX_DEPTH || visited.has(current)) return;
  visited.add(current);
  const next = (child) => collectStyleObjects(child, context, depth + 1, out, visited);

  switch (current.type) {
    case "ObjectExpression":
      out.push(current);
      return;
    case "ArrayExpression":
      for (const element of current.elements) {
        if (!element) continue;
        next(element.type === "SpreadElement" ? element.argument : element);
      }
      return;
    case "ConditionalExpression":
      next(current.consequent);
      next(current.alternate);
      return;
    case "LogicalExpression":
      // `cond && style` contributes only its right side; `a || b` and `a ?? b`
      // can both land.
      if (current.operator !== "&&") next(current.left);
      next(current.right);
      return;
    case "ArrowFunctionExpression":
    case "FunctionExpression":
      // `<Pressable style={({ pressed }) => [...]} />`
      returnedExpressions(current).forEach(next);
      return;
    case "Identifier": {
      const binding = bindingOf(current, context);
      if (!binding) return;
      if (binding.type === "FunctionDeclaration") returnedExpressions(binding).forEach(next);
      else next(binding.init);
      return;
    }
    case "MemberExpression": {
      // `styles.card`, `themed(theme).card`, `styles["card"]`
      const name = current.computed
        ? current.property.type === "Literal" && typeof current.property.value === "string"
          ? current.property.value
          : null
        : current.property.type === "Identifier"
          ? current.property.name
          : null;
      if (!name) return;
      const sheet = resolveSheet(current.object, context, 0);
      if (!sheet) return;
      for (const property of sheet.properties) {
        if (staticPropertyName(property) === name) next(property.value);
      }
      return;
    }
    case "CallExpression": {
      if (isStyleSheetStyleCall(current)) {
        current.arguments.forEach(next);
        return;
      }
      const name = calleeName(current.callee);
      if (name && (MEMO_HOOKS.has(name) || STYLE_WORKLETS.has(name))) {
        const callback = unwrap(current.arguments[0]);
        if (isFunction(callback)) returnedExpressions(callback).forEach(next);
        return;
      }
      // A local helper: `style={cardStyle(active)}`.
      const callee = unwrap(current.callee);
      if (callee && callee.type === "Identifier") {
        const binding = bindingOf(callee, context);
        const fn = binding && binding.type === "VariableDeclarator" ? unwrap(binding.init) : binding;
        if (isFunction(fn)) returnedExpressions(fn).forEach(next);
      }
      return;
    }
    default:
      return;
  }
}

/**
 * Visitors that call `onStyleObject` once per object literal the file uses as a
 * style. Spread them into a rule's visitor map; a rule that handles one of the
 * same node types itself has to call the handler returned here from its own.
 *
 * @param {import("eslint").Rule.RuleContext} context
 * @param {(object: object) => void} onStyleObject receives an ObjectExpression
 * @returns {Record<string, (node: object) => void>}
 */
function styleObjectVisitors(context, onStyleObject) {
  /** @type {Set<object>} */
  const seen = new Set();

  /** @param {object | null | undefined} value a style value */
  const fromValue = (value) => {
    if (!value) return;
    /** @type {object[]} */
    const objects = [];
    collectStyleObjects(value, context, 0, objects, new Set());
    for (const object of objects.flatMap((found) => [found, ...stateStyles(found)])) {
      if (seen.has(object)) continue;
      seen.add(object);
      onStyleObject(object);
    }
  };

  /** @param {object} sheetNode a sheet expression */
  const fromSheet = (sheetNode) => {
    const sheet = resolveSheet(sheetNode, context, 0);
    if (!sheet) return;
    for (const property of sheet.properties) {
      if (property.type === "Property") fromValue(property.value);
    }
  };

  /** @param {object} fn a function with a return type */
  const fromTypedFunction = (fn) => {
    if (isStyleType(fn.returnType)) returnedExpressions(fn).forEach(fromValue);
  };

  return {
    JSXAttribute(node) {
      if (!node.name || node.name.type !== "JSXIdentifier" || !STYLE_NAME.test(node.name.name)) return;
      if (!node.value || node.value.type !== "JSXExpressionContainer") return;
      fromValue(node.value.expression);
    },

    CallExpression(node) {
      if (isStyleSheetCreate(node) || isCreateThemedStyles(node)) {
        fromSheet(node);
        return;
      }
      if (isStyleSheetStyleCall(node)) {
        node.arguments.forEach(fromValue);
        return;
      }
      const name = calleeName(node.callee);
      if (name && STYLE_WORKLETS.has(name)) {
        const worklet = unwrap(node.arguments[0]);
        if (isFunction(worklet)) returnedExpressions(worklet).forEach(fromValue);
      }
    },

    Property(node) {
      if (!node.parent || node.parent.type !== "ObjectExpression") return;
      const key = staticPropertyName(node);
      if (key && STYLE_NAME.test(key)) fromValue(node.value);
    },

    VariableDeclarator(node) {
      if (node.init && node.id.type === "Identifier" && isStyleType(node.id.typeAnnotation)) {
        fromValue(node.init);
      }
    },

    TSAsExpression(node) {
      if (isStyleType(node.typeAnnotation)) fromValue(node.expression);
    },

    TSSatisfiesExpression(node) {
      if (isStyleType(node.typeAnnotation)) fromValue(node.expression);
    },

    ArrowFunctionExpression: fromTypedFunction,
    FunctionExpression: fromTypedFunction,
    FunctionDeclaration: fromTypedFunction,
  };
}

module.exports = {
  STYLE_NAME,
  collectStyleObjects,
  isStyleType,
  styleObjectVisitors,
};
