# Contributing

## Getting Started

1. Clone the repo
2. Run `bun install`
3. Run `npx expo start` (press `i`/`a`/`w` for iOS/Android/Web)

## Package Manager

This project uses **bun**. Always use `bun install` and `bun add <package>` — not npm or yarn. The lockfile is `bun.lock`.

## Code Style

- **Double quotes**, **always semicolons** (enforced by ESLint)
- 2-space indentation
- Run `bun run lint` before committing

## Git Workflow

- Branch from `dev` for feature work
- Use Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`
- Keep commits small and focused
- Open PRs against `dev`, not `main`

## PR Checklist

- [ ] `bun run lint` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run check:features` passes (cross-feature import contract)
- [ ] `bun run test:ci` — all tests pass
- [ ] Web tested (`bun run web`)
- [ ] iOS/Android tested if touching native code
- [ ] New components include showcase demos
- [ ] No secrets or credentials committed
- [ ] CI is green — `.github/workflows/ci.yml` runs the same gates plus the web build + bundle-size delta

## Testing

- Tests live next to source files in `__tests__/` directories or as `*.test.ts(x)` siblings
- Run interactively: `bun jest --watchAll`
- Run a single file: `bun jest --testPathPattern=path/to/test`
- CI-style with coverage: `bun run test:ci`
- Coverage is collected from `client/**`, `app/api/**`, `server/**`, and `shared/**` so route-level seams (CORS, rate limiting, auth bootstrap, media storage, billing) stay observable — not just UI code
- For component tests that just need a stable theme without mounting providers, `import "@/test/mockTheme";` at the top of the file mocks `useTheme` with a fixed light-scheme palette so colour assertions stay deterministic
- Coverage focus on reusable surfaces: design-system primitives (Card, Badge, EmptyState, Skeleton, RadioGroup, …), the form primitive trio (`FormProvider` + `FormTextInput` + `FormCheckbox`), and screen templates (Welcome, Error, List, …) keep the regression surface honest. Avoid snapshot-only tests — assert visible behaviour or interaction outcomes

## Project Structure

See `Agent/Docs/ARCHITECTURE.md` for the canonical architecture reference and `Agent/AGENTS.md` for the docs index. Key directories:

- `app/` — Expo Router file-based routing (UI routes + `app/api/*` server routes)
- `client/features/` — Self-contained feature modules (auth, billing, media, i18n, notifications, onboarding, keyboard, navigation, app)
- `packages/ui/src/components/` — Design system primitives for `@mrmeg/expo-ui`
- `client/screens/` — Pre-built screen templates
- `client/lib/api/` — `apiClient` (typed fetch) + `authenticatedFetch` (Amplify-aware)
- `client/lib/form/` — Form primitives (`FormProvider`, `FormTextInput`, `FormCheckbox`, …) on top of react-hook-form + Zod
- `client/lib/storage/` — Cross-platform AsyncStorage wrapper
- `client/state/` — App-local Zustand stores; UI package stores own theme and global notification state
- `server.bun.ts` — default Bun production server (static compression, CORS, rate limiting, security headers)
- `server/` — Express fallback server and shared server helpers
- `shared/` — Code shared between client and server (e.g. `shared/media.ts` path constants)

## Design System

- Shadcn-inspired, zinc palette + teal accent
- See `packages/ui/src/constants/` for tokens (colors, fonts, spacing) and `Agent/Docs/DESIGN.md` for the full reference
- Component sizes: sm=32, md=36, lg=40
- Use `StyleSheet.flatten([...])` (not raw arrays) for `@rn-primitives` style props — nested style arrays crash React Native Web

## Adding a New Component

1. Scaffold: `bun run generate component <Name>`
2. Implement in `packages/ui/src/components/<Name>.tsx`
3. Add a showcase demo under `app/(main)/(demos)/showcase/`
4. Export it from `packages/ui/src/components/index.ts` and add an entry to `COMPONENTS` in `client/showcase/registry.ts` — the Explore tab's component count and any future filtering read from there. The registry test (`client/showcase/__tests__/registry.test.ts`) verifies the package import path resolves on disk.

## Adding a New Screen Template Or Demo

1. Scaffold: `bun run generate screen <Name>` — writes both `client/screens/<Name>Screen.tsx` (reusable template) and `app/(main)/(demos)/screen-<kebab>.tsx` (demo route). Standalone demos can be hand-written directly under `app/(main)/(demos)/`.
2. Wire navigation: add a Stack entry in `app/(main)/_layout.tsx` if you need a deep link beyond the demo route.
3. Register: add an entry to `SCREEN_TEMPLATES` (or `DEMOS`) in `client/showcase/registry.ts` so it shows up in the Explore tab. The registry test enforces unique ids/routes and that every documented route maps to a real `.tsx` file.

## Scaffolding

```bash
bun run generate component <Name>   # UI component → packages/ui/src/components/<Name>.tsx
bun run generate screen <Name>      # client/screens/<Name>Screen.tsx + app/(main)/(demos)/screen-<kebab>.tsx
bun run generate hook <Name>        # client/hooks/use<Name>.ts (working scaffold, no TODO bodies)
bun run generate form <Name>        # client/components/forms/<Name>Form.tsx, built on @/client/lib/form primitives
```

The generator never overwrites existing files; rerun after deleting the
stale file if you need to regenerate. Names in PascalCase, kebab-case, or
snake_case are all accepted and normalized to PascalCase exports.
