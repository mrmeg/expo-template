I'm starting an investigation session to surface issues and turn them into specs.

Topic: $ARGUMENTS

## Procedure

### 1. Load context
- Read Agent/AGENTS.md for the current task list and system overview
- Read relevant docs from Agent/Docs/ based on the topic
- If no topic was given, read APP_OVERVIEW.md and ARCHITECTURE.md for a broad view

### 2. Investigate

**If a topic was given:**
- Deep dive into that area — read source files, trace data flows, check tests
- Look for bugs, missing edge cases, inconsistencies, performance issues, UX gaps
- Cross-reference against Agent/Docs/ for drift between docs and code

**If no topic was given, scan broadly:**
- Check recent git log for areas of churn
- Grep for TODO, FIXME, HACK, TEMP, XXX comments in source
- Compare USER_FLOWS.md against actual implementation for gaps
- Check PERFORMANCE.md for unresolved bottlenecks
- Look for inconsistencies between DOMAIN.md business rules and code
- Identify missing or inadequate test coverage

### 3. Present findings

For each finding, show:
- **What:** One-line description
- **Where:** File(s) and line(s) affected
- **Type:** Bug / Improvement / Feature / Tech Debt
- **Effort:** Small / Medium / Large
- **Why it matters:** One sentence on user or system impact

Sort by type (bugs first), then effort (quick wins first).

### 4. Ask me which findings should become specs

Wait for my input. I'll tell you which ones to write up.

### 5. Create specs for approved findings

For each approved finding, create a spec in Agent/Specs/ following the established format:

```
# Spec: {Title}

**Status:** Draft
**Priority:** {High/Medium/Low}
**Scope:** {Server / Client / Server + Client}

---

## What
## Why
## Current State
## Changes
## Acceptance Criteria
## Constraints
## Out of Scope
## Files Likely Affected
## Edge Cases
```

- Save as `draft-{kebab-case-name}.md` in Agent/Specs/
- Add a row to the Task List in Agent/AGENTS.md with Status: Draft

### 6. Summary

When done, list the specs created and remind me:
- `/review-spec draft-{name}.md` to poke holes before promoting
- Change Status from Draft to Ready and remove the `draft-` prefix when approved
