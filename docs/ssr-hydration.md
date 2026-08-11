# Web SSR Hydration — Invariants & Checklist

This template renders web in Expo Router **`server` output mode** (see
`app.config.ts` → `web.output: "server"`). Every web page is server-rendered in
Node, then hydrated in the browser. React requires the server HTML and the
client's **first** render to be identical. Any value that differs at first
render throws `Hydration failed because the server rendered HTML didn't match
the client…` — verbose in dev, a silent re-render (and subtle bugs) in prod.

## The one rule

**Never let render output depend on something the server cannot know at render
time.** Render a server-consistent default on the first pass, then switch to the
real value after mount.

What the server does **not** have during render:

- no `window` / `document` / `localStorage`
- no OS color scheme
- `useWindowDimensions()` returns `width: 0, height: 0`
- only fonts / i18n that were initialized **synchronously during render** —
  `useEffect` callbacks do **not** run on the server

## Why each piece matters (and where it lives in this template)

The template is already correct on most of these. They're documented so a fork
doesn't regress them and an agent knows the invariant before editing.

### 1. The HTML shell must render framework SSR nodes — `app/+html.tsx`

`app/+html.tsx` consumes `useServerDocumentContext()` and renders:

- `headNodes` inside `<head>`
- `bodyNodes` at the end of `<body>`
- `htmlAttributes` / `bodyAttributes` spread onto `<html>` / `<body>`

These framework-managed nodes carry **the react-native-web `<style>` element**
(all the `r-*` class rules) **and the expo-font `<style id="expo-generated-fonts">`**
that holds `@font-face` declarations.

If a custom `Root` omits them (a common mistake when `+html.tsx` is hand-written
or copied from an older template), the SSR HTML ships without those styles. Two
failure modes result:

- **Unstyled first paint / FOUC** — RNW only injects its CSS into
  `document.styleSheets` after JS hydrates.
- **Icon-font hydration mismatch** — `@expo/vector-icons` renders an empty
  `<Text/>` until `Font.isLoaded(family)` is true, and on web that check looks
  for the `@font-face` rule in `<style id="expo-generated-fonts">`. No rule in
  the HTML → client first render says "not loaded" (empty) while the server
  (with its `serverContext` populated) renders the glyph → mismatch.

> This exact omission caused a multi-round icon hydration bug in a downstream
> project forked from an older copy of this template. The contract is documented
> in `node_modules/expo-router/build/server/ServerDocument.js`.

### 2. Fonts — register during render, per request

Fonts must be registered **during render** so expo-font's server store is
populated server-side and the `@font-face` ships in the HTML. This template
loads fonts through `@mrmeg/expo-ui`'s `useResources`, which calls an
idempotent `ensureIconFontRegistered()` **in its render body** (the same shape
as `ensureI18nInitialized()` in §3):

```ts
export function ensureIconFontRegistered(): void {
  if (Platform.OS !== "web" || typeof window !== "undefined") return;
  if (Font.isLoaded("feather")) return;      // per-request store; cheap
  Font.loadAsync(Feather.font);              // synchronous on server-web
}
```

Three non-obvious details:

- **The family key is lowercase `"feather"`.** `@expo/vector-icons` builds the
  set with `createIconSet(glyphMap, 'feather', font)`, so `Feather.font` is
  `{ feather: … }` and the loaded-check is `Font.isLoaded("feather")`.
- **On server-web `Font.loadAsync` is synchronous** (it routes to
  `registerStaticFont`), so there's nothing to await and no `void` — let a
  throw propagate. A throw means the call ran outside a request scope, which
  must be loud. Call the public `Font.loadAsync`; don't reach into
  `expo-font/build/server`.
- **Module scope is NOT sufficient for SSR.** expo-font's server store is an
  `AsyncLocalStorage` entered *per request* by `Font.withServerContext()`, and
  Metro's `inlineRequires` defers a module's evaluation until it is first
  required during a render. So a module-scope `Font.loadAsync(Feather.font)`
  registers the font for whichever request warmed the module cache and for no
  other — the same cold-start-shaped failure §7 describes for the RNW sheet.
  Symptom: request 1 looks fine, requests 2+ ship zero `@font-face`, icons
  render as bare `<Text/>` server-side while the client's first render sees the
  font as loaded → React #418. Always curl the **2nd and 3rd** requests.

`useResources` still keeps a module-scope `Font.loadAsync(Feather.font)`, but
guarded to `typeof window !== "undefined"`: on the client that call
synchronously injects the `@font-face` rule before hydration, which is what
makes the client's `isLoaded` check read true. Invariant: **server store
populated per request, client rule injected pre-hydration.**

**Anti-pattern:** a bare `Font.loadAsync(...)` (or a custom `useResources`) that
only loads inside `useEffect`. That runs client-only, after first render, so the
server emits empty icons. If you replace the library hook, use expo-font's
`useFonts(map)` and include the icon fonts (Feather, etc.) in the map.

### 3. i18n must initialize synchronously during render — **including SSR**

> **Implemented in this template.** Use it as the reference for fixing a fork or
> a downstream app that still calls `initI18n()` only from an effect.

The problem this solves: if `app/_layout.tsx` initializes i18n **only** inside a
`useEffect` (`initI18n().then(() => setI18nReady(true))`), effects don't run on
the server, so i18next is uninitialized during SSR. Any `t("a.b")` on a
server-rendered screen emits the **raw key** server-side and the **translation**
client-side → a hydration mismatch. The bundled screens that use `t()` (e.g.
`settings.tsx`) live inside `(main)`, which the onboarding gate replaces during
SSR for a visitor with no `has-seen-onboarding` cookie (§6) — so a cookie-less
request masks the bug, but it bites the moment any SSR-reachable route calls
`t()`. Send the cookie to see through the gate.

**How it's wired here:**

