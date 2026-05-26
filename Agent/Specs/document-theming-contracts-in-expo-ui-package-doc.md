# Spec: Document Theming Contracts In Expo UI Package Doc

**Status:** Blocked
**Priority:** Medium
**Type:** Docs Drift
**Area:** packages/ui, docs
**Blocked By:** `fix-web-theme-first-paint-race.md` must reach Ready (and ideally Merged) so the SSR/cookie subsection describes the shipped design, not a planned design that may shift during the Phase 0 spike.

---

## What

Extend `Agent/Docs/EXPO_UI_PACKAGE.md` (and the published mirrors `packages/ui/README.md`, `packages/ui/llms.txt`, `packages/ui/llms-full.md`, `packages/ui/LLM_USAGE.md`) with the four theming contracts that exist in code today but are not documented:

1. The web SSR / first-paint contract: `+html.tsx` inline script, `theme-loading` shield, `data-theme` attribute, `localStorage` and (after the first-paint-race spec lands) cookie persistence.
2. The store-default-light SSR tradeoff and how the cookie/middleware bridge resolves it (links to `draft-fix-web-theme-first-paint-race.md`).
3. The native splash and adaptive-icon dark-variant requirements (links to `draft-add-dark-splash-and-themed-app-icon.md`).
4. The "every `theme.colors.primary` (or `theme.colors.foreground`) background must pair with its inverting foreground token" rule, with a worked example and a list of allow-listed exceptions (intentional dark-modal contexts).

## Why

Investigation `Agent/Investigations/20260526-dark-mode-color-issues.md` found three classes of dark-mode bug in the template: a web first-paint race, two icon-on-primary contrast bugs, and a missing native splash dark variant. The package documentation at `Agent/Docs/EXPO_UI_PACKAGE.md` (and its `packages/ui/README.md` mirror, which ships to npm) describes the theming API exhaustively but says nothing about the SSR/hydration contract, the splash requirement, or the inverting-foreground rule. Future apps cloning this template will repeat the same bugs because the contracts live only in the +html.tsx inline script and a couple of comments.

The published-on-npm mirrors matter because consumer agents in other repos load `node_modules/@mrmeg/expo-ui/llms.txt` to discover how to use the package. Without these contracts in there, every new template adopter finds out about them by shipping the bug.

## Current State

`Agent/Docs/EXPO_UI_PACKAGE.md` (695 lines) covers:

- Public imports and export map.
- App startup and `useResources()`.
- `useTheme()` API surface and helpers (lines 145-247).
- `useStyles()` factory (lines 201-215).
- Token list (lines 224-247).
- Typography, components, fonts, package gates, etc.

Verified absent (`grep -ni "ssr|hydrat|server-render|systemTheme|+html|data-theme|theme-loading|cookie|splash|primaryForeground" Agent/Docs/EXPO_UI_PACKAGE.md`):

- No SSR section. The single hydration mention is one bullet about `useResources()` injecting a Lato stylesheet.
- No mention of the `+html.tsx` inline script or the `theme-loading` shield.
- No mention of `dataset.theme` / the DOM-mirror `useEffect` in `useTheme.ts`.
- No mention of cookie persistence (granted, this lands with the first-paint spec, but the doc must update with that spec).
- No splash-screen guidance beyond the `useResources` font note.
- No worked example of the `primary` ↔ `primaryForeground` pairing rule. The token list shows the names but not the inversion property.

`packages/ui/README.md`, `packages/ui/LLM_USAGE.md`, `packages/ui/llms.txt`, `packages/ui/llms-full.md` mirror selected sections of the workspace doc to npm. Same gaps.

## Changes

### 1. Add an "SSR and First Paint (Web)" section to `Agent/Docs/EXPO_UI_PACKAGE.md`

Insert after the existing "App Startup" section. Covers:

