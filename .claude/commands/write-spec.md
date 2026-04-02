I need a spec written for: $ARGUMENTS

## Procedure

1. Read Agent/AGENTS.md for project context
2. Read relevant docs from Agent/Docs/ for the affected area
3. Investigate the relevant source code — understand the current state thoroughly before writing anything
4. Write a complete spec in Agent/Specs/ following this structure:

```
# Spec: {Title}

**Status:** Draft
**Priority:** {High/Medium/Low}
**Scope:** {Server / Client / Server + Client}

---

## What
{2-3 sentences on what's being built or fixed}

## Why
{Business value, user impact, or technical motivation}

## Current State
{What exists today — specific files, functions, behavior. Be precise.}

## Changes
{Numbered sections with implementation details. Include code snippets where they clarify intent. Each change should name the files affected.}

## Acceptance Criteria
{Numbered, testable criteria}

## Constraints
{What NOT to change, backward compatibility, performance budgets}

## Out of Scope
{Explicitly excluded follow-ups — prevents scope creep during implementation}

## Files Likely Affected
{Grouped by Server / Client}

## Edge Cases
{Bullet list with expected behavior for each}

## Risks
{What could go wrong and how to mitigate — optional, include if non-trivial}
```

5. Save as `draft-{kebab-case-name}.md` in Agent/Specs/
6. Add a row to the Task List in Agent/AGENTS.md with Status: Draft

After writing, tell me to run `/review-spec draft-{name}.md` to review and promote to Ready.