1. `client/features/i18n/index.ts` exports an idempotent, **synchronous**
   English bootstrap and calls it at module load:

   ```ts
   export function ensureI18nInitialized(): void {
     if (i18n.isInitialized) return;
     try {
       void i18n.use(initReactI18next).init({
         resources: { en: { translation: en } },
         lng: fallbackLocale,
         fallbackLng: fallbackLocale,
         initAsync: false,           // inline resources + initAsync:false → init resolves synchronously
         interpolation: { escapeValue: false },
         react: { useSuspense: false },
       }).catch(() => { /* terminal state owned by initI18n() */ });
     } catch { /* never crash module import (e.g. a test mock without initReactI18next) */ }
   }
   ensureI18nInitialized();          // best-effort at module load
   ```

   `initI18n()` remains for the post-hydration locale upgrade — it calls
   `ensureI18nInitialized()` first, then (for a non-English detected/persisted
   locale) lazy-loads that bundle and `changeLanguage()`s into it. It stays
   terminal-state (resolves, never rejects) and still feeds the `i18nReady`
   startup gate.

2. `app/_layout.tsx` calls `ensureI18nInitialized()` **in the render body**
   (not an effect). Metro's `inlineRequires` can defer a pure module-load
   side-effect so it never runs on the server; calling it during render
   guarantees it runs on SSR before any screen.

i18next v26 note: the synchronous-init flag is `initAsync: false` (it was
`initImmediate` in older majors). This template is on i18next v26.

### 4. Viewport-dependent layout — seed the whole frame, not just a context

Branching layout on `useWindowDimensions().width` (`isCompact = width < 760`,
etc.) diverges the server (width 0 → "compact") from the client (real width).
This can shift **sibling order** (e.g. a skipped `{!isCompact && <Nav/>}`
block), not just styles — a structural mismatch.

Width 0 is not a corner case on web SSR, it's the default. Three separate
places hardcode it, and each one has to be seeded independently:

| Source | Server-side value | Who reads it |
|---|---|---|
| react-native-web `Dimensions.get('window')` | `{width: 0, height: 0}` (`update()` early-returns with no DOM) | `SafeAreaProvider`'s frame fallback |
| `SafeAreaProvider` with no `initialMetrics` | falls back to the above | `useSafeAreaFrame`, layout below the root |
| expo-router `SafeAreaProviderCompat.initialMetrics.frame` | **module constant**, `{width: 0, height: 0}` on web | `useFrameSize` → the stack `Header` |

Left unseeded, the SSR HTML ships `max-width:-68px` on the header title
container (`layout.width - 68`), collapsed centered containers, and content
hugging the left edge.

**How it's wired here:**

1. **`server/lib/ssrViewport.ts`** resolves a width from the request:
   `mrmeg-vw` cookie (precise, written by `useDimensions` after the first
   mount) → User-Agent heuristic → desktop default. Same three read surfaces
   as `ssrOnboarding.ts` (§6): `detectSsrViewportFromRequestScope()` for the
   root layout, `resolveSsrViewportWidth(cookie, ua)` as the shared pure core,
   and `detectSsrViewportWidth(request)` / `withSsrViewport(loader)` for routes
   that also want it in loader data.
2. **`client/features/app/ssrViewportMetrics.ts`** turns that into
   `SafeAreaProvider`'s `initialMetrics` (zero insets — the browser can't know
   real insets before its probe element mounts, so anything else is a
   guaranteed mismatch). `RootLayout` passes it and provides the same width to
   `SsrViewportContext` so `useDimensions` agrees with the frame. Native gets
   `undefined` and keeps its real measurement path.
3. **`MainLayout` passes `layout={{width, height}}`** in `screenOptions`,
   because the `Header` reads expo-router's module-scope frame constant, which
   `initialMetrics` does not reach.

The invariant that makes all of this hydration-safe: **the browser resolves the
width from `document.cookie` / `navigator.userAgent`, not from
`window.innerWidth`.** Both sides derive the same number from the same bytes,
exactly like the onboarding cookie in §6. Reading the real width during render
would be *more* accurate and *guaranteed* to mismatch; `useDimensions` picks it
up in a post-mount effect instead, and refreshes the cookie for next time.

> **Per-request leak caution.** Resolve these values *during render* (a lazy
> `useState` initializer) and never cache them in module scope. The server
> module scope is shared across concurrent requests, so a hoisted frame — or a
> `Dimensions.set()` / store mutation — lets a phone request's width bleed into
> a desktop request's layout. Same hazard as the RNW stylesheet in §7.

Use `useDimensions()` for responsive width, **not** raw
`useWindowDimensions()`, in anything that renders on web.

### 5. Theme — resolved server-side from a cookie

Theme is **personalization**, so it gets the same treatment as onboarding (§6):
give the server the signal instead of masking a wrong render.

Before this, the server had no way to know the visitor's theme, so every SSR
render shipped a fully **light** React tree — light surface classes and light
foregrounds throughout — and a dark-mode user watched the whole page recolor
after hydration (dark blank → light tree → dark tree). The blocking script could
only set the `<body>` background; it cannot recolor a React tree.

Four parts:

1. **`themeStore` dual-writes on web.** `setTheme(pref)` writes
   `localStorage["user-theme-preference"]` **and** a
   `user-theme-preference=<pref>` cookie (`path=/; max-age≈1y; SameSite=Lax`) —
   same name for both, so there's one string to grep and the `+html.tsx` script
   already reads it. `loadTheme()` backfills/repairs the cookie from
   `localStorage` (and writes `system` when nothing is persisted), so existing
   users are migrated on their next visit. Native persistence is unchanged:
   AsyncStorage, eagerly hydrated at module load, no cookie.

2. **`server/lib/ssrTheme.ts` reads it.** `parseThemePreferenceCookie()` does
   the parse (anchored to a cookie boundary; unknown values → `null`);
   `detectSsrThemeSeedFromRequestScope()` gets the header from `expo-server`'s
   `requestHeaders()` — **inside a try/catch that falls back to the default
   seed**, because the same module ships in the client bundle where
   `requestHeaders()` throws. `detectSsrThemeSeed(request)` is the explicit
   loader-friendly form, mirroring `detectOnboardingSeen(request)`.

   A `system` preference (or a first-time visitor) resolves through the
   `Sec-CH-Prefers-Color-Scheme` client hint when the browser sends one.
   `app/+html.tsx` opts in with `<meta http-equiv="Accept-CH">`, so the hint
   arrives from the second navigation onwards on browsers that implement it;
   absent a hint the server falls back to light, which is what the store has
   always booted with.

