# Spec: Developer Experience Documentation

**Status:** Ready
**Priority:** Medium
**Scope:** Client

---

## What

Add VSCode workspace configuration (settings, recommended extensions) and a CONTRIBUTING.md file to improve the developer onboarding experience. Update README.md to cross-reference the new docs.

## Why

New developers cloning this template have no IDE setup guidance. Without a `.vscode/settings.json`, contributors may use inconsistent formatting (tabs vs spaces, single vs double quotes, missing semicolons) that conflicts with the project's ESLint rules. Without a CONTRIBUTING.md, developers have no reference for the project's git workflow, PR process, testing expectations, or code style conventions. These are standard files that most production templates include.

## Current State

- No `.vscode/` directory exists in the project.
- No `CONTRIBUTING.md` or `DEVELOPMENT.md` exists.
- `CLAUDE.md` documents commands, architecture, and conventions but is intended for AI agents, not human contributors.
- `package.json` has scripts for linting (`npx expo lint`), testing (`jest`), and building, but these are not documented in a contributor-facing guide.
- The project uses ESLint flat config with double quotes, always semicolons, and 2-space indentation (per CLAUDE.md).
- Git workflow uses Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- bun is the package manager (bun.lock present).

## Changes

### 1. Create VSCode settings

**New file:** `.vscode/settings.json`

```json
{
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.expo": true,
    "**/android": true,
    "**/ios": true
  },
  "files.associations": {
    "*.tsx": "typescriptreact",
    "*.ts": "typescript"
  }
}
```

Key choices:
- 2-space indentation matches ESLint config.
- Format on save with ESLint auto-fix catches style violations immediately.
- Workspace TypeScript SDK ensures consistent TS version across contributors.
- Search exclusions hide generated directories that clutter global search.

### 2. Create VSCode recommended extensions

**New file:** `.vscode/extensions.json`

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "expo.vscode-expo-tools",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

These are non-prescriptive recommendations. VSCode shows a prompt to install them; contributors can decline.

### 3. Create CONTRIBUTING.md

**New file:** `CONTRIBUTING.md`

Structure:

```markdown
# Contributing

## Getting Started

1. Clone the repo
2. Run `bun install`
3. Run `npx expo start` (press i/a/w for iOS/Android/Web)

## Package Manager

This project uses **bun**. Always use `bun install` and `bun add <package>` (not npm or yarn).

## Code Style

- **Double quotes**, **always semicolons** (enforced by ESLint)
- 2-space indentation
- Run `npx expo lint` before committing to catch violations

## Git Workflow

- Branch from `dev` for feature work
- Use Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`
- Keep commits small and focused
- Open PRs against `dev`, not `main`

## PR Checklist

- [ ] `npx expo lint` passes with no errors
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
- `server/` — Express production server

## Design System

- Shadcn-inspired, zinc-based palette
- See `client/constants/` for tokens (colors, fonts, spacing)
- Component sizes: sm=32, md=36, lg=40
- Always use `StyleSheet.flatten()` for @rn-primitives style props (see CLAUDE.md)

## Adding a New Component

1. Create the component in `client/components/ui/`
2. Add a showcase demo in `app/(main)/(demos)/showcase/index.tsx`
3. Update the component count badge in `app/(main)/(tabs)/index.tsx`

## Adding a New Screen Template

1. Create the template in `client/screens/`
2. Create a demo route in `app/(main)/(demos)/screen-<name>.tsx`
3. Register the route in `app/(main)/_layout.tsx`
4. Add an entry to the Explore tab in `app/(main)/(tabs)/index.tsx`

## Scaffolding

Use the generator CLI:
- `npx tsx scripts/generate.ts component <Name>` — scaffold a component
- `npx tsx scripts/generate.ts screen <Name>` — scaffold a screen template
```

### 4. Update README.md

**File:** `README.md`

Add a "Contributing" section (or update the existing one) with a link:

```markdown
## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, code style, and PR guidelines.
```

Also add a note about VSCode:

```markdown
## IDE Setup

This project includes VSCode workspace settings in `.vscode/`. Open the project in VSCode and accept the recommended extensions prompt for the best experience.
```

## Acceptance Criteria

1. `.vscode/settings.json` exists with 2-space indentation, format on save, and ESLint auto-fix settings.
2. `.vscode/extensions.json` exists with relevant extension recommendations.
3. `CONTRIBUTING.md` covers: getting started, package manager, code style, git workflow, PR checklist, testing, project structure overview, and how to add components/screens.
4. `README.md` references CONTRIBUTING.md and mentions the VSCode setup.
5. No existing functionality is changed -- these are documentation-only additions.
6. The `.vscode/` directory is committed to the repo (it is intentional for workspace settings to be shared).

## Constraints

- Do not add Prettier config files (`.prettierrc`, etc.) -- the project uses ESLint for formatting. The VSCode Prettier extension is recommended but Prettier config is not added because ESLint handles the rules.
- Do not duplicate content that already exists in `CLAUDE.md`. Reference it where appropriate ("See `CLAUDE.md` for detailed architecture documentation").
- Keep CONTRIBUTING.md concise. It should be scannable in under 2 minutes. Link to CLAUDE.md for deep dives.
- The `.vscode/settings.json` should not include personal preferences (font size, color theme, etc.) -- only project-relevant settings.

## Out of Scope

- Adding a `.editorconfig` file (VSCode settings cover this).
- Creating GitHub issue/PR templates (`.github/` directory).
- Setting up CI/CD workflows (GitHub Actions, EAS Build).
- Adding a code of conduct.
- Configuring Husky or lint-staged for pre-commit hooks.

## Files Likely Affected

**New files:**
- `.vscode/settings.json`
- `.vscode/extensions.json`
- `CONTRIBUTING.md`

**Modified files:**
- `README.md` (add Contributing and IDE Setup sections)

## Edge Cases

- **Existing README.md content:** The README may already have sections that overlap. Read the current README before adding sections to avoid duplication. Add new sections at the end or in a logical position.
- **Prettier vs ESLint conflict:** The project does not have a `.prettierrc`. If the Prettier extension auto-formats in ways that conflict with ESLint, the ESLint auto-fix on save should correct it. Note this in CONTRIBUTING.md if relevant.
- **bun vs npm confusion:** CONTRIBUTING.md should explicitly state that bun is required and npm/yarn should not be used, since the lockfile is `bun.lock`.

## Risks

- **VSCode settings too opinionated:** Some contributors may dislike format-on-save or specific settings. Since these are workspace settings (not user settings), contributors can override them in their user settings. This is standard practice for shared projects.
- **Stale CONTRIBUTING.md:** If the project evolves and CONTRIBUTING.md is not updated, it becomes misleading. Reference CLAUDE.md as the source of truth for architecture details to reduce duplication.
