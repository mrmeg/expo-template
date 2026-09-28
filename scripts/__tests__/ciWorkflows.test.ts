/**
 * Guardrails for `.github/workflows/`: which events run CI, where Bun's version
 * comes from, and the shape of the one publish workflow.
 *
 * Plain text checks, like the other workflow tests: the files are small and the
 * properties pinned here are line-level.
 */
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const workflowFiles = readdirSync(join(root, ".github/workflows")).filter((name) => /\.ya?ml$/.test(name));

/** The lines of a block that starts at `^<indent><key>:` and ends at the next line indented as little. */
function block(text: string, key: string, indent = ""): string {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line === `${indent}${key}:` || line.startsWith(`${indent}${key}: `));
  if (start === -1) return "";
  const end = lines.findIndex(
    (line, index) => index > start && line.trim() !== "" && !line.startsWith(`${indent} `) && !line.startsWith("#"),
  );
  return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

describe("Bun is pinned in one place", () => {
  it(".bun-version holds one exact version", () => {
    expect(read(".bun-version").trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it.each(workflowFiles)("%s reads it in every setup-bun step", (file) => {
    const text = read(`.github/workflows/${file}`);
    const setups = text.split("uses: oven-sh/setup-bun@").slice(1);

    for (const setup of setups) {
      const withBlock = setup.split("\n").slice(0, 4).join("\n");
      expect(withBlock).toContain("bun-version-file: .bun-version");
    }
    expect(text).not.toMatch(/bun-version:\s/);
  });

  it("package.json does not pin a second version", () => {
    expect(JSON.parse(read("package.json")).packageManager).toBeUndefined();
  });
});

describe.each(["ci.yml", "package-compatibility.yml"])("%s triggers", (file) => {
  const on = block(read(`.github/workflows/${file}`), "on");

  it("runs on every pull request, whatever its base", () => {
    const pullRequest = block(on, "pull_request", "  ");

    expect(pullRequest).not.toBe("");
    expect(pullRequest).not.toContain("branches");
  });

  it("runs on pushes to main and dev", () => {
    expect(block(on, "push", "  ")).toMatch(/branches: \[main, dev\]/);
  });
});

it("package-compatibility.yml filters pull requests and pushes by the same paths", () => {
  const on = block(read(".github/workflows/package-compatibility.yml"), "on");
  const paths = (event: string) => block(block(on, event, "  "), "paths", "    ");

  expect(paths("pull_request")).not.toBe("");
  expect(paths("pull_request")).toBe(paths("push"));
});

describe("publishing", () => {
  const publish = read(".github/workflows/publish-packages.yml");
  const stepIndex = (name: string) => publish.indexOf(`- name: ${name}`);

  it("is one workflow for every package", () => {
    expect(workflowFiles.filter((file) => file.startsWith("publish"))).toEqual(["publish-packages.yml"]);
    expect(publish).toContain("scripts/plan-package-publish.mjs");
    expect(publish).toContain("include: ${{ fromJSON(needs.plan.outputs.matrix) }}");
    expect(existsSync(join(root, "scripts/plan-package-publish.mjs"))).toBe(true);
  });

  it("publishes on pushes to main that change a package manifest, and on manual runs", () => {
    const on = block(publish, "on");

    expect(block(on, "push", "  ")).toContain("- \"packages/*/package.json\"");
    expect(block(on, "push", "  ")).toMatch(/branches:\n\s+- main\n/);
    expect(block(on, "workflow_dispatch", "  ")).toMatch(/package:[\s\S]*version:[\s\S]*ref:/);
  });

  it("packs once, smokes that tarball, and publishes the same tarball with provenance", () => {
    expect(publish).toMatch(/node scripts\/release-package\.mjs .* --pack-destination /);
    expect(publish).toContain("TARBALL: ${{ steps.release.outputs.tarball }}");
    expect(publish.match(/npm publish/g)).toHaveLength(1);
    expect(publish).toContain("npm publish \"${TARBALL}\" --provenance --access public");
    expect(read("scripts/release-package.mjs")).toContain("\"consumer-smoke\", \"--tarball\", tarball");
  });

  it("commits a bump before publishing, and tags after", () => {
    const order = ["Gates, pack, and consumer smoke", "Commit version bump", "Publish ${{", "Tag ${{"].map(stepIndex);

    expect(order.every((index) => index > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(publish).toContain("git push origin \"refs/tags/${TAG}\"");
  });

  it("keeps trusted publishing with the NPM_TOKEN fallback", () => {
    expect(publish).toContain("id-token: write");
    expect(publish).toContain("NPM_PUBLISH_TOKEN: ${{ secrets.NPM_TOKEN }}");
    expect(publish).toContain("unset NODE_AUTH_TOKEN");
    expect(publish).toContain("HAS_NPM_TOKEN: ${{ secrets.NPM_TOKEN != '' }}");
  });

  it("passes dispatch inputs through env, never straight into a shell line", () => {
    for (const line of publish.split("\n").filter((text) => /^\s+(run: |node |if |git |npm )/.test(text))) {
      expect(line).not.toMatch(/\$\{\{\s*(inputs|matrix|steps)\./);
    }
  });
});
