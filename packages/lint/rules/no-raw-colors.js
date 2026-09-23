/**
 * @fileoverview Colors belong to the theme, not to a call site. A hex or
 * `rgba()` literal in a style property or a color prop cannot follow the color
 * scheme, so it is either wrong in light mode or wrong in dark mode.
 *
 * Only styles are policed: a `color` key in an object the file never uses as a
 * style — chart series, a map theme, a palette table — is data, not a style
 * (see `lib/stylePositions.js` for what counts as one).
 */

const { isColorKey } = require("../lib/categories");
const {
  alphaOf,
  isRawColorString,
  literalStringValue,
  nearestPaletteKey,
  tokensForPaletteKey,
} = require("../lib/colors");
const { designSystemComponent } = require("../lib/components");
const { readSettings } = require("../lib/settings");
const {
  DESIGN_SYSTEM_MISSING_MESSAGES,
  loadDesignSystemFor,
  reportMissingDesignSystem,
} = require("../lib/source");
const { styleObjectVisitors } = require("../lib/stylePositions");
const { staticPropertyName } = require("../lib/styles");

/** JSX props whose value is a color. */
const COLOR_PROP = /(?:^color$|Color$)/;

/**
 * @param {string} raw the literal color text
 * @param {import("../lib/source").DesignSystem} design
 * @param {string} uiSourceLabel
 * @returns {string} the guidance half of the message
 */
function guidanceFor(raw, design, uiSourceLabel) {
  /** @type {string[]} */
  const parts = [];
  const paletteKey = nearestPaletteKey(raw, design.palette);
  const tokens = paletteKey ? tokensForPaletteKey(design.lightTheme, paletteKey, 3) : [];

  if (tokens.length > 0) {
    const named = tokens.map((token) => `\`theme.colors.${token}\``).join(", ");
    parts.push(`Use a theme token from \`useTheme()\`: ${named}.`);
  } else {
    parts.push("Use a theme token from `useTheme()`.");
  }

  if (paletteKey) {
    parts.push(
      `Use \`palette.${paletteKey}\` from \`"@mrmeg/expo-ui/constants"\` only where the color must ignore the color scheme.`,
    );
  }

  const alpha = alphaOf(raw);
  if (alpha !== null) {
    const rounded = Math.round(alpha * 100) / 100;
    parts.push(
      `For alpha, \`withAlpha(color, ${rounded})\` from \`"@mrmeg/expo-ui/hooks"\`.`,
    );
  }

  parts.push(
    `Add a token in \`${uiSourceLabel}/constants/colors.ts\` only if the design explicitly calls for one.`,
  );
  return parts.join(" ");
}

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Use theme tokens instead of hex, rgb(), hsl(), or CSS color keywords in style properties and color props.",
    },
    schema: [],
    messages: {
      rawColor: "{{value}} is a raw color. {{guidance}}",
      ...DESIGN_SYSTEM_MISSING_MESSAGES,
    },
  },

  create(context) {
    const settings = readSettings(context);
    const design = loadDesignSystemFor(settings);

    /**
     * @param {object} node the node to report
     * @param {string} raw the literal color text
     */
    const report = (node, raw) => {
      context.report({
        node,
        messageId: "rawColor",
        data: {
          value: `\`"${raw}"\``,
          guidance: guidanceFor(raw, design, settings.uiSourceLabel),
        },
      });
    };

    const styleVisitors = styleObjectVisitors(context, (styleObject) => {
      for (const property of styleObject.properties) {
        const key = staticPropertyName(property);
        if (!key || !isColorKey(key)) continue;
        const raw = literalStringValue(property.value);
        if (raw === null || !isRawColorString(raw)) continue;
        report(property.value, raw);
      }
    });

    return {
      ...styleVisitors,

      Program: reportMissingDesignSystem(context, design, settings),

      JSXAttribute(node) {
        // `style` / `*Style` props: their objects are styles.
        styleVisitors.JSXAttribute(node);

        // Color-valued props on design-system elements: `<Icon color="#fff" />`.
        if (!node.name || node.name.type !== "JSXIdentifier") return;
        if (!COLOR_PROP.test(node.name.name)) return;
        if (!node.value) return;

        const valueNode =
          node.value.type === "JSXExpressionContainer" ? node.value.expression : node.value;
        const raw = literalStringValue(valueNode);
        if (raw === null || !isRawColorString(raw)) return;

        const element = node.parent;
        if (!element || element.type !== "JSXOpeningElement") return;
        if (!designSystemComponent(element, context, settings)) return;

        report(valueNode, raw);
      },
    };
  },
};
