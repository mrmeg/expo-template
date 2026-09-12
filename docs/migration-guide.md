# Migrating an Existing App to the expo-template Baseline

Self-contained: use this in any Expo app to reach the [mrmeg/expo-template](https://github.com/mrmeg/expo-template) baseline — server web output, typed data loaders, `@mrmeg/expo-ui` components, reusable screen templates, verification gates. Required config, API shapes, and patterns are inlined; anything else is fetchable from the template's GitHub.

## How to Use This Document

1. Self-assess to find your tier and starting phase.
2. Work the phases in order.
3. Pilot one screen/feature, confirm it builds and passes checks, then repeat the pattern.
4. Run the Phase 7 gates after each phase.

## Reference Materials (fetch as needed)

| Resource | URL |
|----------|-----|
| All template docs, concatenated | `https://raw.githubusercontent.com/mrmeg/expo-template/main/llms-full.txt` |
| Raw-URL index of demos, screen templates, component source | `https://raw.githubusercontent.com/mrmeg/expo-template/main/llms-examples.txt` |
| UI package usage rules | `https://raw.githubusercontent.com/mrmeg/expo-template/main/packages/ui/LLM_USAGE.md` |
| Any individual file | `https://raw.githubusercontent.com/mrmeg/expo-template/main/<path>` |

`llms-full.txt` is generated from the repo; where it disagrees with this guide, trust it.

## Target Baseline (September 2026)

| Package | Version |
|---------|---------|
| expo | ~57.0.21 |
| expo-router | ~57.0.20 |
| expo-server | ~57.0.3 |
| react / react-dom | 19.2.3 |
| react-native | 0.86.3 |
| react-native-web | ^0.21.2 |
| @mrmeg/expo-ui | ^0.24.0 |
| @mrmeg/expo-media (if using media) | ^0.5.0 |
| zustand | ^5.0.15 |
| @tanstack/react-query | ^5.102.8 |
| react-hook-form | ^7.87.0 |
| zod | ^4.5.4 |
| typescript | ~6.0.3 (strict) |
| jest-expo | ~57.0.5 |
| @testing-library/react-native | ^14.0.1 |
| eslint | ^10 (flat config) |

Package manager: **Bun** (`bun.lock`; scripts run as `bun run <script>`).

## Self-Assessment

Check `package.json` and the app config:

- **Tier 1** — Expo 56, `web.output: "server"`, `@mrmeg/expo-ui` ≥ 0.6. Start at Phase 3, then 4–7.
- **Tier 2** — Expo 55, `@mrmeg/expo-ui` 0.1–0.2. Start at Phase 1; budget real time for Phase 4, since the ui API moved substantially between 0.2 and 0.23.
- **Tier 3** — Expo ≤ 54, no `@mrmeg/expo-ui`, possibly `web.output: "single"` or `"static"`. Every phase, upgrading Expo one major at a time (52→53→54→55→56→57) and getting the app booting at each step.

## Phase 1 — Toolchain

1. Adopt Bun: delete other lockfiles, run `bun install`.
2. `bunx expo install expo@^57.0.0 --fix`, then `bunx expo-doctor`; resolve every finding. (Tier 3: one major at a time.)
3. TypeScript ~6.0, `"strict": true`, `"@/*"` path alias pointing at the repo root.
4. ESLint 10 flat config (`eslint.config.mjs`); lint via `bunx expo lint`.

## Phase 2 — Server Web Output

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
      asyncRoutes: { web: "production" },
    },
  ],
  // ...other plugins
],
```

`output: "server"` gives API routes, middleware, and data loaders on a Node/Bun server. `unstable_useServerRendering` also renders each route **per request**, so the response carries real markup instead of an export-time shell; leaving that one flag off is a valid smaller step. It is the flag with real migration cost, because the first render then runs in Node with no DOM:

- **Register react-native-web styles at module scope.** The framework's head snapshot is taken before route modules load, so rules registered later ship as classes with no CSS. Render a server-only component **last** in the root layout that emits `StyleSheet.getSheet()` as a React 19 style resource (`href` + `precedence`; template: `client/features/app/SsrStyleFlush.tsx`), with its atomic selectors doubled (`.r-x` → `.r-x.r-x`) so they outrank the client sheet's single-class resets until each route chunk lands.
- **Filter the snapshot in `app/+html.tsx`.** Drop the framework's `<style id="react-native-stylesheet">` node from `headNodes`, and render one empty element with that id for react-native-web to adopt as its client sheet.

Then:

1. Add `expo-server` (`~57.0.3`).
2. Add `app/+html.tsx` (fetch the template's). It wraps every route's HTML with the viewport meta, global CSS, a blocking script that stamps the color scheme on `<html>` before first paint, and — under server rendering — the framework's SSR head/body resources. Adapt fonts and scripts.
3. Add a production server entry. Template: `server.bun.ts` (`Bun.serve`) serves `dist/client/` statics and mounts the `dist/server/` handler through `expo-server/adapter/bun`. On a non-Bun host, use the matching `expo-server` adapter and reimplement the same static/CORS/rate-limit/header layers.
4. **First-render rules.** Persisted browser state (localStorage, `matchMedia`, dimensions) exists only after mount, so a route's first render must not depend on it — read it in an effect or accept the pre-hydration default. Anything that must be correct before paint belongs in a `+html.tsx` blocking script (how the color scheme is stamped). Under server rendering, any value the markup depends on must come off the request: mirror it into a cookie and re-derive it from identical bytes on both sides so hydration matches (`server/lib/ssrViewport.ts`, `server/lib/ssrOnboarding.ts`, `client/features/app/ssrViewportMetrics.ts`). Without a viewport signal, react-native-web lays out the tree at width 0.

## Phase 3 — Data Loaders

Routes that need server data export a typed `loader` beside the screen. Keep the route file thin, but make each export a **declaration** — a specifier re-export is invisible to `expo export`:

```ts
// app/(main)/things/[id].tsx — the entire route file:
import { thingLoader } from "@/client/features/things/loaders";
import ThingDetailScreen from "@/client/features/things/ThingDetailScreen";