3. **`SsrThemeSeedContext` carries it per request.** `useThemeStore` is a module
   singleton shared by every concurrent SSR request, so a per-request theme can
   **never** be written into it. `@mrmeg/expo-ui/state`'s `SsrThemeSeedContext`
   is the per-request channel instead, and `client/components/SsrThemeProvider.tsx`
   provides it: a lazy `useState` initializer reads the request scope on the
   server and `document.cookie` in the browser. `packages/ui` must not import
   `expo-server` (`check:forbidden-imports`), which is why the parse lives in
   the app's `server/` layer and only the context lives in the package.

   `RootLayout` is split for this: the default export renders only
   `<SsrThemeProvider>`, and `RootLayoutContent` (which calls `useTheme()` for
   the navigation `ThemeProvider` and the Stack backdrop) renders inside it — a
   component can't consume a context it renders itself.

4. **`useTheme` prefers the seed until persistence has loaded.** The store gained
   `hasLoadedTheme`, flipped by `loadTheme()`. While it's false on web,
   `useTheme`/`useStyles` resolve from the seed; after mount
   `syncThemeFromEnvironment()` reads `localStorage`, starts the live OS
   listener, and store state takes over for good. So `localStorage` always wins
   on a mismatch and a stale cookie can't pin anyone to the wrong theme beyond
   the first paint.

`app/+html.tsx` renders `data-theme` on `<html>` from the same per-request read —
**but only when that read found something.** `detectSsrThemeFromRequestScope()`
returns `{ seed, hasSignal, scheme }`, and `scheme` is `null` unless the server
genuinely knows the answer (an explicit `light`/`dark` cookie, or a real
`Sec-CH-Prefers-Color-Scheme` hint). Two branches:

- **Signal** → stamp `data-theme` and `color-scheme`, so the
  `html[data-theme=…]` CSS paints the right body background on byte 1 with no
  blocking script involved. `data-ssr-system-scheme` goes on too, carrying the
  system scheme the server used: the client hint is a *request* header that
  browser JS cannot read, so without that attribute the client's first render
  would have to guess with `window.matchMedia` and would disagree with the
  server on every hint-less request.

- **No signal** → stamp **nothing**. The server rendered light because that's
  the store's boot default, not because it knows anything, and a stamped guess
  is worse than no attribute: `COLOR_SCHEME_SCRIPT` returns early on
  `root.dataset.theme`, and `@media (prefers-color-scheme: dark)
  html:not([data-theme])` stops matching. Both failsafes would be dead, and a
  brand-new visitor on a dark OS whose browser sent no hint would get a light
  flash with no way out. Omitting the attribute hands that case back to the
  script and the media query, exactly as it worked before the cookie existed.

A `system` cookie with **no** hint sits deliberately in the second branch:
`hasSignal` is true (the preference is known, and the seed carries it so the
server render and the client's own cookie read agree) but `scheme` is `null`,
because the light it resolves to is still the guess.

The `<meta name="theme-color">` (Safari status-bar/toolbar and Android Chrome
chrome tinting) follows the same two branches: a signal renders **one
unqualified meta** pinned to the resolved scheme's `background` (unqualified
because an explicit dark cookie must beat a light OS — a media-gated meta
would follow the OS instead), and no signal renders a
**`prefers-color-scheme`-gated pair**, the meta equivalent of the CSS
fallback — OS-correct without pinning the guess. After hydration
`useSafariThemeColorSync()` (client/features/app/safariThemeColor.ts) removes
the gated pair and keeps a single meta tracking the theme store, so in-app
toggles re-tint the browser chrome. Both branches are pinned by
`__tests__/ssrThemeStamp.test.tsx`.

So the blocking `COLOR_SCHEME_SCRIPT` stays a **first-visit-only** failsafe that
actually fires: its `data-theme` early-return is the handover, and the
conditional stamp above is what keeps the handover real. Don't widen its 500ms
`theme-loading` window; the cookie is what fixes the common case, and the script
only has to cover the hint-less first paint.

`{...htmlAttributes}` is spread first and the theme props merge over it —
including `style`, which is spread into the `colorScheme` object rather than
replacing it, so a framework-supplied `<html>` style survives.

Any *other* component that reads theme/window for render output should still
resolve to a stable default on the first render (gate on a `useHydrated()`-style
flag) and switch after mount.

Verify both cookie states against a **production** server — the dev server ships
no app content, so it can't demonstrate this:

```bash
bun run build && PORT=3000 bun run start

# The <html> attribute the blocking script and the CSS both key off.
curl -s -H 'Cookie: user-theme-preference=dark' localhost:3000/showcase \
  | grep -o 'data-theme="[^"]*"'            # data-theme="dark"

# No cookie, no hint: NO data-theme at all. An empty result is the pass —
# `data-theme="light"` here would be the regression (dead script + dead media
# query for a dark-OS first-timer).
curl -s localhost:3000/showcase | grep -o 'data-theme="[^"]*"'   # (nothing)
```

Don't grep the raw color out of the whole document: the RNW stylesheet snapshot
registers **both** palettes on every response, so `rgba(9,9,11,1.00)` is present
either way. What changes is which class the *tree* references. Resolve the class
from the stylesheet, then count its uses in the markup:

```bash
page=$(curl -s -H 'Cookie: user-theme-preference=dark' localhost:3000/showcase)
cls=$(printf '%s' "$page" \
  | grep -o '[a-z0-9-]*{background-color:rgba(9,9,11,1.00)' | head -1 | cut -d'{' -f1)

printf '%s' "$page" | grep -c "class=\"[^\"]*$cls"          # 1 — dark tree
curl -s localhost:3000/showcase | grep -c "class=\"[^\"]*$cls"   # 0 — light tree
```

`system` resolves through the client hint, which curl can send explicitly:

```bash
curl -s -H 'Cookie: user-theme-preference=system' \
     -H 'Sec-CH-Prefers-Color-Scheme: dark' localhost:3000/ \
  | grep -o 'data-ssr-system-scheme="[^"]*"'   # data-ssr-system-scheme="dark"
```

