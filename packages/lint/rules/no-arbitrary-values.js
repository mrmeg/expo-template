/**
 * @fileoverview Spacing and radii come off a scale. A one-off `13` reads as
 * deliberate to no one and drifts the rhythm of every screen it lands on, so a
 * numeric literal in a spacing or radius property has to name a token.
 */

const { RADIUS_SCALE_KEYS, SPACING_SCALE_KEYS } = require("../lib/categories");
const { readSettings } = require("../lib/settings");
const {
  DESIGN_SYSTEM_MISSING_MESSAGES,
  loadDesignSystem,
  reportMissingDesignSystem,
} = require("../lib/source");

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
 * The nearest token, then the nearest one on the other side of the value, so
 * the message brackets what was written and the reader can pick a direction.
 * When the value sits past either end of the scale, the second-nearest token on
 * the same side stands in.
 *
 * @param {number} value
 * @param {import("../lib/source").TokenGroup} group
 * @returns {{name: string, value: number}[]}
 */
function nearestTokens(value, group) {
  const target = Math.abs(value);
  const ranked = group.values
    .map((candidate) => ({
      name: group.nameByValue.get(candidate) || "",
      value: candidate,
      distance: Math.abs(candidate - target),
    }))
    .sort((a, b) => a.distance - b.distance || a.value - b.value);

  const nearest = ranked[0];
  if (!nearest) return [];
  const opposite = ranked.find((entry) =>
    nearest.value < target ? entry.value > target : entry.value < target,
  );
  const second = opposite || ranked[1];
  const picked = second ? [nearest, second] : [nearest];
  return picked.map((entry) => ({ name: entry.name, value: entry.value }));
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
    const design = loadDesignSystem(settings.uiSourceDir);
    const sourceCode = context.sourceCode || context.getSourceCode();

    return {
      Program: reportMissingDesignSystem(context, design, settings.uiSourceDir),

      Property(node) {
        if (node.computed) return;
        const key =
          node.key.type === "Identifier"
            ? node.key.name
            : node.key.type === "Literal" && typeof node.key.value === "string"
              ? node.key.value
              : null;
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

        const value = numericValue(node.value);
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
          node: node.value,
          messageId: "offScale",
          data: {
            value: `\`${sourceCode.getText(node.value)}\``,
            scale,
            guidance,
          },
        });
      },
    };
  },
};
