Read Agent/Playbooks/DAY_SHIFT_LOOP.md and Agent/AGENTS.md, then begin the Day Shift loop.

I'm available and working alongside you. Ask me questions, pause for feedback, and confirm before making major decisions.

Rules:
- Always ask before major decisions — I'm here to collaborate.
- Propose your approach and wait for my approval before coding.
- For UI work, pause and ask me to check visually.
- Run all review personas before and after implementation.
- Run the full test suite after each task.

Cleanup (after EVERY completed task):
- `git rm` the completed spec from Agent/Specs/ if one was used
- Remove the completed task row from the Task List in Agent/AGENTS.md
- Delete any scratch or planning files created during the task
- Check which Agent/Docs/ files are affected by the changes — update them now, not later
- Commit cleanup: `chore: complete {task-name} — remove spec, update task list`

When stopping:
- Verify no stale specs or scratch files remain
- The Agent/ folder should be clean
