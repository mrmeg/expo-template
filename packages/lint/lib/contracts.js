/**
 * Style contracts: which categories a design-system component lets a caller
 * override, and what the message says when it does not.
 *
 * The base policy is "you may place and space a component, you may not restyle
 * it": `layout`, `arrangement`, and `spacing` are allowed, `color`,
 * `typography`, and `shape` are not. A component that declares a `size` prop
 * owns its internal spacing too, so `spacing` and `arrangement` close as well.
 *
 * Contracts refine that per component. Later entries win, and rule options are
 * appended to the defaults rather than replacing them, so a project adds a case
 * without restating the design system.
 */

const BASE_POLICY = {
  layout: "allow",
  arrangement: "allow",
  spacing: "allow",
  color: "deny",
  typography: "deny",
  shape: "deny",
};

/**
 * @param {string[]} names
 * @returns {string} an anchored alternation, e.g. `^(?:A|B\.C)$`
 */
function anyOf(names) {
  return "^(?:" + names.map((name) => name.replace(/\./g, "\\.")).join("|") + ")$";
}

/**
 * Components whose props are `StyledText`'s `TextProps` — the type scale
 * (`size`), the semantic scale (`semantic`), `fontWeight`, `align`, and the
 * font family (`variant`) all apply verbatim.
 */
const TEXT_PROPS_COMPONENTS = [
  "StyledText",
  "SerifText",
  "SansSerifText",
  "MonoText",
  "SerifBoldText",
  "SansSerifBoldText",
  "DisplayText",
  "TitleText",
  "HeadingText",
  "SubheadingText",
  "BodyText",
  "CaptionText",
  "LabelText",
  "EyebrowText",
  "Button.Text",
  "CardTitle",
  "CardDescription",
  "ItemTitle",
  "ItemDescription",
];

/**
 * Every component that renders text and owns its typography. `Label` is one but
 * declares its own narrower props (`size` only), so it takes its own message.
 */
const TEXT_LIKE_COMPONENTS = TEXT_PROPS_COMPONENTS.concat(["Label"]);

const TEXT_PROPS_PATTERN = anyOf(TEXT_PROPS_COMPONENTS);

/** `StyledText`, its aliases, and the other text-owning components. */
const TEXT_LIKE_PATTERN = anyOf(TEXT_LIKE_COMPONENTS);

/** Components that exist to wrap other content and carry its styles. */
const PASSTHROUGH_PATTERN =
  "^(?:AnimatedView|KeyboardAvoidingView|DismissKeyboard|MaxWidthContainer|Skeleton)$";

const ALL_CATEGORIES = ["layout", "arrangement", "spacing", "color", "typography", "shape"];

/**
 * Shipped with `configs.recommended`; rule options extend this list.
 *
 * @type {{pattern: string, prop?: string, allow?: string[], deny?: string[], message?: string}[]}
 */
