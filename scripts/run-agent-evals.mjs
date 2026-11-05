#!/usr/bin/env node
/**
 * The agent eval runner: does package guidance make a coding agent better at
 * using `@mrmeg/expo-ui`, `expo-media` and `expo-purchases`?
 *
 * It runs each task (`evals/agents/tasks`) under each guidance variant
 * (`evals/agents/variants`) with `claude -p` in a fresh copy of a consumer app
 * installed from freshly packed tarballs, scores the result deterministically
 * (type-check, design-system lint, the task's own assertions), and records the
 * CLI's cost, turns and duration. Runs cost money: read `evals/agents/README.md`.
 *
 * Usage:
 *   node scripts/run-agent-evals.mjs --dry-run
 *   node scripts/run-agent-evals.mjs --tasks settings-screen --variants C --trials 1
 *   node scripts/run-agent-evals.mjs --yes                      # the full matrix
 *   node scripts/run-agent-evals.mjs --probe                    # the isolation probe
 *   node scripts/run-agent-evals.mjs --reference good           # score the committed reference solutions, no agent
 */
import { appendFileSync, copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { agentSummary, packageDocAccess, parseStream, runAgent } from "../evals/agents/lib/agent.mjs";
import { EVALS_DIR, loadTasks, loadVariants, select } from "../evals/agents/lib/catalog.mjs";
import {
  buildFixture,
  changedFiles,
  cloneFixture,
  designLint,
  overlayFiles,
  readBaseGuidance,
  readFixtureMarker,
  snapshot,
  typecheck,
} from "../evals/agents/lib/fixture.mjs";
import { formatPlan, formatSummary, planMatrix } from "../evals/agents/lib/matrix.mjs";
import { runProbe } from "../evals/agents/lib/probe.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_RESULTS_DIR = join(EVALS_DIR, "results");

const USAGE = `
Usage:
  node scripts/run-agent-evals.mjs [options]

Options:
  --tasks <ids>            Comma-separated task ids or numbers (default: all)
  --variants <ids>         Comma-separated variant ids or names, e.g. A,C (default: all)
  --trials <n>             Trials per task and variant (default: 3)
  --model <model>          Model alias or id passed to claude (default: sonnet)
  --max-budget-usd <n>     Spend cap per trial, passed to claude (default: 2)
  --dry-run                Print the matrix and the estimated maximum spend; run nothing
  --yes                    Confirm a run of more than one trial after reading its worst-case spend
  --probe                  Run the isolation probe (one short agent run), print the verdict, and exit
  --reference <good|bad>   Score each task's committed reference solution instead of running an
                           agent: no spend, checks the harness and the fixture
  --fixture-dir <dir>      Build the fixture into <dir> and keep it, or reuse it when already built
  --keep-workdirs          Keep each trial's working copy (printed in the log) instead of deleting it
  --results-dir <dir>      Where JSONL, stream logs and changed files go (default: evals/agents/results)
  --timeout-minutes <n>    Kill an agent run after this long (default: 20)
  -h, --help               This text
`;

export function parseArgs(argv) {
  const options = {
    tasks: null,
    variants: null,
    trials: 3,
    model: "sonnet",
    maxBudgetUsd: 2,
    dryRun: false,
    yes: false,
    probe: false,
    reference: null,
    fixtureDir: null,
    keepWorkdirs: false,
    resultsDir: DEFAULT_RESULTS_DIR,
    timeoutMinutes: 20,
    help: false,
  };
  const value = (index, name) => {
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) throw new Error(`${name} needs a value`);
    return next;
  };
  const positive = (text, name) => {
    const number = Number(text);
    if (!Number.isFinite(number) || number <= 0) throw new Error(`${name} needs a positive number, got "${text}"`);
    return number;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    else if (arg === "-h" || arg === "--help") options.help = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--yes") options.yes = true;
    else if (arg === "--probe") options.probe = true;
    else if (arg === "--keep-workdirs") options.keepWorkdirs = true;
    else if (arg === "--tasks") options.tasks = value(index++, arg);
    else if (arg === "--variants") options.variants = value(index++, arg);
    else if (arg === "--trials") options.trials = Math.floor(positive(value(index++, arg), arg));
    else if (arg === "--model") options.model = value(index++, arg);
    else if (arg === "--max-budget-usd") options.maxBudgetUsd = positive(value(index++, arg), arg);
    else if (arg === "--timeout-minutes") options.timeoutMinutes = positive(value(index++, arg), arg);
    else if (arg === "--fixture-dir") options.fixtureDir = resolve(value(index++, arg));
    else if (arg === "--results-dir") options.resultsDir = resolve(value(index++, arg));
    else if (arg === "--reference") {
      options.reference = value(index++, arg);
      if (!["good", "bad"].includes(options.reference)) throw new Error(`--reference takes good or bad, got "${options.reference}"`);
    } else throw new Error(`unknown argument "${arg}"`);
  }
  return options;
}

