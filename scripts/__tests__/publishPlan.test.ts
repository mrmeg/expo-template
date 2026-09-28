/**
 * `scripts/plan-package-publish.mjs`, the plan job of publish-packages.yml:
 * which packages a push to main publishes, and whether a manual run may start.
 *
 * Each case runs the script against a throwaway git repo (two commits: the
 * push's `before` and the checkout) and a local fake registry, reading the
 * matrix from `$GITHUB_OUTPUT` the way the workflow does.
 */
import { execFile, execFileSync } from "child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const root = join(__dirname, "..", "..");
const execFileAsync = promisify(execFile);

/** npm's view of the world: package name -> published versions. Missing name = 404. */
const PUBLISHED: Record<string, string[]> = {
  "@fixture/ui": ["1.0.0"],
  "@fixture/media": ["2.0.0", "2.1.0"],
  "@fixture/purchases": ["0.1.0"],
};

let server: Server;
let registry: string;
let repo: string;
let before: string;
let after: string;
const tempDirs: string[] = [];

function git(args: string[]) {
  return execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], {
    cwd: repo,
    encoding: "utf8",
  }).trim();
}

function writeManifests(versions: Record<string, string>) {
  for (const [key, version] of Object.entries(versions)) {
    mkdirSync(join(repo, "packages", key), { recursive: true });
    writeFileSync(
      join(repo, "packages", key, "package.json"),
      `${JSON.stringify({ name: `@fixture/${key}`, version }, null, 2)}\n`,
    );
  }
}

beforeAll(async () => {
  server = createServer((request, response) => {
    const name = decodeURIComponent(new URL(request.url ?? "/", "http://registry").pathname.slice(1));
    const versions = PUBLISHED[name];
    if (!versions) {
      response.statusCode = 404;
      response.end("{}");
      return;
    }
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ name, versions: Object.fromEntries(versions.map((v) => [v, { dist: {} }])) }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  registry = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;

  repo = mkdtempSync(join(tmpdir(), "publish-plan-repo-"));
  tempDirs.push(repo);
  git(["init", "-q"]);
  writeManifests({ ui: "1.0.0", media: "2.0.0", purchases: "0.1.0", lint: "0.1.0" });
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "before"]);
  before = git(["rev-parse", "HEAD"]);

  // The push: ui bumped to an unpublished version, media to one npm already has,
  // lint to a version of a package npm has never seen; purchases untouched.
  writeManifests({ ui: "1.1.0", media: "2.1.0", lint: "0.2.0" });
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "after"]);
  after = git(["rev-parse", "HEAD"]);
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

interface Plan {
  status: number;
  output: string;
  matrix?: { package: string; name: string; release: string }[];
  count?: string;
  sha?: string;
}

async function plan(args: string[], env: Record<string, string> = {}): Promise<Plan> {
  const outputDir = mkdtempSync(join(tmpdir(), "publish-plan-output-"));
  tempDirs.push(outputDir);
  const outputFile = join(outputDir, "github-output");
  writeFileSync(outputFile, "");

  let status = 0;
  let output: string;
  try {
    const result = await execFileAsync(
      "node",
      [join(root, "scripts/plan-package-publish.mjs"), ...args, "--root", repo, "--registry", registry],
      { cwd: root, env: { ...process.env, GITHUB_OUTPUT: outputFile, HAS_NPM_TOKEN: "", ...env } },
    );
    output = `${result.stdout}${result.stderr}`;
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    status = failure.code ?? 1;
    output = `${failure.stdout ?? ""}${failure.stderr ?? ""}`;
  }

  const outputs = Object.fromEntries(
    readFileSync(outputFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
  return {
    status,
    output,
    matrix: outputs.matrix ? JSON.parse(outputs.matrix) : undefined,
    count: outputs.count,
    sha: outputs.sha,
  };
}

describe("push to main", () => {
  it("publishes only versions that changed in the push and npm does not have", async () => {
    const result = await plan(["--event", "push", "--before", before]);

    expect(result.status).toBe(0);
    expect(result.matrix).toEqual([{ package: "ui", name: "@fixture/ui", release: "1.1.0" }]);
    expect(result.count).toBe("1");
    expect(result.sha).toBe(after);
    expect(result.output).toContain("skip @fixture/media@2.1.0: already on npm");
    expect(result.output).toContain("skip @fixture/purchases@0.1.0: version unchanged in this push");
  });

  it("never makes a first publish, even with NPM_TOKEN set", async () => {
    const result = await plan(["--event", "push", "--before", before], { HAS_NPM_TOKEN: "true" });

    expect(result.matrix?.map((entry) => entry.package)).toEqual(["ui"]);
    expect(result.output).toContain("@fixture/lint is not on npm yet, and a first publish never runs on push");
  });

  it("falls back to npm alone when the before commit is unknown", async () => {
    const result = await plan(["--event", "push", "--before", "0000000000000000000000000000000000000000"]);

    expect(result.status).toBe(0);
    expect(result.matrix).toEqual([{ package: "ui", name: "@fixture/ui", release: "1.1.0" }]);
    expect(result.output).toContain("skip @fixture/purchases@0.1.0: already on npm");
  });

  it("plans nothing when no version changed", async () => {
    const result = await plan(["--event", "push", "--before", after]);

    expect(result.matrix).toEqual([]);
    expect(result.count).toBe("0");
  });
});

describe("manual run", () => {
  it("plans the requested bump of one package", async () => {
    const result = await plan(["--event", "workflow_dispatch", "--package", "media", "--version", "minor"]);

    expect(result.status).toBe(0);
    expect(result.matrix).toEqual([{ package: "media", name: "@fixture/media", release: "minor" }]);
  });

  it("refuses an exact version npm already has", async () => {
    const result = await plan(["--event", "workflow_dispatch", "--package", "media", "--version", "2.1.0"]);

    expect(result.status).toBe(1);
    expect(result.output).toContain("@fixture/media@2.1.0 is already published.");
    expect(result.count).toBeUndefined();
  });

  it("refuses a first publish without NPM_TOKEN, and allows it with one", async () => {
    const refused = await plan(["--event", "workflow_dispatch", "--package", "lint", "--version", "0.2.0"]);
    expect(refused.status).toBe(1);
    expect(refused.output).toContain("@fixture/lint is not on npm yet");
    expect(refused.output).toContain("NPM_TOKEN");

    const allowed = await plan(["--event", "workflow_dispatch", "--package", "lint", "--version", "0.2.0"], {
      HAS_NPM_TOKEN: "true",
    });
    expect(allowed.status).toBe(0);
    expect(allowed.matrix).toEqual([{ package: "lint", name: "@fixture/lint", release: "0.2.0" }]);
  });

  it.each([
    [["--package", "nope", "--version", "patch"], "unknown package \"nope\""],
    [["--package", "ui", "--version", "banana"], "invalid version \"banana\""],
    [["--package", "ui", "--version", "1.2.3; rm -rf /"], "invalid version"],
  ])("rejects %p", async (args, message) => {
    const result = await plan(["--event", "workflow_dispatch", ...args]);

    expect(result.status).toBe(1);
    expect(result.output).toContain(message);
  });
});

it("rejects an unknown event", async () => {
  const result = await plan(["--event", "schedule"]);

  expect(result.status).toBe(1);
  expect(result.output).toContain("--event must be push or workflow_dispatch");
});
