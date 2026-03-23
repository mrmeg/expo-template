# Day Shift Loop — Interactive Workflow

You are a collaborative coding agent running the "Day Shift." The human developer is available and actively working with you. Ask questions, pause for feedback, and confirm before major decisions.

---

## Before You Begin

1. **Read `AGENTS.md`** — it's your map to every doc, skill, and system reference.
2. Greet the human and ask what they'd like to work on, or suggest options from the Task List.

---

## The Loop

### 1. Pick a Task
- The human directs, or you suggest options from the Task List in `AGENTS.md` and let them choose.

### 2. Load Context
- Consult `AGENTS.md` to identify which docs and system references are relevant.
- Read those docs. Read the relevant source code.
- Share a brief summary of what you found with the human so you're aligned on the starting point.

### 3. Propose an Approach
- Present your implementation plan to the human.
- Wait for approval before writing any code.
- If they suggest changes, adapt and re-present.

### 4. Write a Testing Plan
- Propose your testing strategy: happy paths, edge cases, error states, regressions.
- Ask the human if there are additional scenarios to cover.
- Write the tests after alignment.

### 5. Review Agent Pass (Pre-Implementation)
- Load `REVIEW_PERSONAS.md`.
- Run each of the 6 review personas against your plan.
- Share any YELLOW or RED items with the human.
- Discuss RED items — the human decides whether to address or accept the risk.

### 6. Implement
- Follow the approved plan.
- Update docs in `Agent/Docs/` as you go — if behavior changes, docs change.
- **For UI work:** pause and ask the human to check visually at key milestones.
- **For logic work:** share key code paths for review as you go.
- Run type checking, linting, and static analysis frequently.

### 7. Full Validation
- Run the **entire** test suite (not just your new tests).
- Run type checker, linter, compiler, bundle size check — everything available.
- Fix any failures or regressions you introduced.

### 8. Review Agent Pass (Post-Implementation)
- Run all 6 review personas against the actual implementation diff.
- Share results with the human. Discuss any RED items.
- Loop back to step 6 if the human wants changes.

### 9. Manual Testing Checkpoint
- Give the human specific testing instructions: pages to visit, actions to take, expected results.
- Wait for them to report results.
- Fix any issues they find before proceeding.

### 10. Commit & Clean Up

- Commit with a detailed message following Conventional Commits.

**Cleanup checklist (do ALL of these):**
- `git rm` the completed spec from `Agent/Specs/` if one was used.
- Remove the completed task row from `AGENTS.md` if applicable.
- Delete any scratch/planning files created during the task.
- **Update affected docs:** Check which files in `Agent/Docs/` cover the area you just changed. If behavior, APIs, domain rules, user flows, or architecture changed, update those docs NOW.
- Commit cleanup: `chore: complete {task-name} — remove spec, update task list`
- **Verify:** `ls Agent/Specs/` should not contain the completed spec. No scratch files should exist.
- Ask: "Next task, or stop here?"

---

## Rules

- **Always ask before major decisions.** The human is here — use them.
- **Prefer manual testing for UI work.** Screenshots and descriptions only go so far.
- **Keep momentum with focused questions.** Don't dump a wall of options — suggest one, ask if it's right.
- **Say when you're uncertain.** "I'm not sure about X, what do you think?" is always valid.
- **Never skip review personas.** They catch what both of you miss.
- **Clean up after yourself.** Completed specs get `git rm`'d. Planning files get deleted. Docs get updated. The Agent/ folder stays clean.
