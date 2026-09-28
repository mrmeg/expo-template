/**
 * @fileoverview Spacing and radii come off a scale. A one-off `13` reads as
 * deliberate to no one and drifts the rhythm of every screen it lands on, so a
 * numeric literal in a spacing or radius property has to name a token.
 *
 * Only styles are policed: `padding` in a chart config or any other object the
 * file never uses as a style is not spacing (see `lib/stylePositions.js`).
 */

const { RADIUS_SCALE_KEYS, SPACING_SCALE_KEYS } = require("../lib/categories");
const { nearestTokens } = require("../lib/nearest");
const { readSettings } = require("../lib/settings");
const {
  DESIGN_SYSTEM_MISSING_MESSAGES,
  loadDesignSystemFor,
  reportMissingDesignSystem,
} = require("../lib/source");
const { styleObjectVisitors } = require("../lib/stylePositions");
const { staticPropertyName } = require("../lib/styles");

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

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Use spacing and radius tokens instead of arbitrary numeric literals in padding, margin, gap, and border-radius properties.",
    },
    schema: [],
    messages: {
      offScale: "{{value}} is not a {{scale}} token. {{guidance}}",
      ...DESIGN_SYSTEM_MISSING_MESSAGES,
    },
  },

  create(context) {
    const settings = readSettings(context);
    const design = loadDesignSystemFor(settings);
    const sourceCode = context.sourceCode || context.getSourceCode();

    /** @param {object} property a Property of an object used as a style */
    const checkProperty = (property) => {
      const key = staticPropertyName(property);
      if (!key) return;

      const scale = SPACING_SCALE_KEYS.has(key)
        ? "spacing"
        : RADIUS_SCALE_KEYS.has(key)
          ? "radius"
          : null;
      if (!scale) return;

      const group = design.tokens[scale];
      // Without tokens there is nothing to name; stay silent rather than
      // report something the reader cannot act on.
      if (!group || group.values.length === 0) return;

      const value = numericValue(property.value);
      if (value === null) return;
      if (value === 0) return;
      if (group.values.includes(Math.abs(value))) return;

      const nearest = nearestTokens(value, group);
      // A negative offset is measured on its magnitude but written negated,
      // so the suggestion has to be negated too: `-3` is fixed by
      // `-spacing.xxs`, never by `spacing.xxs`.
      const negated = value < 0;
      const named = nearest
        .map((token) => {
          // Zero has no negative form worth printing.
          const sign = negated && token.value !== 0 ? "-" : "";
          return `\`${sign}spacing.${token.name}\` (${sign}${token.value})`;
        })
        .join(", ");
      const guidance =
        `Nearest: ${named}. Import \`{ spacing }\` from \`"@mrmeg/expo-ui/constants"\`. ` +
        `Add a token in \`${settings.uiSourceLabel}/constants/spacing.ts\` only if the design explicitly calls for one.`;

      context.report({
        node: property.value,
        messageId: "offScale",
        data: {
          value: `\`${sourceCode.getText(property.value)}\``,
          scale,
          guidance,
        },
      });
    };

    return {
      ...styleObjectVisitors(context, (styleObject) => {
        styleObject.properties.forEach(checkProperty);
      }),

      Program: reportMissingDesignSystem(context, design, settings),
    };
  },
};