- The store always renders light during SSR today; the new cookie + middleware bridge (from `draft-fix-web-theme-first-paint-race.md`) makes SSR ship the right scheme when a cookie or `Sec-CH-Prefers-Color-Scheme` header is present.
- The `+html.tsx` inline `<script>` is the no-cookie failsafe: it reads `localStorage["user-theme-preference"]` and `prefers-color-scheme`, sets `data-theme` on `<html>`, and adds `theme-loading` for dark visitors so `#root { visibility: hidden }` until React hydrates and the store reports synced.
- `useTheme()` mirrors the active scheme to `document.documentElement.dataset.theme` and `style.colorScheme`, but only after the store reports hydrated (so the inline script's dark value is not overridden).
- The 500 ms inline-script `setTimeout` is a last-resort failsafe for visitors whose JS chunk fails to hydrate; under normal hydration the React side removes the shield.
- Consumer apps **must** call `syncThemeFromEnvironment()` in a top-level `useEffect`. Without it, the store never marks itself hydrated and the shield stays up.

Provide a copy-paste `app/_layout.tsx` skeleton showing the correct ordering: `useResources()`, `useTheme()`, `syncThemeFromEnvironment()` effect, theme-loading-shield removal effect, splash hide.

### 2. Add a "Native Splash and Adaptive Icon" section

Insert near the existing "App Startup" section. Covers:

- `expo-splash-screen` plugin must declare a `dark` block or every dark-mode visitor sees a white flash on cold launch.
- Android `adaptiveIcon` should declare `monochromeImage` for Android 13+ themed icons.
- Recommended dark splash background is `colors.dark.colors.background` so the splash → first frame transition does not visually flicker.
- Link to `draft-add-dark-splash-and-themed-app-icon.md` for the full asset spec.

Show the corrected `app.config.ts` plugin entry as a code block.

### 3. Add a "Token Pairing Rule" subsection inside "Theme Tokens"

After the token list at line 224-247, add the inverting-pair contract:

> Some tokens come in inverting pairs. The "background" half of the pair is dark in light mode and light in dark mode; the "foreground" half is the opposite. Any place that uses the background half as a `backgroundColor` MUST pair it with the matching foreground token, never with `palette.white`, `"#fff"`, or `theme.colors.text`.

List the seven pairs (`background`/`foreground`, `card`/`cardForeground`, `popover`/`popoverForeground`, `primary`/`primaryForeground`, `secondary`/`secondaryForeground`, `accent`/`accentForeground`, `destructive`/`destructiveForeground`, plus `muted` ↔ `mutedForeground`) and a Do/Don't example using `theme.colors.primary`:

```tsx
// Don't — invisible icon in dark mode
<View style={{ backgroundColor: theme.colors.primary }}>
  <Icon name="play" color="white" />
</View>

// Do — adapts in both schemes
<View style={{ backgroundColor: theme.colors.primary }}>
  <Icon name="play" color={theme.colors.primaryForeground} />
</View>
```

Note the allow-listed exceptions: there are no current allow-list cases for the `primary`/`foreground` background + hardcoded white pattern. `client/features/media/components/VideoPlayer.tsx` and `client/features/media/components/ImagePreview.tsx` use `backgroundColor: "black"` (literal) with `color="white"` for fullscreen-dark video/image modals — that pattern is intentional and is *not* what the lint rule documented in `fix-dark-mode-icon-on-primary-bg.md` targets. The doc should describe the rule as "any `theme.colors.primary` or `theme.colors.foreground` (without a transparency wrapper) bg paired with a hardcoded white/black foreground" so future readers don't expect an allow-list that doesn't exist.

### 4. Add a "Theme Cookie and Privacy" subsection

After the SSR section (Change 1). Covers:

- The cookie name is `user-theme-preference`, value `"light" | "dark" | "system"`.
- It is `SameSite=Lax`, `Path=/`, `Max-Age=31536000`. `Secure` when served over HTTPS.
- It is a strictly necessary user-preference cookie. Document this so consumer apps that show consent banners do not block it.
- The cookie is mirrored from `localStorage`, so legacy visitors are not stranded after the first-paint spec lands.

### 5. Mirror the new sections to the published files

Update:

- `packages/ui/README.md` — copy SSR, splash, and token-pairing sections verbatim or with light edits to keep consumer-facing wording cleaner.
- `packages/ui/LLM_USAGE.md` — add a short "Theming gotchas" section linking to the workspace doc and listing the three contracts.
- `packages/ui/llms.txt` and `packages/ui/llms-full.md` — add the same gotchas in machine-readable form so coding agents in consumer repos discover them when grepping `node_modules/@mrmeg/expo-ui`.

These four files are hand-maintained — no generator script exists today (only `scripts/check-media-package-consumer.mjs` validates presence of the file names, not content). List all four files in the PR body so the reviewer can cross-check that the workspace doc and mirrors did not drift.

### 6. Cross-link from the investigation and other specs

- `Agent/Investigations/20260526-dark-mode-color-issues.md` — when this spec lands and the investigation is removed per playbook lifecycle, ensure the durable knowledge it carried has all moved into `Agent/Docs/EXPO_UI_PACKAGE.md`.
- `draft-fix-web-theme-first-paint-race.md` and `draft-add-dark-splash-and-themed-app-icon.md` — point to the relevant sections in `EXPO_UI_PACKAGE.md` so future readers find the doc first.

## Acceptance Criteria

1. `Agent/Docs/EXPO_UI_PACKAGE.md` contains the four new sections (SSR & First Paint, Native Splash and Adaptive Icon, Token Pairing Rule, Theme Cookie and Privacy) with the correct cross-links to the related specs.
2. `packages/ui/README.md`, `packages/ui/LLM_USAGE.md`, `packages/ui/llms.txt`, and `packages/ui/llms-full.md` carry the same contracts (mirrored, not hand-rewritten beyond consumer-facing wording).
3. The Token Pairing Rule lists every inverting pair from `packages/ui/src/constants/colors.ts` and shows a worked Do/Don't example.
4. The SSR section explicitly tells consumers they must call `syncThemeFromEnvironment()` from a top-level `useEffect` and includes a paste-ready `app/_layout.tsx` skeleton.
5. The Native Splash section shows the corrected `app.config.ts` plugin entry with a `dark` block and a `monochromeImage`.
6. The investigation artifact (`Agent/Investigations/20260526-dark-mode-color-issues.md`) is removed per the playbook's lifecycle rule once this spec and the three related specs have either landed or moved past Draft (their evidence has been copied into spec bodies and into the doc).

## Constraints

- Do not duplicate API reference content. The existing `useTheme()` table at `Agent/Docs/EXPO_UI_PACKAGE.md:188-200` stays where it is; the new sections cross-reference it.
- Do not paste implementation code into the doc. Reference file paths and let the source code stay authoritative.
- Keep the published `llms.txt` machine-readable: short bullets, no narrative paragraphs.
- Do not let `packages/ui/README.md` drift to be a superset of the workspace doc. Workspace doc is authoritative; README is a friendly subset.
- The doc must accurately reflect the post-`draft-fix-web-theme-first-paint-race.md` state. If that spec is still in Draft when this one is implemented, this spec lands with TODO markers pointing to the open spec, not stale claims.

## Out of Scope

- Adding a high-contrast theme variant or accessibility-driven theme override (separate spec).
- Documenting `useResources()` or `i18n` configuration changes (already covered in their existing sections).
- Updating `Agent/Docs/DESIGN.md` or `Agent/Docs/USER_FLOWS.md` — they may benefit from accessibility notes around dark mode contrast, but that is owned by the Designer and Human-Advocate personas respectively.

## Files Likely Affected

Workspace docs:

- `Agent/Docs/EXPO_UI_PACKAGE.md`

Published mirrors:

- `packages/ui/README.md`
- `packages/ui/LLM_USAGE.md`
- `packages/ui/llms.txt`
- `packages/ui/llms-full.md`

Cross-references (light edits only):

- `Agent/Specs/fix-web-theme-first-paint-race.md`
- `Agent/Specs/fix-dark-mode-icon-on-primary-bg.md`
- `Agent/Specs/add-dark-splash-and-themed-app-icon.md`

Cleanup (when all four specs have landed or moved):

- Remove `Agent/Investigations/20260526-dark-mode-color-issues.md` per `Playbooks/CONSTITUTION.md:46`.

## Edge Cases

- The first-paint-race spec changes its design between Draft and Ready (e.g., picks the simpler "block render until store syncs" path instead of cookie-driven SSR). This doc spec must be re-checked at that point so the cookie section either drops or stays.
- A consumer app does not use `+middleware.ts` or `app/+html.tsx` (they ejected). Doc should note that those files are required for the SSR theming contract to work.
- The published `llms.txt` is fetched by external coding agents; keep it stable and concise. Adding paragraphs of prose here defeats the purpose.
- The package version in `packages/ui/package.json` should bump alongside the doc mirror change because consumer agents will look for the new content. This is a docs-only minor bump per the existing release flow; flag in the PR body.

## Risks

- **Doc drift between workspace and mirror.** If the implementer edits the workspace doc but forgets `packages/ui/README.md` or vice versa, the next published version misleads consumer agents. The list-all-four-files-in-PR-body habit is the only enforcement; do not invent a generator script as part of this spec.
- **Spec ordering.** This doc spec is blocked on `fix-web-theme-first-paint-race.md` reaching Ready (and ideally Merged) so the SSR/cookie subsection describes the shipped design. The Phase 0 spike of that spec may also alter the design — this spec absorbs whatever the spike concludes. Do not promote this spec to Ready until that one is unambiguous.
- **Missing the investigation cleanup.** The playbook says investigation artifacts are removed once their evidence is in specs and no finding still depends on them. The implementer must check whether the P3 "Needs decision" findings (`providerLetter`, `screen-list` offline dot, `DetailHeroScreen` back button) still depend on the investigation; if so, the investigation file stays until those decisions are made.
- **SDK version drift in source docs.** `Agent/AGENTS.md:47` claims SDK 55 but `package.json` declares `"expo": "~56.0.5"`. Fix that in the AGENTS.md as part of this spec or as a separate sub-edit; otherwise the doc updates will inherit the same wrong version reference.
