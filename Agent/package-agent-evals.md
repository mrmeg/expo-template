---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Agent eval set: does package guidance make agents better with `@mrmeg` packages?

## Goal
Measure whether package guidance makes coding agents better at using `@mrmeg/expo-ui`, `expo-media`, and `expo-purchases`, before and after the `package-agents-section` and `ui-component-docs-split` specs. The harness runs the same small set of realistic tasks under different `AGENTS.md` guidance variants, scores the results deterministically, and records cost. Anthropic's skill guidance says to build evaluations before more documentation (https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices). Today no measurement exists: the only external data point is Vercel's single vendor-run eval.

## Context
- Consumer fixtures already exist: `scripts/check-package-consumer.mjs` builds each package, runs `bun pm pack`, installs the tarballs into throwaway Expo fixtures (ui fixture: `package.json`, `app.json`, `tsconfig.json`, `App.tsx`, `client/icons.json`), and type-checks them. Reuse its pack and fixture helpers, factoring them into `scripts/lib/` if needed. Don't duplicate them.
- The lint plugin (`packages/lint`, bin `expo-ui-lint`, ESLint 9 flat config) gives deterministic design-system violation counts. Its consumer-smoke fixture shows how to wire it from a tarball.
- The headless agent is `claude -p` with `--output-format json` (reports cost and turns), `--model`, `--max-budget-usd`, `--permission-mode`, `--strict-mcp-config`, and `--setting-sources`.
- Runs must not inherit Matt's user-level guidance (`~/.claude/CLAUDE.md` points agents at an Obsidian vault), skills, or MCP servers. Verify the isolation with a probe run, e.g. ask the agent to print what instructions it has. If the flags are not enough, run with a temporary `CLAUDE_CONFIG_DIR`, keeping only the auth needed.

## Work
1. **Layout.**
   - `evals/agents/README.md`: purpose, how to run, cost warning.
   - `evals/agents/tasks/<id>/prompt.md` and `evals/agents/tasks/<id>/check.mjs`.
   - `evals/agents/variants/`.
   - Runner `scripts/run-agent-evals.mjs`.
   - Results go to a gitignored `evals/agents/results/`.
   - Keep `evals/` out of `tsconfig`, Jest and lint globs if they would pick it up.
2. **Fixture.** A minimal Expo Router consumer app installed from freshly packed tarballs of ui, media, purchases and lint:
   - root layout wired per `packages/ui/LLM_USAGE.md` Required App Setup (`useResources`, `KeyboardProvider`, `UIProvider`);
   - `client/icons.json` plus the generated module;
   - the lint plugin configured;
   - a one-paragraph base `AGENTS.md` (stack and commands only).

   Each trial runs in a fresh temp copy.
3. **Variants**, each producing the fixture's `AGENTS.md`:
   - **A (none):** base only.
   - **B (pointer):** base plus fieldnest's style of line, "read `node_modules/@mrmeg/expo-ui/LLM_USAGE.md` before UI work".
   - **C (inline index):** base plus every installed package's `llms.txt`, concatenated under a heading.

   Once `package-agents-section` lands, C must call `bunx expo-ui-agents` instead. Make the variant list data-driven so a split-docs variant can be added later.
4. **Tasks (5)**, written as a user would ask, never naming components:
   1. A settings screen (theme choice, notifications toggle, sign-out with a confirm).
   2. A searchable list screen with loading, empty and error states.
   3. A validated form that shows a success toast on submit.
   4. A photo picker and upload grid using `@mrmeg/expo-media` client hooks against a stub endpoint.
   5. Gating a screen behind a `pro` entitlement with `@mrmeg/expo-purchases`.

   Verify each task's intended APIs exist in the packages before writing its checks.
5. **Scoring**, deterministic and per trial:
   - `tsc --noEmit` passes;
   - `expo-ui-lint` error count on changed files;
   - task `check.mjs` assertions;
   - `num_turns`, `total_cost_usd`, `duration_ms` from the CLI JSON;
   - whether the agent opened any `node_modules/@mrmeg/*` doc. Use `--output-format stream-json` if the plain JSON lacks tool calls.

   Assertions cover expected package components and hooks (e.g. `ItemGroup`/`Item`, `notify`, `Screen`), and forbidden patterns: `@mrmeg/expo-ui/dist` imports, `lucide-react-native`, raw `Text`/`Pressable` that the package wraps, Cards around sections, and hand-rolled toasts or sheets.
6. **Runner CLI.**
   - Flags: `--tasks`, `--variants`, `--trials` (default 3), `--model` (default `sonnet`), `--max-budget-usd` per trial (default 2), `--dry-run` (prints the matrix and the estimated maximum spend, runs nothing).
   - Writes JSONL per trial and prints a task × variant summary: pass rate, mean lint errors, mean cost.
   - Before running more than one trial, it prints the worst-case spend and requires `--yes`.

## Out of scope
- CI integration: runs cost money and are nondeterministic.
- LLM-judge scoring.
- Models other than Claude.
- Running the full matrix: an owner-approved spend for Matt, after merge.

## Validation
- `node scripts/run-agent-evals.mjs --dry-run` lists 5 tasks × 3 variants × 3 trials with a spend estimate.
- Each `check.mjs` passes on a hand-written reference solution and fails on a deliberately bad one (raw `Text`, Lucide import, Card-wrapped section). Commit both as test fixtures under `evals/agents/tasks/<id>/` and run them in a Jest test.
- Isolation probe: one trial shows no user-level CLAUDE.md, skills or MCP servers in the agent's context.
- One real smoke trial only (task 1, variant C, `--trials 1`, budget ≤ $2). Report its JSONL row in the PR. Do not run the full matrix.
- `bun run verify`