### 6. Onboarding gate — resolved server-side from a cookie

Onboarding is **personalization**, and the fix for personalization under SSR is
to give the server the signal rather than mask a wrong render. The flag is
mirrored into a cookie, the server reads it off the request, and returning
visitors get gate-free HTML — no shield script, no hidden gate in the DOM, and
`(main)` routes actually server-render for them.

`localStorage` remains the client's source of truth. The cookie is only a
render hint, so it can be stale (cleared cookies, an older visitor) without
trapping anyone: the client reconciles against `localStorage` after mount and
localStorage wins.

Three parts:

1. **`onboardingStore.ts` dual-writes on web.** `setHasSeenOnboarding(seen)`
   writes `localStorage["has-seen-onboarding"]` **and** a
   `has-seen-onboarding=1` cookie (`path=/; max-age≈1y; SameSite=Lax`).
   Setting the flag back to `false` expires the cookie (`max-age=0`), so a
   runtime onboarding reset server-renders the gate again on the next request.
   `loadOnboarding()` also repairs cookie/localStorage drift in both
   directions. Native persistence is unchanged: AsyncStorage, eagerly hydrated
   at module load, no cookie.
2. **`server/lib/ssrOnboarding.ts` reads it.** `parseOnboardingSeenCookie()`
   does the parse; `detectOnboardingSeenFromRequestScope()` gets the header
   from `expo-server`'s `requestHeaders()` — **inside a try/catch that falls
   back to `false`**. The catch is load-bearing, not defensive noise: the same
   module ships in the client bundle, where `requestHeaders()` throws because
   there is no request scope. `detectOnboardingSeen(request)` is the explicit
   loader-friendly form, mirroring `detectSsrViewportWidth(request)`.

   Why the ambient request scope rather than a loader: the gate lives in the
   **root layout**, and layouts can't export loaders —
   `@expo/router-server`'s server manifest only carries leaf html routes
   (`dist/server/_expo/routes.json` has zero `loader` fields on layouts). A
   `withOnboardingSeen(loader)` wrapper + provider would work but would have to
   be repeated on all 31 leaf routes.
3. **`useHasSeenOnboarding()` keeps hydration exact.** It follows the
   `useDimensions` shape (§4): a lazy `useState` initializer seeds the first
   render from the cookie — the one signal *both* the server and the browser
   have (`document.cookie` client-side, request scope server-side) — so the
   server HTML and the hydrated tree agree. After mount, `loadOnboarding()`
   (via `useAppStartup`) reads `localStorage` and flips `hasLoadedOnboarding`,
   at which point store state takes over. `RootLayout` calls this hook, not
   `useOnboardingStore((s) => s.hasSeenOnboarding)`.

**Never read `localStorage` during render** to decide this. That's the original
mismatch: the server can't see it, so the two first renders diverge. The cookie
exists precisely so both sides read the same bytes.

New visitors have no cookie → the server renders onboarding, fully styled by
the react-native-web `<style>` element in `headNodes` (§1). Don't add
per-element "critical CSS" for it in `+html.tsx`: `#root [data-testid=…]`
selectors outrank RNW's generated classes by specificity and keep overriding
them *after* hydration (this once collapsed the Get Started button's
`fullWidth` inner view to text width).

Verify both cookie states against the real server, not just Jest:

```bash
curl -s localhost:3000/ | grep -c onboarding-gate                               # new visitor    → > 0
curl -s -H 'Cookie: has-seen-onboarding=1' localhost:3000/ | grep -c onboarding-gate  # returning → == 0
```

> The theme preference now uses this same mechanism — see §5. The
> `theme-loading` shield survives only as a first-visit failsafe, because the
> OS `prefers-color-scheme` fallback is the one signal no cookie can supply on
> a first visit (the `Sec-CH-Prefers-Color-Scheme` client hint covers it from
> the second request onwards).

### 7. Theme-dependent styles — register at module scope, not render time

The streaming SSR renderer snapshots react-native-web's stylesheet for the
`<style id="react-native-stylesheet">` head node **before route modules load**
(`@expo/router-server`'s `getStreamingContent` builds `headNodes` up front,
then streams the app). RNW only inserts a rule into its sheet when the style is
first resolved, so **where** a style is created decides whether its CSS ships
in the head:

- Module-scope `StyleSheet.create(...)` → registered at import → in the head. ✅
- `useMemo(() => createStyles(theme), [theme])` → registered **during render**,
  after the head snapshot → the SSR HTML references classes with no rules →
  fully unstyled first paint until hydration re-inserts them. ❌

The server-side sheet is a module singleton, so the bug is cold-start-shaped:
in dev it reproduces on **every** request; in production only the **first**
render after a cold start is broken (request 1 warms the sheet for request 2+),
which makes it easy to miss in testing and guaranteed for the first real user.

**How it's handled here (two layers):**

1. **`createThemedStyles`** (`@mrmeg/expo-ui/lib`) wraps a `(theme) => styles`
   factory and eagerly evaluates it for both base themes at module load, so the
   rules exist before any head flush. Use it instead of the `useMemo` idiom:

   ```ts
   const createStyles = (theme: Theme) => StyleSheet.create({ ... });
   const themedStyles = createThemedStyles(createStyles);
   // in the component:
   const styles = themedStyles(theme);
   ```

   Factories with non-theme parameters either precompute the enum combinations
   (`Button` per size, `TextInput` per variant×size) or move the dynamic value
   to an inline style at the call site (`style={[styles.header, { paddingTop:
   insets.top }]}`) — inline styles are emitted as `style="…"` attributes and
   always ship in the HTML.

2. **`SsrStyleFlush`** (`client/features/app/SsrStyleFlush.tsx`), rendered as
   the **last** child in `RootLayout`, re-emits the full RNW sheet as a React 19
   hoistable style resource after the app subtree has rendered. It backstops
   anything that still creates styles during render (third-party components,
   a missed conversion) so the page never ships class names without rules. It
   renders `null` on the client — no hydration mismatch.

