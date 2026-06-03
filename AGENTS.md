## Agent Workflow

This is the repo guidance file and HTML plan index. Keep it short, current, and easy to edit.

### How To Work

- Read this file first, then load only the active plan, relevant docs, and source files needed for the task.
- For planned work, create a readable HTML plan in `Agent/Plans/{slug}.html`.
- Keep the Task List synchronized with each plan's status.
- Ask only for irreversible decisions, genuine ambiguity, or blockers.
- Validate with fresh command output. Never claim tests, builds, UI checks, or CI passed from memory.
- Update `Agent/Docs/` only when there is durable project knowledge worth keeping.

### Task List

| Plan | Status | Priority | Type | Area | Blocked By |
|------|--------|----------|------|------|------------|
| [`publish-expo-media-0-1-1.html`](Agent/Plans/publish-expo-media-0-1-1.html) | Blocked | High | Package release | `packages/media` | npm trusted publishing or `NPM_TOKEN` for `@mrmeg/expo-media@0.1.1` |

### System Docs

`Agent/Docs/` may be empty. Add rows only for docs that exist and are worth maintaining. Keep docs lightweight: durable summaries, source pointers, invariants, and gotchas. Avoid pasted code, inventories, and completed-task history.

| Doc | Path | Purpose |
|-----|------|---------|
| Architecture | [`Agent/Docs/ARCHITECTURE.md`](Agent/Docs/ARCHITECTURE.md) | App shape, package boundaries, server/runtime flow |
| API | [`Agent/Docs/API.md`](Agent/Docs/API.md) | Route families, auth/error contracts, env-gated behavior |
| Design | [`Agent/Docs/DESIGN.md`](Agent/Docs/DESIGN.md) | UI package conventions and reusable component rules |
| Domain | [`Agent/Docs/DOMAIN.md`](Agent/Docs/DOMAIN.md) | Template invariants for auth, media, billing, onboarding |
| Performance | [`Agent/Docs/PERFORMANCE.md`](Agent/Docs/PERFORMANCE.md) | Bundle budget, SSR hydration, worker and caching notes |
| User Flows | [`Agent/Docs/USER_FLOWS.md`](Agent/Docs/USER_FLOWS.md) | Core launch, auth, media, billing, settings, error flows |
| SSR Hydration | [`docs/ssr-hydration.md`](docs/ssr-hydration.md) | Detailed web SSR mismatch checklist and verification commands |
| Bundle Analysis | [`docs/bundle-analysis.md`](docs/bundle-analysis.md) | Bundle-size guard usage and baseline update steps |
| Error Tracking | [`docs/error-tracking.md`](docs/error-tracking.md) | Sentry runtime and native upload setup |

### Tech Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Package manager | Bun | `bun.lock`; CI installs with `bun install --frozen-lockfile` |
| App runtime | Expo SDK 56, React 19.2, React Native 0.85 | Expo Router entry, native and web targets |
| Router | Expo Router 56 | Typed routes, API routes, server output, server middleware and data loaders enabled |
| Language | TypeScript 6 strict | Path alias `@/*` points at repo root |
| UI | `@mrmeg/expo-ui` workspace package | RN primitives, design tokens, theme state, reusable components |
| Media | `@mrmeg/expo-media` workspace package | Client hooks, processing helpers, S3/R2 server handlers |
| State/data | Zustand 5, TanStack React Query 5 | Persisted client stores; query defaults live in app providers |
| Auth | AWS Amplify/Cognito | Optional; disabled unless both public Cognito env vars are set |
| Billing | Stripe hosted-external baseline | Optional; disabled unless Stripe/server env is configured |
| Server | Bun server plus Express fallback | Expo Server adapter, compression, CORS, rate limits, security headers |
| Observability | Sentry React Native | Runtime DSN and native upload config are separately env-gated |
| Testing | Jest 29, jest-expo, RNTL 13 | `bun run typecheck`, `lint`, `check:features`, `test:ci`, package gates |
| CI | GitHub Actions | Validate job plus parallel web build and bundle-size job |

### Agent Artifacts

- `Agent/Plans/` holds active HTML plans.
- `Agent/Docs/` is optional and should stay concise.
- Do not create personas, constitutions, shift reports, archive folders, or markdown specs.
- Legacy `Agent/Specs/*.md`, shift reports, and changelog files were not restored during bootstrap; keep new planned work in `Agent/Plans/*.html`.

### Review Checklist

- Plan matches current code and docs.
- Tests cover the changed behavior or the skip reason is documented.
- Docs are updated only when behavior changed and the note is durable.
- No archive, completed, scratch, or stale report files under `Agent/`.

### Project Notes

- Use the exact package scripts in `package.json`; do not substitute generic Expo or npm commands when a local Bun script exists.
- Quote route paths with parentheses or brackets in shell commands, for example `'app/(main)/(tabs)/index.tsx'`.
- Optional auth, billing, media, and Sentry features must fail closed when env is missing; a blank `.env` should keep the template explorable.
- Reusable UI belongs in `packages/ui`; reusable media contracts and processing belong in `packages/media`. App integrations stay under `client/`, `server/`, `app/api/`, or `shared/`.
- For web SSR or hydration work, read `docs/ssr-hydration.md` before editing and verify with real server HTML, not only Jest or `tsc`.
