/**
 * Raw-color detection and nearest-token lookup.
 *
 * "Raw" means the value spells a color out instead of naming one: a hex
 * literal, an `rgb()`/`rgba()`/`hsl()`/`hsla()` string, or a CSS color keyword.
 * `"transparent"` is allowed — it is the absence of a color, not a choice of
 * one, and no token can replace it.
 *
 * The nearest palette entry is the one with the smallest Euclidean distance in
 * RGB. That is not a perceptual metric, but the palette is a small neutral
 * scale plus a handful of status colors, so it lands on the obvious neighbour
 * and gives the message something concrete to name.
 */

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTIONAL = /^(?:rgb|rgba|hsl|hsla)\s*\(/i;

/** CSS color keywords and their sRGB values. */
const NAMED_COLORS = {
  aliceblue: [240, 248, 255],
  antiquewhite: [250, 235, 215],
  aqua: [0, 255, 255],
  aquamarine: [127, 255, 212],
  azure: [240, 255, 255],
  beige: [245, 245, 220],
  bisque: [255, 228, 196],
  black: [0, 0, 0],
  blanchedalmond: [255, 235, 205],
  blue: [0, 0, 255],
  blueviolet: [138, 43, 226],
  brown: [165, 42, 42],
  burlywood: [222, 184, 135],
  cadetblue: [95, 158, 160],
  chartreuse: [127, 255, 0],
  chocolate: [210, 105, 30],
  coral: [255, 127, 80],
  cornflowerblue: [100, 149, 237],
  cornsilk: [255, 248, 220],
  crimson: [220, 20, 60],
  cyan: [0, 255, 255],
  darkblue: [0, 0, 139],
  darkcyan: [0, 139, 139],
  darkgoldenrod: [184, 134, 11],
  darkgray: [169, 169, 169],
  darkgreen: [0, 100, 0],
  darkgrey: [169, 169, 169],
  darkkhaki: [189, 183, 107],
  darkmagenta: [139, 0, 139],
  darkolivegreen: [85, 107, 47],
  darkorange: [255, 140, 0],
  darkorchid: [153, 50, 204],
  darkred: [139, 0, 0],
  darksalmon: [233, 150, 122],
  darkseagreen: [143, 188, 143],
  darkslateblue: [72, 61, 139],
  darkslategray: [47, 79, 79],
  darkslategrey: [47, 79, 79],
  darkturquoise: [0, 206, 209],
  darkviolet: [148, 0, 211],
  deeppink: [255, 20, 147],
  deepskyblue: [0, 191, 255],
  dimgray: [105, 105, 105],
  dimgrey: [105, 105, 105],
  dodgerblue: [30, 144, 255],
  firebrick: [178, 34, 34],
  floralwhite: [255, 250, 240],
  forestgreen: [34, 139, 34],
  fuchsia: [255, 0, 255],
  gainsboro: [220, 220, 220],
  ghostwhite: [248, 248, 255],
  gold: [255, 215, 0],
  goldenrod: [218, 165, 32],
  gray: [128, 128, 128],
  green: [0, 128, 0],
  greenyellow: [173, 255, 47],
  grey: [128, 128, 128],
  honeydew: [240, 255, 240],
  hotpink: [255, 105, 180],
  indianred: [205, 92, 92],
  indigo: [75, 0, 130],
  ivory: [255, 255, 240],
  khaki: [240, 230, 140],
  lavender: [230, 230, 250],
  lavenderblush: [255, 240, 245],
  lawngreen: [124, 252, 0],
  lemonchiffon: [255, 250, 205],
  lightblue: [173, 216, 230],
  lightcoral: [240, 128, 128],
  lightcyan: [224, 255, 255],
  lightgoldenrodyellow: [250, 250, 210],
  lightgray: [211, 211, 211],
  lightgreen: [144, 238, 144],
  lightgrey: [211, 211, 211],
  lightpink: [255, 182, 193],
  lightsalmon: [255, 160, 122],
  lightseagreen: [32, 178, 170],
  lightskyblue: [135, 206, 250],
  lightslategray: [119, 136, 153],
  lightslategrey: [119, 136, 153],
  lightsteelblue: [176, 196, 222],
  lightyellow: [255, 255, 224],
  lime: [0, 255, 0],
  limegreen: [50, 205, 50],
  linen: [250, 240, 230],
  magenta: [255, 0, 255],
  maroon: [128, 0, 0],
  mediumaquamarine: [102, 205, 170],
  mediumblue: [0, 0, 205],
  mediumorchid: [186, 85, 211],
  mediumpurple: [147, 112, 219],
  mediumseagreen: [60, 179, 113],
  mediumslateblue: [123, 104, 238],
  mediumspringgreen: [0, 250, 154],
  mediumturquoise: [72, 209, 204],
  mediumvioletred: [199, 21, 133],
  midnightblue: [25, 25, 112],
  mintcream: [245, 255, 250],
  mistyrose: [255, 228, 225],
  moccasin: [255, 228, 181],
  navajowhite: [255, 222, 173],
  navy: [0, 0, 128],
  oldlace: [253, 245, 230],
  olive: [128, 128, 0],
  olivedrab: [107, 142, 35],
  orange: [255, 165, 0],
  orangered: [255, 69, 0],
  orchid: [218, 112, 214],
  palegoldenrod: [238, 232, 170],
  palegreen: [152, 251, 152],
  paleturquoise: [175, 238, 238],
  palevioletred: [219, 112, 147],
  papayawhip: [255, 239, 213],
  peachpuff: [255, 218, 185],
  peru: [205, 133, 63],
  pink: [255, 192, 203],
  plum: [221, 160, 221],
  powderblue: [176, 224, 230],
  purple: [128, 0, 128],
  rebeccapurple: [102, 51, 153],
  red: [255, 0, 0],
  rosybrown: [188, 143, 143],
  royalblue: [65, 105, 225],
  saddlebrown: [139, 69, 19],
  salmon: [250, 128, 114],
  sandybrown: [244, 164, 96],
  seagreen: [46, 139, 87],
  seashell: [255, 245, 238],
  sienna: [160, 82, 45],
  silver: [192, 192, 192],
  skyblue: [135, 206, 235],
  slateblue: [106, 90, 205],
  slategray: [112, 128, 144],
  slategrey: [112, 128, 144],
  snow: [255, 250, 250],
  springgreen: [0, 255, 127],
  steelblue: [70, 130, 180],
  tan: [210, 180, 140],
  teal: [0, 128, 128],
  thistle: [216, 191, 216],
  tomato: [255, 99, 71],
  turquoise: [64, 224, 208],
  violet: [238, 130, 238],
  wheat: [245, 222, 179],
  white: [255, 255, 255],
  whitesmoke: [245, 245, 245],
  yellow: [255, 255, 0],
  yellowgreen: [154, 205, 50],
};

/**
 * @param {string} value
 * @returns {boolean} true when the string spells a color out
 */
function isRawColorString(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed === "") return false;
  const lower = trimmed.toLowerCase();
  if (lower === "transparent") return false;
  if (HEX.test(trimmed)) return true;
  if (FUNCTIONAL.test(trimmed)) return true;
  return Object.prototype.hasOwnProperty.call(NAMED_COLORS, lower);
}

