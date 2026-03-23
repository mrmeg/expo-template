# Workflow Guide

This project uses two agent workflows: **Night Shift** for autonomous overnight work and **Day Shift** for interactive daytime collaboration. Both are driven by specs — well-defined task documents that tell the agent exactly what to build.

---

## Building a Feature — End to End

### 1. Discover

Start with one of two entry points depending on how well you know what to build:

**Broad scan** — You want to find issues or opportunities:
```
/investigate
```
The agent scans the codebase for bugs, TODOs, inconsistencies, missing tests, and gaps between docs and code. It presents findings sorted by severity and effort, then you pick which ones become specs.

**Targeted investigation** — You have a topic in mind:
```
/investigate the search system returns stale results after filter changes
```
The agent deep-dives into that specific area and surfaces findings.

**Direct spec** — You already know exactly what to build:
```
/write-spec add donation tipping to the checkout flow
```
The agent investigates the relevant code, then writes a complete spec.

Both paths produce draft specs in `Agent/Specs/` (prefixed with `draft-`) and add Draft rows to the task list in `AGENTS.md`.

### 2. Refine

Poke holes in each draft before promoting it:
```
/review-spec draft-donation-tipping.md
```
The agent acts as a critical reviewer — finding missing edge cases, ambiguities the night shift might misinterpret, and references to docs that don't exist yet. Iterate until the spec is solid. Edit the spec manually if needed.

Use `/ask` for quick research while refining:
```
/ask how does the Stripe checkout session handle metadata for connected accounts
```

### 3. Promote

When a spec is ready for execution:
1. Remove the `draft-` prefix from the filename
2. Change `Status: Draft` to `Status: Ready` inside the spec
3. The spec is now eligible for night/day shift to pick up

### 4. Execute

Choose based on your availability:

| Situation | Command | What happens |
|-----------|---------|--------------|
| Going to bed / stepping away | `/nightshift` | Agent works autonomously through all Ready specs |
| At the keyboard, want to collaborate | `/dayshift` | Agent proposes, you approve, iterate together |

Both shifts follow the same quality process: load context → write tests → plan → review personas → implement → validate → review personas → commit → clean up.

### 5. Review

**After a night shift:**
```
/morning-review
```
Walk through the Night Shift Report — verify each task manually, step through diffs, give feedback. If you find issues, the agent traces the root cause to the doc or workflow that caused it and fixes that first.

**After a day shift:** Review happens live during the session — manual testing checkpoints, visual checks for UI work, and real-time feedback.

### 6. Maintain

**Check project state anytime:**
```
/status
```
Shows the task list, draft specs, recent commits, blockers, and whether a morning review is pending.

**Refresh docs after manual work:**
```
/update-docs
```
The shifts update docs automatically, but use this after making changes outside of a shift session.

---

## Night Shift

**When to use:** You have specs ready and want autonomous progress overnight.

**Command:** `/nightshift`

### How it works

1. The agent reads `AGENTS.md` for the task list and picks specs marked **Ready** (bugs first)
2. For each task, it loads context from docs and source code
3. Writes failing tests, then develops an implementation plan
4. Runs all 6 review personas against the plan, adapts until green
5. Implements, runs full validation, then runs review personas against the diff
6. Commits the work, then cleans up — `git rm`s the completed spec, removes the task row from `AGENTS.md`, deletes any scratch files
7. Moves to the next task

### What you get back

When the shift ends, the agent produces `Agent/NIGHT_SHIFT_REPORT.md` containing:

- **Completed tasks** — commits, summaries, and step-by-step manual testing instructions
- **Blocked tasks** — what went wrong and what input is needed
- **Issues discovered** and **docs updated**

### Morning review

Run `/morning-review` to walk through the report:

- Review testing instructions and verify each task manually
- Step through each commit diff with feedback
- If you find an issue, the agent traces it back to the doc/workflow that caused it and fixes the root cause first, then the code
- Once everything looks good, the report file is deleted

### Key rules

- The agent never asks questions — you are unavailable
- Blockers are documented in `CHANGELOG.md` under "NEEDS INPUT FROM USER"
- Specs prefixed with `draft-` are skipped
- The working tree must be clean when the shift ends

---

## Day Shift

**When to use:** You're at the keyboard and want to collaborate in real time.

**Command:** `/dayshift`

### How it works

1. The agent greets you and asks what to work on (or suggests options from the task list)
2. Loads context from docs and source, shares a summary so you're aligned
3. **Proposes an approach** — waits for your approval before coding
4. Proposes a testing plan, asks if you have additional scenarios
5. Runs review personas against the plan, shares YELLOW/RED items — you decide on REDs
6. Implements the approved plan, pausing at key points:
   - **UI work** — asks you to check visually
   - **Logic work** — shares key code paths for review
7. Runs full validation (tests, types, lint)
8. Runs review personas against the implementation diff, discusses any REDs
9. **Manual testing checkpoint** — gives you specific instructions, waits for your results, fixes issues
10. Commits, cleans up specs if applicable, asks "next task or stop?"

### Key rules

- The agent always asks before major decisions
- Focused questions to keep momentum — suggests one option, asks if it's right
- Says when it's uncertain rather than guessing
- Review personas still run (both pre and post) — they catch what you both miss

---

## Comparison

| | Night Shift | Day Shift |
|---|---|---|
| **Human available** | No | Yes |
| **Decision-making** | Agent decides | Human approves |
| **UI verification** | Automated only | Human checks visually |
| **Testing** | Agent runs all tests | Agent + human manual testing |
| **Blockers** | Documented, move on | Discussed in real time |
| **Output** | Night Shift Report | Committed code, reviewed live |
| **Cleanup** | Automated at end | After each task |

---

## Supporting Commands

| Command | When to use |
|---------|-------------|
| `/investigate` | Surface issues and turn them into specs — broad scan or targeted topic |
| `/write-spec <description>` | Create a spec when you already know what to build |
| `/review-spec <filename>` | Poke holes in a spec before a shift runs it |
| `/status` | Quick dashboard — tasks, drafts, recent commits, blockers |
| `/update-docs` | Refresh Agent/Docs/ after code changes |
| `/ask <question>` | Quick research — concise answers, no boilerplate |
| `/bootstrap-docs` | Generate initial docs from scratch (one-time setup) |

### Typical flow

1. `/investigate` or `/write-spec` — create draft specs
2. `/review-spec draft-{name}.md` — poke holes, iterate
3. Remove `draft-` prefix, set Status to Ready
4. `/nightshift` or `/dayshift` — execute the work
5. `/morning-review` — review night shift results (if applicable)
6. `/update-docs` — ensure docs reflect changes (shifts do this automatically, but useful for manual work)

---

## Shared Infrastructure

Both workflows use the same supporting tools:

- **`AGENTS.md`** — Task list, doc index, tech stack reference
- **`REVIEW_PERSONAS.md`** — 6 review personas for plan and code review
- **`Agent/Docs/`** — System documentation, updated by both workflows
- **`Agent/Specs/`** — Task specs, `git rm`'d upon completion
- **`CHANGELOG.md`** — Human-facing changelog