const DEFAULT_CONTRACTS = [
  {
    // The value of `color` is still policed by `no-raw-colors`; text
    // components have no color prop, so a theme token in `style` is the
    // sanctioned path.
    pattern: TEXT_LIKE_PATTERN,
    allow: ["color"],
  },
  {
    // Text sizes itself from the type scale, so the padding inside a text box
    // is not a call-site decision — but the type scale is not the fix for it
    // either, which is why this message never names `size`.
    pattern: TEXT_LIKE_PATTERN,
    deny: ["spacing", "arrangement"],
    message:
      "`\"{{key}}\"` is not allowed on `<{{component}}>`: {{component}} owns its {{category}}. Put margin on it or padding on a parent for space around it.",
  },
  {
    pattern: TEXT_PROPS_PATTERN,
    deny: ["typography"],
    message:
      "`\"{{key}}\"` is not allowed on `<{{component}}>`: {{component}} owns its typography. Use `size`, `semantic`, `fontWeight`, or `align`; `variant` picks the font family{{fontVariants}}.",
  },
  {
    // `Label` pairs with a control and only has the three label sizes.
    pattern: "^Label$",
    deny: ["typography"],
    message:
      "`\"{{key}}\"` is not allowed on `<{{component}}>`: {{component}} owns its typography. Use `size`{{sizes}}.",
  },
  {
    // Italics have no prop to name, so the generic typography message would
    // promise `size` / `fontWeight` / `variant` — none of which can produce
    // one. The honest answer is the design-system file.
    pattern: TEXT_LIKE_PATTERN,
    deny: ["fontStyle"],
    message:
      "`\"{{key}}\"` is not allowed on `<{{component}}>`: {{component}} owns its typography and has no italic prop. Add one in `{{uiSource}}/components/StyledText.tsx` only if the design explicitly calls for it.",
  },
  {
    // Same for underline and strike-through.
    pattern: TEXT_LIKE_PATTERN,
    deny: ["textDecorationLine", "textDecorationStyle"],
    message:
      "`\"{{key}}\"` is not allowed on `<{{component}}>`: {{component}} owns its typography and has no text-decoration prop. Add one in `{{uiSource}}/components/StyledText.tsx` only if the design explicitly calls for it.",
  },
  {
    pattern: PASSTHROUGH_PATTERN,
    allow: ALL_CATEGORIES,
  },
  {
    // The documented transparent-sheet path in `LLM_USAGE.md`.
    pattern: "^BottomSheet(?:\\.|$)",
    prop: "^backgroundStyle$",
    allow: ["color"],
  },
  {
    // The RN content column paints its own card fill; `LLM_USAGE.md` clears it
    // through `style` so custom chrome behind a transparent sheet shows.
    pattern: "^BottomSheet\\.Content$",
    prop: "^style$",
    allow: ["color"],
  },
  {
    // `pressedStyle` / `disabledStyle` exist to restyle those states — a
    // pressed fill or a faded border is the point of the prop. Typography is
    // still `Button.Text`'s.
    pattern: "^Button(?:\\.|$)",
    prop: "^(?:pressedStyle|disabledStyle)$",
    allow: ["color", "shape"],
  },
  {
    // The text-state styles carry a color; their typography belongs to the
    // `Button.Text` child, which takes `StyledText`'s props.
    pattern: "^Button$",
    prop: "^(?:textStyle|pressedTextStyle|disabledTextStyle)$",
    allow: ["color"],
    deny: ["typography"],
    message:
      "`\"{{key}}\"` is not allowed in `{{prop}}` on `<{{component}}>`: Button.Text owns its typography. Render `<Button.Text size=… fontWeight=…>` as the child instead of `{{prop}}`.",
  },
  {
    // The focus treatment is the reason the prop exists.
    pattern: "^TextInput$",
    prop: "^focusedStyle$",
    allow: ["color", "shape"],
  },
];

/**
 * @param {string} pattern
 * @returns {RegExp | null}
 */