Keep using `StyleSheet.create` / `createThemedStyles` for static styles rather
than leaning on the flush: rules that only exist in the flush node disappear
from `document.styleSheets` bookkeeping RNW does at hydration, and the flush
duplicates whatever the head already carries.

#### 7a. The flush must lose cascade ties — the adoption anchor

Both sheets use single-class selectors, so **document order breaks every tie**,
and the flush is emitted as a hoisted resource: React writes it into the head
*preamble*, ahead of everything `+html.tsx` renders. Left alone, RNW would then
create its client sheet with `head.insertBefore(element, head.firstChild)`
(`react-native-web/dist/exports/StyleSheet/dom/createCSSStyleSheet.js`) at index
0 — **before** the flush — and lose those ties. The flush's classic base resets
(`.css-g5y9jx { padding: 0px; margin: 0px; … }`, one per View/Text/TextInput)
would then override any atomic that exists **only** in the client sheet, e.g. a
`{ padding-top: 32px }` atomic registered after the flush was serialized
(`.r-fd4yh7` in the build where this was diagnosed — atomic hashes vary per
build).
Most late rules self-heal because the client re-inserts them into a sheet that
wins on its own; the ones that don't get silently zeroed.

The fix is one line in `app/+html.tsx`:

```tsx
<style id="react-native-stylesheet" />
```

`createCSSStyleSheet` does `root.getElementById(id)` **first** and only creates
an element when that misses, so RNW **adopts** this node — placing the client
sheet where the anchor sits (after the flush) and leaving exactly one sheet
instead of two competing ones.

Three constraints, each load-bearing:

- **The anchor must stay empty.** `createOrderedCSSStyleSheet` hydrates its
  group records by walking the adopted element's existing rules and indexes them
  by the most recent `[stylesheet-group="N"]{}` marker. A rule that isn't
  preceded by its marker throws `undefined is not an object (evaluating
  'groups[group].rules')` at module scope — before hydration, so the page dies.
  That rules out inlining the flushed CSS here.
- **It must stay ahead of the bootstrap `<script>`s.** RNW calls `createSheet()`
  at module scope, so the anchor has to already be in the DOM when the entry
  bundle runs, or `getElementById` misses and the competing sheet comes back.
- **The `headNodes` filter must keep dropping the framework snapshot** (same
  file, §1) — it carries this same id, and a duplicate makes adoption
  order-dependent.

Do **not** "fix" this by stripping the `.css-*` resets from the flush instead.
The filter removes the framework snapshot and the client sheet doesn't exist
until JS runs, so the flush is the **only** pre-hydration source of those
resets: without them every `View` falls back to `display: block`,
`flex-direction: row`, `box-sizing: content-box` — i.e. the unstyled first paint
the flush exists to prevent.

Pinned by `__tests__/ssrStyleCascade.test.tsx` (head ordering, single id, resets
retained) and `__tests__/rnwSheetAdoption.test.ts` (the two RNW dist behaviors
adoption depends on, so an upgrade breaks a test instead of production).

### 8. Cold starts must not reach visitors — warm-up gate + blank-screen watchdog

The first SSR render after a server boot imports the whole `dist/server`
bundle and resolves every lazy route chunk — seconds of work. Two defenses,
both in this template:

1. **The warm-up gate** (`server.bun.ts`). At boot the server renders `/`
   twice — once bare (onboarding gate tree) and once with
   `Cookie: has-seen-onboarding=1` (the returning-visitor tree; the two
   lazy-load different route subtrees) — draining each body, since suspended
   chunks only render as the stream is consumed. HTML and loader requests
   `await` that warm-up; static files and `/api/*` are never gated, so health
   checks respond immediately. Without the gate, a visitor who raced the
   fire-and-forget warm-up ate the cold render personally: ~9s
   time-to-first-byte against a server still loading modules — observed as the
   trigger window for intermittent blank-on-load reports. A warm-up failure
   logs `SSR warm-up render failed` and serving continues (requests then pay
   the cold render, the old behavior).

2. **The blank-screen recovery watchdog**
   (`client/features/app/blankRecoveryScript.ts`, rendered as an inline
   `<head>` script by `app/+html.tsx`). If hydration dies after the server
   HTML was discarded — React 19 drops the server DOM on a hydration error,
   and a failed client re-render then leaves `#root` empty — the user is
   stranded on a themed blank page that only a manual refresh fixes. The
   watchdog buffers the first window `error`/`unhandledrejection` messages,
   checks `#root` for rendered text 4s after `load` (15s fallback), and on a
   provably dead root reloads **once** (sessionStorage-guarded, so it can
   never loop), replaying the captured errors as a console warning on the
   next healthy load. `innerText` is the aliveness probe deliberately: it
   ignores `<template>` segments and hidden nodes, so a pending Suspense
   boundary or the ErrorScreen never count as dead. If a fork's entry route
   legitimately renders zero text at rest, relax the check — don't delete it.
   When debugging a user report, ask for the `[blank-screen-recovery]`
   console output: it contains the pre-reload errors that are otherwise lost
   to the refresh. Every dead detection also overwrites
   `localStorage["blank-screen-recovery:last"]` and leaves it there — on a
   phone, where nobody has a console open while it happens, read it later via
   remote Web Inspector (iPhone: Settings → Safari → Advanced → Web
   Inspector, then Mac Safari → Develop → the device → the tab) or evaluate
   `localStorage.getItem("blank-screen-recovery:last")`.

### 9. Deferring expensive work — branch on ROUTE IDENTITY, never on a commit count, `Platform`, or `window`

Sometimes a screen wants to render *less* than the server did, because rendering
all of it at once is what makes a client-side navigation feel broken. The
showcase galleries are the case in this template: `/components` mounts 36 live
component instances (most of `@mrmeg/expo-ui`) and `/blocks` mounts 6 live page
sections. On a direct URL load that's fine — it's server work, and the HTML must
stay gallery-complete. On a client transition it was seconds of synchronous
render with the content pane blank.

The discriminator that is safe to branch a render on is **"did the visitor arrive
on this route, or navigate to it?"** — `client/lib/clientNavigation.ts`:

