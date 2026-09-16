/**
 * Style-key categories.
 *
 * A React Native style object is structured, so a property's key is enough to
 * know what the property does. `no-restyle` decides policy per category, and
 * `no-raw-colors` uses the `color` category to find color-valued properties.
 *
 * Keys that are not listed are ignored: TypeScript already types them, and the
 * design system takes no position on them.
 */

/** @type {Record<string, string[]>} */
const KEYS_BY_CATEGORY = {
  layout: [
    "margin",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "marginHorizontal",
    "marginVertical",
    "marginStart",
    "marginEnd",
    "marginBlock",
    "marginInline",
    "flex",
    "flexGrow",
    "flexShrink",
    "flexBasis",
    "alignSelf",
    "width",
    "minWidth",
    "maxWidth",
    "position",
    "top",
    "right",
    "bottom",
    "left",
    "start",
    "end",
    "inset",
    "zIndex",
    "display",
    "overflow",
    "transform",
    "textAlign",
  ],
  arrangement: [
    "flexDirection",
    "flexWrap",
    "alignItems",
    "justifyContent",
    "alignContent",
  ],
  spacing: [
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "paddingHorizontal",
    "paddingVertical",
    "paddingStart",
    "paddingEnd",
    "paddingBlock",
    "paddingInline",
    "gap",
    "rowGap",
    "columnGap",
    "height",
    "minHeight",
    "maxHeight",
  ],
  color: [
    "backgroundColor",
    "color",
    "borderColor",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
    "borderStartColor",
    "borderEndColor",
    "borderBlockColor",
    "borderBlockStartColor",
    "borderBlockEndColor",
    "shadowColor",
    "tintColor",
    "textDecorationColor",
    "textShadowColor",
    "overlayColor",
  ],
  typography: [
    "fontSize",
    "fontFamily",
    "fontWeight",
    "fontStyle",
    "lineHeight",
    "letterSpacing",
    "textTransform",
    "textDecorationLine",
    "textDecorationStyle",
    "textAlignVertical",
    "includeFontPadding",
  ],
  shape: [
    "borderRadius",
    "borderTopLeftRadius",
    "borderTopRightRadius",
    "borderBottomLeftRadius",
    "borderBottomRightRadius",
    "borderTopStartRadius",
    "borderTopEndRadius",
    "borderBottomStartRadius",
    "borderBottomEndRadius",
    "borderStartStartRadius",
    "borderStartEndRadius",
    "borderEndStartRadius",
    "borderEndEndRadius",
    "borderWidth",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "borderStartWidth",
    "borderEndWidth",
    "borderStyle",
    "shadowOffset",
    "shadowOpacity",
    "shadowRadius",
    "elevation",
    "opacity",
    "boxShadow",
  ],
};

const CATEGORIES = Object.keys(KEYS_BY_CATEGORY);

/** @type {Map<string, string>} */
const CATEGORY_BY_KEY = new Map();
for (const category of CATEGORIES) {
  for (const key of KEYS_BY_CATEGORY[category]) {
    CATEGORY_BY_KEY.set(key, category);
  }
}

/**
 * Spacing keys that `no-arbitrary-values` measures against the `spacing` token
 * group. `height`/`minHeight`/`maxHeight` are deliberately excluded: they are
 * sizes, not spacing steps.
 */
const SPACING_SCALE_KEYS = new Set([
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "paddingHorizontal",
  "paddingVertical",
  "paddingStart",
  "paddingEnd",
  "paddingBlock",
  "paddingInline",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "marginHorizontal",
  "marginVertical",
  "marginStart",
  "marginEnd",
  "marginBlock",
  "marginInline",
  "gap",
  "rowGap",
  "columnGap",
]);

/** Radius keys that `no-arbitrary-values` measures against the `radius` group. */
const RADIUS_SCALE_KEYS = new Set(
  KEYS_BY_CATEGORY.shape.filter((key) => /^border[A-Za-z]*Radius$/.test(key)),
);

/**
 * @param {string} key style property name
 * @returns {string | null} the category, or null when the key is not policed
 */
function categorize(key) {
  return CATEGORY_BY_KEY.get(key) || null;
}

/**
 * @param {string} key
 * @returns {boolean} true when the key holds a color value
 */
function isColorKey(key) {
  return CATEGORY_BY_KEY.get(key) === "color";
}

module.exports = {
  CATEGORIES,
  KEYS_BY_CATEGORY,
  SPACING_SCALE_KEYS,
  RADIUS_SCALE_KEYS,
  categorize,
  isColorKey,
};
