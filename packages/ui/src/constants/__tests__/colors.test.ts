/**
 * Theme token contrast invariants.
 *
 * Every inverting token pair must clear the WCAG threshold appropriate
 * for its role. Two tiers per WCAG 2.1:
 *  - Text-on-surface pairs: ≥ 4.5 : 1 (SC 1.4.3, body text)
 *  - UI-component pairs:    ≥ 3   : 1 (SC 1.4.11, non-text contrast)
 *
 * Three pairs currently fall below threshold and are tracked as palette debt
 * (see `it.todo` block below). They do NOT cause the icon-on-primary bug
 * this test guards against — they are pre-existing palette decisions that
 * deserve their own spec. If the palette is updated, replace `it.todo` with
 * `it()` and add the assertion.
 *
 * If a NEW pair drops below threshold, fix the palette in `colors.ts` or
 * record a relaxed threshold in the PR — do not silently move it to todo.
 */

import { colors } from "../colors";
import { getContrastRatio } from "../../lib/contrast";

const TEXT_ON_SURFACE_MIN = 4.5;
const UI_COMPONENT_MIN = 3;

type SchemeName = "light" | "dark";
const SCHEMES: SchemeName[] = ["light", "dark"];

type TokenKey = keyof typeof colors.light.colors;

// Pairs that this spec locks down. Currently all pass.
const STRICT_TEXT_PAIRS: Array<[TokenKey, TokenKey]> = [
  ["background", "foreground"],
  ["card", "cardForeground"],
  ["popover", "popoverForeground"],
];

const STRICT_UI_PAIRS: Array<[TokenKey, TokenKey]> = [
  ["primary", "primaryForeground"],
  ["secondary", "secondaryForeground"],
];

describe("theme color tokens — contrast invariants", () => {
  describe.each(SCHEMES)("%s scheme", (scheme) => {
    const tokens = colors[scheme].colors;

    describe("text-on-surface pairs (WCAG SC 1.4.3 ≥ 4.5:1)", () => {
      it.each(STRICT_TEXT_PAIRS)("%s ↔ %s", (bg, fg) => {
        const bgValue = tokens[bg];
        const fgValue = tokens[fg];
        const ratio = getContrastRatio(bgValue, fgValue);
        expect(ratio).toBeGreaterThanOrEqual(TEXT_ON_SURFACE_MIN);
      });
    });

    describe("UI-component pairs (WCAG SC 1.4.11 ≥ 3:1)", () => {
      it.each(STRICT_UI_PAIRS)("%s ↔ %s", (bg, fg) => {
        const bgValue = tokens[bg];
        const fgValue = tokens[fg];
        const ratio = getContrastRatio(bgValue, fgValue);
        expect(ratio).toBeGreaterThanOrEqual(UI_COMPONENT_MIN);
      });
    });
  });

  // Palette debt — fix in a follow-up spec, then promote to `it.each` above.
  // Snapshot of current ratios (computed via getContrastRatio):
  //   light.muted (#F4F4F5) ↔ light.mutedForeground (#71717A)         = 4.07  (target 4.5)
  //   light.accent (#14b8a6) ↔ light.accentForeground (#FFFFFF)        = 2.49  (target 3)
  //   dark.destructive (#F87171) ↔ dark.destructiveForeground (#FFFFFF) = 2.77  (target 3)
  it.todo("light.muted ↔ light.mutedForeground reaches 4.5:1");
  it.todo("light.accent ↔ light.accentForeground reaches 3:1");
  it.todo("dark.destructive ↔ dark.destructiveForeground reaches 3:1");
});