/** `--tasks 1,3` also works: a bare number picks the task of that order. */
function selectTasks(tasks, selector) {
  if (!selector) return tasks;
  const byOrder = selector
    .split(",")
    .map((part) => part.trim())
    .map((part) => (/^\d+$/.test(part) ? (tasks.find((task) => task.order === Number(part))?.id ?? part) : part))
    .join(",");
  return select(tasks, byOrder, "task");
}

/** Run the task's `check.mjs` against the trial's app; it prints its verdict as JSON. */
function runTaskCheck(task, appDir, changed, stagingDir) {
  const changedPath = join(stagingDir, "changed-files.json");
  writeFileSync(changedPath, JSON.stringify(changed));
  const result = spawnSync(process.execPath, [task.check, appDir, "--changed", changedPath], { encoding: "utf8" });
  try {
    const verdict = JSON.parse(result.stdout);
    return {
      pass: verdict.pass,
      failed: verdict.assertions.filter((assertion) => !assertion.pass && !assertion.advisory).map((assertion) => assertion.id),
      advisoryFailed: verdict.assertions.filter((assertion) => !assertion.pass && assertion.advisory).map((assertion) => assertion.id),
      assertions: verdict.assertions,
    };
  } catch {
    return {
      pass: false,
      failed: ["check-crashed"],
      advisoryFailed: [],
      assertions: [],
      error: (result.stderr || result.stdout || "").slice(0, 500),
    };
  }
}

