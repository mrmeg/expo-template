Bootstrap project-specific documentation by analyzing this codebase.

## What this does

1. **Generate Agent/Docs/** — Create or overwrite each doc listed in the System Docs table in Agent/AGENTS.md by analyzing the actual codebase
2. **Populate Tech Stack** — Detect the project's tech stack and fill in the Tech Stack Reference table in Agent/AGENTS.md
3. **Update CLAUDE.md** — Append the Night Shift Workflow section to CLAUDE.md if not already present

## Procedure

### Step 1: Read Agent/AGENTS.md
Understand the doc structure and what needs to be generated.

### Step 2: Detect tech stack
Analyze the project for package.json, Cargo.toml, go.mod, requirements.txt, pyproject.toml, Gemfile, build.gradle, pom.xml, composer.json, mix.exs, Dockerfile, docker-compose, CI configs, etc. Identify:
- Framework and language
- Database and ORM
- Auth system
- Testing tools
- Build/deploy tools
- Key libraries

Update the Tech Stack Reference table in Agent/AGENTS.md with what you find.

### Step 3: Generate docs
For each doc in the System Docs table, analyze the codebase and generate project-specific content:

- **ARCHITECTURE.md** — system design, data flow, key decisions
- **API.md** — endpoints, schemas, auth patterns
- **DESIGN.md** — UI patterns, component conventions, design tokens
- **DOMAIN.md** — business entities, rules, invariants
- **PERFORMANCE.md** — obvious performance considerations, budgets
- **USER_FLOWS.md** — key user journeys

Create additional docs if the project warrants them (e.g., APP_OVERVIEW.md for complex apps). Add rows to the System Docs table for any new docs.

### Step 4: Append to CLAUDE.md
If CLAUDE.md exists but doesn't contain a "Night Shift Workflow" section, append:

```
## Night Shift Workflow

This project uses the Night Shift agentic workflow for autonomous overnight development.

### Key Paths
- `Agent/AGENTS.md` — Router to all docs and resources (read this first)
- `Agent/Playbooks/` — Workflow playbooks
- `Agent/Docs/` — System documentation (agents read AND update these)
- `Agent/CHANGELOG.md` — Human-facing changelog

### Slash Commands

**Spec creation:**
- `/investigate <topic>` — Surface issues and create specs
- `/write-spec <description>` — Create a spec when you know what to build
- `/review-spec <filename>` — Poke holes in a spec before a shift runs it

**Execution:**
- `/nightshift` — Kick off an autonomous night shift run
- `/dayshift` — Start an interactive day shift session
- `/morning-review` — Review night shift commits with feedback loop

**Maintenance:**
- `/status` — Quick dashboard of tasks, drafts, commits, blockers
- `/update-docs` — Refresh Agent/Docs/ after code changes
- `/bootstrap-docs` — Generate or refresh project docs from the codebase
- `/ask <question>` — Concise day-shift research helper
```

If CLAUDE.md doesn't exist, create it with just this section.

## Rules
- Keep each doc concise but accurate
- Flag anything uncertain with `<!-- NEEDS HUMAN REVIEW -->`
- Do not invent things that don't exist in the code — only document what you can verify
- If a doc already has real content, overwrite it (this command is meant to regenerate)

## When done
Show:
1. Detected tech stack summary
2. Which docs were generated
3. Anything flagged with `<!-- NEEDS HUMAN REVIEW -->`
4. Remind: `/investigate` to find work, `/write-spec` to create tasks