/**
 * A style value is only raw when it is spelled out in the source: a string
 * literal, or a template literal with no interpolation.
 *
 * @param {object} node
 * @returns {string | null} the literal text, or null
 */
function literalStringValue(node) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0 && node.quasis.length === 1) {
    return node.quasis[0].value.cooked;
  }
  return null;
}

/**
 * @param {string} hex
 * @returns {number[] | null} `[r, g, b]`
 */
function hexToRgb(hex) {
  let body = hex.replace(/^#/, "");
  if (body.length === 3 || body.length === 4) {
    body = body
      .slice(0, 3)
      .split("")
      .map((char) => char + char)
      .join("");
  } else {
    body = body.slice(0, 6);
  }
  if (!/^[0-9a-f]{6}$/i.test(body)) return null;
  return [
    parseInt(body.slice(0, 2), 16),
    parseInt(body.slice(2, 4), 16),
    parseInt(body.slice(4, 6), 16),
  ];
}

/**
 * @param {number} h hue in degrees
 * @param {number} s saturation 0-1
 * @param {number} l lightness 0-1
 * @returns {number[]} `[r, g, b]`
 */
function hslToRgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const sector = Math.floor(hue / 60) % 6;
  const table = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ];
  const [r, g, b] = table[sector];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

/**
 * @param {string} value
 * @returns {number[] | null} `[r, g, b]`
 */
