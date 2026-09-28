/**
 * Local design-system sources are trusted only when they are `@mrmeg/expo-ui`'s.
 *
 * The default `uiSourceDir` is `packages/ui/src`, a path plenty of consumer
 * monorepos have for a UI package of their own. Reading that as the design
 * system would quote its tokens, or quietly lint against nothing, instead of
 * the manifest the installed `@mrmeg/expo-ui` ships. The package.json beside
 * the sources decides.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Linter } = require("eslint");
const tsParser = require("@typescript-eslint/parser");

const plugin = require("../index.js");
const { resolveOrigin, resolveUiSourceDir } = require("../lib/settings");
const { designSystemNotFoundMessage } = require("../lib/source");

const REAL_UI_SRC = path.resolve(__dirname, "../../ui/src");
const ROOT = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "expo-ui-lint-settings-")));

afterAll(() => {
  fs.rmSync(ROOT, { recursive: true, force: true });
});

/** A project whose `packages/ui` is the package named `name`, with real sources. */
function projectWithUiPackage(dir: string, name: string) {
  const uiDir = path.join(ROOT, dir, "packages", "ui");
  fs.mkdirSync(uiDir, { recursive: true });
  fs.cpSync(REAL_UI_SRC, path.join(uiDir, "src"), { recursive: true });
  fs.writeFileSync(path.join(uiDir, "package.json"), JSON.stringify({ name, version: "1.0.0" }));
  return path.join(ROOT, dir);
}

/** Installs a `@mrmeg/expo-ui` with a manifest whose only spacing token is 7. */
function installManifest(projectDir: string) {
  const installed = path.join(projectDir, "node_modules", "@mrmeg", "expo-ui");
  fs.mkdirSync(path.join(installed, "dist"), { recursive: true });
  fs.writeFileSync(
    path.join(installed, "package.json"),
    JSON.stringify({
      name: "@mrmeg/expo-ui",
      version: "9.9.9",
      exports: { "./design-system.json": { default: "./dist/design-system.json" } },
    }),
  );
  fs.writeFileSync(
    path.join(installed, "dist", "design-system.json"),
    JSON.stringify({
      schemaVersion: 1,
      package: "@mrmeg/expo-ui",
      version: "9.9.9",
      tokens: { spacing: { entries: [{ name: "installedGap", value: 7 }] } },
      palette: {},
      themeTokens: [],
      lightTheme: {},
      darkTheme: {},
      fontVariants: null,
      components: [],
    }),
  );
}

const foreign = projectWithUiPackage("foreign", "@acme/ui");
const foreignWithManifest = projectWithUiPackage("foreign-installed", "@acme/ui");
installManifest(foreignWithManifest);
const vendored = projectWithUiPackage("vendored", "@mrmeg/expo-ui");

describe("resolveOrigin", () => {
  it("reads @mrmeg/expo-ui sources, found by package name", () => {
    expect(resolveOrigin({ rawSettings: {}, cwd: vendored })).toEqual({
      kind: "source",
      path: path.join(vendored, "packages", "ui", "src"),
    });
  });

  it("passes over another package's packages/ui/src for the installed manifest", () => {
    expect(resolveOrigin({ rawSettings: {}, cwd: foreignWithManifest })).toEqual({
      kind: "manifest",
      path: path.join(foreignWithManifest, "node_modules", "@mrmeg", "expo-ui", "dist", "design-system.json"),
      skippedSources: { path: path.join(foreignWithManifest, "packages", "ui", "src"), packageName: "@acme/ui" },
    });
  });

  it("says whose sources it passed over when there is no manifest either", () => {
    const origin = resolveOrigin({ rawSettings: {}, cwd: foreign });
    expect(origin).toEqual({
      kind: "none",
      uiSourceDir: path.join(foreign, "packages", "ui", "src"),
      skippedSources: { path: path.join(foreign, "packages", "ui", "src"), packageName: "@acme/ui" },
    });
    expect(designSystemNotFoundMessage({ origin })).toBe(
      `Design-system facts were not found: the sources at \`${path.join(foreign, "packages", "ui", "src")}\` are \`@acme/ui\`'s, not @mrmeg/expo-ui's, and no manifest resolvable as \`@mrmeg/expo-ui/design-system.json\`. Install an @mrmeg/expo-ui release that ships the manifest, or set \`settings["expo-ui"].uiSourceDir\` or \`settings["expo-ui"].manifestPath\`.`,
    );
  });

  it("applies the same check to an explicit uiSourceDir", () => {
    const origin = resolveOrigin({
      rawSettings: { uiSourceDir: path.join(foreignWithManifest, "packages", "ui", "src") },
      cwd: foreignWithManifest,
    });
    expect(origin.kind).toBe("manifest");
    expect(origin.skippedSources.packageName).toBe("@acme/ui");
  });

  it("keeps walking up past a closer foreign packages/ui/src", () => {
    const nested = path.join(vendored, "apps", "mobile");
    fs.mkdirSync(path.join(nested, "packages", "ui", "src"), { recursive: true });
    fs.writeFileSync(path.join(nested, "packages", "ui", "package.json"), JSON.stringify({ name: "@acme/ui" }));

    expect(resolveUiSourceDir("packages/ui/src", [nested])).toBe(path.join(vendored, "packages", "ui", "src"));
  });
});

describe("rules in a project with its own packages/ui", () => {
  it("quote the installed manifest, not the foreign sources", () => {
    // Linting from the project's own root, the way its ESLint would.
    const linter = new Linter({ cwd: foreignWithManifest });
    const messages = linter.verify(
      "const s: ViewStyle = { padding: 13 };",
      [
        {
          files: ["**/*.tsx"],
          plugins: { "expo-ui": plugin },
          languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
          settings: { "expo-ui": { uiSourceDir: "packages/ui/src" } },
          rules: { "expo-ui/no-arbitrary-values": "error" },
        },
      ],
      path.join(foreignWithManifest, "app", "screen.tsx"),
    );

    expect(messages).toHaveLength(1);
    // `installedGap` exists only in the installed manifest.
    expect(messages[0].message).toContain("`spacing.installedGap` (7)");
    expect(messages[0].message).toContain("`@mrmeg/expo-ui/constants/spacing.ts`");
  });
});
