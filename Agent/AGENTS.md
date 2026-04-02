# AGENTS.md — Agent Router

This file tells you where to find everything. **Read this first on every run.**

---

## Task List

Pick tasks from `./Specs/`. Work specs marked **Ready** in priority order. Bugs first, then features.

| Spec | Status | Priority |
|------|--------|----------|

## Workflow

| Doc | Path | Purpose |
|-----|------|---------|
| Agent Loop | `./Playbooks/AGENT_LOOP.md` | Autonomous night shift operating procedure |
| Day Shift Loop | `./Playbooks/DAY_SHIFT_LOOP.md` | Interactive daytime operating procedure |
| Review Personas | `./Playbooks/REVIEW_PERSONAS.md` | 6 reviewer personas for plan/code review |
| Workflow Guide | `./Playbooks/WORKFLOW_GUIDE.md` | Overview of both workflows |
| Changelog | `./CHANGELOG.md` | Human-facing changelog |
| Specs | `./Specs/` | Feature/bug specs for the night shift |

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
| App Overview | `./Docs/APP_OVERVIEW.md` | — | High-level app overview |

## Tech Stack Reference

| Layer | Tech | Notes |
|-------|------|-------|
| Framework | Expo SDK 55 / React Native 0.83.2 | New architecture enabled |
| UI | React 19.2.0 / TypeScript 5.9 (strict) | Typed routes, strict mode |
| Routing | Expo Router v55 | File-based, async routes on web |
| State (client) | Zustand 5.0 | 7 stores, persisted (AsyncStorage / localStorage) |
| State (server) | TanStack React Query 5.90 | 5min staleTime, smart retry |
| Auth | AWS Amplify 6.16 + Cognito | Hub listeners, auto token refresh |
| Storage | Cloudflare R2 (S3-compatible) | Presigned URLs for upload/download |
| i18n | i18next + expo-localization | en/es, type-safe keys, RTL support |
| UI Primitives | @rn-primitives (18 packages) | Dialog, tabs, select, radio, dropdown, etc. |
| Forms | react-hook-form 7.72 + zod 4.3 | Schema validation, 6 form adapters |
| Animations | react-native-reanimated 4.2 | Spring/timing, reduced motion support |
| Gestures | react-native-gesture-handler 2.30 | Platform-specific setup |
| Media | expo-image-picker, expo-image-manipulator | Compression presets, HEIC conversion |
| Error Tracking | @sentry/react-native 8.6 | Zero-impact without DSN |
| Fonts | Lato (400/700) via expo-font | 5s timeout, system fallback |
| Server | Express 5.2 | Compression, CORS, rate limiting, security headers |
| Testing | Jest 29 + jest-expo | @testing-library/react-native, 98 tests |
| CI/CD | GitHub Actions | typecheck, lint, test on PRs |
| Linting | ESLint 10 (flat config) | Double quotes, always semicolons |
| Package Manager | bun | bun.lock, frozen-lockfile in CI |
| Dev Tools | Reactotron | Dev-only, zero prod overhead |

## Conventions

- **Commit style:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)
- **Branch strategy:** All night shift work stays on a single branch. Commits stack.
- **Test location:** Tests live next to source files as `*.test.ts` (adjust per project)
- **Doc updates:** If you change behavior, update the relevant doc in `./Docs/`. Always.

## How to Use This File

1. Starting a task? Load the relevant docs from the table above.
2. Unsure about architecture? Read `ARCHITECTURE.md`.
3. Unsure about a business rule? Read `DOMAIN.md`.
4. Writing UI? Read `DESIGN.md`.
5. Review phase? Each persona reviews against the doc they own.
6. If a doc doesn't exist yet, **create it** in `./Docs/` and flag it for human review.
