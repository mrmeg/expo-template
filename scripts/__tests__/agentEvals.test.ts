/**
 * The agent eval set (`evals/agents`, run by `scripts/run-agent-evals.mjs`).
 *
 * Nothing here calls a model or installs the fixture. It proves the parts that
 * decide a trial's score are sound: each task's `check.mjs` passes the committed
 * reference solution and fails the deliberately bad one, the runner's matrix and
 * its spend gate behave, and the stream and isolation helpers read what they are
 * meant to. Jest does not load `.mjs`, so each case runs the real file in Node.
 */
import { spawnSync } from "child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

const root = join(__dirname, "..", "..");
const evals = join(root, "evals", "agents");
const tasksDir = join(evals, "tasks");
const runner = join(root, "scripts", "run-agent-evals.mjs");

const taskIds = readdirSync(tasksDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

type Assertion = { id: string; pass: boolean; advisory: boolean; detail: string };
type Verdict = { taskId: string; pass: boolean; files: string[]; assertions: Assertion[] };

function runCheck(taskId: string, kind: "good" | "bad") {
  const result = spawnSync("node", [join(tasksDir, taskId, "check.mjs"), join(tasksDir, taskId, "fixtures", kind)], { encoding: "utf8" });
  const verdict = JSON.parse(result.stdout) as Verdict;
  return { status: result.status, verdict, failed: verdict.assertions.filter((assertion) => !assertion.pass).map((assertion) => assertion.id) };
}

/** Import a module in Node and evaluate `body` with it as `m` and the JSON `input`; return its JSON result. */
function inModule<T>(modulePath: string, body: string, input: unknown = null): T {
  const script = [
    `import * as m from ${JSON.stringify(pathToFileURL(modulePath).href)};`,
    `const input = JSON.parse(process.env.EVAL_INPUT);`,
    `const output = await (async () => { ${body} })();`,
    `console.log(JSON.stringify(output));`,
  ].join("\n");
  const result = spawnSync("node", ["--input-type=module", "-e", script], {
    encoding: "utf8",
    env: { ...process.env, EVAL_INPUT: JSON.stringify(input) },
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout) as T;
}

function runRunner(...args: string[]) {
  return spawnSync("node", [runner, ...args], { encoding: "utf8" });
}

describe("the task set", () => {
  it("has the five tasks, each with a prompt, metadata, a check, and good and bad reference solutions", () => {
    expect(taskIds).toEqual(["contact-form", "photo-upload", "pro-gate", "searchable-list", "settings-screen"]);
    for (const taskId of taskIds) {
      for (const file of ["prompt.md", "task.json", "check.mjs", "fixtures/good", "fixtures/bad"]) {
        expect(existsSync(join(tasksDir, taskId, file))).toBe(true);
      }
    }
  });

  it("writes prompts as a user would, never naming a component, hook or export", () => {
    const componentDocs = readdirSync(join(root, "packages", "ui", "docs", "components"))
      .filter((file) => file.endsWith(".md") && file !== "index.md")
      .map((file) => file.replace(/\.md$/, ""));
    const exportsNamed = [
      ...componentDocs,
      "ItemGroup",
      "AlertDialog",
      "notify",
      "PaywallGate",
      "PurchasesProvider",
      "useEntitlement",
      "useRequireEntitlement",
      "useMediaPicker",
      "useUploadQueue",
      "createMediaClient",
      "MediaGrid",
      "MediaTile",
      "UploadQueue",
      "useTheme",
    ];
    for (const taskId of taskIds) {
      const prompt = readFileSync(join(tasksDir, taskId, "prompt.md"), "utf8");
      const named = exportsNamed.filter((name) => new RegExp(`\\b${name}\\b`).test(prompt));
      expect({ taskId, named }).toEqual({ taskId, named: [] });
    }
  });
});

describe.each(taskIds)("check.mjs for %s", (taskId) => {
  it("passes the reference solution", () => {
    const { status, verdict, failed } = runCheck(taskId, "good");
    // `screen-root` is advisory: the docs disagree on whether a screen's root is Screen.
    expect(failed.filter((id) => !verdict.assertions.find((assertion) => assertion.id === id)?.advisory)).toEqual([]);
    expect(verdict.pass).toBe(true);
    expect(status).toBe(0);
  });

  it("fails the bad solution: raw Text, a Lucide import, a Card around a section", () => {
    const { status, verdict, failed } = runCheck(taskId, "bad");
    expect(verdict.pass).toBe(false);
    expect(status).toBe(1);
    expect(failed).toEqual(expect.arrayContaining(["no-raw-primitives", "no-icon-libraries", "no-card-around-sections"]));
    // And a task-specific assertion fails too, not only the shared ones.
    const shared = new Set(["no-dist-imports", "no-icon-libraries", "no-raw-primitives", "no-card-around-sections", "no-hand-rolled-overlays"]);
    expect(failed.filter((id) => !shared.has(id) && id !== "screen-root").length).toBeGreaterThan(0);
  });
});

describe("check.mjs helpers", () => {
  it("only reads the files named by --changed", () => {
    const task = "settings-screen";
    const scratch = mkdtempSync(join(tmpdir(), "agent-evals-test-"));
    try {
      const changed = join(scratch, "changed.json");
      writeFileSync(changed, "[]");
      const result = spawnSync(
        "node",
        [join(tasksDir, task, "check.mjs"), join(tasksDir, task, "fixtures", "good"), "--changed", changed],
        { encoding: "utf8" },
      );
      const verdict = JSON.parse(result.stdout) as Verdict;
      expect(verdict.files).toEqual([]);
      expect(verdict.pass).toBe(false);
      expect(verdict.assertions.find((assertion) => assertion.id === "route-exists")?.pass).toBe(false);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});

describe("check.mjs judgement calls", () => {
  const settings = join(tasksDir, "settings-screen");

  /** Run settings-screen's check against an app holding only `app/settings.tsx` with this source. */
  function checkSource(source: string): Verdict {
    const scratch = mkdtempSync(join(tmpdir(), "agent-evals-test-"));
    try {
      mkdirSync(join(scratch, "app"));
      writeFileSync(join(scratch, "app", "settings.tsx"), source);
      return JSON.parse(spawnSync("node", [join(settings, "check.mjs"), scratch], { encoding: "utf8" }).stdout) as Verdict;
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
  const good = readFileSync(join(settings, "fixtures", "good", "app", "settings.tsx"), "utf8");
  const outcome = (verdict: Verdict, id: string) => verdict.assertions.find((assertion) => assertion.id === id);

  it("counts a function passed by name as wired up, not only one that is called", () => {
    const passedByName = good.replace("onPress={() => void signOut()}", "onPress={signOut}");
    expect(passedByName).not.toBe(good);
    expect(outcome(checkSource(passedByName), "sign-out-wired")?.pass).toBe(true);
  });

  it("does not count a function that is imported and never used", () => {
    const unused = good.replace("onPress={() => void signOut()}", "");
    expect(outcome(checkSource(unused), "sign-out-wired")?.pass).toBe(false);
  });

  it("reports a raw Pressable as advisory, since the package's own lint leaves Pressable available", () => {
    const withPressable = `import { Pressable } from "react-native";\n${good}`;
    const verdict = checkSource(withPressable);
    expect(outcome(verdict, "no-raw-pressable")).toEqual(expect.objectContaining({ pass: false, advisory: true }));
    expect(verdict.pass).toBe(true);
  });

  it("fails a raw Text, which the package wraps as StyledText", () => {
    const verdict = checkSource(`import { Text } from "react-native";\n${good}`);
    expect(outcome(verdict, "no-raw-primitives")?.pass).toBe(false);
    expect(verdict.pass).toBe(false);
  });
});

describe("the runner", () => {
  it("--dry-run lists 5 tasks x 3 variants x 3 trials with the spend estimate and runs nothing", () => {
    const result = runRunner("--dry-run");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Matrix: 5 tasks x 3 variants x 3 trials = 45 trials");
    expect(result.stdout).toContain("Estimated maximum spend: 45 x $2.00 = $90.00");
    for (const variant of ["A  none", "B  pointer", "C  inline-index"]) expect(result.stdout).toContain(variant);
  });

  it("honors --tasks, --variants, --trials and --max-budget-usd in the plan", () => {
    const result = runRunner("--dry-run", "--tasks", "1,pro-gate", "--variants", "c", "--trials", "2", "--max-budget-usd", "0.5");
    expect(result.stdout).toContain("Matrix: 2 tasks x 1 variants x 2 trials = 4 trials");
    expect(result.stdout).toContain("4 x $0.50 = $2.00");
  });

  it("refuses more than one real trial without --yes, printing the worst-case spend", () => {
    const result = runRunner("--tasks", "1", "--trials", "2");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Worst-case spend: 6 x $2.00 = $12.00");
    expect(result.stderr).toContain("--yes");
  });

  it("rejects an unknown task, variant or flag", () => {
    expect(runRunner("--dry-run", "--tasks", "nope").stderr).toContain("Unknown task nope");
    expect(runRunner("--dry-run", "--variants", "Z").stderr).toContain("Unknown variant z");
    expect(runRunner("--bogus").stderr).toContain('unknown argument "--bogus"');
  });

  it("builds the variant list from the variants directory", () => {
    const variants = inModule<{ id: string; name: string }[]>(
      join(evals, "lib", "catalog.mjs"),
      "return (await m.loadVariants()).map(({ id, name }) => ({ id, name }));",
    );
    expect(variants).toEqual([
      { id: "A", name: "none" },
      { id: "B", name: "pointer" },
      { id: "C", name: "inline-index" },
    ]);
  });
});

describe("the agent run", () => {
  const agent = join(evals, "lib", "agent.mjs");

  it("gives the child an allowlisted environment, none of the parent session's CLAUDE_CODE_* variables", () => {
    const env = inModule<Record<string, string>>(
      agent,
      "return m.childEnvironment(input);",
      {
        PATH: "/bin",
        HOME: "/home/x",
        CLAUDECODE: "1",
        CLAUDE_CODE_SESSION_ID: "abc",
        CLAUDE_CODE_MESSAGING_SOCKET: "/tmp/s",
        CLAUDE_CODE_ENTRYPOINT: "cli",
        SECRET_THING: "nope",
        ANTHROPIC_API_KEY: "kept-for-billing-path",
        CLAUDE_CONFIG_DIR: "/home/x/.claude",
      },
    );
    expect(env.PATH).toBe("/bin");
    expect(env.CLAUDE_CONFIG_DIR).toBe("/home/x/.claude");
    expect(env.ANTHROPIC_API_KEY).toBe("kept-for-billing-path");
    for (const name of ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_MESSAGING_SOCKET", "CLAUDE_CODE_ENTRYPOINT", "SECRET_THING"]) {
      expect(env).not.toHaveProperty(name);
    }
    expect(env.CLAUDE_CODE_DISABLE_AUTO_MEMORY).toBe("1");
    expect(env.ENABLE_CLAUDEAI_MCP_SERVERS).toBe("false");
  });

  it("passes the isolation flags with the prompt first", () => {
    const args = inModule<string[]>(agent, "return m.claudeArgs(input);", { prompt: "do it", model: "sonnet", maxBudgetUsd: 1.5 });
    expect(args.slice(0, 2)).toEqual(["-p", "do it"]);
    for (const flag of ["--strict-mcp-config", "--disable-slash-commands", "--no-session-persistence", "--verbose"]) {
      expect(args).toContain(flag);
    }
    expect(args[args.indexOf("--setting-sources") + 1]).toBe("project");
    expect(args[args.indexOf("--max-budget-usd") + 1]).toBe("1.5");
    expect(args[args.indexOf("--permission-prompts") + 1]).toBe("none");
    expect(args[args.indexOf("--output-format") + 1]).toBe("stream-json");
    expect(args).not.toContain("--dangerously-skip-permissions");
    expect(args[args.indexOf("--permission-mode") + 1]).not.toBe("bypassPermissions");
  });

  it("reads turns, cost, duration and package doc reads out of a stream-json log", () => {
    const lines = [
      { type: "system", subtype: "init", model: "m", claude_code_version: "9.9.9", tools: ["Read"], mcp_servers: [] },
      {
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "Reading the guide." },
            { type: "tool_use", name: "Read", input: { file_path: "/tmp/x/node_modules/@mrmeg/expo-ui/LLM_USAGE.md" } },
            { type: "tool_use", name: "Read", input: { file_path: "/tmp/x/node_modules/@mrmeg/expo-ui/dist/index.d.ts" } },
            { type: "tool_use", name: "Bash", input: { command: "cat node_modules/@mrmeg/expo-media/llms.txt | head" } },
            { type: "tool_use", name: "Read", input: { file_path: "/tmp/x/app/index.tsx" } },
          ],
        },
      },
      { type: "result", subtype: "success", is_error: false, num_turns: 4, total_cost_usd: 0.1234, duration_ms: 5678 },
    ].map((event) => JSON.stringify(event));
    const out = inModule<{ summary: Record<string, unknown>; docs: { opened: boolean; docs: string[]; packageFiles: number } }>(
      agent,
      "const parsed = m.parseStream(input); return { summary: m.agentSummary(parsed), docs: m.packageDocAccess(parsed.toolUses) };",
      lines,
    );
    expect(out.summary).toEqual({
      numTurns: 4,
      totalCostUsd: 0.1234,
      durationMs: 5678,
      isError: false,
      subtype: "success",
      model: "m",
      claudeCodeVersion: "9.9.9",
    });
    expect(out.docs.opened).toBe(true);
    expect(out.docs.docs).toEqual(["node_modules/@mrmeg/expo-media/llms.txt", "node_modules/@mrmeg/expo-ui/LLM_USAGE.md"]);
    expect(out.docs.packageFiles).toBe(1);
  });

  it("reports a run with no result event as an error", () => {
    const summary = inModule<{ isError: boolean; subtype: string }>(agent, "return m.agentSummary(m.parseStream(input));", ["not json"]);
    expect(summary).toEqual(expect.objectContaining({ isError: true, subtype: "no-result" }));
  });
});

describe("the isolation probe", () => {
  const probe = join(evals, "lib", "probe.mjs");
  const stream = (answer: unknown, init: Record<string, unknown> = {}) => ({
    init: { model: "m", tools: ["Read"], mcp_servers: [], skills: [], plugins: [], slash_commands: [], ...init },
    text: JSON.stringify(answer),
  });
  const clean = { instruction_sources: [{ path: "AGENTS.md", first_line: "# Eval App" }], skills: [], mcp_servers: [], canary: "eval-canary-7f3a91" };

  const builtin = [
    { name: "cc-plugin-agents-md", path: "builtin", source: "cc-plugin-agents-md@builtin" },
    { name: "cc-plugin-telemetry", path: "builtin", source: "cc-plugin-telemetry@builtin" },
  ];

  it("passes a context with only the fixture's instructions, built-in plugins aside", () => {
    expect(inModule<{ pass: boolean }>(probe, "return m.judgeProbe(input);", stream(clean, { plugins: builtin })).pass).toBe(true);
  });

  it("fails on a user-level CLAUDE.md, an MCP server, a skill, or missing fixture instructions", () => {
    const judge = (parsed: unknown) => inModule<{ pass: boolean }>(probe, "return m.judgeProbe(input);", parsed).pass;
    const leaked = { ...clean, instruction_sources: [...clean.instruction_sources, { path: "~/.claude/CLAUDE.md", first_line: "# Global Agent Guidance" }] };
    expect(judge(stream(leaked))).toBe(false);
    expect(judge(stream(clean, { mcp_servers: [{ name: "figma", status: "connected" }] }))).toBe(false);
    expect(judge(stream(clean, { tools: ["Read", "mcp__figma__get_design_context"] }))).toBe(false);
    expect(judge(stream({ ...clean, skills: ["write-spec"] }))).toBe(false);
    expect(judge(stream(clean, { plugins: [{ name: "cloudflare", path: "/home/x/.claude/plugins/cloudflare", source: "cloudflare@marketplace" }] }))).toBe(false);
    expect(judge(stream({ ...clean, canary: null }))).toBe(false);
  });
});

describe("the fixture", () => {
  it("states stack and commands only, in one paragraph, with no component guidance", () => {
    const base = readFileSync(join(evals, "fixture", "AGENTS.base.md"), "utf8");
    const paragraphs = base.split("\n\n").filter((part) => !part.startsWith("#"));
    expect(paragraphs).toHaveLength(1);
    expect(base).not.toMatch(/@mrmeg|LLM_USAGE|ItemGroup|Screen/);
  });

  it("wires the root layout the way LLM_USAGE.md's Required App Setup does", () => {
    const layout = readFileSync(join(evals, "fixture", "app", "_layout.tsx"), "utf8");
    for (const required of ["useResources", "KeyboardProvider", "UIProvider", "registerIcons"]) expect(layout).toContain(required);
    const usage = readFileSync(join(root, "packages", "ui", "LLM_USAGE.md"), "utf8");
    for (const required of ["useResources", "KeyboardProvider", "UIProvider"]) expect(usage).toContain(required);
  });
});
