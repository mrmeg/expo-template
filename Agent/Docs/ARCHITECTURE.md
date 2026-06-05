# Architecture

This repo is a Bun-managed Expo template with a universal app, server-rendered
web output, API routes, and two publishable workspace packages.

## Primary Shape

| Area | Source | Notes |
|------|--------|-------|
| Route tree | `app/` | Expo Router layouts, tabs, demos, `+html`, `+middleware`, and API routes |
| App code | `client/` | Feature folders, screens, app-local hooks, config, API clients, storage, Sentry |
| Server adapters | `server.bun.ts`, `server/index.ts`, `server/` | Bun is default production server; Express remains fallback |
| Shared contracts | `shared/` | Client/server types such as billing and media compatibility helpers |
| UI package | `packages/ui/` | `@mrmeg/expo-ui` components, tokens, hooks, state, lib exports |
| Media package | `packages/media/` | `@mrmeg/expo-media` client hooks, processing helpers, server handlers |
| Existing reference docs | `docs/` | SSR hydration, bundle analysis, Sentry setup |

## Runtime Flow

`app/_layout.tsx` owns the provider stack and app startup gate. Startup waits
for resources, i18n, onboarding state, and optional auth bootstrap before
hiding the splash screen.

Web uses `app.config.ts` with `web.output = "server"` and Expo Router server
features enabled. `expo export -p web` produces `dist/client` static assets and
`dist/server` SSR output. `server.bun.ts` serves compressed static assets and
hands SSR requests to `expo-server/adapter/bun`.

API route files live under `app/api/**/+api.ts`. Shared route behavior lives in
`server/api/shared/`, while domain-specific adapters live under
`server/api/billing/`, `server/api/media/`, and package server exports.

## Feature Boundaries

Feature code lives in `client/features/<feature>`. Features should be portable
by default and use these shared surfaces instead of importing sibling feature
internals:

- `@mrmeg/expo-ui/*`
- `@mrmeg/expo-media/*`
- `client/lib/*`
- `client/hooks/*`
- `client/state/*`
- `shared/*`

Allowed cross-feature edges are intentionally narrow:

| Feature | May import from | Reason |
|---------|-----------------|--------|
| `app` | `auth`, `i18n`, `keyboard`, `onboarding` | Root startup, providers, bootstrap, and gates |
| `billing` | `auth` | Identity for billing requests only |
| `server-alpha` | none | Self-contained server/data-loader demo pattern |

`scripts/check-feature-isolation.js` and
`client/features/__tests__/featureIsolation.test.ts` enforce this contract.

## Package Boundaries

`packages/ui` must stay app-agnostic. It can own tokens, primitives, theme
state, haptics, animation helpers, and global UI state. It must not import from
`@/client/*`.

`packages/media` must stay framework-adapter friendly. It owns reusable media
contracts, processing, React Query factories, key helpers, and S3/R2 handler
factories. App-specific auth, CORS, bucket env names, route files, and UI stay
outside the package.

Workspace development resolves both packages with `workspace:*`. Published
consumers use package exports from npm.

## Data And Server Patterns

- React Query is used for server state; Zustand is used for client state.
- Persisted stores use AsyncStorage on native and localStorage on web.
- API clients return typed results or typed problem objects instead of letting
  UI code reason over raw `Response` details.
- Optional subsystems fail closed when env is missing: auth disables gates,
  billing returns `billing-disabled`, media returns `media-disabled`, and
  Sentry stays inert.

## Gotchas

- SSR and hydration invariants are detailed in `docs/ssr-hydration.md`; read it
  before changing `app/+html.tsx`, font loading, i18n startup, viewport logic,
  theme startup, or onboarding startup.
- `metro.config.js`, `server.bun.ts`, `server/index.ts`, and
  `server/ffmpegWorker.js` share the web FFmpeg worker contract. Keep the URL
  and file path synchronized.
- `app.identity.js` and `app.identity.d.ts` are the app identity source of
  truth used by `app.config.ts` and runtime deep-link helpers.
