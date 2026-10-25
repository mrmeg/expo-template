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

## Target Baseline (October 2026)

| Package | Version |
|---------|---------|
| expo | ~58.0.9 (SDK 58 beta) |
| expo-router | ~58.0.18 |
| expo-server | ~58.0.5 |
| react / react-dom | 19.3.0 |
| react-native | 0.88.0-rc.4 |
| react-native-web | ^0.21.4 |
| @mrmeg/expo-ui | ^0.32.0 |
| @mrmeg/expo-media (if using media) | ^0.6.0 |
| zustand | ^5.0.15 |
| @tanstack/react-query | ^5.104.2 |
| react-hook-form | ^7.90.0 |
| zod | ^4.6.7 |
| typescript | ~6.0.3 (strict) |
| jest-expo | ~58.0.9 |
| @testing-library/react-native | ^14.1.0 |
| eslint | ^10 (flat config) |

Package manager: **Bun** (`bun.lock`; scripts run as `bun run <script>`).

## Self-Assessment

Check `package.json` and the app config:

- **Tier 1** — Expo 56–57, `web.output: "server"`, `@mrmeg/expo-ui` ≥ 0.6. Start at Phase 3, then 4–7.
- **Tier 2** — Expo 55, `@mrmeg/expo-ui` 0.1–0.2. Start at Phase 1; budget real time for Phase 4, since the ui API moved substantially between 0.2 and 0.23.
- **Tier 3** — Expo ≤ 54, no `@mrmeg/expo-ui`, possibly `web.output: "single"` or `"static"`. Every phase, upgrading Expo one major at a time (52→53→54→55→56→57→58) and getting the app booting at each step.

## Phase 1 — Toolchain

