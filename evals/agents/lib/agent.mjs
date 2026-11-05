/**
 * Runs `claude -p` as the agent under test, isolated from the machine's own
 * configuration, and reads what it did out of the `stream-json` log.
 *
 * Isolation, all of it by flag or environment so no credential is copied:
 *  - `--setting-sources project` skips the user's settings (hooks, plugins,
 *    permissions, `enabledPlugins`); the fixture's own settings are the only ones.
 *  - `--strict-mcp-config` with no `--mcp-config` loads no MCP server from a file;
 *    `ENABLE_CLAUDEAI_MCP_SERVERS=false` drops the account's connectors.
 *  - `--disable-slash-commands` drops skills and commands.
 *  - `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` stops the agent reading or writing the
 *    per-project memory under the user's config directory.
 *  - The child's environment is an allowlist, so the parent session's own
 *    `CLAUDE_CODE_*` variables (message sockets, session ids) never leak in.
 *  - `--tools` limits the agent to file tools and Bash (no web, no subagents),
 *    and `--allowedTools` limits Bash to the type-checker, the lint, and the
 *    icon CLI; `--permission-prompts none` denies anything else.
 * `evals/agents/README.md` states what the probe (`--probe`) verifies.
 */
import { createWriteStream } from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";

export const CLAUDE_BIN = process.env.AGENT_EVALS_CLAUDE_BIN || "claude";

const TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash"];
const ALLOWED_TOOLS = [
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "Bash(bunx tsc *)",
  "Bash(bun x tsc *)",
  "Bash(bunx expo-ui-lint *)",
  "Bash(bun x expo-ui-lint *)",
  "Bash(bunx expo-ui-icons *)",
  "Bash(bun x expo-ui-icons *)",
];

/** Environment names the child keeps. Everything else, the parent session's `CLAUDE_CODE_*` included, is dropped. */
const ENV_ALLOWLIST = new Set(["PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "TERM", "TMPDIR", "CLAUDE_CONFIG_DIR"]);
/** Prefixes kept so a user on an API key or a cloud provider keeps their billing path. */
const ENV_ALLOW_PREFIXES = ["LC_", "ANTHROPIC_", "CLAUDE_CODE_USE_"];
const ENV_ALLOW_EXTRA = new Set(["CLAUDE_CODE_OAUTH_TOKEN"]);

/** The environment for the child `claude`: an allowlist plus the isolation switches. */
export function childEnvironment(source = process.env) {
  const env = {};
  for (const [name, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (ENV_ALLOWLIST.has(name) || ENV_ALLOW_EXTRA.has(name) || ENV_ALLOW_PREFIXES.some((prefix) => name.startsWith(prefix))) {
      env[name] = value;
    }
  }
  env.CLAUDE_CODE_DISABLE_AUTO_MEMORY = "1";
  env.ENABLE_CLAUDEAI_MCP_SERVERS = "false";
  env.DISABLE_AUTOUPDATER = "1";
  return env;
}

/** The arguments of one headless run. The prompt comes first: the tool lists are variadic. */
export function claudeArgs({ prompt, model, maxBudgetUsd }) {
  return [
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    model,
    "--max-budget-usd",
    String(maxBudgetUsd),
    "--permission-mode",
    "acceptEdits",
    "--permission-prompts",
    "none",
    "--tools",
    TOOLS.join(","),
    "--allowedTools",
    ALLOWED_TOOLS.join(","),
    "--setting-sources",
    "project",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--no-session-persistence",
    "--exclude-dynamic-system-prompt-sections",
  ];
}

/**
 * Run the agent in `cwd` and stream its output to `logPath`.
 *
 * @param {{ cwd: string, prompt: string, model: string, maxBudgetUsd: number, logPath: string, timeoutMs?: number }} options
 * @returns {Promise<{ lines: string[], exitCode: number | null, signal: string | null, stderr: string, timedOut: boolean }>}
 */
export async function runAgent({ cwd, prompt, model, maxBudgetUsd, logPath, timeoutMs = 20 * 60_000 }) {
  const log = createWriteStream(logPath);
  const child = spawn(CLAUDE_BIN, claudeArgs({ prompt, model, maxBudgetUsd }), {
    cwd,
    env: childEnvironment(),
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    log.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL");
  }, timeoutMs);

  const [exitCode, signal] = await once(child, "close");
  clearTimeout(timer);
  log.end();
  return { lines: stdout.split("\n").filter((line) => line.trim()), exitCode, signal, stderr, timedOut };
}

/** Parse the lines of a `stream-json` log; a line that is not JSON is skipped. */
export function parseStream(lines) {
  const events = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch {
      // Not an event.
    }
  }

  const init = events.find((event) => event.type === "system" && event.subtype === "init") ?? null;
  const result = [...events].reverse().find((event) => event.type === "result") ?? null;
  const toolUses = [];
  let text = "";
  for (const event of events) {
    if (event.type !== "assistant") continue;
    for (const block of event.message?.content ?? []) {
      if (block.type === "tool_use") toolUses.push({ name: block.name, input: block.input ?? {} });
      else if (block.type === "text") text += `${block.text}\n`;
    }
  }
  return { events, init, result, toolUses, text: text.trim() };
}

const PACKAGE_MARKER = "node_modules/@mrmeg/";
const DOC_FILE = /\.(md|txt)$/i;

/** The `node_modules/@mrmeg/...` path a tool use names, from its path, pattern or command; null when it names none. */
function mrmegReferences(toolUse) {
  const { name, input } = toolUse;
  const fields =
    name === "Bash" ? [input.command] : [input.file_path, input.path, input.pattern, input.glob].filter((value) => typeof value === "string");
  const references = [];
  for (const field of fields) {
    if (typeof field !== "string") continue;
    for (const match of field.matchAll(/node_modules\/@mrmeg\/[^\s"'`;|&)]*/g)) references.push(match[0]);
  }
  return references;
}

/**
 * Did the agent open any `node_modules/@mrmeg/*` doc? A doc is an `.md` or `.txt`
 * file read by the Read tool, or named by a shell command or a grep. Anything
 * else under the packages (type declarations, source) counts as package files.
 *
 * @param {{ name: string, input: Record<string, any> }[]} toolUses
 */
export function packageDocAccess(toolUses) {
  const docs = new Set();
  let packageFiles = 0;
  for (const toolUse of toolUses) {
    const references = mrmegReferences(toolUse);
    if (references.length === 0) continue;
    const reads = toolUse.name === "Read" || toolUse.name === "Bash" || toolUse.name === "Grep";
    let counted = false;
    for (const reference of references) {
      const path = reference.slice(reference.indexOf(PACKAGE_MARKER));
      if (reads && DOC_FILE.test(path)) docs.add(path);
      else if (!counted) {
        packageFiles += 1;
        counted = true;
      }
    }
  }
  return { opened: docs.size > 0, docs: [...docs].sort(), packageFiles };
}

/** The numbers the CLI reports on its final `result` event. */
export function agentSummary(parsed) {
  const result = parsed.result;
  return {
    numTurns: result?.num_turns ?? null,
    totalCostUsd: result?.total_cost_usd ?? null,
    durationMs: result?.duration_ms ?? null,
    isError: result ? Boolean(result.is_error) : true,
    subtype: result?.subtype ?? "no-result",
    // What the `--model` alias resolved to, so a later run can be compared like for like.
    model: parsed.init?.model ?? null,
    claudeCodeVersion: parsed.init?.claude_code_version ?? null,
  };
}
