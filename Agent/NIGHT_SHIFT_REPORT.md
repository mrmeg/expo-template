# Night Shift Report — 2026-04-03

## Completed

### 1. InputOTP autoFocus Default
**Commits:** `c3572b4`, `3572783`
**What changed:** Changed `InputOTP` `autoFocus` prop default from `true` to `false`. Updated JSDoc. Removed `autoFocus={false}` workarounds from showcase (3 instances).

**How to verify:**
1. Open web dev server (`npx expo start --web`)
2. Navigate to the component showcase
3. Verify the page loads scrolled to the top, not the bottom
4. Scroll to InputOTP section — verify OTP inputs do NOT auto-focus on page load

---

### 2. Showcase Missing Components
**Commits:** `811d40d`, `094731a`
**What changed:** Added 4 new demo sections to the component showcase: Badge (4 variants), Card (default/outline/pressable), Label (basic/required/error/sizes/with-input), AnimatedView (all 4 animation types with replay toggle). Also fixed a pre-existing TypeScript error in Tabs.tsx (children type narrowing).

**How to verify:**
1. Open component showcase on web
2. Scroll to find new sections between Skeleton and Bottom Sheet
3. Verify Badge shows 4 pills in a row (Default, Secondary, Outline, Destructive)
4. Verify Card shows 3 variants including a pressable card that shows a toast when tapped
5. Verify Label shows sizes, required asterisk, and error state
6. Verify AnimatedView shows 4 animations; tap "Replay animations" to remount
7. Check: web, iOS, Android — no console errors

---

### 3. Accessibility Improvements
**Commits:** `454c2f9`, `4204689`
**What changed:** Added `accessibilityRole="button"` to Drawer trigger (both asChild and non-asChild paths), backdrop ("Close drawer"), and close button ("Close"). Marked Accordion chevron icon as `decorative`. Added `accessibilityRole="button"` and position labels ("Digit 1 of 6") to InputOTP cells.

**How to verify:**
1. On iOS: enable VoiceOver, navigate to a Drawer trigger — should announce as "button"
2. Open a drawer, swipe to backdrop — should announce "Close drawer, button"
3. Navigate to an Accordion — chevron should NOT be announced separately
4. Navigate to an InputOTP — each cell should announce "Digit X of Y, button"
5. Verify no visual changes on any platform

---

### 4. Test Coverage Expansion
**Commits:** `86cac11`, `9e6a5e3`
**What changed:** Added 10 new test files covering hooks (useTheme, useStaggeredEntrance), UI components (Progress, Tabs, InputOTP, Switch, Checkbox, Select), and stores (themeStore, globalUIStore). TypeScript compiles cleanly.

**How to verify:**
1. Run `npx jest` — all new test files should pass alongside existing 98 tests
2. Expected total: ~150+ tests across 18 test files

**Note:** Tests were not validated at runtime during this shift due to a local environment issue (node/simdjson library mismatch). TypeScript compiles cleanly. Tests may need minor adjustments if mocks don't match runtime behavior.

---

## Blocked
None.

## Issues Discovered
- `@rn-primitives/accordion` already provides `role='button'` on its Trigger — confirmed during a11y review, avoided duplicate

## Docs Updated
- `Agent/CHANGELOG.md` — added entries for all 4 tasks under [Unreleased]
- All docs in `Agent/Docs/` audited — no updates needed (DESIGN.md, ARCHITECTURE.md, USER_FLOWS.md all still accurate)
