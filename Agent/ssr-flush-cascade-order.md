---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Stop the SSR style flush from out-cascading the client stylesheet

## Goal
Defensive fix: the SSR-flushed stylesheet currently sits *after* react-native-web's client sheet in the head, so at equal (single-class) specificity its base reset `.css-g5y9jx { padding: 0px; margin: 0px; … }` defeats any atomic padding/margin rule that exists only in the client sheet. Today the only confirmed victim is an invisible 0×0 node, but the failure mode will silently zero real padding the moment a late-inserted rule doesn't get re-flushed. Make the flush lose to (or be adopted as) the client sheet.

## Context
Verified 2026-08-06 with live browser probes (production mode):

- `client/features/app/SsrStyleFlush.tsx:36` emits `<style href="rnw-ssr-flush" precedence="rnw-ssr">`; React 19 hoists it to head index ~3. RNW's client sheet is created with `head.insertBefore(element, head.firstChild)` → index 0 (`react-native-web/dist/exports/StyleSheet/dom/createCSSStyleSheet.js`). Later sheet wins ties.
- Confirmed defeat: `.r-fd4yh7 { padding-top: 32px }` exists only in the client sheet; its element computes `padding-top: 0px` — the flush's `.css-g5y9jx` reset wins on document order. Most late rules self-heal because the flush re-flushes client-side (observed 500→516 rules), but this one never did.
- Button padding is currently immune (`.r-3o4zer`/`.r-cnw61z` exist in both sheets) — this spec is prevention, not the fix for the user's padding report (which was diagnosed as not-a-bug).
- Related moving part: `app/+html.tsx:144-161` already strips the framework's own `<style id="react-native-stylesheet">` snapshot from `headNodes` for the mirror-image reason. Any ordering change must be made coherently with that filter.

## Work
Pick one (implementer's judgment; both verified viable in principle):

- **Option A — adoption (preferred if it works):** emit the flushed CSS as `<style id="react-native-stylesheet">` instead of the `href`/`precedence` pair. RNW's `createCSSStyleSheet` returns the existing element when `getElementById(id)` hits, so the client *adopts* the flushed sheet instead of creating a competing one — no duplicate sheets, no ordering question. Requires updating the `+html.tsx:144-161` filter (it currently strips exactly that id) so the flush replaces, not duplicates, the framework snapshot. Verify RNW's rule-insertion (grouped/marker-based) tolerates adopting a sheet that already contains flushed rules; if it corrupts grouping, fall back to Option B.
- **Option B — subtraction:** keep the current node but strip the base reset rules (`.css-*` selectors) from the flushed text in `SsrStyleFlush.tsx` — the client sheet always carries them, so the flush then only ever *adds* atomics and can no longer zero anything. Pre-hydration paint still gets the resets from the framework snapshot/client sheet; confirm the pre-hydration frame still renders correctly with resets absent from the flush.

Tests: unit-test the flush output (Option B: no `.css-` reset selectors present; Option A: correct element id and that the `+html.tsx` filter no longer produces a duplicate). Add/extend an SSR test asserting a style defined only post-flush still computes (or at minimum that the flush contains no `padding: 0px` base rule).

## Validation
- `bun run typecheck && bun run lint && bun run test:ci`
- Browser, production mode: on `/form-demo`, the element carrying `.r-fd4yh7` must compute `padding-top: 32px`; spot-check Button computed padding unchanged (12px/4px); no visual regression on first paint of `/showcase` (the flush's whole purpose — styled pre-hydration frame — must survive).

## Out of scope
- Theme flash and viewport width-0 (separate specs).
- Changing which styles the app registers (this is ordering/content of the flush only).

## Open questions
- None blocking; Option A vs B per the fallback rule above.