```ts
// client/lib/clientNavigation.ts — module scope, no store, no state
let initialPathname: string | null = null;   // the pathname this app load started on
let hasNavigated = false;                    // latched once the app moves off it

export function recordPathname(pathname) { /* first write wins; later differing write latches */ }

export function isClientNavigatedScreen(pathname) {
  if (typeof window === "undefined") return false;      // server: always render everything
  if (hasNavigated) return true;                        // been elsewhere; entry HTML is gone
  if (initialPathname === null) return false;           // nothing recorded yet → full
  return pathname !== initialPathname;
}
```

`recordPathname()` is called from `RouteIdentityObserver` in
`client/features/app/RootLayout.tsx` — **in its render body** (idempotent,
first-wins) *and* from an effect keyed on `usePathname()`. The render-body call is
the load-bearing one; the effect only latches the "we have navigated away" half.
It is its own childless component because `usePathname()` subscribes to the route
store, and calling it in `RootLayoutContent` would re-render every provider in
that file (including `ThemeProvider`'s inline `value` object) on every navigation.

| When | `isClientNavigatedScreen(pathname)` | Renders |
|------|-------------------------------------|---------|
| Server render (no `window`) | `false` | everything — complete HTML |
| Client's hydration render of that HTML, **including a late leaf pass** | `false` (pathname == entry) | everything — **matches the server** |
| Screen mounted by a client navigation | `true` (pathname != entry) | free to defer; no server HTML to match |
| Back on the entry route after navigating away | `true` (`hasNavigated` latched) | free to defer; that HTML is long gone |

Native has a `window`, never hydrates, and mounts its first screen before any
navigation, so the first screen renders full and every post-navigation screen
gets the deferral as a straight win.

**Why not "has React committed once?" — the bug this replaced.** The first version
flipped a module flag from a `RootLayout` mount effect and assumed a leaf still
rendering the hydration pass would see `false`. **It doesn't.** React hydrates
selectively: the root layout can commit — running its effects — *before* a leaf
route's own hydration render. Measured on the production build, direct loads of
`/components` and `/blocks` flashed skeletons ~364–462ms after load and threw
React #418 in 3 of 3 trials, because the gallery's `useState` initializer ran
*after* the root's effect had already fired. **Commit ordering between a layout
and its leaves is not a contract.** Route identity is, and it needs no effect to
have run.

Three rules for consuming it:

1. **Read it in a `useState` initializer, never in the render body.** The value
   must be fixed for the life of the mount; a component that re-read it would
   change its own output mid-life, which during hydration is exactly the mismatch
   this exists to avoid. `client/showcase/useProgressivePreviewCount.ts` does
   `const [defer] = useState(() => isClientNavigatedScreen(pathname))`.
2. **Never trust the module state on the server.** A browser gets a fresh module
   scope per page load; a server process is long-lived and serves many requests,
   so `initialPathname` there belongs to whichever request arrived first. Hence
   the unconditional `typeof window === "undefined"` → full render.
3. **Batch with `requestAnimationFrame`, not `requestIdleCallback`** (not on
   native) and not Reanimated (banned here). One batch per frame is what bounds
   each frame's work.

What this is **not**: scroll-window virtualization. `LegendList`/`FlashList` gate
rows behind an `onLayout`-driven flag that never fires on the server, so web SSR
would ship zero rows (PR #30 was declined for exactly this). RNW `FlatList` does
SSR its `initialNumToRender` window, but adopting it in a gallery would drop
every below-fold card from the HTML. Virtualize the **mount schedule**, not the
scroll window.

Pinned by `client/lib/__tests__/clientNavigation.test.ts` (the discriminator
itself, server guard included),
`client/showcase/__tests__/useProgressivePreviewCount.test.ts` (the hook's two
modes) and `client/showcase/__tests__/galleriesProgressive.test.tsx` (the deferred
gallery render — it simulates a navigation by recording an entry pathname that
differs from the one the screens render for). `client/showcase/__tests__/galleries.test.tsx`
records no entry pathname at all, so it keeps exercising the full-mount path —
that suite passing unmodified *is* the arrival-path assertion. Jest suites all
start with the module reset (`test/setup.ts`), because module scope survives
`clearMocks`.

## How to verify an SSR fix — do NOT rely on Jest/tsc alone

Jest mocks `expo-font` and `react-i18next`, and `tsc` doesn't model Metro/SSR,
so **neither catches these**. Always check the **real** server render with the
dev server running:

```bash
curl -s http://localhost:8081/<route> > /tmp/ssr.html

grep -c "@font-face" /tmp/ssr.html                       # fonts present  → > 0
grep -c 'expo-generated-fonts' /tmp/ssr.html              # font <style>   → == 1
grep -c 'class="css-text-146c3p1"></div>' /tmp/ssr.html   # empty icons    → == 0
grep -oc 'someNamespace\.someKey' /tmp/ssr.html           # leaked i18n key → == 0
```

**Class-name naming differs between dev and production builds.** RNW's
`createIdentifier` prefixes the hash with the style-group debug label only when
`NODE_ENV !== "production"`. The Text reset rule is therefore
`css-text-146c3p1` against the dev server (`localhost:8081`, as above) and
`css-146c3p1` in a production build (`bun run build` + `bun run start` on
`localhost:3000`) — same hash, different prefix. Use `css-\(text-\)\?146c3p1`
if you want one grep that works on both. (The `app/+html.tsx:149` comment names
the dev form for the same reason.)

For §7 (missing style rules), diff the classes the body *uses* against the
rules the document *defines* — zero classes should be undefined:

```bash
python3 - <<'EOF'
import re
html = open('/tmp/ssr.html').read()
defined = set(re.findall(r'\.((?:r-|css-)[\w-]+)\s*[{,]', html))
body = html[html.find('<body'):]
used = {c for m in re.findall(r'class="([^"]*)"', body)
        for c in m.split() if c.startswith(('r-', 'css-'))}
print("undefined classes:", sorted(used - defined) or "none ✅")
EOF
```

In production (`bun run build` + `bun run start`), check the **first** request
after server boot — the cold-start render is the one that regresses.

For §7a (cascade order), confirm the adoption anchor is present exactly once,
empty, and positioned after the flush but before the first script:

```bash
python3 - <<'EOF'
html = open('/tmp/ssr.html').read()
anchor = html.find('<style id="react-native-stylesheet">')
flush  = html.find('data-precedence="rnw-ssr"')
print("anchor count:", html.count('id="react-native-stylesheet"'), "(want 1)")
print("anchor empty:", '<style id="react-native-stylesheet"></style>' in html)
print("anchor after flush:", anchor > flush > -1)
print("anchor before scripts:", -1 < anchor < html.find('<script'))
EOF
```

Then open the route in a browser with the console open and confirm **zero**
hydration warnings. Reproduce **both** a cold reload **and** navigation from
another page — warm font/i18n caches change which side renders "loaded", so a
bug can hide on one path and appear on the other.

Cascade regressions need a **computed-style** check, which no `curl` can do:
in DevTools confirm a client-only atomic still applies: on `/form-demo`, find
the single-class `padding-top: 32px` rule in `style#react-native-stylesheet`
(atomic hashes are build-dependent — locate the rule by its declaration, not a
hardcoded class name) and confirm its element computes `32px`, not `0px`; Button
padding is unchanged, and the pre-hydration frame on `/showcase` is still styled
(throttle the network and watch the first paint).

**Gotcha — the onboarding gate masks `(main)` routes for cookie-less requests.**
A bare `curl /settings` looks like a brand-new visitor, so the server renders
`OnboardingGate` in place of the whole Stack and you get onboarding markup, not
the settings screen — *neither* translated strings nor leaked keys, which reads
as a false pass. Since §6, you no longer have to patch the source to get past
it: send the cookie.

```bash
curl -s -H 'Cookie: has-seen-onboarding=1' localhost:3000/settings > /tmp/ssr.html
```

That returns the real `(main)` markup — confirm translated strings appear (e.g.
`Appearance`, `Language`) with no raw `settings.` keys. (Before the cookie
existed, the §3 i18n fix was verified by temporarily short-circuiting the gate
with `{true || hasSeenOnboarding ? …}` and restarting the server.)

### `(main)`-route SSR must return real markup, not a blank 200

Every `(main)` route server-renders the Radix Tabs tree. `MainLayout` sets
`initialRouteName: "(tabs)"`, and `app/(main)/(tabs)/_layout.tsx` renders
`NativeTabs`, whose web implementation
(`expo-router/build/native-tabs/NativeTabsView.web.js`) is built on
`@radix-ui/react-tabs`. So the tabs subtree renders during SSR of *every*
`(main)` route, `(demos)/*` included.

**A throw in that subtree does not produce a 500.**
`@expo/router-server`'s `renderStreamingContent.js` handles the stream's
`onError` with nothing but `console.error("SSR streaming render error:", …)`, so
the response stays a **200** with a blank or truncated body. Status codes and
`wc -c` both look fine — the shell, `<head>`, and hydration scripts always
render — so check for **route-specific text** and watch the server's stdout:

```bash
# Server on a port you own (PORT=3000 by default).
bun run build && PORT=3000 bun run start

for route in "" screen-faq settings profile media; do
  body=$(curl -s -H 'Cookie: has-seen-onboarding=1' "localhost:3000/$route")
  printf '%-12s bytes=%s\n' "/${route}" "$(printf '%s' "$body" | wc -c)"
done
```

Then grep each response for a string only that route renders — e.g.
`Component Library` (`/`), `Is there a free plan` (`/screen-faq`),
`Appearance` (`/settings`), `Edit Profile` (`/profile`), `Total Size`
(`/media`) — and confirm the server log shows **zero**
`SSR streaming render error:` lines.

Run the sweep **twice**, and once more against a freshly restarted server with
the route under test as the *first* request: per §7 the server-side RNW
stylesheet is a module singleton, so some SSR faults are cold-start-only.

Note `/screen-faq` streams its screen inside a Suspense boundary (a trailing
`$RC("B:2","S:2")` in the HTML). Its own content arrives after the tabs shell,
which is why grepping for FAQ text — not just body length — is the real check.

**Duplicate Radix modules are the mechanism to suspect** if this ever does go
blank: two copies of a Radix context/collection package means a consumer reads
the other copy's empty context. As of this writing the `(main)` routes render
clean — the blank body does not reproduce on a healthy install.

### The galleries must SSR complete, skeleton-free — §9's regression check

§9 lets the galleries defer previews on a screen the visitor *navigated to*. The
failure mode if that gate is ever loosened into a plain `Platform`/`typeof window`
check is silent: the SSR HTML ships skeletons, and the page reads as a broken
gallery to anything without JS (crawlers included). One command distinguishes
them — `grep -c` for both testIDs on a direct load:

```bash
bun run build && PORT=3000 bun run start
curl -s -H 'Cookie: has-seen-onboarding=1' localhost:3000/components > /tmp/gallery.html

grep -o 'component-card-[A-Za-z]*"' /tmp/gallery.html | sort -u | wc -l  # == COMPONENTS.length
grep -c 'component-card-skeleton-' /tmp/gallery.html                     # == 0
```

The counts must be "every registered component, zero skeletons". Same shape for
`/blocks` (`block-card-` present, `block-card-skeleton-` absent).

**Correct HTML is only half the check.** The regression §9's route-identity
rewrite fixed was invisible to both curl and Jest: the HTML was perfect, but the
*client's* hydration render of the leaf deferred anyway, so skeletons flashed in
~400ms after load and the console threw React #418. So on a **direct load** of
`/components` and `/blocks`, watch the browser: no skeleton must ever appear, and
the console must stay clean. Then check the *client transition* (navigate in from
the rail or a link): card chrome should paint promptly, previews fill in over the
next few frames, and the pane is never blank.

### Duplicate `react-slot` breaks `asChild` — `React.Children.only`

A *browser* pass on `/showcase` did catch a real crash from that same family:
clicking the AlertDialog trigger ("Delete Account") threw

```
Error: React.Children.only expected to receive a single React element child.
```

and tripped the error boundary. The plain `Dialog` demo on the same page was
fine, which is the tell — the fault is per-component, not global.

Why: `react-slot`'s `isSlottable(child)` tests
`child.type.__radixId === SLOTTABLE_IDENTIFIER`, and that identifier is
`Symbol("radix.slottable")` — **not** `Symbol.for(...)`. It is therefore unique
per *physical copy* of the package. `AlertDialogContent` built its `Slottable`
from its own nested copy while the matching `Slot` came through
`react-primitive`'s copy, so `isSlottable` returned false, the real child fell
through to `SlotClone` alongside a sibling, and
`React.Children.count(children) > 1` hit `React.Children.only(null)`.

Fixed with `package.json` `overrides`:

```json
"@radix-ui/react-slot": "1.2.4",
"@radix-ui/react-primitive": "2.1.4"
```

(the higher of each pair — both splits were one patch apart). Use `overrides`,
not Metro's `dedupePackages` (`metro.config.js`): that rewrites only the
**Metro** bundle, while SSR runs the exported server bundle, so `overrides` is
the lever that reaches both. Confirm with one copy each on disk:

```bash
find node_modules -path '*@radix-ui/react-slot/package.json' | wc -l       # → 1
find node_modules -path '*@radix-ui/react-primitive/package.json' | wc -l  # → 1
```

`__tests__/radixSingleton.guardrail.test.ts` pins the lockfile against this
drift, so a re-split fails CI instead of a demo.

### `<Link asChild>` children must take a flattened style object

Same `Slot`, different failure. A browser pass found every showcase gallery dead
on web — the route unmounted to the error boundary on hydration with

```
TypeError: Failed to set an indexed property [0] on 'CSSStyleDeclaration'
```

Why: `<Link asChild>` renders through `expo-router`'s `Slot` (Radix's, under a
shim), and Radix's `mergeProps` has exactly one rule for `style`:

```js
overrideProps.style = { ...slotPropValue, ...childPropValue };
```

Spreading an **array** index-keys it, so `style={[styles.card, cond ? {…} : null]}`
becomes `{ 0: {…}, 1: null }`. The SSR HTML serializes that as
`style="0:[object Object];1:[object Object]"`, and hydration throws when RNW
tries to assign key `"0"` on a `CSSStyleDeclaration`. When it doesn't throw it
just loses the paint — a `backgroundColor` sitting in entry `0` never lands,
which is how a primary CTA rendered with no fill. A function-form style is the
same trap from the other side: spreading a function yields `{}`.

`expo-router`'s Slot shim flattens *its own* `style` and dev-throws for an
array-styled child, but nothing flattens the child for you. Every `Link asChild`
child in this template goes through
`client/features/navigation/linkPressableStyle.ts`, which returns one flat object
(and appends the web pointer cursor):

```tsx
<Link href={href} asChild>
  <Pressable style={linkPressableStyle(styles.card, { flexBasis: "47%" })}>
</Link>
```

Note this is invisible to a route test whose `expo-router` mock stubs `Link` as a
string element — the pre-fix galleries passed 46/46 while every one was broken in
a browser. `client/showcase/__tests__/galleries.test.tsx` mocks `Link` with the
**real** `Slot` and records each `asChild` child's raw `style`, so a new `[...]`
literal fails regardless of where it renders.

## Guardrail

`__tests__/ssrHydration.guardrail.test.ts` holds source/behavior assertions so a
fork can't silently drop these:

- `app/+html.tsx` contains `useServerDocumentContext`, `headNodes`, `bodyNodes`.
- `app/_layout.tsx` calls `ensureI18nInitialized()` in the render body **before**
  the first `useEffect` (not only in an effect).
- Importing `@/client/features/i18n` leaves i18next initialized synchronously and
  `i18n.t("common.ok")` resolves to `"OK"` (not the raw key) — the exact
  condition the server's first render needs.

These are cheap backstops, not a substitute for the real-server `curl` check
above (Jest mocks `react-i18next`, so it can't model the SSR render on its own).

`__tests__/radixSingleton.guardrail.test.ts` covers the `(main)`-route Radix
dependency graph in the same spirit: the packages the SSR Tabs tree renders
through (`react-tabs`, `react-direction`, `react-context`,
`react-roving-focus`, `react-collection`, `react-presence`, `react-id`) must
each resolve to exactly one version in `bun.lock`, `react-slot` and
`react-primitive` must stay unified at the versions the `overrides` pin, and
`package.json` must still declare those overrides.

`__tests__/ssrWarmup.guardrail.test.ts` pins §8's wiring: the boot warm-up
covers the cookied tree and drains bodies, the HTML path awaits it while
`/api/*` does not, and `app/+html.tsx` still renders the watchdog script in
`<head>`. `__tests__/blankRecovery.test.ts` drives the watchdog script itself
in a sandbox: reload-once on a dead root, loop-guard, error replay.

§9's suites live with the code they cover rather than in `__tests__/`:
`client/lib/__tests__/clientNavigation.test.ts` pins the discriminator itself
(entry route vs navigated-to, the `hasNavigated` latch, and the server guard),
`client/showcase/__tests__/useProgressivePreviewCount.test.ts` pins the hook's two
modes (full-immediate on the route the visitor arrived on, per-frame batches after
a navigation, with unmount cancellation), and
`client/showcase/__tests__/galleriesProgressive.test.tsx` pins the rendered result
on both paths. None of them replaces the curl above — Jest can't tell you what the
server actually serialized — and none replaces a browser: the #418 regression that
motivated the route-identity rewrite had correct HTML and green Jest suites, and
was only visible as a skeleton flash on a real direct load.

`__tests__/ssrStyleCascade.test.tsx` renders `app/+html.tsx` with a mocked
server-document context and pins §7a: exactly one
`<style id="react-native-stylesheet">`, empty, after the hoisted flush and
before the first `<script>`; the flush still carries `href`/`precedence`; and its
`.css-*` base resets are still present.
`__tests__/rnwSheetAdoption.test.ts` pins the two react-native-web dist
behaviors that adoption depends on (id lookup reuses an existing element;
group-marker hydration throws on a pre-populated sheet), so an RNW upgrade that
changes either fails CI instead of silently zeroing padding. Neither test can
model the cascade itself — jsdom doesn't resolve cross-stylesheet ties the way
browsers do, so the computed-style check above stays manual.
