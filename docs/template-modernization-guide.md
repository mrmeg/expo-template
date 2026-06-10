# Template Modernization Guide

This guide is the LLM-facing map for using this repo as a reference template.
Use it when adapting another Expo app to this stack, selecting reusable
components, choosing a screen template, or checking modernization work against
the repo's current patterns.

## Start Here

Treat these files as the source of truth before editing another project:

| Need | Source |
|------|--------|
| App overview, scripts, architecture, setup | `README.md` |
| Contribution workflow and project structure | `CONTRIBUTING.md` |
| Repo guidance and docs index | `AGENTS.md` |
| UI package setup, components, theming | `packages/ui/README.md` |
| Media package setup, processing, server handlers | `packages/media/README.md` |
| Server output, API routes, data loaders, middleware | `docs/server-guide.md` |
| SSR hydration and web first-render constraints | `docs/ssr-hydration.md` |
| Bundle budget and analysis workflow | `docs/bundle-analysis.md` |
| Sentry runtime and native upload setup | `docs/error-tracking.md` |
| UI component exports | `packages/ui/src/components/index.ts` |
| Screen and demo registry | `client/showcase/registry.ts` |
| Demo routes | `app/(main)/(demos)/` |
| Reusable screen implementations | `client/screens/` |

When code and docs disagree, inspect the source files and update the docs in
the same change.

## Stack Baseline

The template is a Bun-managed Expo app with Expo Router, server-rendered web
output, TypeScript strict mode, React Query, Zustand, optional Cognito auth,
optional Stripe billing, optional S3/R2 media, optional Sentry, and two
workspace packages:

- `@mrmeg/expo-ui` from `packages/ui`: design tokens, theme state, reusable
  components, animation/haptic helpers, and global UI state.
- `@mrmeg/expo-media` from `packages/media`: media contracts, processing
  helpers, React Query factories, and S3/R2 server handler factories.

App-specific integration belongs in `app/`, `client/`, `server/`, or `shared/`.
Reusable UI belongs in `packages/ui`. Reusable media contracts and processing
belong in `packages/media`.

## LLM Use Rules

- Prefer repo components over new primitives. Import from
  `@mrmeg/expo-ui/components`, `@mrmeg/expo-ui/hooks`, and
  `@mrmeg/expo-ui/constants`.
- Use `useTheme()` and token exports for color, spacing, radius, shadow,
  typography, and contrast decisions. Avoid new hard-coded palettes.
- Keep reusable package code app-agnostic. `packages/ui` must not import from
  `@/client/*`; `packages/media` must not depend on app route files or app
  env names.
- Keep optional systems fail-closed. A blank `.env` must leave the template
  explorable with auth, billing, media, and Sentry disabled.
- Respect SSR first-render constraints on web. Read `docs/ssr-hydration.md`
  before changing `app/+html.tsx`, root startup, theme startup, i18n startup,
  onboarding, viewport logic, or font loading.
- Add showcase coverage when adding a reusable component or screen template.
  Update `client/showcase/registry.ts` so the Explore tab remains the adoption
  surface.
- Use exact local scripts from `package.json`; do not substitute generic Expo
  or npm commands when a Bun script exists.

## Component Selection

Start with `packages/ui/src/components/index.ts` and the showcase route
`app/(main)/(demos)/showcase/index.tsx`.

| Use case | Prefer |
|----------|--------|
| Page text, headings, localized labels | `StyledText` exports |
| Primary, secondary, outline, destructive actions | `Button` |
| Text entry | `TextInput`, app form wrappers under `client/lib/form/` |
| Boolean input | `Switch`, `Checkbox`, `Toggle` |
| One-of-many or few-of-many choice | `RadioGroup`, `SegmentedControl`, `Select`, `ToggleGroup` |
| Numeric selection | `Slider`, or an app-specific stepper built from package primitives |
| Navigation inside a surface | `Tabs`, `Accordion`, `Collapsible` |
| Menus and contextual commands | `DropdownMenu`, `Popover`, `Tooltip` |
| Modal or transient surfaces | `Dialog`, `BottomSheet`, `Drawer` |
| Status, progress, or async feedback | `Alert`, `Badge`, `Progress`, `Skeleton`, `EmptyState` |
| Cards and repeated item containers | `Card`, `Separator`, `AnimatedView` |
| Icons | `Icon`, with names typed by `IconName` |
| App shell infrastructure | `UIProvider`, `ErrorBoundary`, `StatusBar`, `Notification` |

For forms, use `react-hook-form` through `client/lib/form/FormProvider.tsx`
and the field wrappers in `client/lib/form/`. Keep field state local to the
smallest useful component, especially inside showcase demos and high-churn
forms.

## Screen Templates

The reusable screen templates live in `client/screens/`. Demo routes under
`app/(main)/(demos)/` show concrete usage and are registered in
`client/showcase/registry.ts`.

