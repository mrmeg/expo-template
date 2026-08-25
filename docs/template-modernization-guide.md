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
| Bundle budget and analysis workflow | `docs/bundle-analysis.md` |
| Sentry runtime and native upload setup | `docs/error-tracking.md` |
| UI component exports | `packages/ui/src/components/index.ts` |
| Component, block, screen-template, and demo registry | `client/showcase/registry.ts` |
| Demo routes | `app/(main)/(demos)/` |
| Reusable screen implementations | `client/templates/<id>/` |
| Reusable composed sections | `client/blocks/<id>/` |

When code and docs disagree, inspect the source files and update the docs in
the same change.

## Stack Baseline

The template is a Bun-managed Expo app with Expo Router, server-rendered
web output, TypeScript strict mode, React Query, Zustand, optional Cognito auth,
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
- Web routes are server-rendered per request. Persisted browser state
  (localStorage, `matchMedia`, dimensions) is unavailable in that first render,
  so it must either be derived from the request — the way
  `server/lib/ssrViewport.ts` and `server/lib/ssrOnboarding.ts` read cookies —
  or read after mount. Changes to `app/+html.tsx`, root startup, theme startup,
  i18n startup, onboarding, viewport logic, or font loading must be verified in
  a browser against `bun run build && bun run start`.
- Add showcase coverage when adding a reusable component, block, or screen
  template. Components are listed by hand in `client/showcase/registry.ts`;
  blocks and screen templates are generated from their `meta.ts` by
  `bun run gen:blocks` / `bun run gen:templates`. Explore and the three
  galleries derive every count and card from those registries, so a new asset
  shows up without touching a screen.
- Use exact local scripts from `package.json`; do not substitute generic Expo
  or npm commands when a Bun script exists.

## Three Scales

The showcase is organised by how much of a screen an asset covers. Pick the
largest scale that fits before dropping to the one below.

| Scale | Lives in | Browse at | Use for |
|-------|----------|-----------|---------|
| 01 Components | `packages/ui/src/components/` | `app/(main)/(demos)/components/` (card grid + per-component detail) | A single primitive: a button, an input, a sheet |
| 02 Blocks | `client/blocks/<id>/` | `app/(main)/(demos)/blocks/` (live stage + component recipe) | A composed section of a screen: hero, feature grid, stat row |
| 03 Screen templates | `client/templates/<id>/` | `app/(main)/(demos)/templates/` (card grid → the live screen) | A complete screen you adapt rather than compose |

The Explore tab (`app/(main)/(tabs)/index.tsx`) is the entry point: a search
field that filters all three registries at once, then one section per scale.
`app/(main)/(demos)/showcase/index.tsx` is still the exhaustive per-component
kitchen sink and is linked from the components gallery header.

## Component Selection

Start with `packages/ui/src/components/index.ts` and the components gallery
`app/(main)/(demos)/components/index.tsx` (or the exhaustive
`app/(main)/(demos)/showcase/index.tsx`).

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

## Blocks

Blocks live in `client/blocks/<id>/` as a `Block.tsx` plus a `meta.ts`, and are
registered by `bun run gen:blocks`. Each `meta.ts` carries a `recipe` — the
component ids the block composes — which the gallery renders as links into the
component detail, so a block documents its own construction.

| Block | Category | Use for |
|-------|----------|---------|
| Hero | marketing | Landing headline, subcopy, and primary/secondary actions |
| Feature Grid | marketing | Three-up capability grid with icons |
| Stat Row | data | A row of metrics with change indicators |
| CTA Banner | marketing | A single mid-page conversion prompt |
| FAQ Section | content | Accordion of common questions |
| Sign-In Form | auth | Email/password entry with social options |

Reach for a block before hand-composing a section out of primitives, and before
copying a whole screen template you only need one band of.

## Screen Templates

Screen templates live in `client/templates/<id>/` as a `Screen.tsx` (the
reusable implementation), a `demo.tsx` (the route's sample data), and a
`meta.ts` (id, label, description, icon, `route`, `order`, `category`).
`bun run gen:templates` turns those metas into
`client/templates/registry.generated.ts`; navigate by an entry's `route`, never
a path built from its id.

| Template | Category | Use for |
|----------|----------|---------|
| Welcome | marketing | First-run welcome and authentication entry |
| Hero | marketing | Landing page: centered and full-bleed variants |
| Pricing | marketing | Plans, billing intervals, comparison states |
| Testimonials | marketing | Snap-scrolling social proof |
| Dashboard | data | Metrics, charts, activity feeds |
| Stats | data | Metric grid with change indicators |
| List | content | Searchable lists, refresh, loading and empty states |
| Card Grid | content | Filterable card collections |
| Detail / Hero | content | Object detail pages with prominent media |
| Chat | content | Message timelines and composer layout |
| Notifications | content | Grouped notification feeds |
| FAQ | content | Accordion of questions and answers |
| Settings | forms-auth | Grouped settings, toggles, account actions |
| Profile | forms-auth | User profile, avatar, stats, sectioned details |
| Form | forms-auth | Multi-step forms with validation and review |
| Search | states | Query results, filters, empty states |
| Error | states | Setup, retry, auth, access, and fatal states |

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
   screens from the largest matching scale down: a screen template in
   `client/templates/<id>/`, then a block in `client/blocks/<id>/`, then
   individual components.
5. Normalize forms through `react-hook-form`, `zod`, and `client/lib/form`
   wrappers.
6. Move server state to React Query and client state to small Zustand stores.
7. Convert API calls to typed route contracts and typed problem handling.
8. Add optional systems behind env gates. Missing auth, billing, media, or
   Sentry config should degrade to setup/disabled states, not runtime crashes.
9. Verify the web build in a browser before optimizing for native-only
   behavior.
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
`README.md`. For web-startup work, verify in a browser against
`bun run build && bun run start` (see `docs/server-guide.md`).

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
- Web startup logic that blocks first paint on persisted browser state.
- Showcase demos with high-churn state at the full-route level.

## Keeping This Guide Current

Update this file when:

- A reusable component is added, removed, renamed, or moved.
- A screen template is added, removed, renamed, or gets a new intended use.
- The modernization order changes because of stack, routing, web output, or
  package boundary changes.
- Verification scripts or feature gates change.

Keep examples source-linked and concise. Prefer pointing to the canonical
implementation over copying code that will drift.
