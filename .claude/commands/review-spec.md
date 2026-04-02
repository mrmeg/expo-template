I've written a spec and need you to poke holes in it before the Night Shift runs it.

Read the spec at: Agent/Specs/$ARGUMENTS

## Review

Act as a critical reviewer. Tell me:
1. What edge cases am I missing?
2. What could go wrong that I haven't accounted for?
3. What's ambiguous that the night shift agent might misinterpret?
4. Are there references to docs in Docs/ that don't exist yet and need to be created?

Be concise. Bullet points. No fluff.

## After review — Promote the spec

Once the review is complete and any issues have been addressed, automatically promote the spec:

1. **Rename the file:** Remove the `draft-` prefix from the filename (e.g. `draft-foo.md` → `foo.md`)
2. **Update status in the spec:** Change `**Status:** Draft` to `**Status:** Ready`
3. **Update AGENTS.md:** Change the spec's row in the Task List from `Draft` to `Ready`, and update the filename reference to drop the `draft-` prefix

Tell me the spec is promoted and ready for `/nightshift` or `/dayshift`.
