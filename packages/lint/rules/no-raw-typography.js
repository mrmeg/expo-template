/**
 * @fileoverview Type comes off `StyledText`'s scale. A `fontSize: 13` in a
 * style is a size no other screen shares, a `lineHeight` written by hand
 * drifts from the size it was tuned for, and a `fontFamily` literal pins a face
 * the theme's `setFonts` can no longer replace. In a style, each of the three
 * has to become a `StyledText` prop — `size`, a `semantic` variant, `variant`
 * and `fontWeight` — or a `useFontStyle` result, which carry the scale.
 *
 * Only styles are policed (see `lib/stylePositions.js`): a `fontSize` in a
 * chart config or a PDF layout is not typography.
 */

const { nearestTokens } = require("../lib/nearest");
const { readSettings } = require("../lib/settings");
const {
  DESIGN_SYSTEM_MISSING_MESSAGES,
  loadDesignSystemFor,
  reportMissingDesignSystem,
} = require("../lib/source");
const { styleObjectVisitors } = require("../lib/stylePositions");
const { staticPropertyName } = require("../lib/styles");

const SIZE_GUIDANCE =
  "Use `size` or a `semantic` variant on `StyledText` instead of `fontSize` in a style.";
const LINE_HEIGHT_GUIDANCE =
  "Use `size` on `StyledText` instead of `lineHeight` in a style; every size carries its line height.";
const FAMILY_TAIL = "A brand face goes through `setFonts`, never a literal.";

/**
 * @param {object} node
 * @returns {number | null} the literal number, negatives included
 */
function numericValue(node) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "number") return node.value;
  if (
    node.type === "UnaryExpression" &&
    node.operator === "-" &&
    node.argument &&
    node.argument.type === "Literal" &&
    typeof node.argument.value === "number"
  ) {
    return -node.argument.value;
  }
  return null;
}

/**
 * @param {object} node
 * @returns {string | null} a string literal or an expression-free template literal
 */
function stringValue(node) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0 && node.quasis.length === 1) {
    return node.quasis[0].value.cooked;
  }
  return null;
}

/**
 * @param {import("../lib/source").TokenGroup} typography
 * @returns {import("../lib/source").TokenGroup} the same sizes keyed by line
 *   height, so `nearestTokens` can bracket a raw `lineHeight`
 */
function lineHeightGroup(typography) {
  /** @type {Map<number, string>} */
  const nameByValue = new Map();
  /** @type {{name: string, value: number}[]} */
  const entries = [];
  for (const entry of typography.entries) {
    if (typeof entry.lineHeight !== "number") continue;
    entries.push({ name: entry.name, value: entry.lineHeight });
    if (!nameByValue.has(entry.lineHeight)) nameByValue.set(entry.lineHeight, entry.name);
  }
  return { entries, nameByValue, values: [...nameByValue.keys()].sort((a, b) => a - b) };
}

/**
 * @param {{name: string, value: number}[]} tokens
 * @returns {string} "`sm` (12), `base` (14)"
 */
function listSizes(tokens) {
  return tokens.map((token) => `\`${token.name}\` (${token.value})`).join(", ");
}

/**
 * @param {import("../lib/source").TokenGroup} typography
 * @param {string} name a size
 * @returns {string} "14/21", or "14" when the line height is unknown
 */
function sizeNumbers(typography, name) {
  const entry = typography.entries.find((candidate) => candidate.name === name);
  if (!entry) return "";
  return typeof entry.lineHeight === "number" ? `${entry.value}/${entry.lineHeight}` : `${entry.value}`;
}

/**
 * The family a stack leads with, normalised for comparison: `"Inter",
 * system-ui, …` and `Inter` are the same face.
 *
 * @param {string} family
 * @returns {string}
 */
