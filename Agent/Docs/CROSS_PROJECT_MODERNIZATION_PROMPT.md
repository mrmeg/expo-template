# Cross-Project Modernization Prompt

Use this prompt in other Expo app repos when you want an LLM agent to bring
the project closer to the current shared MrMeg Expo architecture.

## Copy Into Chats

```md
I want you to modernize this Expo app using my shared Expo architecture.

First, read this reference prompt from my local template repo:

`/Users/mattmegenhardt/Development/expo-template/Agent/Docs/CROSS_PROJECT_MODERNIZATION_PROMPT.md`

Then apply it to the current project. In short, your goals are:

1. Adopt Expo Router web/server patterns where useful:
   - server rendering
   - API routes
   - middleware
   - data loaders
2. Refactor media handling to use `@mrmeg/expo-media@latest`.
3. Audit the UI and refactor to use `@mrmeg/expo-ui@latest` wherever
   reasonable.
4. Keep app-specific product logic local, but replace duplicated shared
   primitives, media infrastructure, and server patterns with the package-backed
   architecture.

Important constraints:

- Do not create curl-only or hidden demo routes. Every new demo/API route must
  be reachable from visible UI or removed.
- Do not copy source from the packages. Install and import their public npm
  entrypoints.
- Read package docs from `node_modules/@mrmeg/expo-ui/*` and
  `node_modules/@mrmeg/expo-media/*` after installing.
- Validate with the project’s typecheck, lint, tests, web build/export, and a
  production smoke test when available.
- Watch for the known issues listed in the local reference prompt, especially
  Bun `.bun` asset serving, Reactotron side effects in tests, Expo middleware
  limitations, and npm publish/version drift.

Start by inspecting this app’s current architecture and package versions. Then
make the changes directly and report exactly what changed, what was validated,
and what remains app-specific.
```

## Full Implementation Prompt

```md
You are modernizing this Expo app so it follows my current shared app
architecture. Your goals are:

1. Adopt Expo Router web/server alpha patterns where appropriate.
2. Refactor media handling to use `@mrmeg/expo-media`.
3. Audit and refactor UI to use `@mrmeg/expo-ui` wherever reasonable.
4. Keep app-specific product logic local, but move reusable patterns toward the
   shared packages so my projects stay closer together and future development
   is faster.

Reference docs:
- Expo Router server rendering: https://docs.expo.dev/router/web/server-rendering/
- Expo Router server middleware: https://docs.expo.dev/router/web/middleware/#best-practices
- Expo Router data loaders: https://docs.expo.dev/router/web/data-loaders/

Package docs to inspect after install:
- `node_modules/@mrmeg/expo-ui/llms.txt`
- `node_modules/@mrmeg/expo-ui/LLM_USAGE.md`
- `node_modules/@mrmeg/expo-ui/llms-full.md`
- `node_modules/@mrmeg/expo-media/llms.txt`
- `node_modules/@mrmeg/expo-media/LLM_USAGE.md`
- `node_modules/@mrmeg/expo-media/llms-full.md`

Install/update:
- `@mrmeg/expo-ui@latest`
- `@mrmeg/expo-media@latest`
- satisfy their Expo/React Native peer deps instead of copying package source.

Expo server work:
- Enable server output and Expo Router flags in app config:
  - `web.output = "server"`
  - `unstable_useServerRendering: true`
  - `unstable_useServerMiddleware: true`
  - `unstable_useServerDataLoaders: true`
- Add `app/+middleware.ts` only if there is visible app behavior for it. Use
  `unstable_settings.matcher` to keep it scoped.
- Middleware must be lightweight. Do not parse request bodies there. Expo
  middleware receives an immutable request and cannot consume `text()`,
  `json()`, `formData()`, or mutate request headers.
- Use API routes for body parsing, writes, auth-gated server actions,
  CORS/preflight, and typed error responses.
- Use route `loader` exports for route-scoped server data that should be
  available to SSR/initial render through `useLoaderData`.
- Do not create phantom curl routes. Every demo/template API route must be
  reachable from a visible UI screen, even if it is just a diagnostics/demo card
  with buttons.

Media package refactor:
- Replace app-local presigned URL, S3/R2 key validation, media client,
  upload/list/delete helpers, React Query hooks, and processing helpers with
  `@mrmeg/expo-media`.
- Use public entrypoints only:
  - `@mrmeg/expo-media`
  - `@mrmeg/expo-media/client`
  - `@mrmeg/expo-media/react-query`
  - `@mrmeg/expo-media/server`
  - granular processing entrypoints under `@mrmeg/expo-media/processing/*`
- Do not import server code into client bundles.
- Prefer granular processing imports; avoid broad processing barrels if that
  pulls HEIC/video/FFmpeg code into the main bundle.
- Keep app-owned media policies in one local settings/config module: media
  types, upload policies, auth rules, max sizes, custom filename allowance,
  bucket/env mapping.
- Upload signing should use `mediaType + contentType`, not extension-only
  signing. Clients must not choose raw buckets or arbitrary prefixes.
- Missing storage env should fail closed with typed setup-state responses, not
  opaque 500s, and responses must list env var names only, never secret values.

UI package audit:
- Read `@mrmeg/expo-ui` docs first. Do not recreate primitives the package
  already ships.
- Use package entrypoints only:
  - `@mrmeg/expo-ui`
  - `@mrmeg/expo-ui/components`
  - `@mrmeg/expo-ui/components/*`
  - `@mrmeg/expo-ui/constants`
  - `@mrmeg/expo-ui/hooks`
  - `@mrmeg/expo-ui/state`
  - `@mrmeg/expo-ui/lib`
- Do not import from `dist`, package source folders, or copied local primitives.
- Mount `UIProvider` once near the app root if using package
  overlays/notifications.
- Call `useResources()` once near the app root.
- Use `useTheme`, `useStyles`, semantic tokens, `StyledText`, and package
  controls.
- Remove app-local `Appearance` / `matchMedia` theme syncing unless it is truly
  app-specific; package theme sync should stay package-owned.
- Keep app-specific screens, feature state, product copy, API calls, and
  domain-specific layout decisions local.

Known issues to avoid:
- If using Bun, Expo web export may emit package assets under
  `dist/client/assets/node_modules/.bun`. Express static ignores
  dot-directories by default, so production servers may need a narrow static
  mount for that generated `.bun` asset subtree or icon fonts can render as
  square boxes.
- Do not make `logDev` or other harmless helpers import Reactotron as a side
  effect. Jest/CI can crash with `XMLHttpRequest is not defined` if Reactotron
  is eagerly imported.
- Middleware does not run for client-side navigation or native screen
  transitions. Native/API calls can hit middleware, but native navigation itself
  will not.
- Server rendering/data loaders are alpha and require server/static rendering
  support. Verify with production export, not only dev server.
- When customizing `+html.tsx`, preserve all values from
  `useServerDocumentContext`; missing injected nodes can break metadata, fonts,
  CSS, or hydration.
- npm package publishing is separate from local version bumps. If package
  updates are needed, verify `npm view @mrmeg/expo-ui version` and
  `npm view @mrmeg/expo-media version`, and make sure trusted publishing or
  `NPM_TOKEN` is configured.

Validation checklist:
- `bun install`
- `bun run typecheck`
- `bun run lint`
- `bun run test:ci` or project equivalent
- web export/build command
- production server smoke test for SSR pages, loaders/API routes, icon
  fonts/assets, and media flows
- verify no demo/API route exists only as a curl target; every route should be
  visible in UI or removed.
```

Local source path for this reference:

`/Users/mattmegenhardt/Development/expo-template/Agent/Docs/CROSS_PROJECT_MODERNIZATION_PROMPT.md`
