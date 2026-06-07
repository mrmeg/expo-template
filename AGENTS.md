## Project Guidance

This repo is a Bun-managed Expo template with reusable UI and media packages.
Do normal coding work directly unless the user explicitly asks for a plan.

### How To Work

- Read this file first, then load only the docs and source files needed for the task.
- Validate with fresh command output. Never claim tests, builds, UI checks, or CI passed from memory.
- Keep durable template guidance in `docs/` or the relevant package README.
- Keep reusable UI in `packages/ui`; keep reusable media contracts and processing in `packages/media`.
- App integrations stay under `client/`, `server/`, `app/api/`, or `shared/`.

### Docs

| Doc | Path | Purpose |
|-----|------|---------|
| Template Guide | [`docs/template-modernization-guide.md`](docs/template-modernization-guide.md) | LLM-facing component, screen-template, and modernization reference |
| SSR Hydration | [`docs/ssr-hydration.md`](docs/ssr-hydration.md) | Detailed web SSR mismatch checklist and verification commands |
| Bundle Analysis | [`docs/bundle-analysis.md`](docs/bundle-analysis.md) | Bundle-size guard usage and baseline update steps |
| Error Tracking | [`docs/error-tracking.md`](docs/error-tracking.md) | Sentry runtime and native upload setup |
| UI Package | [`packages/ui/README.md`](packages/ui/README.md) | `@mrmeg/expo-ui` install, setup, components, theming, publishing |
| Media Package | [`packages/media/README.md`](packages/media/README.md) | `@mrmeg/expo-media` install, setup, processing, server handlers |

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

### Project Notes

- Use the exact package scripts in `package.json`; do not substitute generic Expo or npm commands when a local Bun script exists.
- Quote route paths with parentheses or brackets in shell commands, for example `'app/(main)/(tabs)/index.tsx'`.
- Optional auth, billing, media, and Sentry features must fail closed when env is missing; a blank `.env` should keep the template explorable.
- For web SSR or hydration work, read `docs/ssr-hydration.md` before editing and verify with real server HTML, not only Jest or `tsc`.
