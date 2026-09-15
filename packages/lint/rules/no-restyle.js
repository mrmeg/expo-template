/**
 * @fileoverview A design-system component owns its appearance. Overriding its
 * color, typography, or shape from the call site forks the design without
 * saying so, and the fork is invisible to everyone who reads the component.
 * Placing and spacing a component is still the caller's job.
 */

const { categorize } = require("../lib/categories");
const { designSystemComponent } = require("../lib/components");
const { compileContracts, decide, denialMessage } = require("../lib/contracts");
const { readSettings } = require("../lib/settings");
const {
  DESIGN_SYSTEM_MISSING_MESSAGES,
  loadDesignSystem,
  reportMissingDesignSystem,
} = require("../lib/source");
const { resolveStyleEntries } = require("../lib/styles");

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Use a design-system component's own variant, size, and preset props instead of restyling its appearance through `style`.",
    },
    schema: [
      {
        type: "object",
        properties: {
          contracts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                pattern: { type: "string" },
                prop: { type: "string" },
                allow: { type: "array", items: { type: "string" } },
                deny: { type: "array", items: { type: "string" } },
                message: { type: "string" },
              },
              required: ["pattern"],
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      restyle: "{{message}}",
      ...DESIGN_SYSTEM_MISSING_MESSAGES,
    },
  },

  create(context) {
    const settings = readSettings(context);
    const design = loadDesignSystem(settings.uiSourceDir);
    const options = context.options[0] || {};
    const contracts = compileContracts(options.contracts);
    // A shared sheet property can be reached from several elements and several
    // branches of the same attribute. The same diagnostic at the same place is
    // noise, so it is reported once per file.
    /** @type {Set<string>} */
    const reported = new Set();

    return {
      Program: reportMissingDesignSystem(context, design, settings.uiSourceDir),

      JSXAttribute(node) {
        if (!node.name || node.name.type !== "JSXIdentifier") return;
        const propName = node.name.name;
        if (propName !== "style" && !/Style$/.test(propName)) return;
        if (!node.value) return;

        const element = node.parent;
        if (!element || element.type !== "JSXOpeningElement") return;
        const component = designSystemComponent(element, context, settings);
        if (!component) return;

        const valueNode =
          node.value.type === "JSXExpressionContainer" ? node.value.expression : node.value;
        const entries = resolveStyleEntries(valueNode, context);
        if (entries.length === 0) return;

        const info = design.components.get(component.name) || null;
        const hasSize = Boolean(info && info.hasSize);

        for (const entry of entries) {
          const category = categorize(entry.key);
          if (!category) continue;

          const verdict = decide({
            componentName: component.name,
            propName,
            key: entry.key,
            category,
            hasSize,
            contracts,
          });
          if (verdict.allowed) continue;

          const message = denialMessage({
            componentName: component.name,
            key: entry.key,
            category,
            info,
            fontVariants: design.fontVariants,
            uiSourceLabel: settings.uiSourceLabel,
            propName,
            template: verdict.message,
          });

          const fingerprint = String(entry.keyNode.range) + "|" + message;
          if (reported.has(fingerprint)) continue;
          reported.add(fingerprint);

          context.report({
            node: entry.keyNode,
            messageId: "restyle",
            data: { message },
          });
        }
      },
    };
  },
};
