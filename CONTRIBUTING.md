# Contributing

## Getting Started

```bash
bun install
npx expo start        # press i / a / w for iOS / Android / Web
```

Package manager is **bun** (`bun install`, `bun add <package>`) — never npm or
yarn. Lockfile: `bun.lock`.

## Code Style

Double quotes, always semicolons (ESLint-enforced), 2-space indentation.

## Git Workflow

- Branch from `dev`; open PRs against `dev`, not `main`.
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`.
- Keep commits small and focused.

## PR Checklist

- [ ] `bun run verify` passes (peer check, typecheck, lint, feature isolation, template + block registry and LLM docs freshness, README version drift, tests — CI's `validate` gates in CI order)
- [ ] Web tested (`bun run web`)
- [ ] iOS/Android tested if touching native code
- [ ] New components include showcase demos
- [ ] No secrets or credentials committed
- [ ] CI green — `.github/workflows/ci.yml` runs the same gates plus the web build + bundle-size delta

## Testing

```bash
bun jest --watchAll                     # interactive
bun jest --testPathPattern=path/to/test # single file
bun run test:ci                         # CI-style with coverage
```

- Tests live in `__tests__/` directories next to source, or as `*.test.ts(x)` siblings.
- `bun run verify` runs the same suite without coverage.
- Coverage spans `client/**`, `app/api/**`, `server/**`, `shared/**`, `packages/ui/src/**`, and `packages/media/src/**`, so route-level seams (CORS, rate limiting, auth bootstrap, media storage, billing) stay observable — not just UI code.
- Need a stable theme without mounting providers? `import "@/test/mockTheme";` at the top of the file mocks `useTheme` with a fixed light-scheme palette.
- Keep coverage on reusable surfaces: design-system primitives (Card, Badge, EmptyState, Skeleton, RadioGroup, …), the form primitive trio (`FormProvider` + `FormTextInput` + `FormCheckbox`), and screen templates (Welcome, Error, List, …). Avoid snapshot-only tests — assert visible behaviour or interaction outcomes.

## Project Structure

Docs index: `AGENTS.md`. Modernization reference:
`docs/template-modernization-guide.md`.

- `app/` — Expo Router file-based routing (UI routes + `app/api/*` server routes)
- `client/features/` — Feature modules: auth, billing, media, i18n, keyboard, navigation, onboarding, server-alpha, app
- `client/templates/` — Screen templates, one folder each (`Screen.tsx` + `demo.tsx` + `meta.ts`)
- `client/blocks/` — Composed screen sections; see `client/blocks/README.md`
- `client/showcase/` — Gallery registry, filters, previews, details, gallery screen bodies
- `packages/ui/src/components/` — Design system primitives for `@mrmeg/expo-ui`
- `client/lib/api/` — `authenticatedFetch` (provider-aware fetch helper)
- `client/lib/form/` — `FormProvider`, `FormTextInput`, `FormCheckbox`, … on react-hook-form + Zod
- `client/lib/storage/` — Cross-platform AsyncStorage wrapper
- `server.bun.ts` — Bun production server (static compression, CORS, rate limiting, security headers)
- `server/` — Shared server helpers (rate limits, API helpers, media handlers)
- `shared/` — Code shared between client and server (e.g. `shared/media.ts` path constants)

## Design System

- Shadcn-inspired, zinc palette + teal accent.
- Tokens (colors, fonts, spacing) in `packages/ui/src/constants/`; reference in `packages/ui/README.md`.
- Control heights: `TextInput` / `Select` sm=32, md=36, lg=40; `Button` sm=28, md=32, lg=40.
- Use `StyleSheet.flatten([...])` (not raw arrays) for `@rn-primitives` style props — nested style arrays crash React Native Web.

## Adding a New Component

1. Scaffold: `bun run generate component <Name>`.
2. Implement in `packages/ui/src/components/<Name>.tsx`.
3. Add a showcase demo to `client/showcase/ShowcaseScreen.tsx` (the kitchen sink; its `app/(main)/(demos)/showcase/index.tsx` route is a one-line lazy shell) and a card preview to `client/showcase/previews.tsx`. Optionally seed variants + a usage snippet in `client/showcase/details.tsx` — an id with no entry falls back to its live preview plus import path.
4. Export from `packages/ui/src/components/index.ts` and add an entry to `COMPONENTS` in `client/showcase/registry.ts`; the Explore tab's count and filtering read from there. `client/showcase/__tests__/registry.test.ts` verifies the import path resolves on disk.

## Adding a New Screen Template Or Demo

1. Scaffold: `bun run generate screen <Name>` — writes `client/templates/<kebab>/Screen.tsx` (reusable, props-driven `<Name>Screen`), `demo.tsx` (what the route renders), `meta.ts` (registry metadata), and the route `app/(main)/(demos)/screen-<kebab>.tsx`. Standalone demos can be hand-written directly under `app/(main)/(demos)/`.
2. Fill in `meta.ts` (description, icon, order), then `bun run gen:templates` to regenerate `client/templates/registry.generated.ts` (codegen; `gen:templates:check` gates CI and `bun run verify`).
3. Add a Stack entry in `app/(main)/_layout.tsx` if you need a deep link beyond the demo route.
4. A hand-written demo instead needs an entry in `DEMOS` in `client/showcase/registry.ts` to reach the Explore tab. The registry test enforces unique ids/routes and that every documented route maps to a real `.tsx` file.

## Scaffolding

```bash
bun run generate component <Name>   # packages/ui/src/components/<Name>.tsx
bun run generate screen <Name>      # client/templates/<kebab>/ + app/(main)/(demos)/screen-<kebab>.tsx
bun run generate hook <Name>        # client/hooks/use<Name>.ts (working scaffold, no TODO bodies)
bun run generate form <Name>        # client/components/forms/<Name>Form.tsx, on @/client/lib/form primitives
```

The generator never overwrites existing files; delete the stale file to
regenerate. PascalCase, kebab-case, and snake_case names are accepted and
normalized to PascalCase exports.
