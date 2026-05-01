# Spec: Create Template Registry For Showcase And Explore

**Status:** Ready
**Priority:** Medium
**Scope:** Client

---

## What
Introduce a registry that describes reusable UI components, screen templates, and demos, then use it to drive Explore navigation and component showcase metadata. The registry should reduce manual duplication when adding or removing template assets.

## Why
The repo is a library of reusable app foundations. A registry makes the template easier to browse, document, test, and extend without updating several hardcoded lists by hand.

## Current State
`app/(main)/(tabs)/index.tsx` hardcodes `screenTemplates`, demo links, and the "35 components" badge. `app/(main)/(demos)/showcase/index.tsx` is a single large file over 2,000 lines with manual imports and demos. There is no source of truth for what components/screens exist, which ones have demos, or what generator/docs entries should be updated.

## Changes
1. Add a template registry module.
   - Include screen template id, label, route, icon, description, and category.
   - Include component id, display name, import path, category, and showcase availability.
   - Include demo/tool entries.

2. Drive Explore from the registry.
   - Replace local `screenTemplates` and `demos` arrays with registry reads.
   - Compute component counts from the registry.
   - Preserve current visual layout unless a small adjustment is needed.

3. Start decomposing showcase metadata.
   - Move categories and display metadata out of the monolithic showcase file.
   - Keep actual interactive demo rendering local or split into small files only where it reduces complexity.

4. Connect generator/docs guidance.
   - Document how new components and screen templates should register themselves.
   - Optionally make generator output include a registry TODO or insertion hint.

5. Add tests.
   - Validate registry route uniqueness.
   - Validate referenced component/screen files exist where practical.
   - Validate Explore renders registry entries.

## Acceptance Criteria
1. Explore screen reads screen template and demo entries from a shared registry.
2. The component count is derived from registry data, not a hardcoded number.
3. Registry tests catch duplicate ids/routes.
4. Adding a new screen template has a documented registry update path.
5. Current Explore links and showcase access remain functional.

## Constraints
- Do not rewrite every showcase demo in one pass.
- Preserve current route paths unless a separate migration is approved.
- Keep typed route casts contained if Expo Router typing requires them.

## Out of Scope
- Building a dynamic plugin marketplace.
- Auto-generating code from the registry at build time.
- Redesigning the visual UI of Explore or Showcase.

## Files Likely Affected
Client:
- New `client/showcase/registry.ts` or `client/templateRegistry.ts`
- `app/(main)/(tabs)/index.tsx`
- `app/(main)/(demos)/showcase/index.tsx`
- `client/showcase/*`

Tests:
- New registry tests
- Explore render tests if practical

Docs:
- `CONTRIBUTING.md`
- `Agent/Docs/DESIGN.md`
- `Agent/Docs/APP_OVERVIEW.md`

## Edge Cases
- A route can exist without a screen template entry, but documented templates should not point to missing routes.
- Component count should exclude helper components unless intentionally listed.
- Registry should support hidden/internal entries if needed for demos.
- Icons should be validated against the local `IconName` type.

## Risks
Over-engineering the registry could make simple additions harder. Keep the first version as typed data plus small helpers.
