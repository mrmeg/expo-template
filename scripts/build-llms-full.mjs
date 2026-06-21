import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fullOutputPath = join(root, "llms-full.txt");
const examplesOutputPath = join(root, "llms-examples.txt");
const repoUrl = "https://github.com/mrmeg/expo-template";
const rawBase = "https://raw.githubusercontent.com/mrmeg/expo-template/main";

const sources = [
  {
    path: "docs/template-modernization-guide.md",
    title: "Template Modernization Guide",
    summary:
      "repo map, component selection, screen templates, feature patterns, migration order, anti-patterns",
  },
  {
    path: "docs/migration-guide.md",
    title: "External App Migration Guide",
    summary:
      "self-contained guide for migrating an existing Expo app to this template's baseline: tier self-assessment, SSR config, loaders, ui package, screen templates, verification gates",
  },
  {
    path: "packages/ui/LLM_USAGE.md",
    title: "@mrmeg/expo-ui Usage",
    summary:
      "import paths, required app setup, theme rules, component use-case index, examples",
  },
  {
    path: "packages/media/README.md",
    title: "@mrmeg/expo-media Reference",
    summary:
      "media contracts, client hooks, server handlers, processing presets",
  },
  {
    path: "docs/server-guide.md",
    title: "Expo Server Guide",
    summary:
      "server output config, API routes, data loaders, middleware, server entries, replication checklist",
  },
  {
    path: "docs/ssr-hydration.md",
    title: "Web SSR Hydration Constraints",
    summary: "first-render rules for the server-rendered web build",
  },
];

// Directories walked (recursively, skipping tests) into the examples index.
const exampleDirs = [
  {
    dir: "app/(main)/(demos)",
    title: "Demo Routes",
    note: "Working in-app examples for every component and screen template; the best reference for real composition.",
  },
  {
    dir: "client/templates",
    title: "Screen Templates",
    note: "Self-contained template folders: Screen.tsx is the reusable, props-driven component (pass data/callbacks from a feature folder; no domain logic), demo.tsx is a worked example with sample data, meta.ts is registry metadata.",
  },
  {
    dir: "packages/ui/src/components",
    title: "UI Component Source",
    note: "Source of every @mrmeg/expo-ui component. Consumers import from the npm package, not these paths.",
  },
  {
    dir: "client/lib/form",
    title: "Form Wrappers",
    note: "react-hook-form + zod wrappers used by form screens and demos.",
  },
];

// Individual files for the server stack section of the examples index.
const serverFiles = [
  "app.config.ts",
  "server.bun.ts",
  "server/index.ts",
  "server/rateLimits.js",
  "app/+middleware.ts",
  "client/features/server-alpha/loaders.ts",
  "client/features/server-alpha/ServerAlphaDemoScreen.tsx",
  "client/features/server-alpha/ServerAlphaExampleScreen.tsx",
  "app/api/template/status+api.ts",
  "app/api/template/examples+api.ts",
  "app/api/template/echo+api.ts",
  "server/api/shared/cors.ts",
  "server/api/shared/errors.ts",
  "server/api/shared/auth.ts",
  "client/showcase/registry.ts",
];

const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

