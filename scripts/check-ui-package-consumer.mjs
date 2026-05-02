import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
  }
}

const root = process.cwd();
const fixture = await mkdtemp(join(tmpdir(), "expo-ui-consumer-"));
let tarball;

function tarballNameForPackage(packageName, version) {
  return `${packageName.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function assertFileExists(path, label) {
  try {
    await access(path);
  } catch {
    throw new Error(`Missing packed file for ${label}: ${path}`);
  }
}

function resolveExportTargets(exportValue, wildcardReplacement) {
  if (typeof exportValue === "string") {
    return [exportValue.replace("*", wildcardReplacement)];
  }

  return Object.values(exportValue)
    .filter((target) => typeof target === "string")
    .map((target) => target.replace("*", wildcardReplacement));
}

async function assertInstalledExportFiles() {
  const packageRoot = join(fixture, "node_modules/@mrmeg/expo-ui");
  const manifest = await readJson(join(packageRoot, "package.json"));
  const exportChecks = [
    { entrypoint: "@mrmeg/expo-ui", key: ".", wildcardReplacement: "" },
    { entrypoint: "@mrmeg/expo-ui/components", key: "./components", wildcardReplacement: "" },
    { entrypoint: "@mrmeg/expo-ui/components/Button", key: "./components/*", wildcardReplacement: "Button" },
    { entrypoint: "@mrmeg/expo-ui/constants", key: "./constants", wildcardReplacement: "" },
    { entrypoint: "@mrmeg/expo-ui/hooks", key: "./hooks", wildcardReplacement: "" },
    { entrypoint: "@mrmeg/expo-ui/state", key: "./state", wildcardReplacement: "" },
    { entrypoint: "@mrmeg/expo-ui/lib", key: "./lib", wildcardReplacement: "" },
  ];

  for (const check of exportChecks) {
    const exportValue = manifest.exports[check.key];
    if (!exportValue) {
      throw new Error(`Missing package export map entry for ${check.entrypoint}`);
    }

    for (const target of resolveExportTargets(exportValue, check.wildcardReplacement)) {
      await assertFileExists(join(packageRoot, target), check.entrypoint);
    }
  }
}

try {
  const uiPackage = await readJson(join(root, "packages/ui/package.json"));
  run("bun", ["run", "--cwd", "packages/ui", "build"], { cwd: root });
  run("bun", ["pm", "pack"], { cwd: join(root, "packages/ui") });
  tarball = join(root, "packages/ui", tarballNameForPackage(uiPackage.name, uiPackage.version));

  await writeFile(
    join(fixture, "package.json"),
    JSON.stringify(
      {
        private: true,
        type: "module",
        dependencies: {
          "@mrmeg/expo-ui": tarball,
          "@types/react": "~19.2.14",
          typescript: "~5.9.2",
        },
        devDependencies: {},
      },
      null,
      2
    )
  );
  await writeFile(
    join(fixture, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          skipLibCheck: true,
          noEmit: true,
        },
        include: ["index.tsx"],
      },
      null,
      2
    )
  );
  await writeFile(
    join(fixture, "index.tsx"),
    [
      'import { Button as RootButton, colors as rootColors, useTheme as useRootTheme } from "@mrmeg/expo-ui";',
      'import { Button as ComponentButton, StyledText } from "@mrmeg/expo-ui/components";',
      'import { Button } from "@mrmeg/expo-ui/components/Button";',
      'import { spacing, colors, typography } from "@mrmeg/expo-ui/constants";',
      'import { useTheme, useResources } from "@mrmeg/expo-ui/hooks";',
      'import { globalUIStore, useThemeStore } from "@mrmeg/expo-ui/state";',
      'import { hapticLight } from "@mrmeg/expo-ui/lib";',
      "",
      "const publicSurface = {",
      "  RootButton,",
      "  ComponentButton,",
      "  StyledText,",
      "  rootColors,",
      "  useRootTheme,",
      "  typography,",
      "  globalUIStore,",
      "  useThemeStore,",
      "  hapticLight,",
      "};",
      "",
      "export function Smoke() {",
      "  const { theme } = useTheme();",
      "  const resources = useResources();",
      "  void publicSurface;",
      "  return <Button text={`${spacing.md}-${colors.light.colors.background}-${theme.colors.background}-${resources.loaded}`} />;",
      "}",
      "",
    ].join("\n")
  );
  await writeFile(
    join(fixture, "runtime-check.mjs"),
    [
      "const runtimeSafeEntrypoints = [",
      "  {",
      '    specifier: "@mrmeg/expo-ui/constants",',
      '    validate: (module) => Boolean(module.colors && module.spacing && module.typography),',
      "  },",
      "];",
      "",
      "for (const entrypoint of runtimeSafeEntrypoints) {",
      "  try {",
      "    const imported = await import(entrypoint.specifier);",
      "    if (!entrypoint.validate(imported)) {",
      "      throw new Error('runtime validation failed');",
      "    }",
      "  } catch (error) {",
      "    console.error(`Runtime import failed for ${entrypoint.specifier}`);",
      "    throw error;",
      "  }",
      "}",
      "",
    ].join("\n")
  );

  run("bun", ["install"], { cwd: fixture });
  await assertInstalledExportFiles();
  run("bun", ["x", "tsc", "--noEmit"], { cwd: fixture });
  run("node", ["runtime-check.mjs"], { cwd: fixture });
} finally {
  if (tarball) await rm(tarball, { force: true });
  await rm(fixture, { recursive: true, force: true });
}