/** The fixture itself must be clean, or every trial's score would measure the fixture. */
function assertBaseline(fixtureDir) {
  const typecheckResult = typecheck(fixtureDir);
  const lint = designLint(fixtureDir, ["app/_layout.tsx", "app/index.tsx", "client/auth.ts", "client/api/people.ts", "client/api/contact.ts"]);
  if (!typecheckResult.pass || lint.errors !== 0) {
    throw new Error(
      `The untouched fixture does not pass: tsc ${typecheckResult.pass ? "clean" : `${typecheckResult.errors} errors`}, lint ${lint.errors} errors.\n${typecheckResult.output}\n${lint.output}`,
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  const allTasks = loadTasks();
  const tasks = selectTasks(allTasks, options.tasks);
  const allVariants = await loadVariants();
  const variants = select(allVariants, options.variants, "variant");

  if (options.dryRun) {
    console.log(formatPlan({ tasks, variants, trials: options.trials, model: options.model, maxBudgetUsd: options.maxBudgetUsd }));
    return 0;
  }

  mkdirSync(options.resultsDir, { recursive: true });

  if (options.probe) {
    // A probe is one short run: a low default cap unless one was given.
    const maxBudgetUsd = process.argv.includes("--max-budget-usd") ? options.maxBudgetUsd : 0.25;
    console.log(`Isolation probe: one agent run on ${options.model}, budget ${maxBudgetUsd.toFixed(2)} USD`);
    const probe = await runProbe({ model: options.model, maxBudgetUsd, resultsDir: options.resultsDir });
    for (const finding of probe.findings) console.log(`${finding.pass ? "PASS" : "FAIL"}  ${finding.name}: ${finding.detail}`);
    console.log(`init event: ${JSON.stringify({ ...probe.init, tools: probe.init?.tools?.length ?? 0 })}`);
    console.log(`agent answer: ${JSON.stringify(probe.answer)}`);
    console.log(`agent: ${JSON.stringify(probe.agent)}; stream log ${probe.logPath}`);
    if (probe.stderr.trim()) console.log(`stderr: ${probe.stderr.trim().slice(0, 500)}`);
    console.log(probe.pass ? "Isolation probe passed." : "Isolation probe FAILED.");
    return probe.pass ? 0 : 1;
  }

  const reference = options.reference;
  const trialsPerCell = reference ? 1 : options.trials;
  const matrixVariants = reference ? [{ id: `ref-${reference}`, name: `reference ${reference}`, order: 0, description: "", apply: async () => {} }] : variants;
  const plan = planMatrix({ tasks, variants: matrixVariants, trials: trialsPerCell, maxBudgetUsd: options.maxBudgetUsd });

  if (!reference && plan.total > 1 && !options.yes) {
    console.error(
      [
        `This would run ${plan.total} trials (${plan.tasks} tasks x ${plan.variants} variants x ${plan.trials} trials) with real agent runs.`,
        `Worst-case spend: ${plan.total} x $${options.maxBudgetUsd.toFixed(2)} = $${plan.worstCaseUsd.toFixed(2)}.`,
        "Re-run with --yes to confirm, or narrow it with --tasks, --variants and --trials.",
      ].join("\n"),
    );
    return 2;
  }
  if (!reference) {
    console.log(`Running ${plan.total} trial${plan.total === 1 ? "" : "s"}; worst-case spend $${plan.worstCaseUsd.toFixed(2)}.`);
  }

  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}${reference ? `-reference-${reference}` : ""}`;
  const jsonlPath = join(options.resultsDir, `${runId}.jsonl`);
  const runDir = join(options.resultsDir, runId);
  mkdirSync(runDir, { recursive: true });

  // Build the fixture once: pack, install, generate. A kept directory is reused.
  const ownsFixture = !options.fixtureDir;
  const fixtureDir = options.fixtureDir ?? mkdtempSync(join(tmpdir(), "agent-eval-fixture-"));
  try {
    const marker = readFixtureMarker(fixtureDir);
    if (marker) {
      console.log(`Reusing the fixture in ${fixtureDir} (built ${marker.builtAt}).`);
    } else {
      console.log(`Building the fixture in ${fixtureDir}: packing and installing ui, media, purchases and lint.`);
      const built = await buildFixture({ root: REPO_ROOT, dir: fixtureDir });
      console.log(`Fixture built: ${Object.entries(built.packages).map(([name, version]) => `${name}@${version}`).join(", ")}`);
    }
    assertBaseline(fixtureDir);
    console.log("The untouched fixture type-checks and lints clean.");

    const baseGuidance = readBaseGuidance();
    const rows = [];

    for (const task of tasks) {
      for (const variant of matrixVariants) {
        for (let trial = 1; trial <= trialsPerCell; trial += 1) {
          const label = `${task.id} / ${variant.id} / trial ${trial}`;
          console.log(`\n--- ${label}`);
          const trialDir = join(runDir, `${task.id}-${variant.id}-${trial}`);
          mkdirSync(trialDir, { recursive: true });

          const appDir = await cloneFixture(fixtureDir);
          try {
            // Claude Code loads AGENTS.md itself (the isolation probe proves it), so
            // the variant's AGENTS.md is the project guidance with no CLAUDE.md shim.
            writeFileSync(join(appDir, "AGENTS.md"), baseGuidance);
            await variant.apply({ appDir });
            const before = snapshot(appDir);

            let parsed = parseStream([]);
            let agentNote = null;
            if (reference) {
              overlayFiles(appDir, join(task.dir, "fixtures", reference));
            } else {
              const run = await runAgent({
                cwd: appDir,
                prompt: task.prompt,
                model: options.model,
                maxBudgetUsd: options.maxBudgetUsd,
                logPath: join(trialDir, "stream.jsonl"),
                timeoutMs: options.timeoutMinutes * 60_000,
              });
              parsed = parseStream(run.lines);
              if (run.timedOut) agentNote = "timed out";
              else if (!parsed.result) agentNote = `no result event (exit ${run.exitCode}${run.stderr.trim() ? `: ${run.stderr.trim().slice(0, 300)}` : ""})`;
            }

            const changed = changedFiles(before, snapshot(appDir)).filter((path) => path !== "AGENTS.md");
            const tsc = typecheck(appDir);
            const lint = designLint(appDir, changed);
            const check = runTaskCheck(task, appDir, changed, trialDir);
            const docs = packageDocAccess(parsed.toolUses);
            const agent = reference ? { numTurns: 0, totalCostUsd: 0, durationMs: 0, isError: false, subtype: "reference", model: null, claudeCodeVersion: null } : agentSummary(parsed);

            for (const path of changed) {
              const target = join(trialDir, "changed", path);
              mkdirSync(dirname(target), { recursive: true });
              copyFileSync(join(appDir, path), target);
            }
            writeFileSync(join(trialDir, "check.json"), JSON.stringify(check, null, 2));
            writeFileSync(join(trialDir, "tsc.txt"), tsc.output);
            writeFileSync(join(trialDir, "lint.txt"), lint.output);

            const row = {
              runId,
              taskId: task.id,
              variant: variant.id,
              trial,
              model: reference ? null : options.model,
              pass: tsc.pass && check.pass && !agent.isError,
              tsc: { pass: tsc.pass, errors: tsc.errors },
              lint: { errors: lint.errors, files: lint.files, failed: lint.failed },
              check: { pass: check.pass, failed: check.failed, advisoryFailed: check.advisoryFailed },
              docs,
              agent: { ...agent, note: agentNote },
              changedFiles: changed,
              trialDir,
            };
            rows.push(row);
            appendFileSync(jsonlPath, `${JSON.stringify(row)}\n`);
            console.log(
              `${row.pass ? "PASS" : "FAIL"}  tsc ${tsc.pass ? "clean" : `${tsc.errors} errors`}, lint ${lint.errors ?? "failed"}, check ${check.pass ? "ok" : `failed [${check.failed.join(", ")}]`}` +
                `${check.advisoryFailed.length ? `, advisory [${check.advisoryFailed.join(", ")}]` : ""}` +
                `${reference ? "" : `, ${agent.numTurns ?? "?"} turns, $${(agent.totalCostUsd ?? 0).toFixed(4)}, docs ${docs.opened ? "opened" : "not opened"}`}${agentNote ? `, ${agentNote}` : ""}`,
            );
          } finally {
            if (options.keepWorkdirs) console.log(`Kept the working copy: ${appDir}`);
            else await rm(appDir, { recursive: true, force: true });
          }
        }
      }
    }

    console.log(`\n${formatSummary(rows)}`);
    console.log(`\nRows: ${jsonlPath}\nPer-trial logs and changed files: ${runDir}`);
    return 0;
  } finally {
    if (ownsFixture) rmSync(fixtureDir, { recursive: true, force: true });
  }
}

// Importable for tests: the entry point only runs when this file is executed.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(`run-agent-evals: ${error.message}`);
      process.exit(1);
    },
  );
}
