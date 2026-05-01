# Spec: Modernize Generator Scaffolds

**Status:** Ready
**Priority:** High
**Scope:** Client

---

## What
Update the generator so it creates files that match the template's current architecture and are useful with minimal cleanup. Generated screens, forms, hooks, and components should follow the same paths, imports, and conventions as the reusable surfaces already in the repo.

## Why
The generator is a key template productivity feature. If it creates outdated shapes, adopters still spend time undoing boilerplate before they can build app-specific features.

## Current State
`scripts/generate.ts` writes screen routes directly under `app/(main)` while existing reusable screen templates live in `client/screens` with demo routes under `app/(main)/(demos)`. The form generator writes to `client/components/forms`, but the repo's form primitives live under `client/lib/form`. Hook templates include placeholder TODOs and unused imports.

## Changes
1. Align generated screens with current screen-template architecture.
   - Generate reusable screen components in `client/screens/<Name>Screen.tsx`.
   - Optionally generate a demo route under `app/(main)/(demos)/screen-<kebab-name>.tsx`.
   - Emit clear next steps for adding Explore navigation and stack entries when needed.

2. Align generated forms with the existing form abstraction.
   - Generate into an agreed path, preferably `client/lib/form` for primitives or a documented app form path for concrete forms.
   - Use existing `FormProvider`, `FormTextInput`, `FormCheckbox`, `FormSelect`, and `FormSwitch` where appropriate.
   - Remove the incorrect "additional dependencies" message because dependencies already exist.

3. Improve hook and component scaffolds.
   - Remove unused imports from generated output.
   - Include a small test scaffold option or clear test instruction if that fits the local pattern.
   - Keep styling aligned with theme tokens and `StyleSheet.create`.

4. Add generator tests.
   - Cover path decisions, name normalization, duplicate protection, and generated content for each type.

5. Refresh docs.
   - Update `README.md`, `CONTRIBUTING.md`, and Agent docs that describe generator behavior.

## Acceptance Criteria
1. `bun run generate component ExampleThing` creates a component that typechecks without edits.
2. `bun run generate screen ExampleThing` follows the current `client/screens` plus demo-route convention or a clearly documented option.
3. `bun run generate form ExampleThing` uses the repo's existing form primitives and does not claim missing dependencies.
4. Generated hook output has no unused imports or placeholder-only implementation that immediately fails lint.
5. Generator behavior is covered by automated tests or a documented smoke test.

## Constraints
- Do not overwrite existing files.
- Keep the CLI non-interactive by default.
- Preserve existing command names where possible.
- Do not introduce a new scaffolding framework unless the local script becomes unmaintainable.

## Out of Scope
- A full code-mod for registering routes automatically across every navigation surface.
- A GUI generator.
- Generating domain-specific business logic.

## Files Likely Affected
Client / tooling:
- `scripts/generate.ts`
- `client/screens/`
- `app/(main)/(demos)/`

Tests:
- `scripts/__tests__/generate.test.ts` or equivalent

Docs:
- `README.md`
- `CONTRIBUTING.md`
- `Agent/Docs/APP_OVERVIEW.md`
- `Agent/Docs/DESIGN.md`

## Edge Cases
- Names with hyphens and underscores should produce predictable PascalCase and kebab-case outputs.
- Duplicate files should fail without modifying anything.
- Generated route names should be safe for Expo Router typed routes.
- Forms should support empty initial schemas without TypeScript errors.

## Risks
Generator changes can ripple into docs and examples. Keep the implementation small and test generated output directly.
