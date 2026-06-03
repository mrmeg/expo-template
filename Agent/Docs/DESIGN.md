# Design

Reusable UI lives in `packages/ui` and is consumed as `@mrmeg/expo-ui`. App
screens should use the package components, tokens, hooks, and state rather than
creating parallel design primitives under `client/`.

## Source Pointers

| Concern | Source |
|---------|--------|
| Components | `packages/ui/src/components/` |
| Tokens | `packages/ui/src/constants/` |
| Theme hooks | `packages/ui/src/hooks/useTheme.ts` |
| Resource loading | `packages/ui/src/hooks/useResources.ts` |
| Theme state | `packages/ui/src/state/themeStore.ts` |
| Showcase registry | `client/showcase/registry.ts` |
| Demo screens | `client/screens/`, `app/(main)/(demos)/` |

## Component Rules

- New reusable primitives belong in `packages/ui/src/components/`.
- Export reusable primitives from the package index and supported subpath
  exports; keep package internals on relative imports.
- App-specific wrappers or feature-integrated screens stay under `client/`.
- Do not import `@/client/*` from `packages/ui`.
- `@rn-primitives` components should receive flattened styles where needed;
  raw nested style arrays can break React Native Web.

## Visual System

The package owns a neutral zinc-based theme with a teal accent, dark and light
schemes, spacing tokens, typography tokens, radius tokens, and platform shadow
helpers.

Use semantic theme colors from `useTheme()` and tokens from
`@mrmeg/expo-ui/constants`. Avoid hard-coded colors in app screens unless a
feature has a real domain-specific status color.

Primary actions use the semantic primary color. Accent is for highlights,
active states, badges, and secondary emphasis.

## Interaction And Accessibility

- Use package controls for forms, switches, toggles, tabs, sliders, dialogs,
  drawers, sheets, popovers, tooltips, and notifications.
- Keep touch targets and hit slop appropriate for native devices.
- Use `useReduceMotion()` for nonessential motion.
- Use theme contrast helpers for dynamic foreground/background combinations.
- Keep tab labels, buttons, empty states, and error actions screen-reader
  legible.

## Showcase Contract

The Explore tab and component showcase are adoption surfaces. When adding a
reusable component or screen template:

- Add a focused demo in `client/showcase`.
- Keep frequently changing control state inside small demo components so the
  full showcase does not re-render on each keystroke or toggle.
- Add or update tests near the package component when behavior changes.

## Forms

The form helpers under `client/lib/form/` wrap package controls for app forms.
Keep form state local to the smallest useful component. Auth form fields use
`client/features/auth/components/AuthTextField.tsx` to avoid form-card rerender
churn while typing.

## Error And Empty States

Use package `ErrorBoundary`, `ErrorScreen`, `EmptyState`, `Alert`, and
`Notification` patterns. User-facing errors should communicate the next useful
action and avoid exposing raw server details when a typed problem code exists.
