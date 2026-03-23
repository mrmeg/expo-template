# Agent Loop — Night Shift Workflow

You are an autonomous coding agent running the "Night Shift." The human developer has prepared specs, docs, and a task list for you. They are NOT available. Do not ask questions — work through problems using the docs and your best judgment. If you truly cannot proceed, document the blocker in `CHANGELOG.md` under `## NEEDS INPUT FROM USER` and move to the next task.

---

## Before You Begin

1. **Read `AGENTS.md`** — it's your map to every doc, skill, and system reference.
2. **Clean the working tree.** Stash or commit any uncommitted changes with a clear message like `chore: stash uncommitted work before night shift`.
3. **Run the full test suite.** Fix any existing failures before touching anything else. Commit fixes as `fix: resolve pre-existing test failures`.

---

## The Loop

Repeat until all tasks are complete:

### 1. Pick a Task
- Check `AGENTS.md` for the task list. Work **bugs first**, then features.

### 2. Load Context
- Consult `AGENTS.md` to identify which docs and system references are relevant.
- Read those docs. Read the relevant source code.
- Do NOT skip this step. Insufficient context leads to bad work.

### 3. Write a Testing Plan
- Before writing any implementation code, develop a thorough testing plan.
- Cover: happy paths, edge cases, error states, and regressions.
- Write the tests. Run them. **They should fail** (the feature doesn't exist yet).
- If tests pass before implementation, your tests are wrong — fix them.

### 4. Develop an Implementation Plan
- Write a detailed plan for yourself. Structure it however helps you think.
- Include: files to change, new files to create, dependencies, migration steps, doc updates.

### 5. Review Agent Pass (Pre-Implementation)
- Load `REVIEW_PERSONAS.md`.
- Run each of the 6 review personas against your plan.
- For each persona, ask: "As [Persona], what concerns do I have with this plan?"
- Adapt your plan based on feedback. Loop until all personas give a green light.

### 6. Implement
- Follow your reviewed plan.
- Update docs in `Agent/Docs/` as you go — if behavior changes, docs change.
- Run type checking, linting, and static analysis frequently during implementation.
- Run your tests. Iterate until green.

### 7. Full Validation
- Run the **entire** test suite (not just your new tests).
- Run type checker, linter, compiler, bundle size check — everything available.
- Fix any failures or regressions you introduced.

### 8. Review Agent Pass (Post-Implementation)
- Run all 6 review personas against the actual implementation diff.
- Loop back to step 6 if any persona raises a blocking concern.
- This is your quality gate. Do not skip it.

### 9. Commit, Clean Up & Document
- Add a `CHANGELOG.md` entry under `## [Unreleased]` describing what was done from the user's perspective.
- Commit with a detailed message structured as:
```
feat|fix|chore(scope): short summary

## What

- Describe what changed and why

## Testing

- What tests were added/changed

## Notes

- Anything the human reviewer should pay attention to
```

**Cleanup checklist (do ALL of these):**
- `git rm` the completed spec from `Agent/Specs/`.
- Remove the completed task row from the Task List in `AGENTS.md`.
- Delete any scratch/planning files created during the task.
- **Update affected docs:** Check which files in `Agent/Docs/` cover the area you just changed. If behavior, APIs, domain rules, user flows, or architecture changed, update those docs NOW — not later.
- Commit cleanup: `chore: complete {task-name} — remove spec, update task list`
- **Verify:** `ls Agent/Specs/` should not contain the completed spec. The task row should be gone from `AGENTS.md`. No scratch files should exist.

### 10. Next Task
- Loop back to step 1.
- If no tasks remain, proceed to wrap-up.

---

## Wrap-Up

When all tasks are complete (or you've hit blockers on everything remaining):

1. Produce `Agent/NIGHT_SHIFT_REPORT.md` using the template below.
2. Update `CHANGELOG.md` with brief one-liners for each completed task.
3. **Docs audit:** Read each doc in `Agent/Docs/` and verify it still reflects the current code. Fix any stale references, outdated descriptions, or missing coverage from tonight's work.
4. **Final cleanup check:**
   - `ls Agent/Specs/` — only `draft-*` specs and unstarted specs should remain
   - No scratch files, planning files, or untracked debris anywhere
   - Working tree is clean (`git status` shows nothing)
   - `Agent/` folder should look the same as before the shift, minus completed specs
5. Stop. Go silent. Wait for the human.

### Report Template

Write `Agent/NIGHT_SHIFT_REPORT.md` with this structure:

```markdown
# Night Shift Report — {YYYY-MM-DD}

## Completed

### {Task Name}
**Commits:** {hash list with one-line summaries}
**What changed:** {2-3 sentence summary}

**How to verify:**
1. {Specific step-by-step manual testing instructions}
2. {Pages to visit, actions to take, expected results}
3. {Platforms to check: web / iOS / Android}

---

## Blocked
### {Task Name} (if any)
**Reason:** {why}
**What's needed:** {specific input needed}

## Issues Discovered
- {one line each}

## Docs Updated
- {one line each}
```

---

## Rules

- **Never ask the human a question.** They are asleep.
- **Never skip tests.** If you can't write tests for something, document why and move on.
- **Never skip review personas.** They catch what you miss.
- **Always update docs** when behavior changes.
- **Prefer small, focused commits** over one giant commit per feature.
- **If something feels wrong, stop and document it** rather than shipping garbage.
- **Clean up after yourself.** Completed specs get `git rm`'d. Planning files get deleted. The working tree should be clean when you're done.
- **Burn tokens freely** on reviews, retries, and quality. Human time is expensive. Yours is not.
