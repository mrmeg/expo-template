/**
 * @fileoverview Where the design system already wraps a primitive, importing the
 * primitive directly skips the theme: the wrapper is where the font, the color,
 * and the platform behaviour live. Primitives the design system deliberately
 * does not cover — `Pressable`, `View`, `@expo/ui`'s `Host` and `Picker` — stay
 * available.
 *
 * Which `react-native` components count is read from the design system, not
 * listed here: any React Native component the design system exports a
 * component of the same name for (`TextInput`, `Switch`, `Button`,
 * `KeyboardAvoidingView`, `StatusBar` today) is wrapped, so a new wrapper is
 * enforced the release it ships. `Text` is the one wrapper with another name.
 */

const { readSettings } = require("../lib/settings");
const {
  DESIGN_SYSTEM_MISSING_MESSAGES,
  loadDesignSystemFor,
  reportMissingDesignSystem,
} = require("../lib/source");

const COMPONENTS_ENTRY = '"@mrmeg/expo-ui/components"';

/**
 * React Native's components: the primitives a design-system component can wrap.
 * Its APIs (`Alert`, `Animated`, `Keyboard`, …) render nothing and are not
 * primitives, even where the design system has a same-named helper.
 */
const REACT_NATIVE_COMPONENTS = new Set([
  "ActivityIndicator",
  "Button",
  "DrawerLayoutAndroid",
  "FlatList",
  "Image",
  "ImageBackground",
  "InputAccessoryView",
  "KeyboardAvoidingView",
  "Modal",
  "Pressable",
  "RefreshControl",
  "SafeAreaView",
  "ScrollView",
  "SectionList",
  "StatusBar",
  "Switch",
  "Text",
  "TextInput",
  "TouchableHighlight",
  "TouchableNativeFeedback",
  "TouchableOpacity",
  "TouchableWithoutFeedback",
  "View",
  "VirtualizedList",
  "VirtualizedSectionList",
]);

/**
 * The React Native components the loaded design system wraps: those it exports
 * a component of the same name for. Empty when no design system was found — the
 * missing-design-system report says why.
 *
 * @param {import("../lib/source").DesignSystem} design
 * @returns {Set<string>}
 */
function wrappedReactNativeComponents(design) {
  const wrapped = new Set();
  for (const name of REACT_NATIVE_COMPONENTS) {
    if (design.components.has(name)) wrapped.add(name);
  }
  return wrapped;
}

/** `@expo/ui` subpaths the design system wraps, and the wrapper to use. */
const EXPO_UI_MODULES = {
  "@expo/ui/community/bottom-sheet": "BottomSheet",
  "@expo/ui/community/slider": "Slider",
  "@expo/ui/community/segmented-control": "SegmentedControl",
};

/** Named exports of `@expo/ui` itself that the design system wraps. */
const EXPO_UI_SPECIFIERS = {
  TextInput: "TextInput",
};

/**
 * A type-only import contributes nothing at runtime: it does not render, so it
 * cannot render with the wrong font. `import type { Text }` and
 * `import { type Text as T }` are how a wrapper's own props get typed.
 *
 * @param {object} specifier
 * @returns {boolean}
 */
function isTypeOnlySpecifier(specifier) {
  return Boolean(specifier && specifier.importKind === "type");
}

/**
 * @param {object} node an ImportDeclaration
 * @returns {boolean} true when nothing in it exists at runtime
 */
function isTypeOnlyImport(node) {
  if (node.importKind === "type") return true;
  // `import { type A, type B } from "x"` — a value import of no values. A bare
  // `import "x"` has no specifiers and does run.
  return node.specifiers.length > 0 && node.specifiers.every(isTypeOnlySpecifier);
}

/**
 * @param {object} specifier
 * @returns {string | null} the imported (not local) name
 */
function importedName(specifier) {
  if (!specifier || specifier.type !== "ImportSpecifier") return null;
  if (isTypeOnlySpecifier(specifier)) return null;
  const imported = specifier.imported;
  if (!imported) return null;
  if (imported.type === "Identifier") return imported.name;
  if (imported.type === "Literal" && typeof imported.value === "string") return imported.value;
  return null;
}

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Import the design-system component instead of the raw primitive it wraps: `react-native` components the design system has a same-named component for, `Text`, `@rn-primitives/*`, and the wrapped `@expo/ui` surfaces.",
    },
    schema: [],
    messages: {
      rawPrimitive: "{{message}}",
      ...DESIGN_SYSTEM_MISSING_MESSAGES,
    },
  },

  create(context) {
    // The design system says which React Native components it wraps; the
    // `@rn-primitives` and `@expo/ui` tables are this rule's own, because those
    // wrappers do not share a name with the module they wrap.
    const settings = readSettings(context);
    const design = loadDesignSystemFor(settings);
    const wrappedReactNative = wrappedReactNativeComponents(design);

    /**
     * @param {object} node
     * @param {string} message
     */
    const report = (node, message) => {
      context.report({ node, messageId: "rawPrimitive", data: { message } });
    };

    return {
      Program: reportMissingDesignSystem(context, design, settings),

      ImportDeclaration(node) {
        const source = node.source && node.source.value;
        if (typeof source !== "string") return;
        if (isTypeOnlyImport(node)) return;

        if (source === "react-native") {
          for (const specifier of node.specifiers) {
            const name = importedName(specifier);
            if (name === "Text") {
              report(
                specifier,
                "`Text` from `\"react-native\"` is a raw primitive: it renders with the platform font and no theme color. " +
                  `Use \`StyledText\` or a semantic alias (\`TitleText\`, \`BodyText\`, \`CaptionText\`, ...) from \`${COMPONENTS_ENTRY}\`.`,
              );
            } else if (name && wrappedReactNative.has(name)) {
              report(
                specifier,
                `\`${name}\` from \`"react-native"\` is wrapped by the design system. ` +
                  `Use \`${name}\` from \`${COMPONENTS_ENTRY}\`, which applies the theme and the shared props.`,
              );
            }
          }
          return;
        }

        if (/^@rn-primitives\//.test(source)) {
          report(
            node.source,
            `\`"${source}"\` is the headless layer that the design system wraps. ` +
              `Import the styled component from \`${COMPONENTS_ENTRY}\`.`,
          );
          return;
        }

        const wrapper = EXPO_UI_MODULES[source];
        if (wrapper) {
          report(
            node.source,
            `\`"${source}"\` is wrapped by the design system. ` +
              `Use \`${wrapper}\` from \`${COMPONENTS_ENTRY}\`, which applies the theme and the shared props.`,
          );
          return;
        }

        if (source === "@expo/ui") {
          for (const specifier of node.specifiers) {
            const name = importedName(specifier);
            if (!name) continue;
            const replacement = EXPO_UI_SPECIFIERS[name];
            if (!replacement) continue;
            report(
              specifier,
              `\`${name}\` from \`"@expo/ui"\` is wrapped by the design system. ` +
                `Use \`${replacement}\` from \`${COMPONENTS_ENTRY}\`, which applies the theme and the shared props.`,
            );
          }
        }
      },
    };
  },
};