export const loader = thingLoader;
export default ThingDetailScreen;
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
    // Unit tests and direct calls have no Expo Server request scope.
  }

  // Server-only modules are imported dynamically so they never enter the
  // client bundle.
  const { getThing } = await import("@/server/api/things");

  return { thing: getThing(params.id), requestedId: params.id ?? null };
};
```

```tsx
// client/features/things/ThingDetailScreen.tsx
import { useLoaderData } from "expo-router";
import type { thingLoader } from "./loaders";

export default function ThingDetailScreen() {
  const { thing, requestedId } = useLoaderData<typeof thingLoader>();
  // Available synchronously on first render — no spinner for loader data.
}
```

Conventions:

- `setResponseHeaders` throws outside a live request; wrap it in try/catch.
- **Declare route exports; never re-export by specifier.** `expo export` finds loaders with a Babel pass over `app/` that recognizes only a `loader` **declaration** (`export const loader = …`, `export function loader…`). `export { thingLoader as loader } from "…"` is skipped, so the route works in development and ships with no loader. The same pass strips a declared `export default` from the loader bundle but leaves an `export { default } from "…"` line, pulling the whole screen graph into that server bundle. (Symptoms and guardrails: the template's `docs/server-guide.md`.)
- Import `@/server/**` **dynamically inside the loader body**, never at module top level.
- Type loader data with `LoaderFunction<T>`; consume with `useLoaderData<typeof loader>()`.
- Loaders replace fetch-on-mount for initial page data. Keep React Query for refetching, mutations, and data that changes after load.

## Phase 4 — @mrmeg/expo-ui

Upgrade to `@mrmeg/expo-ui@^0.24.0`. Peer ranges: `expo`, `expo-font`, `expo-haptics`, `@expo/ui` ≥ 56 < 58; `react` ≥ 19.2 < 20; `react-native` ≥ 0.85 < 0.87; `react-native-web` ≥ 0.21 < 0.22; `zustand` ≥ 5 < 6; `react-native-gesture-handler` ≥ 2.30 < 2.33; `react-native-keyboard-controller` ≥ 1.21 < 2; `react-native-safe-area-context` ≥ 5.6 < 6; `react-native-screens` ≥ 4.23 < 5; `@react-native-async-storage/async-storage` ≥ 2.2 < 2.3.

**Required root setup:**

- Mount `UIProvider` once (props `notification`, `portalHost`, `statusBar` are opt-out). It renders the `@rn-primitives` portal host that `Dialog`, `Drawer`, `DropdownMenu`, `Popover`, `Select`, and `Tooltip` need, plus `Notification` and `StatusBar`.
- Call `const { loaded } = useResources()` once near the root and hold rendering until `loaded`.

**Import only from public subpaths** (`.`, `/components`, `/hooks`, `/state`, `/constants`, `/lib`) — never `dist/` or a source checkout:

```ts
import { Button, Card, StyledText, TextInput } from "@mrmeg/expo-ui/components";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { notify } from "@mrmeg/expo-ui/state";
import { spacing } from "@mrmeg/expo-ui/constants";
```

**Notifications — use `notify`**, not `globalUIStore.show()` (`globalUIStore` remains for reactive subscriptions and tests):

```ts
notify.success("Saved", { messages: ["Your changes have been saved."] });
notify.error("Upload failed");   // .warning / .info take the same shape
notify.loading("Uploading…");    // persists until replaced or hidden
notify.hide();
notify({ type: "success", title: "Saved", action: { label: "View", onPress: openSaved } });

// Loading → success/error around a promise (rethrows on rejection):
await notify.promise(saveProfile(), {
  loading: "Saving…",
  success: "Profile saved",
  error: "Could not save profile",
});
```

**Theme rules:**

- `useTheme()` returns `{ theme, scheme, getShadowStyle, getFocusRingStyle, withAlpha, getContrastingColor, getTextColorForBackground, getContrastRatio }`; colors live at `theme.colors.*`. Use semantic tokens — no hard-coded palettes, shadows, radii, or spacing in general-purpose UI.
- On web each `theme.colors.*` value is a CSS custom property, so hex-alpha concatenation (`theme.colors.x + "15"`) does not work. Use `withAlpha(theme.colors.x, 0.08)`.
- `primary` is the neutral action color (dark gray in light mode, near-white in dark); `accent` (teal) is for highlights, active tabs, badges.
- Use `getShadowStyle(type)` for elevation (`base`, `soft`, `sharp`, `subtle`, `elevated`, `glow`, `glass`, `card`, `cardHover`, `cardSubtle`) rather than the legacy `shadow*` props, which RN 0.85 and react-native-web 0.21 deprecate in favor of `boxShadow`. `Card`'s default variant already applies `getShadowStyle("subtle")`.

**Component swaps.** Replace one-off primitives with package components: buttons, text inputs, switches/checkboxes, selects, tabs, dialogs, bottom sheets, dropdown menus, cards, badges, skeletons, empty states, icons. Full use-case index: `packages/ui/LLM_USAGE.md`.

- `Button` uses `preset`, not `variant`. Heights are compact: Button 28/32/40 (`sm`/`md`/`lg`), `TextInput`/`Select` 32/36/40, `Toggle` 32/36/40 (`sm`/`default`/`lg`), `Tabs` 32/36 (`sm`/`md`).
- Smoke-test web after the UI migration; style shapes that work on native can break react-native-web.

## Phase 5 — Screen Templates

17 self-contained screen templates live under `client/templates/<id>/`: `Screen.tsx` (the reusable screen, a named `<Name>Screen` export), `demo.tsx` (worked example with sample data), `meta.ts` (registry entry), `README.md`. `client/templates/registry.generated.ts` is produced by `bun run gen:templates` (verified by `gen:templates:check`) — rerun after adding or changing a folder. Demo routes at `app/(main)/(demos)/screen-<id>.tsx` re-export `demo.tsx` (`detail-hero.tsx` for `detail-hero`). Smaller composable sections follow the same pattern in `client/blocks/` with `bun run gen:blocks`.

Copy the folders you need (raw path `client/templates/<id>/Screen.tsx`), then refactor your screens to compose them. Templates are **starting points, not containers**: domain logic stays in `client/features/<feature>/` and passes data and callbacks in.

| Template id | Use for |
|-------------|---------|
| `card-grid` | Filterable card layout |
| `chat` | Messaging conversation |
| `dashboard` | Metrics and activity feed |
| `detail-hero` | Hero-image detail view |
| `error` | Error states (`not-found`, `offline`, `maintenance`, `permission-denied`, `generic`) |
| `faq` | Accordion of questions and answers |
| `form` | Multi-step wizard with validation |
| `hero` | Landing hero, centered and full-bleed |
| `list` | Search and pull to refresh |
| `notifications` | Grouped notification list |
| `pricing` | Plans and comparison |
| `profile` | Avatar, stats, sections |
| `search` | Filtered search results |
| `settings` | Grouped lists and toggles |
| `stats` | Metric grid with change indicators |
| `testimonials` | Snap-scrolling quote cards |
| `welcome` | Landing and social login |

## Phase 6 — App Conventions

- **Feature folders:** product code in `client/features/<feature>/`; no imports of sibling feature internals. The template gate is `scripts/check-feature-isolation.js` (`check:features`) — copy it to enforce this.
- **State:** React Query for server state, small Zustand stores for client state. No giant global stores.
- **Forms:** `react-hook-form` + `zod` resolvers behind form wrappers (template: `client/lib/form/`).
- **API routes:** `app/api/<feature>/<name>+api.ts` exporting `export async function GET(request: Request): Promise<Response>`. Shared auth/CORS/error helpers in `server/api/shared/`; keep route files thin. Return typed problem objects, not raw `Response` branching in UI code. Each `+api.ts` exports as its own self-contained server bundle, so consolidate sibling actions that share heavy dependencies behind one `app/api/<feature>/[action]+api.ts` dispatcher (template: `app/api/media/[action]+api.ts`).
- **Auth fetch:** one `authenticatedFetch`/`api.*` wrapper injects the Bearer token; UI code never builds auth headers.
- **Optional systems fail closed:** with a blank `.env`, auth, billing, media, and Sentry degrade to disabled/setup states instead of crashing.

## Phase 7 — Verification

Match the template's gates (add the scripts if missing):

```bash
bun run typecheck      # tsc --noEmit, strict
bun run lint           # expo lint (ESLint flat config)
bun run test:ci        # jest-expo + RNTL 14
bun run check:features # feature isolation (if adopted)
bun run build          # expo export → dist/client + dist/server
```

- RNTL 14 APIs are async: `await render(...)`, `await renderHook(...)`, `await fireEvent(...)`, `await act(...)`. Sync-style tests must be migrated.
- After `bun run build`, start the production server and load the app in a browser: every route renders, API and loader-backed routes return data, dark mode does not white-flash on first paint.

## Anti-Patterns to Remove While Migrating

Sweep for and delete: app-local duplicates of `@mrmeg/expo-ui` primitives (buttons, inputs, menus, modals, cards, typography); hard-coded colors, shadows, radii, spacing in general-purpose UI; fetch-on-mount for initial route data; top-level server-module imports in client-reachable files; UI branching on raw `Response` objects; cross-feature internal imports; startup logic that blocks first paint on persisted browser state; integrations that crash on a blank `.env`.

## Appendix — Portfolio Tier Scan (June 2026)

Where each app stood when this guide was written; re-verify against `package.json` before trusting a row.

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
