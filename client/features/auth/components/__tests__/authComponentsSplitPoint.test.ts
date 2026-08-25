/**
 * Single-split-point guard for the auth component graph (web bundle layout).
 *
 * Metro hoists any module reachable from two or more async chunks into the
 * eagerly `<script>`-loaded `__common` bundle, so the auth screen + five forms
 * (~57 kB raw) only stay off the first-render download path while *every*
 * consumer reaches them through one dynamic `import()` of one specifier:
 * `@/client/features/auth/components`.
 *
 * Nothing at runtime can catch a regression here — a static import or a second
 * `import()` specifier still renders fine, it just silently moves the graph back
 * into `__common` (and jest can't execute a dynamic import at all, see
 * ../../../app/__tests__/AuthGate.test.tsx). So this test reads the consumer
 * sources instead and asserts the invariant the bundle layout depends on.
 */

import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");
const BARREL_SPECIFIER = "@/client/features/auth/components";
const FEATURE_ROOT_SPECIFIER = "@/client/features/auth";

/** Source trees scanned for a re-introduced feature-root barrel import. */
const SOURCE_TREES = ["app", "client", "server", "shared"];

/** Files that reach the auth component graph and must do so lazily. */
const LAZY_CONSUMERS = [
  "client/features/app/AuthGate.tsx",
  "app/(main)/(demos)/auth-demo.tsx",
  "app/(main)/(demos)/showcase/index.tsx",
];

/**
 * Modules that must stay eagerly imported: they're small, hot, and used by
 * screens that must not pay a chunk fetch to read auth state.
 */
const STATIC_DEPENDENCIES: Record<string, string[]> = {
  "app/(main)/(demos)/auth-demo.tsx": [
    "@/client/features/auth/hooks/useAuth",
    "@/client/features/auth/stores/authStore",
  ],
  "client/features/app/AuthGate.tsx": ["@/client/features/auth/stores/authStore"],
};

const read = (relativePath: string) =>
  fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");

const staticImportSpecifiers = (source: string) =>
  [...source.matchAll(/(?:^|\n)\s*(?:import|export)\b[^;\n]*?from\s+"([^"]+)"/g)].map(
    (match) => match[1],
  );

const dynamicImportSpecifiers = (source: string) =>
  [...source.matchAll(/import\(\s*"([^"]+)"\s*\)/g)].map((match) => match[1]);

const touchesAuthComponents = (specifier: string) =>
  specifier.includes("auth/components") || specifier.endsWith("/components");

function walkSources(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSources(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

describe("auth components split point", () => {
  it("re-exports the whole auth component graph from one barrel", () => {
    const barrel = read("client/features/auth/components/index.ts");

    for (const name of [
      "AuthScreen",
      "AuthWrapper",
      "SignInForm",
      "SignUpForm",
      "VerifyEmailForm",
      "ForgotPasswordForm",
      "ResetPasswordForm",
    ]) {
      expect(barrel).toContain(`export { ${name} } from "./${name}"`);
    }
  });

  it.each(LAZY_CONSUMERS)("%s imports auth components only dynamically", (consumer) => {
    const source = read(consumer);

    expect(staticImportSpecifiers(source).filter(touchesAuthComponents)).toEqual([]);
    expect(dynamicImportSpecifiers(source).filter(touchesAuthComponents).length).toBeGreaterThan(0);
  });

  it.each(LAZY_CONSUMERS)("%s uses the shared barrel specifier for every split point", (consumer) => {
    const specifiers = dynamicImportSpecifiers(read(consumer)).filter(touchesAuthComponents);

    for (const specifier of specifiers) {
      expect(specifier).toBe(BARREL_SPECIFIER);
    }
  });

  it("keeps every consumer pointed at the same specifier", () => {
    const specifiers = new Set(
      LAZY_CONSUMERS.flatMap((consumer) =>
        dynamicImportSpecifiers(read(consumer)).filter(touchesAuthComponents),
      ),
    );

    expect([...specifiers]).toEqual([BARREL_SPECIFIER]);
  });

  /**
   * A feature-root barrel (`client/features/auth/index.ts`) is a footgun here:
   * re-exporting the components from it re-attaches the whole graph to any
   * importer's chunk. It was deleted for that reason — this asserts nothing
   * reaches the feature root by its bare specifier, so it can't come back
   * unnoticed.
   */
  it("has no importers of the feature root barrel", () => {
    const offenders = SOURCE_TREES.flatMap((tree) =>
      walkSources(path.join(REPO_ROOT, tree)).filter((file) => {
        const source = fs.readFileSync(file, "utf-8");
        return [
          ...staticImportSpecifiers(source),
          ...dynamicImportSpecifiers(source),
        ].includes(FEATURE_ROOT_SPECIFIER);
      }).map((file) => path.relative(REPO_ROOT, file)),
    );

    expect(offenders).toEqual([]);
    expect(fs.existsSync(path.join(REPO_ROOT, "client/features/auth/index.ts"))).toBe(false);
  });

  it.each(Object.entries(STATIC_DEPENDENCIES))(
    "%s keeps the auth store/hooks eagerly imported",
    (consumer, expected) => {
      const specifiers = staticImportSpecifiers(read(consumer));

      for (const dependency of expected) {
        expect(specifiers).toContain(dependency);
      }
    },
  );
});
