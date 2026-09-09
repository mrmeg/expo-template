## Project Guidance

Bun-managed Expo template with reusable UI and media packages. Code directly
unless the user asks for a plan.

### How To Work

- Read this file first, then load only what the task needs.
- Validate with fresh command output; never claim tests, builds, UI checks, or CI passed from memory.
- Keep durable template guidance in `docs/` or the relevant package README.
- Reusable UI goes in `packages/ui`; reusable media contracts and processing in `packages/media`.
- App integrations stay under `client/`, `server/`, `app/api/`, or `shared/`.

### Docs

| Doc | Path | Purpose |
|-----|------|---------|
| LLM Entry Point | [`llms.txt`](llms.txt) | Index of fetchable LLM docs for external consumers |
| LLM Bundle | [`llms-full.txt`](llms-full.txt) | Generated concat of the LLM docs; rebuild with `bun run docs:llms` |
| LLM Examples Index | [`llms-examples.txt`](llms-examples.txt) | Generated raw-URL index of demo routes, screens, components, server files |
| Template Guide | [`docs/template-modernization-guide.md`](docs/template-modernization-guide.md) | LLM-facing component, screen-template, and modernization reference |
| Migration Guide | [`docs/migration-guide.md`](docs/migration-guide.md) | Portable, self-contained guide for migrating an external Expo app to this baseline |
| Server Guide | [`docs/server-guide.md`](docs/server-guide.md) | Server output, rendering, API routes, data loaders, middleware, replication checklist |
| Bundle Analysis | [`docs/bundle-analysis.md`](docs/bundle-analysis.md) | Bundle-size guard usage and baseline update steps |
| Error Tracking | [`docs/error-tracking.md`](docs/error-tracking.md) | Sentry runtime (native + web) and native upload setup |
| E2E Tests | [`docs/e2e.md`](docs/e2e.md) | Maestro blank-env smoke suite: flows, setup, selector conventions, CI status |
| Media Worker Migration | [`docs/media-worker-migration.md`](docs/media-worker-migration.md) | Shared media Worker contract, consumer migration checklists, legacy-worker teardown |
| UI Package | [`packages/ui/README.md`](packages/ui/README.md) | `@mrmeg/expo-ui` install, setup, components, theming, publishing |
| Media Package | [`packages/media/README.md`](packages/media/README.md) | `@mrmeg/expo-media` install, setup, processing, server handlers |

### Tech Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Package manager | Bun | `bun.lock`; CI installs with `bun install --frozen-lockfile` |
| App runtime | Expo SDK 57, React 19.2, React Native 0.86 | Expo Router entry, native and web targets |
| Router | Expo Router 57 | Typed routes, API routes, server output, server rendering, middleware and data loaders |
| Language | TypeScript 6 strict | Path alias `@/*` points at repo root |
| UI | `@mrmeg/expo-ui` workspace package | RN primitives, design tokens, theme state, reusable components |
| Media | `@mrmeg/expo-media` workspace package | Client hooks, processing helpers, S3/R2 server handlers |
| State/data | Zustand 5, TanStack React Query 5 | Persisted client stores; query defaults in app providers |
| Auth | Clerk or AWS Amplify/Cognito | Optional; env-selected (Clerk publishable key, or both Cognito vars; Cognito wins if both) behind a shared `AuthClient`/`TokenVerifier` |
| Billing | Stripe hosted-external baseline | Optional; disabled unless Stripe/server env is configured |
| Server | Bun server (`server.bun.ts`) | Expo Server adapter, compression, CORS, rate limits, security headers |
| Observability | `@sentry/react-native` (native), `@sentry/react` (web, lazy) | Runtime DSN and native upload config are separately env-gated |
| Testing | Jest 29, jest-expo, RNTL 14 | `bun run verify` runs CI's `validate` gates in order: `packages:peer-check`, `typecheck`, `lint`, `check:features`, `gen:templates:check`, `gen:blocks:check`, `docs:llms:check`, `docs:versions:check`, tests |

### Project Notes

- Use the exact package scripts in `package.json`; do not substitute generic Expo or npm commands when a local Bun script exists.
- Quote route paths with parentheses or brackets in shell commands, for example `'app/(main)/(tabs)/index.tsx'`.
- Auth, billing, media, and Sentry must fail closed when env is missing; a blank `.env` keeps the template explorable.
- Web is server-rendered per request: `web.output: "server"` plus `unstable_useServerRendering` runs routes, loaders, middleware, and API routes on the server, so the first response carries real route markup. The server has no DOM: anything the first render needs comes off the request (`server/lib/ssrViewport.ts`, `server/lib/ssrOnboarding.ts`), and styles must be registered at module scope for `client/features/app/SsrStyleFlush.tsx` to serialize them — see [`docs/server-guide.md`](docs/server-guide.md). Verify web changes in a browser against `bun run build && bun run start`, not only Jest or `tsc`.
- Five gallery routes under `app/(main)/(demos)` — `showcase/index.tsx`, `themed-showcase.tsx`, `components/index.tsx`, `components/[id].tsx`, `blocks/index.tsx` — are one-line lazy shells; edit the bodies in `client/showcase/*Screen.tsx`. Live previews stay out of the eager web bundle because they are reachable only through `client/showcase/gallery.tsx`, via the single `import()` in `client/showcase/lazyGallery.tsx`; `client/showcase/__tests__/gallerySplitPoint.test.ts` fails on a static import from outside `client/showcase/`.
- Generated artifacts, all gated by `bun run verify` and CI — regenerate and commit, never hand-edit: `client/templates/registry.generated.ts` and `client/blocks/registry.generated.ts` (`bun run gen:templates` / `gen:blocks`); `llms-full.txt` and `llms-examples.txt` (`bun run docs:llms`, built by `scripts/build-llms-full.mjs` from its source-doc list and directory walks — rerun after editing those docs or adding/removing demo routes, screens, components, or form wrappers). `bun run docs:versions:check` holds `README.md`'s version claims to `package.json`.


## Agent Workflow

<!-- agent-framework:v4 -->

Use this workflow only for planned work. Normal coding requests proceed directly.

- `write-spec` creates a self-contained spec in the tracked `Agent/` folder; `review-spec` marks it ready or blocked.
- `shift` implements ready specs. `dayshift` pins interactive mode; `nightshift` runs ready AFK specs without questions.
- Each spec becomes one `agent/*` branch and draft PR against its declared `base-branch`. After the PR opens, set the spec's `status: in-review` and its `pr` link, and commit that on the base branch. Never include `Agent/` files in `agent/*` PR diffs.
- `review-shift` reviews and merges those PRs.
- Keep target branches clean and synchronized. Verify with fresh command output.
