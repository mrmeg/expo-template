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
- Run `npx expo lint` before committing

## Git Workflow

- Branch from `dev` for feature work
- Use Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`
- Keep commits small and focused
- Open PRs against `dev`, not `main`

## PR Checklist

- [ ] `npx expo lint` passes
- [ ] `jest --watchAll` — all tests pass
- [ ] Web tested (`npx expo start --web`)
- [ ] iOS/Android tested if touching native code
- [ ] New components include showcase demos
- [ ] No secrets or credentials committed

## Testing

- Tests live next to source files as `*.test.ts` or `*.test.tsx`
- Run all tests: `jest --watchAll`
- Run a single file: `jest --testPathPattern=path/to/test`
- Coverage targets `client/**`

## Project Structure

See `CLAUDE.md` for detailed architecture documentation. Key directories:

- `app/` — Expo Router file-based routing
- `client/features/` — Self-contained feature modules
- `client/components/ui/` — Design system primitives
- `client/screens/` — Pre-built screen templates
- `client/lib/form/` — Form system (react-hook-form + zod)
- `server/` — Express production server

## Design System

- Shadcn-inspired, zinc-based palette
- See `client/constants/` for tokens (colors, fonts, spacing)
- Component sizes: sm=32, md=36, lg=40
- Always use `StyleSheet.flatten()` for @rn-primitives style props (see CLAUDE.md)

## Adding a New Component

1. Scaffold: `npx tsx scripts/generate.ts component <Name>`
2. Implement in `client/components/ui/<Name>.tsx`
3. Add a showcase demo in the showcase screen
4. Update the component count in the Explore tab

## Adding a New Screen Template

1. Create the template in `client/screens/<Name>Screen.tsx`
2. Create a demo route in `app/(main)/`
3. Register the route in `app/(main)/_layout.tsx`
4. Add an entry to the Explore tab

## Scaffolding

```bash
npx tsx scripts/generate.ts component <Name>   # UI component
npx tsx scripts/generate.ts screen <Name>       # Screen route
npx tsx scripts/generate.ts hook <Name>         # Custom hook
npx tsx scripts/generate.ts form <Name>         # Form component
```
