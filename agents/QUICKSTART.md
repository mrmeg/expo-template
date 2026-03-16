# Night Shift — Quick Start Prompts

Copy-paste these into Claude Code to get going.

---

## 1. Kick Off a Night Shift

Use this when you're done for the day and specs are ready.

```
Read @Agent/AGENT_LOOP.md and @Agent/AGENTS.md, then begin the Night Shift loop. Work through TODOS.md — bugs first, then features with completed specs. Do not ask me any questions. If you get stuck, document the blocker in TODOS.md under "NEEDS INPUT FROM USER" and move to the next task. Commit after each completed task. Write a concise report when done.
```

---

## 2. Morning Review — Fix a Mistake

Use this when you find something wrong in the night shift's work. **Don't just fix the code** — fix the root cause in docs/workflow first.

```
I found an issue with your commit [COMMIT HASH or description]. Before fixing the code, I need you to analyze WHY you made this mistake. Look at the docs, specs, and workflow files you were operating from. Tell me:

1. What doc, skill, or workflow instruction led you to this decision?
2. What change to that doc/instruction would have led you to the right decision?
3. Make that doc/workflow fix first, then fix the original code issue.
```

---

## 3. Day Shift — Ask Mode (Quick Research)

Use this during the day when you need concise info while writing specs.

```
I'm in day shift mode. I need sharp, concise answers only — no lengthy explanations. I'm writing a spec and need to know: [YOUR QUESTION]
```

---

## 4. Day Shift — Spec Review

Use this when your spec is drafted and you want the agent to poke holes.

```
Read this spec: @Specs/[YOUR-SPEC-FILE].md

Act as a critical reviewer. Tell me:
1. What edge cases am I missing?
2. What could go wrong that I haven't accounted for?
3. What's ambiguous that the night shift agent might misinterpret?

Be concise. Bullet points only.
```

---

## 5. Bootstrap Docs for an Existing Project

Use this to seed the Docs/ folder from an existing codebase.

```
Read @Agent/AGENTS.md to understand the doc structure. Then analyze this codebase and generate initial versions of each doc listed in the System Docs table:

- Docs/ARCHITECTURE.md — document the system design as it exists today
- Docs/API.md — document existing endpoints and schemas
- Docs/DESIGN.md — document existing UI patterns and component conventions
- Docs/DOMAIN.md — document business entities, rules, and invariants
- Docs/PERFORMANCE.md — note any obvious performance considerations
- Docs/USER_FLOWS.md — document the key user journeys

Keep each doc concise but accurate. Flag anything you're uncertain about with a <!-- NEEDS HUMAN REVIEW --> comment.
```

---

## 6. Second Agent as Reviewer (Experimental)

Run this in a separate terminal (e.g., Codex) while Claude Code runs the main loop.

```
I have another agent doing the AGENT_LOOP.md right now, working through TODOS.md. What I'd like you to do is run your own loop as an expert reviewer.

1. Sleep for 5 minutes at a time.
2. Wake up and check the git log for new commits.
3. Review each new commit against its corresponding TODOS.md entry and spec.
4. Write your feedback in Agent/REVIEWER_NOTES.md.
5. The other agent will check that file and incorporate your feedback.
6. If no new commits appear for 30 minutes, stop.
7. If all TODOs are complete or moved to NEEDS INPUT FROM USER, stop.
```

---

## Folder Structure Reference

```
your-project/
├── Agent/
│   ├── AGENT_LOOP.md        ← Night shift operating procedure
│   ├── AGENTS.md             ← Router — where to find everything
│   └── REVIEW_PERSONAS.md    ← 6 review personas for quality gates
├── Specs/
│   ├── _TEMPLATE.md          ← Copy this for each new spec
│   ├── draft-003-feature.md  ← Agent skips drafts
│   └── 001-feature-name.md   ← Ready specs (no draft- prefix)
├── Docs/
│   ├── ARCHITECTURE.md       ← System design (Architect owns)
│   ├── API.md                ← Endpoints & schemas (Code Expert owns)
│   ├── DESIGN.md             ← UI patterns (Designer owns)
│   ├── DOMAIN.md             ← Business rules (Domain Expert owns)
│   ├── PERFORMANCE.md        ← Perf budgets (Performance Expert owns)
│   └── USER_FLOWS.md         ← User journeys (Human Advocate owns)
├── TODOS.md                  ← Task queue + night shift reports
└── CHANGELOG.md              ← Human-facing changelog
```
