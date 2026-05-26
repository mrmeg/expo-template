# Day Shift Report — 2026-05-26

## Completed

### Fix Dark-Mode Icon On Primary Background
**Spec:** `Agent/Specs/fix-dark-mode-icon-on-primary-bg.md` (status flipped to `Merged`)
**Commits:**
- `a040515` — `chore: Bump Expo SDK and extract contrast utils` (committed by Matt directly while shift was in flight; contains the implementation)
- `d937f1b` — `docs(agent): handoff for fix-dark-mode-icon-on-primary-bg` (this shift; spec/verification/CHANGELOG/router handoff)

**Draft PR:** Not opened. Matt direct-committed the implementation to `dev` and merged to `main` (`a040515`) at 13:06 EDT while the shift was in progress; the change is already live. The shift's role for this task became (a) finishing pending metadata work and (b) preserving the spec/verification artifacts on `dev`.

**What changed:**
1. **Two visible bugs fixed.** `app/(main)/(tabs)/media.tsx:741` (play overlay icon) and `app/(main)/(tabs)/profile.tsx:184` (avatar fallback icon) both hard-coded `color="white"` / `color={palette.white}` on a `theme.colors.primary` background. In dark mode `primary` resolves to near-white, so the icons disappeared. Both now use `theme.colors.primaryForeground`.
2. **`providerLetter` default removed.** `app/(main)/(tabs)/profile.tsx:596-600` no longer defaults to `palette.white`. Both Connected-Account call sites now pass an explicit color so a future provider can't silently regress.
3. **Contrast helpers extracted.** `parseColor`, `hexToRgb`, `calculateLuminance`, `calculateContrastRatio`, `getBetterContrast`, `getTextColorForBackground`, `withAlpha`, and a new top-level `getContrastRatio` moved from `packages/ui/src/hooks/useTheme.ts` into `packages/ui/src/lib/contrast.ts`. Re-exported from `@mrmeg/expo-ui/lib`. The hook surface (`getContrastingColor`, `getContrastRatio`, `withAlpha`, `getTextColorForBackground`) is unchanged for consumers.
4. **Contrast invariant test.** `packages/ui/src/constants/__tests__/colors.test.ts` asserts WCAG ≥ 4.5:1 on text-on-surface pairs and ≥ 3:1 on UI-component pairs. 10 strict assertions pass; 3 pre-existing palette-debt pairs are tracked as `it.todo` (see Issues Discovered).
5. **Lint guard.** `scripts/check-primary-fg.mjs` (invoked via `bun run lint:theme`) walks `app/`, `client/`, and `packages/ui/src/components/` via `@typescript-eslint/parser` and exits non-zero if any descendant `color="white"` (or `palette.white`/`palette.black` etc.) sits inside a JSX element backed by `backgroundColor: theme.colors.primary` or `theme.colors.foreground` (including `styles.X` references). Translucent variants (`withAlpha(...)`, `theme.colors.primary + "20"`) are explicitly ignored.

**Validation evidence:**

| Command | Exit | Result |
|---|---|---|
| `bun run --cwd packages/ui test` | 0 | 24 suites, 166 passed, 3 todo, 0 failed (was 23/156/0 — added the contrast suite) |
| `bun run --cwd packages/ui typecheck` | 0 | clean |
| `bun run typecheck` | 0 | clean |
| `bun run lint:theme` | 0 | `lint:theme: 0 issues` |
| `bun run lint` | 0 | 0 errors, 16 warnings (baseline unchanged) |
| Stash round-trip RED-test of the lint script | 0 | Reverted both fixes; script reported 2 hits at `media.tsx:741` and `profile.tsx:184` with the expected message; restored. |

**How to verify:** See `Agent/Testing/fix-dark-mode-icon-on-primary-bg.md` (run via `/verify-ui` or walk manually).
**Summary of what to check:** Open Media tab + Profile tab in dark mode; play overlay and avatar icons must be visible in both schemes. Run `bun run lint:theme` against a synthetic regression (Scenario 4 step 3) to confirm the guard fires.

---

## In Progress

None.

## Blocked