1. Adopt Bun: delete other lockfiles, run `bun install`.
2. `bunx expo install expo@next --fix` (SDK 58 is in beta; use `expo@^58.0.0` once it is stable), then `bunx expo-doctor`; resolve every finding. (Tier 3: one major at a time.)
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
2. Add `app/+html.tsx` (fetch the template's). It wraps every route's HTML with the viewport meta, global CSS, a blocking script that stamps the color scheme on `<html>` before first paint, and — under server rendering — the framework's SSR head/body resources. Adapt fonts and scripts. The template self-hosts Inter (`public/fonts/inter/`, Latin preloaded, `@font-face` inline with `font-display: optional`) instead of a render-blocking Google Fonts stylesheet; keep the `mrmeg-expo-ui-inter` id on that `<style>` so `useResources()` does not inject a second copy.
3. Add a production server entry. Template: `server.bun.ts` (`Bun.serve`) serves `dist/client/` statics and mounts the `dist/server/` handler through `expo-server/adapter/bun`. On a non-Bun host, use the matching `expo-server` adapter and reimplement the same static/CORS/rate-limit/header layers.
4. **First-render rules.** Persisted browser state (localStorage, `matchMedia`, dimensions) exists only after mount, so a route's first render must not depend on it — read it in an effect or accept the pre-hydration default. Anything that must be correct before paint belongs in a `+html.tsx` blocking script (how the color scheme is stamped). Under server rendering, any value the markup depends on must come off the request: mirror it into a cookie and re-derive it from identical bytes on both sides so hydration matches (`shared/ssrViewport.ts`, `shared/ssrOnboarding.ts`, `client/features/app/ssrViewportMetrics.ts`). Without a viewport signal, react-native-web lays out the tree at width 0.

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

Upgrade to `@mrmeg/expo-ui@^0.32.0`. Peer ranges: `expo`, `expo-font`, `expo-haptics`, `@expo/ui` ≥ 56 < 59; `react` ≥ 19.2 < 20; `react-native` ≥ 0.85 < 0.89; `react-native-web` ≥ 0.21 < 0.22; `zustand` ≥ 5 < 6; `react-native-gesture-handler` ≥ 2.30 < 4; `react-native-keyboard-controller` ≥ 1.21 < 2; `react-native-safe-area-context` ≥ 5.6 < 6; `react-native-screens` ≥ 4.23 < 5; `react-native-svg` ≥ 15 < 16; `@react-native-async-storage/async-storage` ≥ 2.2 < 2.3. Optional, only for the media components: `expo-image`, `expo-video`, `expo-audio` ≥ 56 < 59.

**Required root setup:**

- Mount `UIProvider` once (props `notification`, `portalHost`, `statusBar` are opt-out). It renders the `@rn-primitives` portal host that `Dialog`, `Drawer`, `DropdownMenu`, `Popover`, `Select`, and `Tooltip` need, plus `Notification` and `StatusBar`.
- Call `const { loaded } = useResources()` once near the root and hold rendering until `loaded`.

**Icons (`@mrmeg/expo-ui` 0.29.0+).** `Icon` draws Lucide glyph data the package ships; no icon library is a peer. Run `bunx expo-ui-icons init` once (it seeds `client/icons.json` from the `name="…"` / `icon="…"` literals in `app/`, `client/`, `shared/` and writes `client/icons.generated.ts`), typecheck, and `bunx expo-ui-icons add` every name it reports. Call `registerIcons(appIcons)` at module scope in the root layout (`registerIcons` from `@mrmeg/expo-ui/components/Icon`, `appIcons` from `@/client/icons.generated`) and in the Jest setup (in a `beforeAll`, so test-file mocks still reach `Icon`); delete the Lucide Jest module mapping and any `iconRegistry.generated` mock. Replace direct `lucide-react-native` imports with `<Icon name>` (or `component` for non-Lucide art), and `@expo/vector-icons` tab glyphs with template PNGs: list them as `tabIcons`, run `bunx expo-ui-icons tabs`, and pass `src={TAB_ICONS.<name>} renderingMode="template"` to `NativeTabs.Trigger.Icon`. Then drop both packages from `package.json` and add `bunx expo-ui-icons --check` and `bunx expo-ui-icons tabs --check` to CI. An app already on 0.27.x or 0.28.x follows [Consumer migration to 0.29.1](#consumer-migration-to-0291) step by step.

**Import only from public subpaths** (`.`, `/components`, `/hooks`, `/state`, `/constants`, `/lib`) — never `dist/` or a source checkout:

```ts
import { Button, ItemGroup, StyledText, TextInput } from "@mrmeg/expo-ui/components";
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
- Use `getShadowStyle(type)` for elevation (`base`, `soft`, `sharp`, `subtle`, `elevated`, `glow`, `glass`, `card`, `cardHover`, `cardSubtle`) rather than the legacy `shadow*` props, which RN 0.85 and react-native-web 0.21 deprecate in favor of `boxShadow`. `Card`'s default variant already applies `getShadowStyle("subtle")`. Elevation is for collection tiles and overlays, not for boxing screen sections.

**Screen layout — flatten the card soup.** Screens get one horizontal inset, `spacing.screenPadding` (16), owned by the container or by its children, never both. Replace bordered, shadowed, or tinted panels around sections, forms, and row groups with flat content: lists and settings become `ItemGroup` + `Item` rows (full-width rows, inset hairlines; the scroll view then pads nothing horizontally), form fields span the column under section headers, and sections break on a header, `spacing.sectionSpacing`, or a `Separator`. Size photos, media, and charts to the column; on wide screens cap and centre the column (`maxWidth` + `alignSelf: "center"`) instead of boxing it. Keep `Card` for one item in a collection or one tappable object, never nested. Rules and a full screen: `packages/ui/LLM_USAGE.md`, Screen Layout.

**Component swaps.** Replace one-off primitives with package components: buttons, text inputs, switches/checkboxes, selects, tabs, dialogs, bottom sheets, dropdown menus, grouped lists (`ItemGroup`), badges, skeletons, empty states, icons. Full use-case index: `packages/ui/LLM_USAGE.md`.

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
- **Auth fetch:** one `authenticatedFetch`/`api.*` wrapper injects the Bearer token; UI code never builds auth headers. The wrapper imports no auth code — auth registers its token getter at startup, as the server registers its token verifier. Web requests stay same-origin; native ones resolve `/api/*` against `EXPO_PUBLIC_API_URL` and fail closed in a release build without it (expo-router's `origin` stays blank).
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

## Consumer migration to 0.32.0

From 0.30.x, run `bun add @mrmeg/expo-ui@^0.32.0` (and `@mrmeg/expo-media@^0.6.0` with media), then `bunx expo-ui-icons`, `bunx expo-ui-icons tabs`, typecheck and test. Behaviour that changed:

- 0.31.0: Lucide 1.61 turns `music`, `music-2`, `music-3` and `music-4` into aliases, and `expo-ui-icons` rejects an alias in `client/icons.json`: rename them to `eighth-notes`, `eighth-note`, `half-note` and `sixteenth-notes`. `ThemeSelector` exposes `aria-checked` on web; `TextInput` reads helper text once on native.
- 0.32.0: `Checkbox` with `indeterminate` and `checked={false}` now draws the dash and reads as "mixed"; drop any `checked` passed only to make the dash appear.

New and opt-in, for a media library screen: `MediaTile`, `MediaGrid`, `MediaSelectionBar`, `UploadQueue` (subpath imports, `expo-image` for the tile and queue) and `useKeySelection`. `@mrmeg/expo-media` 0.6.0 adds `/picker` (`useMediaPicker`; `expo-image-picker` becomes an optional peer), `/upload-queue` (`useUploadQueue`, `useVideoThumbnailBackfill`), same-ID video thumbnail helpers (`videoThumbnailKey`, `withVideoThumbnailKeys`), `usePairedVideoList`, and the server option `deleteCompanions`; native video thumbnails, which were silently missing on iOS, now extract. The template's `app/(main)/(tabs)/media.tsx` is the reference screen.

## Consumer migration to 0.30.0

From 0.29.1 the upgrade is mostly additive. Run `bun add @mrmeg/expo-ui@^0.30.0`, then typecheck and test. Behaviour that changed:

- `SegmentedControl` selects no segment when `value` (or `defaultValue`) is not one of `values`; it used to show the first one selected. A screen that relied on that must pass a real value.
- `TextInput` names its native field from `label` and describes it with `errorText` / `helperText`; a consumer's own `accessibilityLabel` / `accessibilityHint` still win. Re-check screen-reader output on forms that set both.
- `Item` now forwards `accessibilityLabel`, `accessibilityHint`, `accessibilityActions`, `testID` and `ref`: drop any wrapper `Pressable` added only to carry them.

New and opt-in: `IconButton`, `buttonHeights`, and the media components (`Image`, `Video`, `AudioPlayer`, `MediaViewer`, plus `MediaControlButton`, `MediaScrubber`, `useMediaKeyboard`). Media components are imported by subpath (`@mrmeg/expo-ui/components/Video`), never from the barrel, and need their optional peer: `bunx expo install expo-image expo-video expo-audio` for the ones you use. `expo-audio` is native code, so rebuild dev clients after adding it; `Video`'s Picture in Picture needs the `expo-video` config plugin with `supportsPictureInPicture: true`. An app on 0.27.x or 0.28.x runs [Consumer migration to 0.29.1](#consumer-migration-to-0291) first.

## Consumer migration to 0.29.1

The upgrade every fleet app on `@mrmeg/expo-ui` 0.27.x or 0.28.x runs to reach 0.29.1. A per-app migration spec cites this section and lists only that app's deltas (call sites, prerequisite PRs, which steps it skips). Run the steps in order; each ends in a state that typechecks and passes tests.

### 1. Prerequisites

- **Clean lockfile.** The bump rewrites `bun.lock`, so start from a committed tree and a lockfile that installs as-is:

  ```sh
  git status --porcelain            # empty
  bun install --frozen-lockfile     # passes without changes
  ```

- **No UI spec in flight in the same repo.** Two branches that both change `bun.lock` or the same screens conflict. Merge or park every open UI or dependency PR first, then branch the migration from the updated base.
- **0.27 → 0.28 first, if the app is on 0.27.x.** 0.28 is a separate behavior change; apply it before the icon work (`packages/ui/CHANGELOG.md`, `[0.28.0]`):
  - `Checkbox` and `RadioGroup.Item` with a `label` are now one control; update tests that query them by role.
  - `Item`'s `separator` no longer defaults to `false`: delete manual dividers between rows, and replace bordered row panels with `ItemGroup` (step 9).
  - Move radius overrides into `setShape` slots (`input`, `card`, `sheet`, `badge`, `dialog`).
  - Optional adoptions: `Screen` + `useWindowInsets` instead of `SafeAreaView` / `useSafeAreaInsets` padding, `useNotificationOffset` in tab layouts, `<UIProvider haptics>` instead of per-control `expo-haptics` calls, `BottomSheet onDismissed` instead of timers.
  - Re-check screenshots: dark shadows are edge-lit, the `Skeleton` fill is `borderStrong`, native ships four Inter files.
- **Peers.** `expo` and `@expo/ui` ≥ 56 < 59, `react` ≥ 19.2, `react-native` ≥ 0.85 < 0.89, `react-native-svg` 15, `react-native-keyboard-controller` ≥ 1.21 (full list in Phase 4).

### 2. Accessibility gate (before the bump)

0.28 hides an `Icon` with no `accessibilityLabel` from assistive tech on every platform (`aria-hidden` on web, `accessible={false}` on native). An icon-only `Pressable` / `Button` that relied on the icon's old unnamed `role="img"` becomes an **unnamed button** after the bump. Fix these first, while the old behavior still lets you find them:

- Give every icon-only control its own name: `accessibilityLabel` on the `Pressable` (translated), `accessibilityRole="button"`, and leave the `Icon` unlabelled (it is decoration inside a named control).
- A standalone informational icon (status glyph with no text beside it) keeps `accessibilityLabel` on the `Icon`.

Lock it in with a guard test that renders each screen with icon-only controls and fails on any unnamed button (RNTL 14: `render` is async and `UNSAFE_root` is gone, so query by role):

```tsx
// client/__tests__/namedControls.test.tsx
import { render, screen, within } from "@testing-library/react-native";
import SettingsScreen from "@/app/(main)/(tabs)/settings";

function unnamedButtons() {
  return screen.queryAllByRole("button").filter(
    (button) =>
      !button.props.accessibilityLabel &&
      !button.props["aria-label"] &&
      !button.props["aria-labelledby"] &&
      within(button).queryAllByText(/\S/).length === 0
  );
}

it.each([["settings", SettingsScreen]])("%s names every button", async (_, Screen) => {
  await render(<Screen />);
  expect(unnamedButtons()).toHaveLength(0);
});
```

Add each screen with an icon-only control to the table. The test must pass on the old version and keep passing after step 3.

### 3. The bump

```sh
bun add @mrmeg/expo-ui@^0.29.1
bun install --frozen-lockfile     # the lockfile is now consistent
test -f node_modules/@mrmeg/expo-ui/dist/design-system.json   # the lint plugin reads it
```

Commit `package.json` and `bun.lock` alone. Typecheck now fails wherever the app passes a Lucide component or an unregistered name; steps 4 to 6 fix that.

### 4. Seed the icon manifest

`Icon` draws glyph data the app registers; 19 names are built in and `IconName` covers those plus the app's own.

```sh
bunx expo-ui-icons init           # writes client/icons.json and client/icons.generated.ts
bun run typecheck                 # lists names that are not registered
bunx expo-ui-icons add <name...>  # add each reported name, then rerun typecheck
```

What `init` finds: double-quoted kebab-case literals after `name` or `icon` with `=` or `:` (`name="search"`, `icon={"bell"}`, `{ icon: "bell" }`) in `app/`, `client/` and `shared/`, skipping tests, `__tests__`, `__mocks__` and `*.generated.ts`. It reports alias names it skipped (`home → house`); use the canonical name. It refuses to overwrite an existing manifest without `--force`.

What it misses, so grep for them and `add` by hand:

- Object literals under other keys (`{ glyph: "map-pin" }`, `{ iconName: "flag" }`), single-quoted or template-literal names.
- Names built at runtime (`` `signal-${level}` ``, `STATUS_ICON[status]`). List every value of the map in `add`, type the map as `Record<Status, IconName>`, and narrow untrusted strings with `isIconName(value)` from `@mrmeg/expo-ui/components/Icon`.
- Names that reached the app through `as=` or `component=` (step 6).

`add` resolves an alias to its canonical name and rejects names that are not in the shipped Lucide snapshot (1.57.0 in 0.29.1). Options: `--manifest <path>` (default `client/icons.json`), `--out <path>` (default `client/icons.generated.ts`).

### 5. Register the icons

Root layout, at module scope (not in a component or effect, so the server render, the first client render and the crash fallback all draw icons):

```tsx
// app/_layout.tsx (or the root layout module it renders)
import { registerIcons } from "@mrmeg/expo-ui/components/Icon";
import { appIcons } from "@/client/icons.generated";

registerIcons(appIcons);
```

Jest setup, in a `beforeAll` with lazy `require`s, so a test file's own `jest.mock(...)` calls bind before `Icon` loads:

```ts
// test/setup.ts
beforeAll(() => {
  const { registerIcons } = require("@mrmeg/expo-ui/components/Icon");
  const { appIcons } = require("@/client/icons.generated");
  registerIcons(appIcons);
});
```

An unregistered name renders nothing and warns once in development: `Icon: "x" is not a registered icon`.

### 6. `as=` and `component=` → `name`

App wrappers that take a Lucide component (`<AppIcon as={Search} />`, `<Icon component={ChevronRight} />`, `icon: Bell` in a config array) become names:

```tsx
// before
import { ChevronRight } from "lucide-react-native";
<Icon component={ChevronRight} size={16} color="mutedForeground" />
// after
<Icon name="chevron-right" size={16} color="mutedForeground" />
```

Type config arrays as `IconName` (`{ icon: "bell" as const }` or `icon: IconName`). Keep `component` only for non-Lucide art (a brand logo SVG). `ToggleIcon` and `ToggleGroupIcon` take `IconProps`, so `name` works there too. An app with many `as=` call sites rewrites them before running `init`, so the scan sees the names.

### 7. Drop Lucide

```sh
grep -rn "lucide" app client shared test jest.config.* package.json   # no hits left except docs
bun remove lucide-react-native
```

Also delete: the `lucide-react-native` entry in Jest `moduleNameMapper` or `transformIgnorePatterns`, any mock of `@mrmeg/expo-ui/components/iconRegistry.generated` (that export is gone), and `@expo/vector-icons` if tab icons were its last use (`tabIcons` in `client/icons.json`, then `bunx expo-ui-icons tabs`; it needs `rsvg-convert`, the check does not).

### 8. `--check` in CI

Add the drift checks to the app's validate job (or its `verify` script) so a name added to `icons.json` without regenerating fails the build:

```sh
bunx expo-ui-icons --check        # exit 1 if client/icons.generated.ts is missing or stale; writes nothing
bunx expo-ui-icons tabs --check   # only for apps with NativeTabs tabIcons
```

After any later kit bump that moves the Lucide snapshot, rerun `bunx expo-ui-icons` (and `tabs`) and commit the output.

### 9. Settings rows: `ThemeSelector`, `ItemGroup` / `Item`

Replace hand-rolled theme pickers (three radio rows, a `SegmentedControl`, a `Select`, a `ToggleGroup`) with one row holding `ThemeSelector`, bound to `useThemeStore`:

```tsx
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@mrmeg/expo-ui/components/Item";
import { ThemeSelector } from "@mrmeg/expo-ui/components/ThemeSelector";
import { useThemeStore } from "@mrmeg/expo-ui/state";

<ItemGroup title={t("settings.preferences")}>
  <Item>
    <ItemContent>
      <ItemTitle>{t("settings.themeTitle")}</ItemTitle>
      {userTheme === "system" && <ItemDescription>{t("settings.matchesDevice", { scheme })}</ItemDescription>}
    </ItemContent>
    <ItemActions>
      <ThemeSelector labels={{ system: t("settings.theme.system"), light: t("settings.theme.light"), dark: t("settings.theme.dark") }} />
    </ItemActions>
  </Item>
</ItemGroup>
```

Pass translated `labels`: they name each segment for screen readers. Show "matches device" only for the system preference. Move every other settings and profile row onto `ItemGroup` + `Item`; delete manual dividers, bordered row panels and per-row `Card`s. The row title names a trailing `Switch` / `Checkbox` / `Toggle`, so those need no label of their own. The template's `app/(main)/(tabs)/settings.tsx` is the reference screen.

### 10. `withAlpha`, not hex-suffix alpha

On web every `theme.colors.*` value is `var(--c-*)`, so `theme.colors.primary + "20"` is invalid CSS and the tint silently disappears (native still shows it, which hides the bug).

```ts
import { withAlpha } from "@mrmeg/expo-ui/hooks";   // also returned by useTheme()
backgroundColor: withAlpha(theme.colors.primary, 0.12)
```

Find them, then keep them out with a source-scan test:

```sh
grep -rnE "colors\.[A-Za-z]+ *\+ *[\"'\`]" app client shared
```

```ts
// client/__tests__/noHexAlpha.test.ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const HEX_ALPHA = /colors\.\w+\s*\+\s*["'`]/;

it("never appends hex alpha to a theme token", () => {
  const hits = ["app", "client", "shared"].flatMap((dir) =>
    (readdirSync(dir, { recursive: true }) as string[])
      .filter((file) => /\.tsx?$/.test(file) && !file.includes("__tests__"))
      .flatMap((file) =>
        readFileSync(join(dir, file), "utf8")
          .split("\n")
          .flatMap((line, i) => (HEX_ALPHA.test(line) ? [`${dir}/${file}:${i + 1}`] : []))
      )
  );
  expect(hits).toEqual([]);
});
```

### 11. Validation checklist

- [ ] `bun install --frozen-lockfile` passes; `git diff --stat` shows only the files this migration meant to touch.
- [ ] `grep -rn lucide app client shared test package.json` is empty; `@mrmeg/expo-ui` resolves to 0.29.1 (`bun pm ls | grep expo-ui`).
- [ ] `bun run typecheck`, `bun run lint` (and `bun lint:ui` where the app has it), `bun run test:ci` (or the app's CI test script) pass, including the named-controls and hex-alpha guards.
- [ ] `bunx expo-ui-icons --check` (and `tabs --check` with NativeTabs) passes and is wired into CI.
- [ ] Web: `bun run build && bun run start`; every route draws its icons in the server HTML, the theme row switches System / Light / Dark, tinted surfaces keep their tint in both schemes, and the console has no `is not a registered icon` warning or hydration warning.
- [ ] Native: a dev build on iOS and Android; icons render on every tab, VoiceOver / TalkBack name every icon-only control, and the crash fallback (throw from a screen in development) draws its icons and reports to Sentry.
- [ ] Screenshots re-checked where 0.28 changed shadows, skeletons or fonts.

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
