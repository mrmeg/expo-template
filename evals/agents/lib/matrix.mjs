/**
 * The matrix the runner works through, and how it is reported: the dry-run plan
 * with its worst-case spend, and the task x variant summary of the scored trials.
 */

const usd = (value) => `$${value.toFixed(2)}`;

/**
 * @param {{ tasks: { id: string }[], variants: { id: string }[], trials: number, maxBudgetUsd: number }} options
 */
export function planMatrix({ tasks, variants, trials, maxBudgetUsd }) {
  const total = tasks.length * variants.length * trials;
  return { tasks: tasks.length, variants: variants.length, trials, total, maxBudgetUsd, worstCaseUsd: total * maxBudgetUsd };
}

/** The `--dry-run` text: what would run, and the most it could cost. */
export function formatPlan({ tasks, variants, trials, model, maxBudgetUsd }) {
  const plan = planMatrix({ tasks, variants, trials, maxBudgetUsd });
  return [
    "Agent evals: dry run, nothing is executed and nothing is spent.",
    `Model ${model}, ${trials} trial${trials === 1 ? "" : "s"} per task and variant, budget ${usd(maxBudgetUsd)} per trial.`,
    "",
    `Tasks (${plan.tasks})`,
    ...tasks.map((task) => `  ${task.order}. ${task.id.padEnd(16)} ${task.title}`),
    "",
    `Variants (${plan.variants})`,
    ...variants.map((variant) => `  ${variant.id}  ${variant.name.padEnd(13)} ${variant.description}`),
    "",
    `Matrix: ${plan.tasks} tasks x ${plan.variants} variants x ${plan.trials} trials = ${plan.total} trials`,
    `Estimated maximum spend: ${plan.total} x ${usd(maxBudgetUsd)} = ${usd(plan.worstCaseUsd)} (the per-trial budget caps each agent run; a trial usually costs a fraction of it)`,
    "",
  ].join("\n");
}

const mean = (values) => (values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length);
const fixed = (value, digits) => (value === null || value === undefined ? "-" : value.toFixed(digits));

/**
 * One row per task and variant: pass rate, mean design-system lint errors, mean
 * cost and turns, and how often the agent opened a package doc.
 *
 * @param {object[]} rows scored trial rows
 */
export function summarize(rows) {
  const cells = new Map();
  for (const row of rows) {
    const key = `${row.taskId}\u0000${row.variant}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(row);
  }
  return [...cells.values()].map((trials) => ({
    taskId: trials[0].taskId,
    variant: trials[0].variant,
    trials: trials.length,
    passed: trials.filter((row) => row.pass).length,
    meanLintErrors: mean(trials.map((row) => row.lint.errors).filter((value) => value !== null)),
    meanCostUsd: mean(trials.map((row) => row.agent.totalCostUsd).filter((value) => value !== null)),
    meanTurns: mean(trials.map((row) => row.agent.numTurns).filter((value) => value !== null)),
    docsOpened: trials.filter((row) => row.docs.opened).length,
  }));
}

export function formatSummary(rows) {
  const table = summarize(rows);
  const header = ["task", "variant", "pass", "lint errors", "cost", "turns", "docs opened"];
  const body = table.map((cell) => [
    cell.taskId,
    cell.variant,
    `${cell.passed}/${cell.trials}`,
    fixed(cell.meanLintErrors, 1),
    cell.meanCostUsd === null ? "-" : usd(cell.meanCostUsd),
    fixed(cell.meanTurns, 1),
    `${cell.docsOpened}/${cell.trials}`,
  ]);
  const widths = header.map((title, column) => Math.max(title.length, ...body.map((line) => line[column].length)));
  const render = (line) => line.map((value, column) => value.padEnd(widths[column])).join("  ").trimEnd();
  const total = rows.reduce((sum, row) => sum + (row.agent.totalCostUsd ?? 0), 0);
  return [
    "Summary (pass = tsc clean and every non-advisory check; lint errors, cost and turns are means per cell)",
    render(header),
    render(widths.map((width) => "-".repeat(width))),
    ...body.map(render),
    "",
    `Total cost reported by the CLI: ${usd(total)} over ${rows.length} trial${rows.length === 1 ? "" : "s"}`,
  ].join("\n");
}