function compile(pattern) {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

/**
 * @param {object[]} [optionContracts] contracts from the rule options
 * @returns {{pattern: RegExp, prop: RegExp | null, allow: Set<string>, deny: Set<string>, message: string | null}[]}
 */
function compileContracts(optionContracts) {
  const raw = DEFAULT_CONTRACTS.concat(
    Array.isArray(optionContracts) ? optionContracts : [],
  );
  /** @type {{pattern: RegExp, prop: RegExp | null, allow: Set<string>, deny: Set<string>, message: string | null}[]} */
  const compiled = [];
  for (const contract of raw) {
    if (!contract || typeof contract.pattern !== "string") continue;
    const pattern = compile(contract.pattern);
    if (!pattern) continue;
    compiled.push({
      pattern,
      prop: typeof contract.prop === "string" ? compile(contract.prop) : null,
      allow: new Set(Array.isArray(contract.allow) ? contract.allow : []),
      deny: new Set(Array.isArray(contract.deny) ? contract.deny : []),
      message: typeof contract.message === "string" ? contract.message : null,
    });
  }
  return compiled;
}

/**
 * @param {object} params
 * @param {string} params.componentName e.g. `Button` or `Button.Text`
 * @param {string} params.propName e.g. `style` or `textStyle`
 * @param {string} params.key the style property name
 * @param {string} params.category the key's category
 * @param {boolean} params.hasSize whether the component declares a `size` prop
 * @param {object[]} params.contracts compiled contracts
 * @returns {{allowed: boolean, message: string | null}}
 */
function decide({ componentName, propName, key, category, hasSize, contracts }) {
  let verdict = BASE_POLICY[category] || "allow";
  /** @type {string | null} */
  let message = null;

  // A component that sizes itself owns the padding and arrangement inside it.
  if (hasSize && (category === "spacing" || category === "arrangement")) {
    verdict = "deny";
  }

  for (const contract of contracts) {
    if (!contract.pattern.test(componentName)) continue;
    if (contract.prop && !contract.prop.test(propName)) continue;

    if (contract.deny.has(key)) {
      verdict = "deny";
      message = contract.message;
      continue;
    }
    if (contract.allow.has(key)) {
      verdict = "allow";
      message = null;
      continue;
    }
    if (contract.deny.has(category)) {
      verdict = "deny";
      message = contract.message;
      continue;
    }
    if (contract.allow.has(category)) {
      verdict = "allow";
      message = null;
    }
  }

  return { allowed: verdict === "allow", message };
}

/**
 * @param {string[] | null} values
 * @returns {string} `a | b | c`
 */
function formatUnion(values) {
  return Array.isArray(values) && values.length > 0 ? values.join(" | ") : "";
}

/**
 * @param {string[] | null} values
 * @returns {string} ` (a | b | c)`, or nothing when the union is unknown
 */
function parenthesizedUnion(values) {
  const union = formatUnion(values);
  return union ? ` (${union})` : "";
}

/**
 * Builds the diagnostic. It names the component that owns the property, the
 * prop to use instead, and — guarded — the file where a new variant would go.
 *
 * @param {object} params
 * @param {string} params.componentName
 * @param {string} params.key
 * @param {string} params.category
 * @param {import("./source").ComponentInfo | null} params.info
 * @param {string[] | null} [params.fontVariants] the `FontVariant` union
 * @param {string} params.uiSourceLabel e.g. `packages/ui/src`
 * @param {string} [params.propName] the attribute the style was written on
 * @param {string | null} params.template a contract's message template
 * @returns {string}
 */
function denialMessage({
  componentName,
  key,
  category,
  info,
  fontVariants,
  uiSourceLabel,
  propName,
  template,
}) {
  if (template) {
    // A union placeholder carries its own parentheses so the sentence still
    // reads when the union could not be resolved from the design system.
    return template
      .split("{{component}}")
      .join(componentName)
      .split("{{key}}")
      .join(key)
      .split("{{category}}")
      .join(category)
      .split("{{prop}}")
      .join(propName || "style")
      .split("{{uiSource}}")
      .join(uiSourceLabel)
      .split("{{sizes}}")
      .join(parenthesizedUnion(info && info.sizeValues))
      .split("{{fontVariants}}")
      .join(parenthesizedUnion(fontVariants || null));
  }

  const head = `\`"${key}"\` is not allowed on \`<${componentName}>\`: ${componentName} owns its ${category}.`;

  if (category === "spacing" || category === "arrangement") {
    const sizes = formatUnion(info && info.sizeValues);
    const sizeAdvice = info && info.hasSize ? (sizes ? `Use \`size\`: ${sizes}, or put` : "Use `size`, or put") : "Put";
    return `${head} ${sizeAdvice} margin on it or padding on a parent for space around it.`;
  }

  const file = info && info.file ? `${uiSourceLabel}/components/${info.file}` : null;
  const variantProp = info && info.variantProp;
  const variantValues = formatUnion(info && info.variantValues);

  /** @type {string[]} */
  const parts = [head];
  if (variantProp) {
    parts.push(
      variantValues
        ? `Use \`${variantProp}\`: ${variantValues}.`
        : `Use \`${variantProp}\`.`,
    );
  }
  if (file) {
    const noun = variantProp === "preset" ? "preset" : "variant";
    // Without a variant union to point at, "none of them provides" refers to
    // nothing, so the sentence ends on the shorter clause.
    const tail = variantProp
      ? "only if the design explicitly calls for a treatment none of them provides"
      : "only if the design explicitly calls for it";
    parts.push(`Add a ${noun} in \`${file}\` ${tail}.`);
  }
  return parts.join(" ");
}

module.exports = {
  ALL_CATEGORIES,
  BASE_POLICY,
  DEFAULT_CONTRACTS,
  PASSTHROUGH_PATTERN,
  TEXT_LIKE_COMPONENTS,
  TEXT_LIKE_PATTERN,
  TEXT_PROPS_COMPONENTS,
  TEXT_PROPS_PATTERN,
  compileContracts,
  decide,
  denialMessage,
  formatUnion,
};
