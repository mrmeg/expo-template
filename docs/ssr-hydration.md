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

### 2. Fonts — load via an SSR-aware path, not a bare effect

Fonts must be registered **during render** so expo-font's `serverContext` is
populated server-side and the `@font-face` ships in the HTML. This template
loads fonts through `@mrmeg/expo-ui`'s `useResources`, which does an eager,
module-scope `Font.loadAsync(Feather.font)` (plus a hook-level load) — so icon
fonts register during SSR and the effect becomes a no-op once loaded.

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
`settings.tsx`) live inside `(main)`, and the onboarding gate replaces the whole
Stack during SSR (the persisted `hasSeenOnboarding` flag reads false on the
server), so the bundled routes mask it — but it bites the moment any
SSR-reachable route calls `t()`.

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

### 4. Viewport-dependent layout — seed width from SSR context

Branching layout on `useWindowDimensions().width` (`isCompact = width < 760`,
etc.) diverges the server (width 0 → "compact") from the client (real width).
This can shift **sibling order** (e.g. a skipped `{!isCompact && <Nav/>}`
block), not just styles — a structural mismatch.

This template handles it with `client/components/SsrViewportProvider.tsx`
(seeded from `@mrmeg/expo-ui/state`'s SSR viewport context, set at the root) +
`useDimensions()`. Use `useDimensions()` for responsive width, **not** raw
`useWindowDimensions()`, in anything that renders on web.

### 5. Theme / `typeof window` branches — resolve to a fixed first-render default

`app/+html.tsx` ships a blocking `themeScript` that sets `data-theme` on `<html>`
before hydration and hides `#root` for dark-mode visitors (the `theme-loading`
class) to mask the flash. The CSS uses `html[data-theme=…]` selectors so the
body background is correct on first paint. Any component that reads theme/window
for render output should resolve to a stable default on the first render (gate
on a `useHydrated()`-style flag) and switch after mount.

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

Then open the route in a browser with the console open and confirm **zero**
hydration warnings. Reproduce **both** a cold reload **and** navigation from
another page — warm font/i18n caches change which side renders "loaded", so a
bug can hide on one path and appear on the other.

**Gotcha — the onboarding gate masks `(main)` routes on the server.** During SSR
the persisted `hasSeenOnboarding` flag is false, so `app/_layout.tsx` renders
`OnboardingGate` in place of the whole Stack. A `curl /settings` therefore
returns the onboarding markup, not the settings screen — so it shows *neither*
translated strings nor leaked keys, which can read as a false pass. To prove the
i18n fix against a real `(main)` screen, temporarily short-circuit the gate
(`{true || hasSeenOnboarding ? …}`), restart the dev server (CI mode disables
reloads), curl, confirm translated strings appear (e.g. `Appearance`,
`Language`) with no raw `settings.` keys, then revert. This is exactly how the
§3 fix was verified.

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
