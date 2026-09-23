/**
 * The shape of `configs.recommended` is the plugin's public surface: the
 * consuming `eslint.config.mjs` spreads it and adds only `files`. A rule that
 * exists but is not in that config is a rule nobody runs.
 */
import type { Linter } from "eslint";
import type typedPlugin from "../index";

const plugin = require("../index");

const RULE_NAMES = ["no-arbitrary-values", "no-raw-colors", "no-raw-primitives", "no-restyle"];

describe("@mrmeg/eslint-plugin-expo-ui", () => {
  it("exports every rule under the `expo-ui` name", () => {
    expect(plugin.meta.name).toBe("expo-ui");
    expect(Object.keys(plugin.rules).sort()).toEqual(RULE_NAMES);
    for (const name of RULE_NAMES) {
      expect(typeof plugin.rules[name].create).toBe("function");
    }
  });

  it("enables all four rules at `error` in `configs.recommended`", () => {
    const config = plugin.configs.recommended;
    expect(config.rules).toEqual({
      "expo-ui/no-raw-colors": "error",
      "expo-ui/no-arbitrary-values": "error",
      "expo-ui/no-restyle": "error",
      "expo-ui/no-raw-primitives": "error",
    });
    // Every entry names a rule the plugin actually ships.
    for (const key of Object.keys(config.rules)) {
      expect(plugin.rules[key.replace("expo-ui/", "")]).toBeDefined();
    }
  });

  it("ships declarations that describe it, for eslint.config.ts", () => {
    // Type-checked by the root `bun run typecheck`: `index.d.ts` has to type the
    // recommended config as a flat config and name every rule.
    const recommended: Linter.Config = (plugin as typeof typedPlugin).configs.recommended;
    const rules: (keyof (typeof typedPlugin)["rules"])[] = [
      "no-raw-colors",
      "no-arbitrary-values",
      "no-restyle",
      "no-raw-primitives",
    ];
    expect(recommended).toBe(plugin.configs.recommended);
    expect([...rules].sort()).toEqual(RULE_NAMES);

    const manifest = require("../package.json");
    expect(manifest.types).toBe("./index.d.ts");
    expect(manifest.exports["."]).toEqual({ types: "./index.d.ts", default: "./index.js" });
    expect(manifest.files).toEqual(expect.arrayContaining(["index.js", "index.d.ts", "LICENSE"]));
  });

  it("registers itself and the design-system location", () => {
    const config = plugin.configs.recommended;
    expect(config.plugins["expo-ui"]).toBe(plugin);
    expect(config.settings["expo-ui"].uiSourceDir).toBe("packages/ui/src");
    // No `files` key on purpose: the consuming config decides which paths the
    // design system governs.
    expect(config.files).toBeUndefined();
  });
});
