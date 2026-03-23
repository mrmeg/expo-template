Review recent changes and update Agent/Docs/ to stay current.

## Procedure

1. Run `git log --oneline -20` and `git diff main...HEAD --stat` to see what changed
2. Read Agent/AGENTS.md to understand which docs exist and who owns them
3. For each doc in Agent/Docs/:
   - Read the doc
   - Check if recent code changes affect its content
   - If yes, update it with accurate information from the current code
   - If it references files, functions, or endpoints that no longer exist, fix or remove the references
   - If new features or patterns were added that belong in this doc, add them
4. Report what you updated and why in a short summary

## Rules
- Only update what actually changed — don't rewrite for the sake of it
- Flag anything uncertain with <!-- NEEDS HUMAN REVIEW -->
- Keep the existing tone, structure, and level of detail
- If a doc is already accurate, skip it and say so
- Do NOT create new doc files — only update existing ones. If a new doc is needed, tell me and I'll decide.
