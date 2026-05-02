import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

try {
  run("bun", ["run", "--cwd", "packages/ui", "build"], { cwd: root });
  run("bun", ["pm", "pack"], { cwd: join(root, "packages/ui") });

  const tarball = join(root, "packages/ui/mrmeg-expo-ui-0.1.0.tgz");
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
      'import { Button } from "@mrmeg/expo-ui/components/Button";',
      'import { spacing, colors } from "@mrmeg/expo-ui/constants";',
      'import { useTheme, useResources } from "@mrmeg/expo-ui/hooks";',
      "",
      "export function Smoke() {",
      "  const { theme } = useTheme();",
      "  const resources = useResources();",
      "  return <Button text={`${spacing.md}-${colors.light.colors.background}-${theme.colors.background}-${resources.loaded}`} />;",
      "}",
      "",
    ].join("\n")
  );

  run("bun", ["install"], { cwd: fixture });
  run("bun", ["x", "tsc", "--noEmit"], { cwd: fixture });
} finally {
  await rm(join(root, "packages/ui/mrmeg-expo-ui-0.1.0.tgz"), { force: true });
  await rm(fixture, { recursive: true, force: true });
}
