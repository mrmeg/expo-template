import type { SerifPreset } from "@mrmeg/expo-ui/constants";
import { applyLook, refinedLook, useThemeStore, type Look } from "@mrmeg/expo-ui/state";

import type { DemoLook } from "../looks";
import { loadLookFonts } from "./loadLookFonts";

/**
 * Who owns the app's look while a look detail page is open.
 *
 * Navigating from one look to another focuses the new page before (or after)
 * the old one blurs, and loading a look's fonts is async, so a plain
 * apply-on-focus / restore-on-blur pair can restore Refined over the look that
 * just applied. Every claim takes a generation number instead: only the newest
 * claim applies, only the newest claim restores, and a stale font load that
 * lands late (a native preset switch lands after its await) re-asserts whatever
 * the newest claim has already applied.
 */

let generation = 0;
/** A claim is open and the store holds (or is about to hold) its look. */
let held = false;
/** What RootLayout set, captured when no claim was open: `applyLook` never resets the serif. */
let baselineSerif: SerifPreset = "georgia";
/** The look the newest claim has applied, once its fonts are ready. */
let applied: Look | null = null;

function applyOnApp(look: Look): void {
  // Newsreader is only registered when the root layout loaded it.
  applyLook(look.serif && baselineSerif !== look.serif ? { ...look, serif: undefined } : look);
}

function restoreRefined(): void {
  applyLook(refinedLook);
  useThemeStore.getState().setSerifPreset(baselineSerif);
}

/**
 * Put `demo`'s look on the whole app until the returned function is called.
 * Fonts load first (a failed load falls back; the look still applies). Safe to
 * call from a focus effect: release runs on blur or when the id changes.
 */
export function claimLook(demo: DemoLook): () => void {
  const mine = ++generation;
  if (!held) {
    held = true;
    baselineSerif = useThemeStore.getState().serifPreset;
  }
  applied = null;
  let released = false;

  void (async () => {
    try {
      await loadLookFonts(demo);
    } catch {
      // A font that fails to load (offline, blocked) falls back; the look still applies.
    }
    if (generation !== mine) {
      // A newer claim owns the app. If it already applied, a preset switch from this load may have landed on top.
      if (applied) applyOnApp(applied);
      return;
    }
    if (released) {
      // Released mid-load with no newer claim: the late preset switch is undone here.
      restoreRefined();
      return;
    }
    applyOnApp(demo.look);
    applied = demo.look;
  })();

  return () => {
    released = true;
    if (generation !== mine) return;
    held = false;
    applied = null;
    restoreRefined();
  };
}
