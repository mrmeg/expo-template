# Migrating an Existing App to the expo-template Baseline

This document is designed to travel. Drop it into any Expo app (or hand it to
an agent working in one) and follow it to bring that app in line with
[mrmeg/expo-template](https://github.com/mrmeg/expo-template): SSR web output,
typed data loaders, `@mrmeg/expo-ui` components, reusable screen templates,
and the template's verification gates.

Unlike `docs/template-modernization-guide.md` (written for agents working
inside the template repo), this guide is self-contained: every required
config value, API shape, and code pattern is inlined, and everything else is
fetchable from the template's public GitHub.

## How to Use This Document

1. Run the **Self-Assessment** below to find your app's tier.
2. Work the phases in order. Lower tiers skip phases they already satisfy.
3. Migrate **one screen/feature as a pilot** before converting the rest —
   validate it builds, hydrates, and passes checks, then repeat the pattern.
4. After each phase, run the **Verification** commands before moving on.

## Reference Materials (fetch as needed)

The template publishes an LLM consumption layer. From any repo, fetch:

| Resource | URL |
|----------|-----|
| Full docs bundle (modernization guide, UI usage, media, server, SSR) | `https://raw.githubusercontent.com/mrmeg/expo-template/main/llms-full.txt` |
| Example index (demo routes, screen templates, component source) | `https://raw.githubusercontent.com/mrmeg/expo-template/main/llms-examples.txt` |
| UI package usage rules | `https://raw.githubusercontent.com/mrmeg/expo-template/main/packages/ui/LLM_USAGE.md` |
| Any individual file | `https://raw.githubusercontent.com/mrmeg/expo-template/main/<path>` |

When this guide and `llms-full.txt` disagree, `llms-full.txt` is newer — trust it.

## Target Baseline (as of June 2026)

| Package | Version |
|---------|---------|
| expo | ~56.0.9 |
| expo-router | ~56.2.9 |
| expo-server | ~56.0.5 |
| react | 19.2.3 |
| react-native | 0.85.3 |
| react-native-web | ^0.21.2 |
| @mrmeg/expo-ui | ^0.8.0 |
| @mrmeg/expo-media (if using media) | ^0.1.1 |
| zustand | ^5.0.14 |
| @tanstack/react-query | ^5.101.0 |
| react-hook-form | ^7.78.0 |
| zod | ^4.4.3 |
| typescript | ~6.0.3 (strict mode) |
| jest-expo | ~56.0.4 |
| @testing-library/react-native | ^14.0.0 |
| eslint | ^10 (flat config) |

Package manager: **Bun** (`bun.lock`, scripts run via `bun run <script>`).

## Self-Assessment

Check your `package.json` and app config, then start at the matching tier:

- **Tier 1 — Close.** Already on Expo 56 + `web.output: "server"` +
  `@mrmeg/expo-ui` ≥ 0.6. Start at **Phase 3** (loaders), then Phases 4–7.
- **Tier 2 — One SDK behind.** Expo 55, `@mrmeg/expo-ui` 0.1–0.2. Start at
  **Phase 1**. Budget real time for Phase 4 — the ui package API changed
  substantially between 0.2 and 0.8.
- **Tier 3 — Far.** Expo ≤ 54, no `@mrmeg/expo-ui`, possibly
  `web.output: "single"` or `"static"`. Work every phase in order. Upgrade
  Expo one SDK major at a time (52→53→54→55→56), getting the app booting at
  each step before continuing.

## Phase 1 — Toolchain

1. Adopt Bun if not already: delete other lockfiles, run `bun install`.
2. Upgrade to Expo SDK 56: `bunx expo install expo@^56.0.0 --fix`, then
   `bunx expo-doctor` and resolve every finding. (Tier 3: one major at a time.)
3. TypeScript ~6.0 with `"strict": true` in `tsconfig.json`. Path alias
   `"@/*"` pointing at the repo root.
4. ESLint 10 flat config (`eslint.config.mjs`), lint via `bunx expo lint`.

## Phase 2 — SSR Web Output

In `app.config.ts` (or `app.json`):

```ts
web: {
  bundler: "metro",
  output: "server",
  favicon: "./assets/images/favicon.png",
},
plugins: [
  [
    "expo-router",
    {
      origin: "",
      unstable_useServerRendering: true,
      unstable_useServerMiddleware: true,
      unstable_useServerDataLoaders: true,
      // Keep development web routes eager; async-route HMR can fail to
      // resolve grouped tab chunks in dev.
      asyncRoutes: { web: "production" },
    },
  ],
  // ...other plugins
],
```

Then:

1. Add `expo-server` (`~56.0.5`) as a dependency.
2. Add an `app/+html.tsx` server document. Fetch the template's version
   (`app/+html.tsx` via the raw URL above) — it injects theme CSS variables
   server-side to prevent white-flash and splices SSR resources via
   `useServerDocumentContext()`. Adapt fonts/scripts to your app.
3. Add a production server entry. The template ships two; copy the one you
   deploy with: `server.bun.ts` (Bun.serve, primary) or `server/index.ts`
   (Express fallback). Both serve `dist/client/` statics and mount the SSR
   handler from `dist/server/` via `expo-server` adapters.
4. **SSR first-render rules** (full detail in `docs/ssr-hydration.md` inside
   `llms-full.txt`): the first web render must not read persisted browser
   state (localStorage, matchMedia, dimensions). Gate those reads behind
   hydration; the template's `+html.tsx` blocking scripts handle color scheme
   and onboarding state.

## Phase 3 — Data Loaders

Routes that need server data export a typed `loader` next to the screen. The
route file stays thin — both the loader and the screen live in a feature
folder:

```ts
// app/(main)/things/[id].tsx — the entire route file:
export { thingLoader as loader } from "@/client/features/things/loaders";
export { default } from "@/client/features/things/ThingDetailScreen";
```

```ts
// client/features/things/loaders.ts
import { setResponseHeaders } from "expo-server";
import type { LoaderFunction } from "expo-router/server";

export type ThingLoaderData = {
  thing: Thing | null;
  requestedId: string | string[] | null;
};

export const thingLoader: LoaderFunction<ThingLoaderData> = async (
  request,
  params,
) => {
  try {
    setResponseHeaders({ "Cache-Control": "no-store" });
  } catch {
    // Static export and direct unit-test calls have no Expo Server
    // request scope.
  }

  // Server-only modules are dynamically imported so they never enter the
  // client bundle.
  const { getThing } = await import("@/server/api/things");

  return {
    thing: getThing(params.id),
    requestedId: params.id ?? null,
  };
};
```

```tsx
// client/features/things/ThingDetailScreen.tsx
import { useLoaderData } from "expo-router";
import type { thingLoader } from "./loaders";

export default function ThingDetailScreen() {
  const { thing, requestedId } = useLoaderData<typeof thingLoader>();
  // Data is available synchronously on first render — no loading spinner
  // needed for loader-provided data.
}
```

Conventions:

- Wrap `setResponseHeaders` in try/catch — it throws outside a live request.
- Import `@/server/**` modules **dynamically inside the loader body**, never
  at module top level.
- Type loader data with `LoaderFunction<T>` and consume with
  `useLoaderData<typeof loader>()`.
- Loaders replace "fetch on mount" for initial page data. Keep React Query
  for client-side refetching, mutations, and data that changes after load.

## Phase 4 — @mrmeg/expo-ui

Upgrade to `@mrmeg/expo-ui@^0.8.0`. Peer requirements: Expo ~56, React
≥ 19.2, RN ≥ 0.83, zustand ≥ 5.

**Required app setup (once, at the root):**

- Mount `UIProvider` once at the root — overlay and feedback components
  (Notification, Dialog, BottomSheet, Tooltip) depend on it.
- Call `useResources()` once near the root before rendering UI (font and
  resource loading).

**Import only from public subpaths** — never from `dist/` or a source
checkout:

```ts
import { Button, Card, StyledText, TextInput } from "@mrmeg/expo-ui/components";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { notify } from "@mrmeg/expo-ui/state";
import { spacing } from "@mrmeg/expo-ui/constants";
```

**Notifications — use `notify`, not `globalUIStore.show()`** (new in 0.8):

```ts
notify.success("Saved", { messages: ["Your changes have been saved."] });
notify.error("Upload failed");
notify.warning("Almost out of space");
notify.loading("Uploading…");   // persistent until replaced or hidden
notify.hide();

// Loading → success/error around any promise (rethrows on rejection):
await notify.promise(saveProfile(), {
  loading: "Saving…",
  success: "Profile saved",
  error: "Could not save profile",
});
```

**Theme rules:**

- Use `useTheme()` (`{ colors, fonts, scheme, isDark }`) and semantic tokens —
  no hard-coded palettes, shadows, radii, or spacing in general-purpose UI.
- `primary` is neutral (dark gray in light mode, near-white in dark mode);
  `colors.accent` (teal) is for highlights, active tabs, badges.
- Cards are border-only (no shadow by default); shadows elsewhere are subtle.

**Component swaps.** Replace one-off primitives with package components:
buttons, text inputs, switches/checkboxes, selects, tabs, dialogs, bottom
sheets, dropdown menus, cards, badges, skeletons, empty states, icons. The
full use-case index is in `packages/ui/LLM_USAGE.md` (see Reference
Materials). Notable rules:

- `Button` uses `preset` (not `variant`); visible heights are compact
  (sm 28 / md 32 / lg 40).
- `DropdownMenu` item styles must be plain objects — flatten with
  `StyleSheet.flatten`, never pass nested style arrays (crashes
  React Native Web).
- Always smoke-test web after UI migration; nested style arrays that work on
  native crash RNW.

## Phase 5 — Screen Templates

The template ships 13 reusable screens under `client/screens/`. Copy the ones
your app needs (raw URL: `client/screens/<Name>.tsx`), then refactor existing
screens to compose them. Templates are **starting points, not containers**:
domain logic lives in `client/features/<feature>/`, which passes data and
callbacks into the template.

| Template | File | Use for |
|----------|------|---------|
| Settings | `SettingsScreen.tsx` | Grouped settings, toggles, account actions |
| Profile | `ProfileScreen.tsx` | Avatar, stats, sectioned details |
| List | `ListScreen.tsx` | Searchable lists, refresh, loading/empty states |
| Pricing | `PricingScreen.tsx` | Plans, billing intervals, comparisons |
| Welcome | `WelcomeScreen.tsx` | First-run welcome, auth entry |
| Card Grid | `CardGridScreen.tsx` | Filterable card collections |
| Chat | `ChatScreen.tsx` | Message timelines, composer |
| Dashboard | `DashboardScreen.tsx` | Metrics, charts, activity feeds |
| Form | `FormScreen.tsx` | Multi-step forms with validation and review |
| Notifications | `NotificationListScreen.tsx` | Grouped notification feeds |
| Search Results | `SearchResultsScreen.tsx` | Query results, filters, empty states |
| Error | `ErrorScreen.tsx` | Setup, retry, auth, access, fatal states |
| Detail Hero | `DetailHeroScreen.tsx` | Detail pages with prominent media |

Working composition examples for every template live under
`app/(main)/(demos)/` in the template (indexed in `llms-examples.txt`).

## Phase 6 — App Conventions

- **Feature folders:** product code in `client/features/<feature>/`; features
  must not import sibling feature internals. The template enforces this with
  `scripts/check-feature-isolation.js` — copy it and its `check:features`
  script if you want the gate.
- **State:** React Query for server state; small Zustand stores for client
  state. No giant global stores.
- **Forms:** `react-hook-form` + `zod` resolvers, through form wrappers
  (template reference: `client/lib/form/`).
- **API routes:** `app/api/<feature>/<name>+api.ts` exporting
  `export async function GET(request: Request): Promise<Response>`. Shared
  auth/CORS/error helpers live in `server/api/shared/` — keep route files
  thin. Return typed problem objects to the client, not raw `Response`
  branching in UI code.
- **Auth fetch:** a single `authenticatedFetch`/`api.*` wrapper injects the
  Bearer token; UI code never builds auth headers.
- **Optional systems fail closed:** with a blank `.env`, auth, billing,
  media, and Sentry must degrade to disabled/setup states — never crash.

## Phase 7 — Verification

Match the template's CI gates (add the scripts if missing):

```bash
bun run typecheck      # tsc --noEmit, strict
bun run lint           # expo lint (ESLint flat config)
bun run test:ci        # jest-expo + RNTL 14
bun run check:features # feature isolation (if adopted)
bun run build          # expo export → dist/client + dist/server
```

Testing notes:

- RNTL 14 APIs are async: `await render(...)`, `await renderHook(...)`,
  `await fireEvent(...)`, `await act(...)` — older sync-style tests must be
  migrated.
- After `bun run build`, verify real SSR output: start the production server
  and confirm the first-response HTML contains rendered content (not an
  empty shell), then confirm hydration produces no console errors and no
  white-flash on dark mode.

## Anti-Patterns to Remove While Migrating

- App-local button/input/menu/modal/card/typography primitives that duplicate
  `@mrmeg/expo-ui` components.
- Hard-coded colors, shadows, radius, spacing in general-purpose UI.
- Fetch-on-mount for initial route data that belongs in a loader.
- Top-level imports of server modules in files that reach the client bundle.
- UI branching on raw HTTP `Response` objects.
- Feature folders importing sibling feature internals.
- Web startup logic reading persisted browser state during first render.
- Optional integrations that crash on a blank `.env`.

## Appendix — Portfolio Tier Scan (June 2026)

Snapshot of where each app stood when this guide was written. If your app is
listed, start at that tier; re-verify against `package.json` first.

| App | Expo | @mrmeg/expo-ui | Web output | Tier |
|-----|------|----------------|-----------|------|
| doglog | 56.0.9 | 0.7.3 | server | 1 |
| fieldnest | 56.0.9 | 0.7.3 | server | 1 |
| insinc | 56.0.8 | 0.7.0 | server | 1 |
| tractor-tools-direct | 56.0.8 | 0.6.1 | server | 1 |
| mrmeg | 55.0.23 | 0.1.10 | server | 2 |
| downrangedays | 55.0.24 | 0.1.8 | server | 2 |
| simplesell | 55.0.15 | 0.2.0 | server | 2 |
| simplesell-preview-publish | 55.0.15 | 0.2.0 | server | 2 |
| simplesell-site-builder | 55.0.15 | 0.2.0 | server | 2 |
| firearm-pos | 54.0.30 | — | server | 3 |
| mindmap | 54.0.33 | — | single | 3 |
| julip | 52.0.18 | — | server | 3 |
| WAGBI | 52.0.36 | — | server | 3 |
