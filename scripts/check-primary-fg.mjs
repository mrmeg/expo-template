#!/usr/bin/env node
/**
 * Theme contrast lint guard.
 *
 * Fails when a JSX element with `backgroundColor: theme.colors.primary` (or
 * `theme.colors.foreground`) — applied directly OR via a referenced
 * `styles.X` entry — has a descendant element whose `color` prop is hard-
 * coded to white/black or `palette.white`/`palette.black`.
 *
 * Why: in dark mode, `theme.colors.primary` resolves to near-white, so a
 * hard-coded white icon on a primary background disappears. The correct
 * pair is `theme.colors.primaryForeground`. Same logic for `foreground` ↔
 * `background`. See `Agent/Specs/fix-dark-mode-icon-on-primary-bg.md`.
 *
 * What does NOT fail (intentional):
 *   - `withAlpha(theme.colors.primary, 0.1)`         translucent tint
 *   - `theme.colors.primary + "20"`                  string-concat alpha
 *   - `backgroundColor: "black"` + `color="white"`   intentional dark modal
 *
 * Usage: `bun run lint:theme`. Exits 0 on clean, 1 on any hit.
 */

import { parse } from "@typescript-eslint/parser";
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { glob } from "node:fs/promises";

const ROOT = resolve(import.meta.dirname, "..");

// Globs to scan. `client/**` lives under app surface; `packages/ui/src/components/**` is
// reusable primitives that must follow the rule too.
const SCAN_GLOBS = [
  "app/**/*.{ts,tsx}",
  "client/**/*.{ts,tsx}",
  "packages/ui/src/components/**/*.{ts,tsx}",
];

// Bg tokens that invert across schemes. Hardcoded white/black foregrounds
// over these surfaces fail in one of the two schemes.
const SUSPECT_BG_TOKENS = new Set(["primary", "foreground"]);

// Foreground colors that are flagged when paired with a suspect bg.
const SUSPECT_HEX = new Set([
  "white", "#fff", "#ffffff",
  "black", "#000", "#000000",
]);

const SUSPECT_PALETTE = new Set(["white", "black"]);

/**
 * @param {import("@typescript-eslint/types").TSESTree.Node} node
 * @returns {boolean}
 */
function isThemeColorsMember(node, tokenSet) {
  // theme.colors.primary
  return (
    node.type === "MemberExpression" &&
    node.property?.type === "Identifier" &&
    tokenSet.has(node.property.name) &&
    node.object?.type === "MemberExpression" &&
    node.object.property?.type === "Identifier" &&
    node.object.property.name === "colors" &&
    node.object.object?.type === "Identifier" &&
    node.object.object.name === "theme"
  );
}

function isHardcodedSuspectColor(valueNode) {
  if (!valueNode) return null;
  // Literal "white" / "#fff"
  if (valueNode.type === "Literal" && typeof valueNode.value === "string") {
    if (SUSPECT_HEX.has(valueNode.value.toLowerCase())) return JSON.stringify(valueNode.value);
  }
  // palette.white / palette.black
  if (
    valueNode.type === "MemberExpression" &&
    valueNode.object?.type === "Identifier" &&
    valueNode.object.name === "palette" &&
    valueNode.property?.type === "Identifier" &&
    SUSPECT_PALETTE.has(valueNode.property.name)
  ) {
    return `palette.${valueNode.property.name}`;
  }
  return null;
}

/**
 * Returns the suspect bg token name if the property's value is a bare
 * `theme.colors.primary` / `theme.colors.foreground`. Returns null when the
 * value is wrapped in `withAlpha(...)`, a string concat, or anything else.
 */
function suspectBgTokenFromValue(valueNode) {
  if (!valueNode) return null;
  if (valueNode.type === "MemberExpression" && isThemeColorsMember(valueNode, SUSPECT_BG_TOKENS)) {
    return valueNode.property.name;
  }
  return null;
}

/**
 * Walk an object literal looking for `backgroundColor: theme.colors.primary|foreground`.
 * Returns the matching token name or null.
 */
function findSuspectBgInObject(objectNode) {
  if (!objectNode || objectNode.type !== "ObjectExpression") return null;
  for (const prop of objectNode.properties) {
    if (prop.type !== "Property") continue;
    const keyName = prop.key?.type === "Identifier" ? prop.key.name : null;
    if (keyName !== "backgroundColor") continue;
    const token = suspectBgTokenFromValue(prop.value);
    if (token) return token;
  }
  return null;
}

/**
 * Collect the names of style entries whose backgroundColor is a suspect bg.
 * Looks at top-level VariableDeclarations like:
 *   const styles = StyleSheet.create({ playButton: { backgroundColor: theme.colors.primary } });
 * and factory return values:
 *   const createStyles = (theme) => StyleSheet.create({ ... });
 *   function createStyles(theme) { return StyleSheet.create({ ... }); }
 */
