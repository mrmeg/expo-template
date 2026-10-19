/**
 * @fileoverview `Icon` draws glyph data the app registers, and no icon library is
 * a peer of the design system. This rule keeps the libraries out: it reports every
 * import of Lucide's React packages and of the vector-icon fonts, and names the
 * replacement — `<Icon name="<canonical>" />` plus the command that registers
 * the name.
 *
 * It also holds the one autofix in the plugin. Lucide renamed icons over time
 * (`home` is now `house`), and `Icon` registers canonical names only, so an old
 * (alias) name in a `name="…"` / `icon="…"` attribute on a design-system
 * component is rewritten to the canonical one. Imports are never autofixed: that
 * would need call-site rewrites.
 *
 * The banned list is this rule's own. A published plugin cannot import
 * `scripts/`, and `scripts/check-ui-forbidden-imports.mjs` guards a different
 * thing (the UI package's own sources, and it also bans the reanimated family).
 *
 * Type-only imports are reported too, unlike `no-raw-primitives`: the goal is to
 * drop the package from `package.json`, and a type import still needs it. That
 * covers the TypeScript-only module forms: `import X = require("…")` and the
 * `import("…")` type (`typeof import("lucide-react-native").Home`). Neither has
 * specifiers to read, so a banned package is one report on the module string.
 */

const { designSystemComponent } = require("../lib/components");
const { readSettings } = require("../lib/settings");
const {
  DESIGN_SYSTEM_MISSING_MESSAGES,
  loadDesignSystemFor,
  reportMissingDesignSystem,
} = require("../lib/source");

const COMPONENTS_ENTRY = '"@mrmeg/expo-ui/components"';
const ICON_ENTRY = '"@mrmeg/expo-ui/components/Icon"';

/** Lucide's React packages; each also bans every subpath. */
const LUCIDE_PACKAGES = ["lucide-react-native", "lucide-react"];

/** The vector-icon fonts; each also bans every subpath. */
const FONT_PACKAGES = ["@expo/vector-icons", "react-native-vector-icons"];

/** Scope of the split vector-icon packages (`@react-native-vector-icons/ionicons`). */
const FONT_SCOPE = "@react-native-vector-icons/";

/**
 * Uppercase exports of Lucide's packages that are not icon components (types
 * included: `lucide-react` / `lucide-react-native` 1.59 export `IconNode`,
 * `LucideIcon`, `LucideIconData`, `LucideIconNode`, `LucideProps`, and
 * `lucide-react` adds `SVGAttributes`; `lucide-react/dynamic` exports
 * `DynamicIcon`, `DynamicIconModule`, and `IconName`). A lowercase export
 * (`icons`, `createLucideIcon`) is excluded by its case.
 */
const NON_ICON_EXPORTS = new Set([
  "Icon",
  "LucideIcon",
  "LucideProps",
  "LucideIconNode",
  "LucideIconData",
  "IconNode",
  "LucideProvider",
  "DynamicIcon",
  "DynamicIconModule",
  "IconName",
  "SVGAttributes",
]);

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * @param {string} source
 * @param {string} name a package name
 * @returns {boolean} true for the package itself or any subpath of it, so
 *   `lucide-react` does not catch `lucide-react-native` or `lucide-static`
 */
function isPackageOrSubpath(source, name) {
  return source === name || source.startsWith(`${name}/`);
}

/**
 * @param {string} source an import source as written
 * @returns {"lucide" | "font" | null}
 */
function classifySource(source) {
  if (LUCIDE_PACKAGES.some((name) => isPackageOrSubpath(source, name))) return "lucide";
  if (FONT_PACKAGES.some((name) => isPackageOrSubpath(source, name))) return "font";
  if (source.startsWith(FONT_SCOPE)) return "font";
  return null;
}

/**
 * @param {Record<string, string>} aliases
 * @param {string} key
 * @returns {boolean} an own entry only: `constructor` is not an alias
 */
