---
status: done
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/51
---

# Label/input association: add htmlFor, fix duplicate-nativeID pattern

## Goal
`Label`'s documented pairing pattern — the same `nativeID` on the Label and its TextInput — produces duplicate DOM ids on web and no label/input association at all. Add an `htmlFor` prop to `Label`, correct the documented pattern, and fix the consumers that copied it (the sign-in-form block shipped with it).

## Context
Verified 2026-08-08 on dev:

- `packages/ui/src/components/Label.tsx:58-74` (usage docs) recommends `<Label nativeID="email-input">` + `<TextInput nativeID="email-input" />`. RNW maps `nativeID → id` (with a deprecation warnOnce), so this renders two elements with the same id.
- `@rn-primitives/label`'s web build only creates a real `<label for=…>` association when `htmlFor` is passed; `Label.tsx:102-108` never forwards it, so no consumer can produce an associated label today.
- `client/blocks/sign-in-form/Block.tsx:103-105` and `:118-120` copied the documented pattern (same `nativeID` on Label and input) — duplicate ids, no association, per the PR #45 review.
- Showcase usage (`app/(main)/(demos)/showcase/index.tsx:827-845`) puts `nativeID` only on the Labels, so it avoids duplicate ids but also gets no association.

## Work
1. `packages/ui/src/components/Label.tsx`: add `htmlFor?: string`, forward it to `LabelPrimitive.Root`/`Text` per @rn-primitives/label's API (web association; native no-op). Keep `nativeID` as the label's own id.
2. Correct the usage docs to the associated pattern: `<Label nativeID="email-label" htmlFor="email-input">` + `<TextInput nativeID="email-input" />`. Note what each id does on web vs native.
3. Fix `client/blocks/sign-in-form/Block.tsx`: unique ids, `htmlFor` on both Labels pointing at their inputs.
4. Update the showcase "With Input" subsection to demonstrate the associated pattern.
5. Tests in `packages/ui/src/components/__tests__/`: htmlFor forwarded; block test asserting no duplicate `nativeID`/id between a Label and its input.
6. `packages/ui` version + CHANGELOG per release flow (fold into the unreleased section if one is pending).

## Validation
- `bun run typecheck && bun run lint && bun run test:ci && bun run ui:test`
- Manual on web: inspect the sign-in-form block — no duplicate ids; clicking the label focuses the input.

## Out of scope
- Auto-generating ids (React `useId`) inside Label — keep explicit props consistent with the rest of the package.
- Other form components' a11y beyond Label pairing.

## Open questions
- None.
