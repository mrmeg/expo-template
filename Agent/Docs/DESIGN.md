# UI/UX Design Guide

> Design system, component conventions, and patterns.

## Design Philosophy

Shadcn-inspired, zinc-based palette. Clean, minimal, consistent across platforms. Border-only cards, subtle shadows, tight spacing.

## Color System

### Palette

Zinc-based neutral scale with teal accent. Defined in `client/constants/colors.ts`.

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `background` | white | zinc-950 | Page backgrounds |
| `foreground` | zinc-950 | zinc-50 | Primary text |
| `card` | white | zinc-950 | Card surfaces |
| `primary` | zinc-900 | zinc-50 | Primary actions (neutral, not teal) |
| `primaryForeground` | zinc-50 | zinc-900 | Text on primary |
| `accent` | teal-500 | teal-400 | Highlights, active tabs, badges |
| `secondary` | zinc-100 | zinc-800 | Secondary surfaces |
| `muted` | zinc-100 | zinc-800 | Muted backgrounds |
| `mutedForeground` | zinc-500 | zinc-400 | Secondary text |
| `border` | zinc-200 | zinc-800 | Borders, dividers |
| `destructive` | red-500 | red-900 | Error states |

### Status Colors
- Success: green
- Warning: amber
- Error: red

### Key Rule
**Primary is neutral** (dark gray / near-white). **Accent is teal** (`theme.colors.accent`). Never use teal as primary.

## Typography

Defined in `client/constants/fonts.ts`.

| Scale | Size | Line Height | Letter Spacing |
|-------|------|-------------|----------------|
| xs | 12 | 16 | 0 |
| sm | 14 | 20 | 0 |
| md | 16 | 24 | 0 |
| lg | 18 | 28 | 0 |
| xl | 20 | 28 | 0 |
| 2xl | 24 | 32 | -0.3 |
| 3xl | 30 | 36 | -0.5 |
| 4xl | 36 | 40 | -0.75 |

- Font family: Lato (`Lato_400Regular`, `Lato_700Bold` via `@expo-google-fonts/lato`, system fallback)
- Weights: 400 (normal), 500 (medium), 700 (bold) — only the two ttf weights are loaded; "500" is rendered with synthetic font-weight CSS
- **2xl+ sizes get negative letter spacing** for tighter headings

## Spacing & Layout

Defined in `client/constants/spacing.ts`. Base unit: 8px.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4 | Tight gaps |
| sm | 8 | Standard gap |
| md | 12 | Component padding |
| lg | 16 | Section padding |
| xl | 24 | Large gaps |
| xxl | 32 | Page margins |
| xxxl | 48 | Major sections |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| radiusNone | 0 | Sharp corners |
| radiusSm | 4 | Small elements |
| radiusMd | 6 | Default (buttons, inputs) |
| radiusLg | 8 | Cards |
| radiusXl | 12 | Large cards |
| radius2xl | 16 | Modals |
| radiusFull | 9999 | Circles, pills |

## Component Conventions

### Sizing

| Size | Height | Usage |
|------|--------|-------|
| sm | 32 | Compact UI |
| md | 36 | Default |
| lg | 40 | Touch-friendly |

Applies to: Button, TextInput, Toggle, Select.

### Cards
- **Border-only** by default — no drop shadow
- Use `theme.colors.border` for card borders
- `radiusLg` (8px) border radius

### Buttons
- Font weight: `"500"` (medium, not bold)
- Padding: `buttonPadding = 10`
- Outline variant uses `theme.colors.border` (not primary) with `foreground` text

### Shadows
- Subtle: opacity 0.05–0.15, small offsets
- Use `getShadowStyle()` from `useTheme()` hook
- **Web: returns empty object** (boxShadow causes RN Web crashes)

### Checkbox
- Checked state: `primary` background, `primaryForeground` icon

### Switch
- Width 44, height 24, thumb 20
- 1px border on track + thumb for contrast
- Default checked state uses a stable dark-neutral track so the white thumb stays visible in both themes

### Tab Bar
- `accent` for active tint
- `mutedForeground` for inactive
- iOS height: 85px (with safe area)

## Component Library (35 components)

All in `client/components/ui/`:

**Layout:** AnimatedView, Card, MaxWidthContainer, Separator, DismissKeyboard
**Typography:** StyledText (semantic variants)
**Forms:** Button, TextInput, Checkbox, RadioGroup, Select, Switch, Toggle, ToggleGroup, InputOTP, Label, Slider
**Feedback:** Alert, Badge, Notification, Progress, Skeleton, EmptyState, StatusBar, Tooltip
**Overlay:** BottomSheet, Dialog, Drawer, DropdownMenu, Popover
**Navigation:** Tabs, Collapsible
**Utility:** ErrorBoundary, Icon

## Critical Pattern: Style Array Crash Prevention

**@rn-primitives components MUST use `StyleSheet.flatten()`**, never raw style arrays:

```tsx
// CRASHES on web
<DropdownMenuItem style={[styles.item, { color: theme.primary }]} />

// CORRECT
<DropdownMenuItem style={StyleSheet.flatten([styles.item, { color: theme.primary }])} />
```

## Theming API

`useTheme()` hook provides:

- `theme.colors.*` — all semantic color tokens
- `scheme` — current scheme ("light" | "dark")
- `getShadowStyle(elevation)` — platform shadow (empty on web)
- `getContrastingColor(bg)` — WCAG-compliant text color for any background
- `getContrastRatio(fg, bg)` — numeric contrast ratio
- `withAlpha(color, alpha)` — add transparency
- `toggleTheme()` / `setTheme(mode)` — switch themes

Contrast calculations are cached (max 500 entries).

## Screen Templates

13 pre-built templates exposed via the `client/showcase/registry.ts` `SCREEN_TEMPLATES` array (Explore tab reads from there) with demo routes under `app/(main)/(demos)/`:

Settings, Profile, List, Pricing, Welcome, Card Grid, Chat, Dashboard, Form (multi-step), Notifications, Search, Error states, Detail Hero.

Use these as starting points for new screens.

### Pricing / account billing surfaces

`client/screens/PricingScreen.tsx` is the shared visual component. When a
screen is billing-aware, it derives each card's `isCurrent`,
`actionLabel`, `actionState`, `disabledReason`, and `loading` fields via
`derivePricingPlan()` from `@/client/features/billing` — the screen
itself never reads Stripe fields directly. See `app/(main)/(demos)/screen-pricing.tsx`
for the reference wiring (plan catalog → `derivePricingPlan` → CTA handler
that calls `useBillingActions`). Unauthenticated users always see
"Sign in to continue"; entitled users see "Manage subscription"; a `free`
card for a paid user renders as `downgrade-disabled` with a "Cancel through
Manage subscription" hint.

`app/(main)/(tabs)/profile.tsx` displays the normalized billing summary
and exposes a single billing CTA: **Manage Subscription** for anyone with
a Stripe customer, otherwise **Upgrade** (routes to pricing). Warning rows
render for `cancelAtPeriodEnd` and `past_due` states — keep those in any
adopter account screen so the UI doesn't stay mute when Stripe needs
attention from the user.