| Template | Source | Use for |
|----------|--------|---------|
| Settings | `client/screens/SettingsScreen.tsx` | Grouped settings, toggles, account actions |
| Profile | `client/screens/ProfileScreen.tsx` | User profile, avatar, stats, sectioned details |
| List | `client/screens/ListScreen.tsx` | Searchable lists, refresh, loading and empty states |
| Pricing | `client/screens/PricingScreen.tsx` | Plans, billing intervals, comparison states |
| Welcome | `client/screens/WelcomeScreen.tsx` | First-run welcome and authentication entry |
| Card Grid | `client/screens/CardGridScreen.tsx` | Filterable card collections |
| Chat | `client/screens/ChatScreen.tsx` | Message timelines and composer layout |
| Dashboard | `client/screens/DashboardScreen.tsx` | Metrics, charts, activity feeds |
| Form | `client/screens/FormScreen.tsx` | Multi-step forms with validation and review |
| Notifications | `client/screens/NotificationListScreen.tsx` | Grouped notification feeds |
| Search Results | `client/screens/SearchResultsScreen.tsx` | Query results, filters, empty states |
| Error | `client/screens/ErrorScreen.tsx` | Setup, retry, auth, access, and fatal states |
| Detail Hero | `client/screens/DetailHeroScreen.tsx` | Object detail pages with prominent media |

Use these as starting points, not as containers for unrelated product logic.
Domain behavior should sit in a feature folder, then pass data and callbacks
into the screen template.

## App And Feature Patterns

| Pattern | Source | Notes |
|---------|--------|-------|
| Root providers and startup gate | `client/features/app/RootLayout.tsx`, `client/features/app/useAppStartup.ts` | Coordinates resources, i18n, onboarding, optional auth, splash hiding |
| Navigation shell | `app/(main)/`, `app/(main)/(tabs)/` | Main Stack, tabs, demos, route grouping |
| API routes | `app/api/**/+api.ts`, `server/api/shared/` | Route files stay thin; shared auth, CORS, and errors live under `server/api/shared` |
| API client | `client/lib/api/` | Use typed results or typed problem objects, not raw `Response` handling in UI |
| Feature folders | `client/features/<feature>/` | Keep features portable; obey feature isolation checks |
| Persisted client state | Zustand stores under `client/features/**` or `client/state/` | Use cross-platform storage helpers where persistence is needed |
| Server state | TanStack React Query | Root defaults live in the provider stack |
| Media feature | `client/features/media/`, `app/api/media/`, `packages/media/` | App routes own auth/env; package owns reusable media contracts |
| Billing feature | `client/features/billing/`, `app/api/billing/`, `server/api/billing/` | Server owns plan catalog and Stripe mapping |

## Modernization Path

Use this order when moving an existing project toward this template:

1. Baseline the toolchain: Bun lockfile, Expo SDK, React, React Native,
   TypeScript strict, Expo Router, and local package scripts.
2. Move app identity into the single identity surface used by `app.config.ts`
   and runtime deep-link helpers.
3. Establish the route shell: root providers, tabs, grouped demo routes,
   error boundary, safe area, keyboard provider, and startup gate.
4. Replace one-off UI with `@mrmeg/expo-ui` components and tokens. Port
   screens by matching the closest template in `client/screens/`.
5. Normalize forms through `react-hook-form`, `zod`, and `client/lib/form`
   wrappers.
6. Move server state to React Query and client state to small Zustand stores.
7. Convert API calls to typed route contracts and typed problem handling.
8. Add optional systems behind env gates. Missing auth, billing, media, or
   Sentry config should degrade to setup/disabled states, not runtime crashes.
9. Verify SSR and hydration on web before optimizing for native-only behavior.
10. Add tests at the boundary touched: package component tests, screen tests,
    route tests, feature isolation, typecheck, lint, and bundle-size checks.

## Modernization Checks

Before calling a migration complete, run the relevant local scripts:

```bash
bun run typecheck
bun run lint
bun run check:features
bun run test:ci
bun run ui:typecheck
bun run ui:test
bun run media:typecheck
bun run media:test
bun run build
bun run bundle-size
```

For UI package changes, also use the showcase and React Scan workflow from
`README.md`. For SSR-sensitive work, verify real server HTML as described in
`docs/ssr-hydration.md`.

## Anti-Patterns To Remove

- App screens defining new button, input, menu, modal, card, or typography
  primitives when package components already exist.
- Hard-coded colors, shadows, radius, and spacing in general-purpose UI.
- Feature folders importing sibling feature internals outside documented
  boundary exceptions.
- Client code reading raw bucket, Stripe, Cognito, or server secret env vars.
- UI code branching on raw HTTP `Response` objects instead of typed problem
  objects.
- Optional feature setup that crashes a blank `.env`.
- Web startup logic that reads persisted browser state during the first render.
- Showcase demos with high-churn state at the full-route level.

## Keeping This Guide Current

Update this file when:

- A reusable component is added, removed, renamed, or moved.
- A screen template is added, removed, renamed, or gets a new intended use.
- The modernization order changes because of stack, routing, SSR, or package
  boundary changes.
- Verification scripts or feature gates change.

Keep examples source-linked and concise. Prefer pointing to the canonical
implementation over copying code that will drift.
