/**
 * Guardrails for the root `package.json` scripts and the build configs that
 * bundle the app.
 *
 * Every production bundle is tree-shaken. A build only gets
 * `EXPO_UNSTABLE_TREE_SHAKING` and `EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH` if the
 * script or profile that starts it sets them: `.env` is gitignored, so CI and
 * EAS never see its copy.
 */
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const scripts = (JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts;

const FLAGS = ["EXPO_UNSTABLE_TREE_SHAKING", "EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH"];

describe("tree-shaking flags", () => {
  const bundling = Object.entries(scripts).filter(([, command]) => /\b(expo export|eas update)\b/.test(command));

  it("finds the bundling scripts", () => {
    expect(bundling.map(([name]) => name)).toEqual(expect.arrayContaining(["build", "build-web"]));
  });

  it.each(bundling)("%s sets both flags", (_name, command) => {
    for (const flag of FLAGS) expect(command).toContain(`${flag}=1 `);
  });

  it("every eas.json build profile sets both flags", () => {
    const profiles = (JSON.parse(read("eas.json")) as { build: Record<string, { env?: Record<string, string> }> })
      .build;

    expect(Object.keys(profiles).length).toBeGreaterThan(0);
    for (const [name, profile] of Object.entries(profiles)) {
      for (const flag of FLAGS) expect([name, flag, profile.env?.[flag]]).toEqual([name, flag, "1"]);
    }
  });

  it("the EAS Update workflow job sets both flags", () => {
    const workflow = read(".eas/workflows/update-production.yml");

    for (const flag of FLAGS) expect(workflow).toContain(`${flag}: "1"`);
  });

  it(".env.example keeps both flags for local exports", () => {
    const env = read(".env.example");

    for (const flag of FLAGS) expect(env).toMatch(new RegExp(`^${flag}=1$`, "m"));
  });
});

describe("script runners", () => {
  it("runs TypeScript scripts with bun, not an unpinned npx tsx", () => {
    const typescript = Object.entries(scripts).filter(([, command]) => /\.ts\b/.test(command));

    expect(typescript.length).toBeGreaterThanOrEqual(7);
    for (const [name, command] of Object.entries(scripts)) {
      expect([name, /(^|&&\s*|\b(npx|bunx|bun x)\s+)tsx\s/.test(command)]).toEqual([name, false]);
    }
    for (const [name, command] of typescript) {
      expect([name, command]).toEqual([name, expect.stringMatching(/^bun (\.\/)?[\w./-]+\.ts\b/)]);
    }
  });

  it("drops the scripts that duplicated others", () => {
    // build-sourcemap was `bun run build-web`; start-local was `start` with the
    // `.env` Bun already loads.
    expect(scripts["build-sourcemap"]).toBeUndefined();
    expect(scripts["start-local"]).toBeUndefined();
    expect(scripts.start).toBe("bun ./server.bun.ts");
  });
});

describe("bun run gen", () => {
  const gen = (args: string[]) =>
    execFileSync("node", ["scripts/gen.mjs", ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

  it("is a root script", () => {
    expect(scripts.gen).toBe("node scripts/gen.mjs");
  });

  it("runs every generator, each of which has its own script and :check script", () => {
    const generators = gen(["--list"])
      .trim()
      .split("\n")
      .map((line) => line.split("\t")[0]);

    expect(generators).toEqual(["ui:icons", "gen:templates", "gen:blocks", "docs:llms"]);
    for (const name of generators) {
      expect(scripts[name]).toBeDefined();
      expect(scripts[`${name}:check`]).toBeDefined();
    }
  });

  it("rejects an unknown argument instead of regenerating", () => {
    expect(() => gen(["--chek"])).toThrow();
  });
});
