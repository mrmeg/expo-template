/**
 * Guardrails for the root `package.json` scripts and the build configs that
 * bundle the app.
 *
 * Every production bundle is tree-shaken. `metro.config.js` is the one place that
 * sets `EXPO_UNSTABLE_TREE_SHAKING` and `EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH`, so a
 * build gets them whatever starts it: CI, Railway and EAS see no gitignored `.env`.
 */
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const scripts = (JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts;

const FLAGS = ["EXPO_UNSTABLE_TREE_SHAKING", "EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH"];

describe("tree-shaking flags", () => {
  it("metro.config.js sets both flags before anything else, overridable from the environment", () => {
    const config = read("metro.config.js");
    const firstRequire = config.indexOf("require(");

    for (const flag of FLAGS) {
      const assignment = config.indexOf(`process.env.${flag} ??= "1";`);
      expect([flag, assignment >= 0 && assignment < firstRequire]).toEqual([flag, true]);
    }
  });

  it("nothing else sets them, so one place decides", () => {
    const eas = read("eas.json");
    const workflow = read(".eas/workflows/update-production.yml");
    const env = read(".env.example");

    for (const flag of FLAGS) {
      expect(eas).not.toContain(flag);
      expect(workflow).not.toContain(flag);
      expect(env).not.toContain(flag);
      for (const [name, command] of Object.entries(scripts)) {
        expect([name, command.includes(flag)]).toEqual([name, false]);
      }
    }
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

    expect(generators).toEqual(["ui:icons", "icons", "icons:tabs", "gen:templates", "gen:blocks", "docs:llms"]);
    for (const name of generators) {
      expect(scripts[name]).toBeDefined();
      expect(scripts[`${name}:check`]).toBeDefined();
    }
  });

  it("rejects an unknown argument instead of regenerating", () => {
    expect(() => gen(["--chek"])).toThrow();
  });
});