### `fix-web-theme-first-paint-race`
**Reason:** Phase 0 spike must validate the SSR-theme bridge approach (`expo-server` `LoaderFunction` + per-request React context, NOT middleware-AsyncLocalStorage — the latter is impossible in `expo-server@56.0.4` because `MiddlewareFunction` has no `next()` callback).
**What's needed:** Run the spike per Phase 0 in the spec; if it succeeds, flip status to Ready.

### `add-dark-splash-and-themed-app-icon`
**Reason:** Designer-supplied dark-variant splash image and Android monochrome adaptive-icon foreground.
**What's needed:** `assets/images/splash-icon-dark.png` and `assets/images/adaptive-icon-monochrome.png` per the Asset Requirements section in the spec.

### `document-theming-contracts-in-expo-ui-package-doc`
**Reason:** Cookie/middleware-bridge subsection content depends on what `fix-web-theme-first-paint-race` ships post-spike.
**What's needed:** First-paint-race spec reaches Ready with finalized design.

### `publish-expo-media-0-1-1`
**Reason:** Pre-existing block on npm trusted-publish or `NPM_TOKEN` (unchanged from prior shift).

## Issues Discovered

- **Pre-existing pending changes to `package.json` and `bun.lock`** (Expo SDK preview→stable bump and friends) were swept up into Matt's `a040515` commit alongside this shift's contrast work. The shift never staged or committed those files itself; they rode along when Matt committed everything in the working tree. The commit message explicitly says "Bump Expo SDK and extract contrast utils" so this is not a surprise, but flagging it for traceability.
- **Three palette-level contrast issues are tracked as `it.todo`** in the new `colors.test.ts`:
  - `light.muted` (#F4F4F5) ↔ `light.mutedForeground` (#71717A) ratio = **4.07:1** vs target 4.5
  - `light.accent` (#14b8a6) ↔ `light.accentForeground` (#FFFFFF) ratio = **2.49:1** vs target 3
  - `dark.destructive` (#F87171) ↔ `dark.destructiveForeground` (#FFFFFF) ratio = **2.77:1** vs target 3
  None of these caused the icon-on-primary symptom. Recommend filing a small `palette-contrast-tighten` follow-up spec when convenient.
- **`Agent/AGENTS.md:47` previously claimed Expo SDK 55** but `package.json` declares `~56.0.5`. Corrected during the prior review-spec session; landed in `a040515`.
- **The shift attempted to set up an `agent/20260526/fix-dark-mode-icon-on-primary-bg` branch** per the Constitution's git discipline. Matt's direct commit to `dev` superseded that workflow; the stale agent branch was deleted.
- **`Agent/` is `.gitignore`d at the repo root**; existing tracked Agent files were force-added historically. The new spec, investigation, and verification files in this commit were added with `git add -f` to match the existing convention.

## Docs Updated

- `Agent/AGENTS.md` — Specs router updated (4 new rows for the dark-mode track; status of `fix-dark-mode-icon-on-primary-bg` flipped to `Merged`); Tech Stack Reference corrected from "Expo SDK 55" to "Expo SDK 56".
- `Agent/CHANGELOG.md` — added Unreleased entries for icon fix, lint guard, contrast test, and helper extraction.
- `Agent/Specs/fix-dark-mode-icon-on-primary-bg.md` — NEW (now `Merged`).
- `Agent/Specs/fix-web-theme-first-paint-race.md` — NEW (`Blocked`, spike-first design).
- `Agent/Specs/add-dark-splash-and-themed-app-icon.md` — NEW (`Blocked` on assets).
- `Agent/Specs/document-theming-contracts-in-expo-ui-package-doc.md` — NEW (`Blocked` on first-paint spec).
- `Agent/Investigations/20260526-dark-mode-color-issues.md` — NEW (durable evidence; retain until all four specs land).
- `Agent/Testing/fix-dark-mode-icon-on-primary-bg.md` — NEW (`status: pending`).

`Agent/Docs/EXPO_UI_PACKAGE.md` is still missing the SSR + token-pairing + splash + cookie sections; that work is intentionally batched into `document-theming-contracts-in-expo-ui-package-doc.md` and lands once the first-paint spec finalizes.

## Next Ready Task

None — the only Ready spec was completed; all remaining specs are `Blocked` with concrete unblock steps listed above.
