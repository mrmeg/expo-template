# Agent evals

Does package guidance make a coding agent better at using `@mrmeg/expo-ui`,
`@mrmeg/expo-media` and `@mrmeg/expo-purchases`? This set runs the same five
realistic tasks under different `AGENTS.md` guidance variants, scores each result
deterministically, and records what it cost. It exists so documentation changes
are judged by measurement instead of taste.

**Runs cost money and are nondeterministic.** Every trial is a real `claude -p`
agent run. Nothing here runs in CI, and `bun run verify` never calls a model.
The full matrix (5 tasks x 3 variants x 3 trials = 45 trials) has a worst case
of 45 x $2.00 = $90 at the default per-trial cap; a trial usually costs a few
tenths of a dollar. The runner prints the worst case and refuses to run more
than one trial without `--yes`.

## Run it

```sh
node scripts/run-agent-evals.mjs --dry-run                    # the matrix and its worst-case spend; runs nothing
node scripts/run-agent-evals.mjs --probe                      # isolation probe: one short agent run (cents)
node scripts/run-agent-evals.mjs --reference good             # score the committed reference solutions: no agent, no spend
node scripts/run-agent-evals.mjs --tasks 1 --variants C --trials 1   # one real trial
node scripts/run-agent-evals.mjs --yes                        # the full matrix
```

| Flag | Default | |
|---|---|---|
| `--tasks <ids>` | all | task ids or numbers, comma-separated (`1,pro-gate`) |
| `--variants <ids>` | all | variant ids or names (`A,C`, `inline-index`) |
| `--trials <n>` | 3 | trials per task and variant |
| `--model <m>` | `sonnet` | passed to `claude --model` |
| `--max-budget-usd <n>` | 2 | cap per trial, passed to `claude --max-budget-usd` |
| `--dry-run` | | print the matrix and estimated maximum spend, run nothing |
| `--yes` | | confirm a run of more than one trial |
| `--probe` | | the isolation probe (budget $0.25 unless `--max-budget-usd` is given) |
| `--reference good\|bad` | | score each task's committed reference solution instead of an agent |
| `--fixture-dir <dir>` | temp dir | build the fixture there and keep it; a later run reuses it |
| `--keep-workdirs` | | keep each trial's working copy |
| `--results-dir <dir>` | `evals/agents/results/` | gitignored |

The first run packs and installs the fixture (a few minutes cold). Pass
`--fixture-dir` to keep it between runs. Results: one JSONL row per trial in
`<results-dir>/<run id>.jsonl`, and per trial a folder with the raw `stream.jsonl`
log, the changed files, `check.json`, `tsc.txt` and `lint.txt`; then a task x
variant summary (pass rate, mean lint errors, mean cost, mean turns, how often a
package doc was opened).

Requires `claude` on `PATH`, signed in. `AGENT_EVALS_CLAUDE_BIN` overrides the binary.

## What a trial is

1. **Fixture** (`fixture/`): a minimal Expo Router app installed from freshly
   packed tarballs of ui, media, purchases and the lint plugin (the pack helpers
   are the consumer smoke's, `scripts/lib/packageConsumer.mjs`), with every peer
   of the four packages. The root layout follows `packages/ui/LLM_USAGE.md`
   "Required App Setup" (`useResources`, `KeyboardProvider`, `UIProvider`, plus a
   `QueryClientProvider` for the media hooks), `client/icons.json` and its
   generated module are wired, and the lint plugin is configured. `client/auth.ts`,
   `client/api/people.ts` and `client/api/contact.ts` are stand-ins the tasks name.
   Built once per run, then cloned (APFS `cp -c`) into a fresh temp directory for
   every trial. Before any agent runs, the untouched fixture must type-check and
   lint clean.
2. **Variant** (`variants/`): produces the fixture's `AGENTS.md` from the base
   paragraph (`fixture/AGENTS.base.md`, stack and commands only).
   - **A, none**: the base only.
   - **B, pointer**: base plus "Read `node_modules/@mrmeg/expo-ui/LLM_USAGE.md` before UI work."
   - **C, inline-index**: base plus the section `bunx expo-ui-agents` writes from the
     installed tarballs (the compact `llms.txt` of every installed package and the
     version-matched doc paths).

   Add a variant by adding a file (`variants/README.md`).
3. **Task** (`tasks/<id>/`): `prompt.md` is the user's ask, never naming a component
   (a Jest test enforces it); `check.mjs` scores the result; `fixtures/good` and
   `fixtures/bad` are the committed reference solutions.
4. **Agent**: `claude -p` in the clone, `stream-json`, file tools and a narrow
   `Bash` (type-check, lint, the icon CLI; no installs, no web), prompt denial
   instead of prompts.
5. **Score**, per trial:
   - `tsc --noEmit` passes;
   - the `expo-ui-lint` violation count on the files the agent changed;
   - the task's `check.mjs`: expected package components and hooks, and forbidden
     patterns (`@mrmeg/expo-ui/dist` imports, icon libraries, raw React Native
     primitives the package wraps, a `Card` around a section, hand-rolled toasts,
     alerts and sheets). Where the docs allow alternatives the assertion takes
     any of them (`ThemeSelector`, `SegmentedControl`, `RadioGroup`, ...);
   - `num_turns`, `total_cost_usd`, `duration_ms` from the CLI's final `result` event;
   - whether the agent opened a `node_modules/@mrmeg/*` doc (an `.md` or `.txt` file it read).

   `pass` is: `tsc` clean, every non-advisory assertion passed, and the agent run
   did not error. Lint errors, cost and turns are reported as means, not part of `pass`.
   An *advisory* assertion is reported (`advisoryFailed`) but does not decide `pass`.
   Two are: `screen-root`, because `LLM_USAGE.md` says every screen root is `Screen`
   while the `Item.md` example it calls the complete flat screen uses a `ScrollView`;
   and `no-raw-pressable`, because the package's own lint leaves `Pressable` available.
   A function counts as wired up whether it is called or passed by name (`onPress={signOut}`).

   Each row also records the resolved `agent.model` and `agent.claudeCodeVersion`, because
   the `sonnet` alias moves: compare runs only like for like.

## Isolation

A trial must not inherit the maintainer's own guidance. By flag and environment, with
no credential copied (`lib/agent.mjs`): `--setting-sources project` (no user settings,
hooks or plugins), `--strict-mcp-config` with no config and
`ENABLE_CLAUDEAI_MCP_SERVERS=false` (no MCP servers or account connectors),
`--disable-slash-commands` (no skills), `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, and an
allowlisted child environment so the parent session's `CLAUDE_CODE_*` variables never
leak in. Claude Code loads `AGENTS.md` itself, so the variant's `AGENTS.md` is the
project guidance with no `CLAUDE.md` shim.

`--probe` proves it: one run through the same flags whose `system/init` event must list
no MCP server or tool, skill, or non-built-in plugin, and whose answer must quote the
fixture's `AGENTS.md` canary and no user-level instruction file. Rerun it after a
Claude Code upgrade.

## Tests

`scripts/__tests__/agentEvals.test.ts` (in `bun run test:ci`) runs each `check.mjs`
against its `good` fixture (must pass) and `bad` fixture (must fail the raw `Text`, icon
library and `Card`-around-a-section assertions, plus a task-specific one), and covers
the matrix, the spend gate, the child environment, the stream parser and the probe
verdict. `--reference good` runs the same reference solutions through the real
fixture, so they are also type-checked and linted against the installed packages.

`evals/` is outside `tsconfig.json`, Jest and ESLint: the fixtures import packages only
the eval fixture app installs.
