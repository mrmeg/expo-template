Give me a quick project status dashboard. No prose — just structured info.

Show:
1. **Task List** — current contents of the Task List table in Agent/AGENTS.md
2. **Draft Specs** — any files in Agent/Specs/ prefixed with `draft-`
3. **Recent Commits** — last 10 commits (`git log --oneline -10`)
4. **Blockers** — check Agent/CHANGELOG.md for any "NEEDS INPUT FROM USER" entries
5. **Pending Review** — check if Agent/NIGHT_SHIFT_REPORT.md exists (means morning review is needed)
6. **Docs Freshness** — for each doc in Agent/Docs/, show last modified date and whether it's likely stale based on recent commits touching related areas