function hasAlias(aliases, key) {
  return Object.prototype.hasOwnProperty.call(aliases, key);
}

/**
 * Lucide's component name to its kebab-case name: drop a `Lucide` prefix and an
 * `Icon` suffix, then split on capitals and on a letter-to-digit boundary
 * (`Grid2x2` is `grid-2x2`, `CalendarX2` is `calendar-x-2`).
 *
 * @param {string} componentName
 * @returns {string}
 */
function kebabFromComponent(componentName) {
  return componentName
    .replace(/^Lucide(?=[A-Z0-9])/, "")
    .replace(/(?<=.)Icon$/, "")
    .replace(/(?<!^)([A-Z])/g, "-$1")
    .replace(/(?<![0-9])([a-zA-Z])([0-9])/g, "$1-$2")
    .toLowerCase();
}

/**
 * @param {string} kebab
 * @param {Record<string, string>} aliases
 * @returns {{kebab: string, canonical: string, isAlias: boolean}} with no alias
 *   table the kebab name is taken as canonical
 */
function resolveName(kebab, aliases) {
  const isAlias = hasAlias(aliases, kebab);
  return { kebab, canonical: isAlias ? aliases[kebab] : kebab, isAlias };
}

/**
 * @param {object} specifier
 * @returns {string | null} the imported (not local) name of a named specifier
 */
function importedName(specifier) {
  if (!specifier || specifier.type !== "ImportSpecifier") return null;
  const imported = specifier.imported;
  if (!imported) return null;
  if (imported.type === "Identifier") return imported.name;
  if (imported.type === "Literal" && typeof imported.value === "string") return imported.value;
  return null;
}

/**
 * @param {string} name an imported name
 * @returns {boolean} true for an uppercase export that is not a Lucide helper
 */
function isIconComponentName(name) {
  return /^[A-Z]/.test(name) && !NON_ICON_EXPORTS.has(name);
}

/**
 * `lucide-react-native/icons/home`: a file per icon, named by its kebab-case
 * name, under an `icons` directory.
 *
 * @param {string} source
 * @returns {string | null} the kebab-case name, or null when the source is not
 *   one icon's file
 */