function rawUrl(path) {
  return `${rawBase}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function listCodeFiles(relativeDir) {
  const entries = await readdir(join(root, relativeDir), { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = `${relativeDir}/${entry.name}`;
      if (entry.isDirectory()) {
        return entry.name === "__tests__" ? [] : listCodeFiles(relativePath);
      }
      return codeExtensions.has(entry.name.slice(entry.name.lastIndexOf("."))) ? [relativePath] : [];
    })
  );
  return files.flat().sort();
}

async function buildExamples() {
  const sections = await Promise.all(
    exampleDirs.map(async ({ dir, title, note }) => {
      const files = await listCodeFiles(dir);
      const lines = files.map((file) => `- ${file}: ${rawUrl(file)}`);
      return `## ${title} (\`${dir}/\`)\n\n${note}\n\n${lines.join("\n")}`;
    })
  );

  const serverLines = serverFiles.map((file) => `- ${file}: ${rawUrl(file)}`);
  sections.push(
    `## Server Stack\n\nKey files for replicating server output, API routes, loaders, and middleware. Read \`docs/server-guide.md\` first.\n\n${serverLines.join("\n")}`
  );

  return `# Expo Template — Examples Index

<!-- GENERATED FILE - do not edit. Rebuild with \`bun run docs:llms\`. -->

Fetchable raw URLs for this template's example and source files
(${repoUrl}). Fetch a demo route to see components composed in a real screen,
then the matching screen template or component source for implementation
detail. Screen templates live in self-contained folders under
\`client/templates/<name>/\` (\`Screen.tsx\` + \`demo.tsx\` + \`meta.ts\`); the
\`app/(main)/(demos)/screen-<name>.tsx\` route re-exports the demo.

${sections.join("\n\n")}
`;
}

function buildPreamble(allSections) {
  const sectionList = allSections
    .map((source, index) => `${index + 1}. ${source.title} — ${source.summary}`)
    .join("\n");

  return `# Expo Template — LLM Reference Bundle

<!-- GENERATED FILE - do not edit. Rebuild with \`bun run docs:llms\`. -->
<!-- Link index version: ${rawBase}/llms.txt -->

This file concatenates every LLM-facing doc from ${repoUrl} so one fetch
teaches an agent to apply the template's components and best practices in
another project.

Two ways to consume this repo:

1. Published packages: run \`bun add @mrmeg/expo-ui\` (and optionally
   \`@mrmeg/expo-media\`), then follow the "@mrmeg/expo-ui Usage" section
   below. The same guide ships in the npm tarball at
   \`node_modules/@mrmeg/expo-ui/LLM_USAGE.md\`.
2. Pattern reference: follow the "Template Modernization Guide" and "Expo
   Server Guide" sections below; fetch concrete example files through the
   "Examples Index" section, or clone ${repoUrl}.git for bulk access.

Sections, in order:

${sectionList}`;
}

async function build() {
  const examplesContent = await buildExamples();

  const allSections = [
    ...sources,
    {
      path: "llms-examples.txt",
      title: "Examples Index",
      summary:
        "fetchable raw URLs for demo routes, screen templates, component source, form wrappers, server stack",
      content: examplesContent,
    },
  ];

  const bodies = await Promise.all(
    allSections.map(async ({ path, content }) => {
      const body = (content ?? (await readFile(join(root, path), "utf8"))).trim();
      return ["---", "", `<!-- Source: ${path} -->`, `<!-- Raw: ${rawUrl(path)} -->`, "", body].join(
        "\n"
      );
    })
  );

  return {
    examplesContent,
    fullContent: `${[buildPreamble(allSections), ...bodies].join("\n\n")}\n`,
  };
}

const checkMode = process.argv.includes("--check");
const { examplesContent, fullContent } = await build();
const outputs = [
  { path: examplesOutputPath, name: "llms-examples.txt", content: examplesContent },
  { path: fullOutputPath, name: "llms-full.txt", content: fullContent },
];

if (checkMode) {
  const stale = [];
  for (const output of outputs) {
    let existing = null;
    try {
      existing = await readFile(output.path, "utf8");
    } catch {
      // Missing output file counts as stale.
    }
    if (existing !== output.content) {
      stale.push(output.name);
    }
  }

  if (stale.length > 0) {
    console.error(
      `${stale.join(" and ")} ${stale.length > 1 ? "are" : "is"} stale. Run \`bun run docs:llms\` and commit the result.`
    );
    process.exit(1);
  }

  console.log("llms-examples.txt and llms-full.txt are up to date.");
} else {
  for (const output of outputs) {
    await writeFile(output.path, output.content);
  }
  console.log(
    `Wrote llms-examples.txt and llms-full.txt from ${sources.length} source docs and ${exampleDirs.length + 1} example sections.`
  );
}
