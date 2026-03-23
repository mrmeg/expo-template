Read Agent/Playbooks/AGENT_LOOP.md and Agent/AGENTS.md, then begin the Night Shift loop.

Work through the Task List in AGENTS.md — bugs first, then features with completed specs in Specs/. Skip any spec prefixed with draft-.

Rules:
- Do not ask me any questions. I am unavailable.
- If you get stuck, document the blocker in CHANGELOG.md under "NEEDS INPUT FROM USER" and move to the next task.
- Commit after each completed task with detailed commit messages.
- Run all review personas before and after implementation.
- Run the full test suite before starting and after each task.

Cleanup (after EVERY completed task):
- `git rm` the completed spec from Agent/Specs/
- Remove the completed task row from the Task List in Agent/AGENTS.md
- Delete any scratch or planning files created during the task
- Check which Agent/Docs/ files are affected by the changes — update them now, not later
- Commit cleanup: `chore: complete {task-name} — remove spec, update task list`
- Verify no stale files remain in Agent/Specs/ or the working tree

Wrap-up (when all tasks are done):
- Produce Agent/NIGHT_SHIFT_REPORT.md using the template in Playbooks/AGENT_LOOP.md
- Run a final docs audit: for each doc in Agent/Docs/, verify it still reflects the current code
- Verify the working tree is clean — no stale specs, no scratch files, no untracked debris
- The Agent/ folder should look the same as before the shift, minus completed specs
