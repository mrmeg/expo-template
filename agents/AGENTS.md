# AGENTS.md — Agent Router

This file tells you where to find everything. **Read this first on every run.**

---

## Workflow

| Doc | Path | Purpose |
|-----|------|---------|
| Agent Loop | `./Agent/AGENT_LOOP.md` | Your main operating procedure |
| Review Personas | `./Agent/REVIEW_PERSONAS.md` | 6 reviewer personas for plan/code review |
| Specs | `./Specs/` | Feature specifications (skip `draft-*` files) |
| TODOs | `./TODOS.md` | Bug list, task queue, and blockers |
| Changelog | `./CHANGELOG.md` | Human-facing changelog |

## System Docs

<!-- Add rows as your project grows. These are the docs review personas "own." -->

| Doc | Path | Owned By | Purpose |
|-----|------|----------|---------|
| Architecture | `./Docs/ARCHITECTURE.md` | Architect | System design, data flow, key decisions |
| API Reference | `./Docs/API.md` | Code Expert | Endpoints, schemas, auth patterns |
| UI/UX Guide | `./Docs/DESIGN.md` | Designer | Design system, components, patterns |
| Domain Model | `./Docs/DOMAIN.md` | Domain Expert | Business rules, entities, invariants |
| Performance | `./Docs/PERFORMANCE.md` | Performance Expert | Budgets, benchmarks, known bottlenecks |
| User Flows | `./Docs/USER_FLOWS.md` | Human Advocate | Key user journeys, accessibility notes |

## Tech Stack Reference

<!-- Customize this section for your project -->

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | React Native / Expo | — |
| Backend | Node.js / Bun on Railway | — |
| Database | SQLite / PostgreSQL via Drizzle | — |
| Edge | Cloudflare Workers / Pages | — |
| Auth | — | Fill in per project |
| Payments | Stripe Connect | — |
| Email | AWS SES | — |
| CI/Testing | — | Fill in per project |

## Conventions

- **Commit style:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)
- **Branch strategy:** All night shift work stays on a single branch. Commits stack.
- **Test location:** Tests live next to source files as `*.test.ts` (adjust per project)
- **Doc updates:** If you change behavior, update the relevant doc in `./Docs/`. Always.

## How to Use This File

1. Starting a task? Check the spec in `./Specs/`, then load the relevant docs from the table above.
2. Unsure about architecture? Read `ARCHITECTURE.md`.
3. Unsure about a business rule? Read `DOMAIN.md`.
4. Writing UI? Read `DESIGN.md`.
5. Review phase? Each persona reviews against the doc they own.
6. If a doc doesn't exist yet, **create it** with what you know and flag it for human review.
