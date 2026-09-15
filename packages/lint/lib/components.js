/**
 * Decides whether a JSX element is a design-system component.
 *
 * A local `<Row>` that happens to share a name with a design-system component
 * must not be policed, so the element's identifier is resolved through scope to
 * its declaration; only an import whose source matches `componentImports`
 * counts. The reported name is the *imported* name, so an alias
 * (`import { Button as Btn }`) still resolves to `Button`'s contract.
 */

/**
 * @param {import("eslint").Scope.Scope | null} scope
 * @param {string} name
 * @returns {import("eslint").Scope.Variable | null}
 */
function findVariable(scope, name) {
  let current = scope;
  while (current) {
    const variable = current.set.get(name);
    if (variable) return variable;
    current = current.upper;
  }
  return null;
}

/**
 * @param {object} node a JSXIdentifier, JSXMemberExpression, or JSXNamespacedName
 * @returns {string[] | null} the dotted name split into segments
 */
function jsxNameSegments(node) {
  if (!node) return null;
  if (node.type === "JSXIdentifier") return [node.name];
  if (node.type === "JSXMemberExpression") {
    const object = jsxNameSegments(node.object);
    if (!object) return null;
    return object.concat(node.property.name);
  }
  return null;
}

/**
 * @param {import("eslint").Scope.Variable | null} variable
 * @returns {{source: string, importedName: string, kind: string} | null}
 */
function importInfo(variable) {
  if (!variable) return null;
  for (const def of variable.defs) {
    if (def.type !== "ImportBinding") continue;
    const declaration = def.parent;
    if (!declaration || declaration.type !== "ImportDeclaration") continue;
    const source = declaration.source && declaration.source.value;
    if (typeof source !== "string") continue;
    const specifier = def.node;
    if (specifier.type === "ImportSpecifier") {
      const imported = specifier.imported;
      const importedName =
        imported && imported.type === "Identifier" ? imported.name : imported && imported.value;
      return { source, importedName: importedName || specifier.local.name, kind: "named" };
    }
    if (specifier.type === "ImportDefaultSpecifier") {
      return { source, importedName: specifier.local.name, kind: "default" };
    }
    if (specifier.type === "ImportNamespaceSpecifier") {
      return { source, importedName: specifier.local.name, kind: "namespace" };
    }
  }
  return null;
}

/**
 * @param {object} openingElement a JSXOpeningElement
 * @param {import("eslint").Rule.RuleContext} context
 * @param {{componentImports: RegExp[]}} settings
 * @returns {{name: string, root: string, source: string} | null}
 */
function designSystemComponent(openingElement, context, settings) {
  const segments = jsxNameSegments(openingElement.name);
  if (!segments || segments.length === 0) return null;
  // Lowercase single-segment names are host elements (`<div>`), never ours.
  if (segments.length === 1 && !/^[A-Z]/.test(segments[0])) return null;

  const sourceCode = context.sourceCode || context.getSourceCode();
  const scope = sourceCode.getScope(openingElement);
  const info = importInfo(findVariable(scope, segments[0]));
  if (!info) return null;
  if (!settings.componentImports.some((pattern) => pattern.test(info.source))) return null;

  const resolved =
    info.kind === "namespace"
      ? segments.slice(1)
      : [info.importedName].concat(segments.slice(1));
  if (resolved.length === 0) return null;

  return { name: resolved.join("."), root: resolved[0], source: info.source };
}

module.exports = {
  findVariable,
  importInfo,
  jsxNameSegments,
  designSystemComponent,
};