function leadFamily(family) {
  return family.split(",")[0].trim().replace(/^["']|["']$/g, "").toLowerCase();
}

/**
 * @param {string} literal the raw `fontFamily`
 * @param {import("../lib/source").FontFamilies} families
 * @param {string[] | null} fontVariants
 * @returns {string} the guidance after "is a raw font family."
 */
function familyGuidance(literal, families, fontVariants) {
  const wanted = leadFamily(literal);
  /** @type {Map<string, string[]>} variant to the weights whose slot holds this face */
  const matches = new Map();
  for (const variant of Object.keys(families)) {
    const weights = families[variant];
    for (const weight of Object.keys(weights)) {
      if (!weights[weight].some((family) => leadFamily(family) === wanted)) continue;
      const list = matches.get(variant) || [];
      list.push(weight);
      matches.set(variant, list);
    }
  }

  const found = [...matches.entries()][0];
  if (!found) {
    const variants = fontVariants && fontVariants.length > 0 ? ` (${fontVariants.join(" | ")})` : "";
    return `Use \`StyledText variant\`${variants} or \`useFontStyle(weight, variant)\`. ${FAMILY_TAIL}`;
  }

  const [variant, weights] = found;
  if (weights.length === Object.keys(families[variant]).length) {
    return (
      `It is the kit's \`${variant}\` face: use \`StyledText variant="${variant}"\` (weight through ` +
      `\`fontWeight\`) or \`useFontStyle(weight, "${variant}")\`. ${FAMILY_TAIL}`
    );
  }
  // `Inter_400Regular` serves `light` and `regular`; the heavier slot is the one
  // a reader means, so it is the example.
  const weight = weights[weights.length - 1];
  const at = weights.map((name) => `\`${name}\``).join(" or ");
  return (
    `It is the kit's \`${variant}\` face at ${at}: use \`StyledText variant="${variant}" ` +
    `fontWeight="${weight}"\` or \`useFontStyle("${weight}", "${variant}")\`. ${FAMILY_TAIL}`
  );
}

/**
 * The facts loaded, but without the typography group: a manifest written
 * before schemaVersion 2, or a `StyledText.tsx` whose size map moved. Raw
 * values are still flagged; the size to use cannot be named, and this says why.
 *
 * @param {import("../lib/settings").Settings} settings
 * @param {import("../lib/source").DesignSystem} design
 * @returns {string}
 */
function typographyMissingMessage(settings, design) {
  const origin = design.origin || (settings && settings.origin) || null;
  if (origin && origin.kind === "manifest") {
    return (
      `Design-system typography facts are missing: the manifest at \`${origin.path}\` predates ` +
      "`no-raw-typography` (schemaVersion 1, no `tokens.typography`). Install an @mrmeg/expo-ui " +
      'release that ships them, or set `settings["expo-ui"].uiSourceDir` to the sources.'
    );
  }
  return (
    `Design-system typography facts are missing: \`${settings.uiSourceLabel}/components/StyledText.tsx\` ` +
    "has no readable `FONT_SIZES` / `LINE_HEIGHTS`. Raw values are still flagged; the size to use cannot be named."
  );
}

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Use StyledText's size, semantic, variant, and fontWeight props (or useFontStyle) instead of fontSize, lineHeight, and fontFamily literals in styles.",
    },
    schema: [],
    messages: {
      rawFontSize: "{{value}} is a raw font size. {{guidance}}",
      rawLineHeight: "{{value}} is a raw line height. {{guidance}}",
      rawFontFamily: "{{value}} is a raw font family. {{guidance}}",
      typographyFactsMissing: "{{message}}",
      ...DESIGN_SYSTEM_MISSING_MESSAGES,
    },
  },

  create(context) {
    const settings = readSettings(context);
    const design = loadDesignSystemFor(settings);
    const sourceCode = context.sourceCode || context.getSourceCode();

    const typography = design.tokens.typography || { entries: [], values: [], nameByValue: new Map() };
    const hasSizes = typography.values.length > 0;
    const lineHeights = lineHeightGroup(typography);

    /** @param {object} property a Property of an object used as a style */
    const checkProperty = (property) => {
      const key = staticPropertyName(property);
      if (key !== "fontSize" && key !== "lineHeight" && key !== "fontFamily") return;
      const valueNode = property.value;
      if (!valueNode) return;
      const value = `\`${sourceCode.getText(valueNode)}\``;

      if (key === "fontFamily") {
        const family = stringValue(valueNode);
        if (family === null || family === "") return;
        context.report({
          node: valueNode,
          messageId: "rawFontFamily",
          data: { value, guidance: familyGuidance(family, design.fonts.families, design.fontVariants) },
        });
        return;
      }

      const number = numericValue(valueNode);
      if (number === null || number === 0) return;

      if (key === "fontSize") {
        let guidance = SIZE_GUIDANCE;
        if (hasSizes) {
          const exact = typography.nameByValue.get(Math.abs(number));
          guidance = exact
            ? `\`StyledText size="${exact}"\` renders it (${sizeNumbers(typography, exact)}). ${SIZE_GUIDANCE}`
            : `Nearest \`StyledText\` sizes: ${listSizes(nearestTokens(number, typography))}. ${SIZE_GUIDANCE}`;
        }
        context.report({ node: valueNode, messageId: "rawFontSize", data: { value, guidance } });
        return;
      }

      let guidance = LINE_HEIGHT_GUIDANCE;
      if (lineHeights.values.length > 0) {
        const exact = lineHeights.nameByValue.get(Math.abs(number));
        guidance = exact
          ? `\`StyledText size="${exact}"\` sets it (${sizeNumbers(typography, exact)}). ${LINE_HEIGHT_GUIDANCE}`
          : `Nearest \`StyledText\` sizes by line height: ${listSizes(nearestTokens(number, lineHeights))}. ${LINE_HEIGHT_GUIDANCE}`;
      }
      context.report({ node: valueNode, messageId: "rawLineHeight", data: { value, guidance } });
    };

    const missing = reportMissingDesignSystem(context, design, settings);

    return {
      ...styleObjectVisitors(context, (styleObject) => {
        styleObject.properties.forEach(checkProperty);
      }),

      Program(node) {
        missing(node);
        if (!design.loaded || hasSizes) return;
        context.report({
          node,
          messageId: "typographyFactsMissing",
          data: { message: typographyMissingMessage(settings, design) },
        });
      },
    };
  },
};
