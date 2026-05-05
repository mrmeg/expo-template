# AGENTS.md — Agent Router

This file tells you where to find everything. **Read this first on every run.**

---

## Task List

Pick tasks from `./Specs/`. Work specs marked **Ready** in priority order. Bugs first, then features.

| Spec | Status | Priority |
|------|--------|----------|
| `publish-expo-media-0-1-1.md` | Blocked | High |
| `use-named-media-upload-policies.md` | Ready | Medium |

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
| Billing | `./Docs/BILLING.md` | Architect | Stripe subscriptions baseline (hosted-external), return contract, entitlement |
| Expo UI Package | `./Docs/EXPO_UI_PACKAGE.md` | Code Expert | Consumer integration reference for the private reusable UI package |
| Expo Media Package | `./Docs/EXPO_MEDIA_PACKAGE.md` | Code Expert | Consumer integration reference for the reusable media package |
| App Overview | `./Docs/APP_OVERVIEW.md` | — | High-level app overview |

## Tech Stack Reference

| Layer | Tech | Notes |
|-------|------|-------|
| Framework | Expo SDK 55 / React Native 0.83 | New Architecture enabled |
| Language | TypeScript 5.9 (strict) | Path alias `@/*` → root |
| UI | React 19.2, React Native Web 0.21 | Universal (iOS, Android, Web) |
| Router | Expo Router ~55 | File-based, typed routes, async web routes |
| State | Zustand 5, TanStack React Query 5 | Persisted stores (AsyncStorage / localStorage) |
| UI Primitives | @rn-primitives/* | shadcn-inspired, 35 components |
| Forms | react-hook-form 7 + Zod 4 | @hookform/resolvers for validation |
| Auth | AWS Amplify 6 + Cognito | Token injection via authenticatedFetch |
| Storage | AWS S3 (@aws-sdk/client-s3) | Presigned URLs, R2-compatible |
| i18n | i18next + expo-localization | en/es, lazy-loaded, RTL support |
| Animation | react-native-reanimated 4.2 | Worklets via react-native-worklets |
| Monitoring | Sentry (@sentry/react-native 8) | Optional, env-var gated |
| Server | Express 5 | Compression, CORS, rate limiting, security headers |
| Testing | Jest 29 + jest-expo + RNTL 13 | Coverage on client/**, 10s timeout |
| Linting | ESLint 10 flat config | Expo lint config |
| CI | GitHub Actions | Bun-based: typecheck → lint → feature isolation → test (validate job), build → bundle-size (bundle-size job, parallel) |
| Package Mgr | Bun | `bun.lock` committed for reproducible installs (`--frozen-lockfile` in CI) |
| Bundler | Metro (via Expo) | Reanimated wrapping, package dedup |
| Dev Tools | Reactotron | Dev-only, conditional init |

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
