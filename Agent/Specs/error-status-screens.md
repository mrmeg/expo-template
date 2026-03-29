# Spec: Error & Status Screen Templates

**Status:** Ready
**Priority:** Medium
**Scope:** Client

---

## Summary

Add a configurable `ErrorScreen` template to `client/screens/` that handles common error and status states with a consistent, theme-aware design. This is a single component with a `variant` prop that controls the icon, copy, and actions for each scenario.

---

## Motivation

Every production app needs error and status screens (404, offline, maintenance, permission denied). Currently the template library has no screen-level error handling patterns. Users end up building these ad hoc, leading to inconsistent styling and incomplete UX (missing retry buttons, no animated entrances, etc.). A well-built template eliminates that repeated work.

---

## Deliverables

### A) ErrorScreen (`client/screens/ErrorScreen.tsx`)

A single configurable screen component with five built-in variants:

| Variant | Icon | Default Title | Default Description | Primary Action | Secondary Action |
|---------|------|--------------|---------------------|----------------|------------------|
| `not-found` | `search` | "Page not found" | "The page you're looking for doesn't exist or has been moved." | "Go back" | "Go home" |
| `offline` | `wifi-off` | "You're offline" | "Check your internet connection and try again." | "Retry" | -- |
| `maintenance` | `wrench` | "Under maintenance" | "We're making improvements. We'll be back shortly." | "Refresh" | -- |
| `permission-denied` | `shield-off` | "Access restricted" | "You don't have permission to view this page." | "Go back" | "Request access" |
| `generic` | `alert-circle` | "Something went wrong" | "An unexpected error occurred. Please try again." | "Retry" | "Go back" |

#### Props Interface

```typescript
export type ErrorVariant = "not-found" | "offline" | "maintenance" | "permission-denied" | "generic";

export interface ErrorScreenAction {
  label: string;
  onPress: () => void;
}

export interface ErrorScreenProps {
  variant?: ErrorVariant;                // defaults to "generic"
  icon?: IconName;                       // override variant default
  title?: string;                        // override variant default
  description?: string;                  // override variant default
  primaryAction?: ErrorScreenAction;     // override variant default (must be provided for retry/go-back to work)
  secondaryAction?: ErrorScreenAction;   // override variant default
  estimatedReturn?: string;              // only shown for "maintenance" variant, e.g. "Back by 3:00 PM EST"
  style?: StyleProp<ViewStyle>;
}
```

#### Behavior

- Vertically and horizontally centered layout (like EmptyState, but full-screen).
- Large icon in a circular muted-background container (same pattern as ListScreen empty state: 80x80 circle, 48px icon, `theme.colors.mutedForeground`).
- Title uses `SansSerifBoldText`, 22px, `letterSpacing: -0.3`, `theme.colors.foreground`.
- Description uses `SansSerifText`, 15px, `theme.colors.mutedForeground`, centered, max-width ~300.
- `estimatedReturn` renders below description as a smaller text line (13px, `mutedForeground`) only when variant is `maintenance` and the prop is provided.
- Primary action renders as `<Button preset="default">`. Secondary action renders as `<Button preset="ghost">`.
- Both actions are optional -- if the consumer provides no `primaryAction`, no button renders (the variant defaults described above are just suggested labels; the consumer must wire `onPress`).
- Staggered entrance animation: icon (scale, delay 0), title (fadeSlideUp, delay STAGGER_DELAY), description (fadeSlideUp, delay STAGGER_DELAY * 2), actions (fadeSlideUp, delay STAGGER_DELAY * 3). Use `useStaggeredEntrance` + `Animated.View` from reanimated, matching the ProfileScreen/WelcomeScreen pattern.
- Theme-aware via `useTheme()` + `createStyles(theme)` pattern (same as all existing screens).

#### Visual Layout (top to bottom, centered)

```
[spacer - flex: 1]
[icon circle]
[title]
[description]
[estimatedReturn (conditional)]
[primary button (if provided)]
[secondary button (if provided)]
[spacer - flex: 1]
```

### Barrel Export

Add `ErrorScreen` to the barrel export in `client/screens/index.ts` (if one exists) or ensure it can be imported as `@/client/screens/ErrorScreen`.

---

## Patterns to Follow

These patterns are mandatory -- they come directly from the existing screen templates:

1. **File structure:** Types section with separator comment, Component section, Styles section -- each separated by `// ---------------------------------------------------------------------------` banners (see ListScreen, SettingsScreen).
2. **Theme:** `const { theme } = useTheme();` and `const styles = createStyles(theme);` where `createStyles` is a function at the bottom returning `StyleSheet.create(...)`.
3. **Imports:** Import `type Theme` from `@/client/constants/colors`, spacing from `@/client/constants/spacing`, text components from `@/client/components/ui/StyledText`, etc.
4. **Animations:** Use `useStaggeredEntrance` from `@/client/hooks/useStaggeredEntrance` with `Animated.View` from `react-native-reanimated` (same as ProfileScreen, WelcomeScreen).
5. **Style override:** Accept `style?: StyleProp<ViewStyle>` and apply as `[styles.container, styleOverride]`.
6. **Spacing tokens:** Use `spacing.*` from constants, never raw numbers. Use `radiusMd`, `radiusLg` etc.
7. **Typography:** Follow the design system -- 2xl+ sizes get negative letterSpacing. Use `SansSerifBoldText` for titles, `SansSerifText` for body.
8. **Button:** Use `<Button>` from `@/client/components/ui/Button` with `preset` prop.
9. **Icon:** Use `<Icon>` from `@/client/components/ui/Icon` with `IconName` type.

---

## Out of Scope

- Navigation logic (consumer wires `onPress` handlers).
- Network status detection (consumer determines when to show `offline` variant).
- Automatic retry logic.
- Custom illustration/image support (icon-only for now).

---

## Testing Plan

1. Component renders without crashing for each variant.
2. Default icon/title/description match the variant table above when no overrides are provided.
3. Custom `icon`, `title`, `description` override the variant defaults.
4. `primaryAction` and `secondaryAction` render buttons when provided, omit when not.
5. `estimatedReturn` only renders for `maintenance` variant.
6. Style override prop is applied to the container.

---

## Files to Create/Modify

| Action | Path |
|--------|------|
| Create | `client/screens/ErrorScreen.tsx` |

---

## Estimated Effort

Small -- single file, ~150-200 lines, follows established patterns exactly.