function collectSuspectStyleKeys(ast) {
  const suspectKeys = new Map(); // styleKey -> token

  function visitObjectAsStylesheet(stylesObj) {
    if (!stylesObj || stylesObj.type !== "ObjectExpression") return;
    for (const prop of stylesObj.properties) {
      if (prop.type !== "Property") continue;
      const keyName = prop.key?.type === "Identifier" ? prop.key.name : null;
      if (!keyName) continue;
      const token = findSuspectBgInObject(prop.value);
      if (token) suspectKeys.set(keyName, token);
    }
  }

  function visitNode(node) {
    if (!node || typeof node !== "object") return;
    // StyleSheet.create({ ... })
    if (
      node.type === "CallExpression" &&
      node.callee?.type === "MemberExpression" &&
      node.callee.object?.type === "Identifier" &&
      node.callee.object.name === "StyleSheet" &&
      node.callee.property?.type === "Identifier" &&
      node.callee.property.name === "create" &&
      node.arguments[0]?.type === "ObjectExpression"
    ) {
      visitObjectAsStylesheet(node.arguments[0]);
    }
    for (const key in node) {
      if (key === "parent" || key === "loc" || key === "range") continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(visitNode);
      else if (child && typeof child === "object" && child.type) visitNode(child);
    }
  }

  visitNode(ast);
  return suspectKeys;
}

/**
 * Walk the JSX tree of an opening element / fragment and collect any
 * `color=...` props with hardcoded suspect colors.
 */
function findSuspectChildColors(jsxElement) {
  const hits = [];
  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "JSXOpeningElement" && Array.isArray(node.attributes)) {
      for (const attr of node.attributes) {
        if (attr.type !== "JSXAttribute") continue;
        const name = attr.name?.name;
        if (name !== "color") continue;
        let valueNode = null;
        if (attr.value?.type === "Literal") valueNode = attr.value;
        else if (attr.value?.type === "JSXExpressionContainer") valueNode = attr.value.expression;
        const detected = isHardcodedSuspectColor(valueNode);
        if (detected) hits.push({ line: attr.loc.start.line, value: detected });
      }
    }
    for (const key in node) {
      if (key === "parent" || key === "loc" || key === "range") continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(walk);
      else if (child && typeof child === "object" && child.type) walk(child);
    }
  }
  walk(jsxElement);
  return hits;
}

/**
 * Resolve the `style` JSX attribute's expression to a list of (a) inline
 * object expressions and (b) `styles.X` member references. Used to determine
 * whether the JSX element's bg is a suspect token directly OR via a known
 * suspect style key.
 */
function gatherStyleSources(styleExpression) {
  const inlineObjects = [];
  const styleKeyRefs = [];
  if (!styleExpression) return { inlineObjects, styleKeyRefs };

  function consume(expr) {
    if (!expr) return;
    if (expr.type === "ObjectExpression") {
      inlineObjects.push(expr);
      return;
    }
    if (
      expr.type === "MemberExpression" &&
      expr.object?.type === "Identifier" &&
      expr.object.name === "styles" &&
      expr.property?.type === "Identifier"
    ) {
      styleKeyRefs.push(expr.property.name);
      return;
    }
    if (expr.type === "ArrayExpression") {
      expr.elements.forEach(consume);
      return;
    }
    // CallExpression like getShadowStyle("soft") — ignore. Conditional
    // expressions and spreads are also treated as opaque.
  }
  consume(styleExpression);
  return { inlineObjects, styleKeyRefs };
}

function checkFile(filePath) {
  const code = readFileSync(filePath, "utf8");
  let ast;
  try {
    ast = parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
      jsx: true,
      loc: true,
      range: true,
    });
  } catch (err) {
    return [{ line: 1, message: `parse error: ${err.message}` }];
  }

  const suspectStyleKeys = collectSuspectStyleKeys(ast);
  const violations = [];

  function visitJSX(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "JSXElement") {
      const opening = node.openingElement;
      const styleAttr = opening?.attributes?.find(
        (a) => a.type === "JSXAttribute" && a.name?.name === "style"
      );
      if (styleAttr?.value?.type === "JSXExpressionContainer") {
        const { inlineObjects, styleKeyRefs } = gatherStyleSources(
          styleAttr.value.expression
        );
        let suspectToken = null;
        for (const obj of inlineObjects) {
          const t = findSuspectBgInObject(obj);
          if (t) suspectToken = t;
        }
        for (const refName of styleKeyRefs) {
          const t = suspectStyleKeys.get(refName);
          if (t) suspectToken = t;
        }
        if (suspectToken) {
          const childHits = findSuspectChildColors(node);
          for (const hit of childHits) {
            violations.push({
              line: hit.line,
              message: `descendant color=${hit.value} on theme.colors.${suspectToken} background — use theme.colors.${suspectToken}Foreground`,
            });
          }
        }
      }
    }
    for (const key in node) {
      if (key === "parent" || key === "loc" || key === "range") continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(visitJSX);
      else if (child && typeof child === "object" && child.type) visitJSX(child);
    }
  }

  visitJSX(ast);
  return violations;
}

async function main() {
  const files = [];
  for (const pattern of SCAN_GLOBS) {
    for await (const entry of glob(pattern, { cwd: ROOT })) {
      if (entry.includes("__tests__")) continue;
      if (entry.endsWith(".d.ts")) continue;
      files.push(join(ROOT, entry));
    }
  }

  let total = 0;
  for (const filePath of files) {
    const violations = checkFile(filePath);
    if (violations.length === 0) continue;
    const rel = relative(ROOT, filePath);
    for (const v of violations) {
      console.error(`${rel}:${v.line}: ${v.message}`);
      total++;
    }
  }

  if (total > 0) {
    console.error(`\nlint:theme found ${total} hardcoded foreground color(s) on inverting backgrounds.`);
    console.error("See Agent/Docs/EXPO_UI_PACKAGE.md (Token Pairing Rule) when added.");
    process.exit(1);
  } else {
    console.log("lint:theme: 0 issues");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
