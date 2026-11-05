/**
 * The isolation probe: one headless run, through the same flags a trial uses,
 * that shows what the agent's context holds. It passes when the fixture's own
 * instructions arrive (a canary line in its AGENTS.md, which Claude Code loads
 * natively) and nothing of the machine's does: no user-level CLAUDE.md, skill,
 * user plugin, or MCP server.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentSummary, parseStream, runAgent } from "./agent.mjs";
import { readBaseGuidance } from "./fixture.mjs";

const CANARY = "eval-canary-7f3a91";

const PROMPT = [
  "Do not use any tools. Reply with a single JSON object and nothing else, with these keys:",
  '"instruction_sources": an array with one entry per instruction or memory source in your context (CLAUDE.md files, AGENTS.md files, rules, memory), each { "path": the file path or a description, "first_line": its first line, verbatim };',
  '"skills": the names of the skills you can invoke;',
  '"mcp_servers": the names of the MCP servers or MCP tools you can see;',
  `"canary": the value that follows "Eval canary:" in your instructions, or null.`,
].join("\n");

/** Text that only a user-level instruction file of this machine would put in context. */
const LEAK_PATTERNS = [/obsidian/i, /Global Agent Guidance/i, /Notes\/Projects/i, /agent-framework/i, /\.claude\/(CLAUDE\.md|skills)/i];

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Judge a parsed probe run: the findings and whether the context is isolated. */
export function judgeProbe(parsed) {
  const init = parsed.init ?? {};
  const answer = extractJson(parsed.text);
  const findings = [];
  const check = (name, pass, detail) => findings.push({ name, pass, detail });

  const mcpServers = init.mcp_servers ?? [];
  const toolNames = init.tools ?? [];
  check("init event received", Boolean(parsed.init), parsed.init ? `model ${init.model}` : "no system/init event in the stream");
  check("no MCP servers", mcpServers.length === 0, `init.mcp_servers = ${JSON.stringify(mcpServers)}`);
  check("no MCP tools", !toolNames.some((name) => String(name).startsWith("mcp__")), `tools = ${toolNames.join(", ")}`);
  check("no skills", (init.skills ?? []).length === 0, `init.skills = ${JSON.stringify(init.skills ?? [])}`);
  // Claude Code's own built-in plugins (it loads AGENTS.md through one) are not the user's.
  const userPlugins = (init.plugins ?? []).filter((plugin) => plugin.path !== "builtin" && !String(plugin.source ?? "").endsWith("@builtin"));
  check("no user plugins", userPlugins.length === 0, `non-built-in init.plugins = ${JSON.stringify(userPlugins)}`);
  check(
    "no custom slash commands",
    (init.slash_commands ?? []).every((name) => !/:/.test(name)),
    `init.slash_commands = ${JSON.stringify(init.slash_commands ?? [])}`,
  );
  check("agent answered in JSON", Boolean(answer), answer ? "parsed" : `response: ${parsed.text.slice(0, 300)}`);
  check("fixture instructions arrived (canary)", answer?.canary === CANARY, `canary = ${JSON.stringify(answer?.canary)}`);
  check("agent reports no skills", (answer?.skills ?? []).length === 0, `skills = ${JSON.stringify(answer?.skills)}`);
  check("agent reports no MCP servers", (answer?.mcp_servers ?? []).length === 0, `mcp_servers = ${JSON.stringify(answer?.mcp_servers)}`);
  const sources = JSON.stringify(answer?.instruction_sources ?? []);
  const leaks = LEAK_PATTERNS.filter((pattern) => pattern.test(parsed.text) || pattern.test(sources));
  check("no user-level CLAUDE.md in context", leaks.length === 0, `instruction_sources = ${sources}`);
  return { pass: findings.every((finding) => finding.pass), findings, answer };
}

/**
 * @param {{ model: string, maxBudgetUsd: number, resultsDir: string, timeoutMs?: number }} options
 */
export async function runProbe({ model, maxBudgetUsd, resultsDir, timeoutMs = 5 * 60_000 }) {
  const dir = await mkdtemp(join(tmpdir(), "agent-eval-probe-"));
  try {
    await writeFile(join(dir, "AGENTS.md"), `${readBaseGuidance()}\nEval canary: ${CANARY}\n`);
    const logPath = join(resultsDir, `probe-${new Date().toISOString().replace(/[:.]/g, "-")}.stream.jsonl`);
    const run = await runAgent({ cwd: dir, prompt: PROMPT, model, maxBudgetUsd, logPath, timeoutMs });
    const parsed = parseStream(run.lines);
    const verdict = judgeProbe(parsed);
    return { ...verdict, agent: agentSummary(parsed), logPath, stderr: run.stderr, exitCode: run.exitCode, init: parsed.init };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