function toRgb(value) {
  const trimmed = String(value).trim();
  const lower = trimmed.toLowerCase();
  if (HEX.test(trimmed)) return hexToRgb(trimmed);
  if (Object.prototype.hasOwnProperty.call(NAMED_COLORS, lower)) {
    return NAMED_COLORS[lower].slice();
  }
  const functional = /^(rgb|rgba|hsl|hsla)\s*\(([^)]*)\)$/i.exec(trimmed);
  if (!functional) return null;
  const kind = functional[1].toLowerCase();
  const parts = functional[2]
    .split(/[,/\s]+/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
  if (parts.length < 3) return null;
  if (kind === "rgb" || kind === "rgba") {
    const channels = parts.slice(0, 3).map((part) => {
      const number = parseFloat(part);
      if (Number.isNaN(number)) return null;
      return part.endsWith("%") ? Math.round((number / 100) * 255) : Math.round(number);
    });
    if (channels.some((channel) => channel === null)) return null;
    return /** @type {number[]} */ (channels);
  }
  const hue = parseFloat(parts[0]);
  const saturation = parseFloat(parts[1]) / 100;
  const lightness = parseFloat(parts[2]) / 100;
  if ([hue, saturation, lightness].some((number) => Number.isNaN(number))) return null;
  return hslToRgb(hue, saturation, lightness);
}

/**
 * @param {string} value
 * @returns {number | null} the alpha channel when it is below 1
 */
function alphaOf(value) {
  const trimmed = String(value).trim();
  if (HEX.test(trimmed)) {
    const body = trimmed.replace(/^#/, "");
    if (body.length === 4) return parseInt(body[3] + body[3], 16) / 255;
    if (body.length === 8) return parseInt(body.slice(6, 8), 16) / 255;
    return null;
  }
  const functional = /^(rgba|hsla|rgb|hsl)\s*\(([^)]*)\)$/i.exec(trimmed);
  if (!functional) return null;
  const parts = functional[2]
    .split(/[,/\s]+/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
  if (parts.length < 4) return null;
  const raw = parts[3];
  const number = parseFloat(raw);
  if (Number.isNaN(number)) return null;
  const alpha = raw.endsWith("%") ? number / 100 : number;
  return alpha >= 1 ? null : alpha;
}

/**
 * @param {string} value a raw color string
 * @param {Record<string, string>} palette
 * @returns {string | null} the nearest palette key
 */
function nearestPaletteKey(value, palette) {
  const rgb = toRgb(value);
  if (!rgb) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const key of Object.keys(palette)) {
    const candidate = toRgb(palette[key]);
    if (!candidate) continue;
    const distance =
      (rgb[0] - candidate[0]) ** 2 + (rgb[1] - candidate[1]) ** 2 + (rgb[2] - candidate[2]) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = key;
    }
  }
  return best;
}

/**
 * @param {Record<string, {paletteKey: string | null, value: string | null}>} theme
 * @param {string} paletteKey
 * @param {number} [limit]
 * @returns {string[]} theme tokens that resolve to that palette entry
 */
function tokensForPaletteKey(theme, paletteKey, limit) {
  const max = limit || 3;
  /** @type {string[]} */
  const tokens = [];
  for (const token of Object.keys(theme)) {
    if (theme[token].paletteKey === paletteKey) {
      tokens.push(token);
      if (tokens.length >= max) break;
    }
  }
  return tokens;
}

module.exports = {
  NAMED_COLORS,
  alphaOf,
  isRawColorString,
  literalStringValue,
  nearestPaletteKey,
  toRgb,
  tokensForPaletteKey,
};