function iconSubpathName(source) {
  const segments = source.split("/");
  if (segments.length < 3 || segments[segments.length - 2] !== "icons") return null;
  const name = segments[segments.length - 1].replace(/\.(?:js|mjs)$/, "");
  return KEBAB_CASE.test(name) && name !== "index" ? name : null;
}

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description:
        "Draw icons with `Icon` and registered Lucide names: no Lucide or vector-icon imports, and Lucide's old (alias) names rewritten to their canonical names.",
    },
    schema: [],
    messages: {
      iconComponent: "{{message}}",
      iconLibrary: "{{message}}",
      iconFont: "{{message}}",
      aliasName: "{{message}}",
      ...DESIGN_SYSTEM_MISSING_MESSAGES,
    },
  },

  create(context) {
    const settings = readSettings(context);
    const design = loadDesignSystemFor(settings);
    const aliases = design.icons.aliases;
    const hasAliases = Object.keys(aliases).length > 0;
    const sourceCode = context.sourceCode;

    /**
     * The clause that tells the reader how to register icon name `name`. The
     * `expo-ui-icons` bin first ships in expo-ui 0.29.0, so a bare `bunx` against
     * an older release, or with nothing installed, would resolve an unvetted npm
     * package; the template's own sources have the root script instead.
     *
     * @param {string} name
     * @returns {string}
     */
    const register = (name) => {
      if (design.icons.lucide == null) {
        return `upgrade \`@mrmeg/expo-ui\` to 0.29.0 or later, then run \`bunx expo-ui-icons add ${name}\``;
      }
      if (settings.origin && settings.origin.kind === "source") {
        return `run \`bun run icons add ${name}\``;
      }
      return `run \`bunx expo-ui-icons add ${name}\``;
    };

    /**
     * @param {object} node
     * @param {string} messageId
     * @param {string} message
     */
    const report = (node, messageId, message) => {
      context.report({ node, messageId, data: { message } });
    };

    /**
     * @param {object} node the specifier, or the source for a subpath import
     * @param {string} name the imported name, or the subpath segment
     * @param {string} source the import source as written
     * @param {string} kebab
     */
    const reportIconComponent = (node, name, source, kebab) => {
      const resolved = resolveName(kebab, aliases);
      const aliasNote = resolved.isAlias
        ? ` (\`${resolved.kebab}\` is Lucide's old name for \`${resolved.canonical}\`)`
        : "";
      report(
        node,
        "iconComponent",
        `\`${name}\` from \`"${source}"\` is an icon-library component. ` +
          `Use \`<Icon name="${resolved.canonical}" />\` from \`${COMPONENTS_ENTRY}\`${aliasNote}; ` +
          `if \`${resolved.canonical}\` is not registered yet, ${register(resolved.canonical)}.`,
      );
    };

    /**
     * @param {object} node
     * @param {string} source
     */
    const reportIconLibrary = (node, source) => {
      report(
        node,
        "iconLibrary",
        `\`"${source}"\` is an icon library; \`Icon\` from \`${COMPONENTS_ENTRY}\` draws Lucide glyphs without one. ` +
          `Use \`<Icon name="…" />\` with a kebab-case Lucide name (to register one, ${register("<name>")}), ` +
          `type icon props with \`IconName\` or \`IconComponent\` from \`${ICON_ENTRY}\`, ` +
          "and pass `component` for art that is not a Lucide icon.",
      );
    };

    /**
     * @param {object} node
     * @param {string} source
     */
    const reportIconFont = (node, source) => {
      report(
        node,
        "iconFont",
        `\`"${source}"\` is an icon font outside the design system. ` +
          `Use \`<Icon name="…" />\` from \`${COMPONENTS_ENTRY}\` with a kebab-case Lucide name (to register one, ${register("<name>")}), ` +
          "list native tab bar glyphs under `tabIcons` in `client/icons.json`, " +
          "and pass `component` for art that is not a Lucide icon.",
      );
    };

    /**
     * A source that is not an `ImportDeclaration`'s: a re-export, `import()`,
     * `require()`, `import X = require()`, or an `import()` type. No specifiers
     * to read, so a banned package is one report.
     *
     * @param {object | null | undefined} literal the string literal naming the module
     */
    const checkModuleLiteral = (literal) => {
      if (!literal || literal.type !== "Literal" || typeof literal.value !== "string") return;
      const kind = classifySource(literal.value);
      if (kind === "lucide") reportIconLibrary(literal, literal.value);
      else if (kind === "font") reportIconFont(literal, literal.value);
    };

    /**
     * Reports each alias name among the strings an attribute value can be, and
     * fixes it in place, keeping the quote it was written with.
     *
     * @param {object | null} node
     * @param {string} prop `name` or `icon`
     */
    const checkAliasValue = (node, prop) => {
      if (!node) return;
      switch (node.type) {
        case "Literal":
          if (typeof node.value === "string") {
            const quote = sourceCode.getText(node).charAt(0);
            checkAliasString(node, node.value, prop, quote);
          }
          return;
        case "TemplateLiteral":
          if (node.expressions.length === 0 && node.quasis.length === 1) {
            const cooked = node.quasis[0].value.cooked;
            if (typeof cooked === "string") checkAliasString(node, cooked, prop, "`");
          }
          return;
        case "JSXExpressionContainer":
          checkAliasValue(node.expression, prop);
          return;
        case "ConditionalExpression":
          checkAliasValue(node.consequent, prop);
          checkAliasValue(node.alternate, prop);
          return;
        case "LogicalExpression":
          checkAliasValue(node.left, prop);
          checkAliasValue(node.right, prop);
          return;
        default:
      }
    };

    /**
     * @param {object} node the literal to replace
     * @param {string} value the string it holds
     * @param {string} prop
     * @param {string} quote
     */
    const checkAliasString = (node, value, prop, quote) => {
      if (!hasAlias(aliases, value)) return;
      const canonical = aliases[value];
      context.report({
        node,
        messageId: "aliasName",
        data: {
          message:
            `\`"${value}"\` is Lucide's old name for \`"${canonical}"\`, and \`Icon\` registers canonical names only. ` +
            `Use \`${prop}="${canonical}"\`; if it is not registered yet, ${register(canonical)}.`,
        },
        fix: (fixer) => fixer.replaceText(node, `${quote}${canonical}${quote}`),
      });
    };

    return {
      // The import ban runs without a design system too: it needs no facts, only
      // the alias table to name a canonical icon, and falls back to the kebab name.
      Program: reportMissingDesignSystem(context, design, settings),

      ImportDeclaration(node) {
        const source = node.source && node.source.value;
        if (typeof source !== "string") return;
        const kind = classifySource(source);
        if (!kind) return;

        if (kind === "font") {
          reportIconFont(node.source, source);
          return;
        }

        // One icon's file: the name is the segment, not a specifier.
        const segment = iconSubpathName(source);
        if (segment) {
          reportIconComponent(node.source, segment, source, segment);
          return;
        }

        let iconSpecifiers = 0;
        let otherSpecifiers = 0;
        for (const specifier of node.specifiers) {
          const name = importedName(specifier);
          if (name && isIconComponentName(name)) {
            iconSpecifiers += 1;
            reportIconComponent(specifier, name, source, kebabFromComponent(name));
          } else {
            // Default, namespace, lowercase (`icons`, `createLucideIcon`), or a
            // Lucide helper such as `LucideIcon`.
            otherSpecifiers += 1;
          }
        }
        if (iconSpecifiers === 0 || otherSpecifiers > 0) reportIconLibrary(node.source, source);
      },

      ExportNamedDeclaration(node) {
        checkModuleLiteral(node.source);
      },

      ExportAllDeclaration(node) {
        checkModuleLiteral(node.source);
      },

      ImportExpression(node) {
        checkModuleLiteral(node.source);
      },

      // `import Lucide = require("lucide-react-native");` — TypeScript-only.
      TSImportEqualsDeclaration(node) {
        const reference = node.moduleReference;
        if (!reference || reference.type !== "TSExternalModuleReference") return;
        checkModuleLiteral(reference.expression);
      },

      // `typeof import("lucide-react-native").Home` — the parser puts the module
      // in `source` (typescript-eslint 8.5x and later); older ones in
      // `argument`, a `TSLiteralType` wrapping the string `Literal`.
      TSImportType(node) {
        // `argument` warns on read in newer parsers, so it is read only as a fallback.
        if (node.source) {
          checkModuleLiteral(node.source);
          return;
        }
        const argument = node.argument;
        checkModuleLiteral(argument && argument.type === "TSLiteralType" ? argument.literal : argument);
      },

      CallExpression(node) {
        if (node.callee.type !== "Identifier" || node.callee.name !== "require") return;
        checkModuleLiteral(node.arguments[0]);
      },

      JSXAttribute(node) {
        if (!hasAliases) return;
        if (node.name.type !== "JSXIdentifier") return;
        const prop = node.name.name;
        if (prop !== "name" && prop !== "icon") return;

        const component = designSystemComponent(node.parent, context, settings);
        if (!component) return;
        // `name` is an icon name only on the Icon family (`Icon`, `Button.Icon`,
        // `ToggleIcon`, `ToggleGroupIcon`); `icon` is one on any component.
        if (prop === "name" && !/Icon$/.test(component.name)) return;

        checkAliasValue(node.value, prop);
      },
    };
  },
};
