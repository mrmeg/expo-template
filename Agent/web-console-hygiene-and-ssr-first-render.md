---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/129
---

# Web console hygiene: `pointerEvents` prop, `useNativeDriver`, and the SSR first-render overflow

## Goal
Every web page of the template (and of every consumer app that uses these components) logs two React Native Web warnings, and the dev server's first server render of `/` and `/showcase` throws `RangeError: Maximum call stack size exceeded` and falls back to client rendering ("Switched to client rendering because the server rendering errored"). The three are one defect: the deprecated `pointerEvents` *prop*. react-native-web's `createDOMProps` handles it with `require("../warnOnce")` inline — a lazy module load at the deepest point of the render, which is what overflows the stack on the first render of a deep route and logs "props.pointerEvents is deprecated" on every later one. Separately, kit animations pass `useNativeDriver: true` on web, where RN logs "Animated: `useNativeDriver` is not supported…" per animation. Zero console warnings on every showcase route, and a clean first SSR render.

## Context
Verified on `origin/dev` `d924b73` with Metro on 8133 (`/tmp/fleet/ui/expo-ui/w4-before/sweep-{a,b}.json`, `metro-8133-w4.log`):
- SSR trace: `loadModuleImplementation > guardedLoadModule > metroRequire > createDOMProps > createElement > View`; bundle line 3949 is `if (pointerEvents != null) { require("../warnOnce").warnOnce('pointerEvents', "props.pointerEvents is deprecated. Use style.pointerEvents"); }`. The first fetch of `/` and `/showcase` after Metro starts returns a 200 whose body contains "Maximum call stack"; `/components/*`, `/blocks`, `/templates` do not overflow. Second renders are clean. Whether a production `expo export` shows it is unverified.
- `pointerEvents` prop in the kit: `Popover.tsx:122` (`"box-none"`), `Tooltip.tsx:113` (`"box-none"`), `SegmentedControl.tsx:200` (`"none"`), `Select.tsx:193` and `DropdownMenu.tsx:183` (`<AnimatedView … pointerEvents="box-none">`; `AnimatedView` spreads `...props` onto `Animated.View`). Template: `app/(main)/(tabs)/index.tsx:165` and `:313` (`<View pointerEvents="none">` in `RailCard`). The owner chain of the warning on every route is `<View> > <RailCard> > <ExploreScreen>` — the Explore tab stays mounted under the demo stack. `Switch.tsx` already uses `style.pointerEvents`.
- `useNativeDriver: true` literals: `Tabs.tsx:142`, `Progress.tsx:141,192,197`, `Accordion.tsx:247`, `Notification.tsx:19-20`, `Switch.tsx:101`, `SegmentedControl.tsx:168`, `Skeleton.tsx:68`, `hooks/useScalePress.ts:82`, `hooks/useStaggeredEntrance.ts:102,127`, plus `Checkbox.tsx` and `RadioGroup.tsx` (the list is illustrative; the contract test in step 3 is authoritative). `Drawer.tsx` already computes `shouldUseNativeDriver`. Warning owners seen: `<AnimatedView>` (via `useStaggeredEntrance`) and `<Switch>`.
- `packages/ui/src/constants/motion.ts` exports `durations` (and easing); it is the natural home for a shared driver flag. `client/showcase/__tests__/gallerySplitPoint.test.ts` is the precedent for a source-contract test that greps the tree.
- Sweep tooling: `/tmp/fleet/ui/expo-ui/sweep.mjs <outDir> --schemes=light [--routes=…]` records per-route console warnings (with owner chains) and the first-fetch SSR status; `hydration-sweep.mjs dark` records `pageerror`s.

## Work
1. **Shared driver flag.** `constants/motion.ts`: `export const nativeDriver = Platform.OS !== "web";` (doc comment: RN Animated on web has no native module; `true` only logs). Replace every `useNativeDriver: true` listed above with `useNativeDriver: nativeDriver`; `Drawer.tsx` keeps its own layout-prop logic but can read the constant. Export from `@mrmeg/expo-ui/constants`.
2. **`pointerEvents` → style.** Kit: move the five props into the element's `style` (`pointerEvents: "box-none"` / `"none"`). `AnimatedView`: accept the `pointerEvents` prop for backward compatibility but fold it into `style` instead of forwarding (consumers pass it today). Template: the two `RailCard` views. Native RN supports `style.pointerEvents` since 0.71, so no platform branch.
3. **Contract test (RED first).** `packages/ui/src/__tests__/webConsoleContracts.test.ts`: walk `packages/ui/src` (excluding `__tests__`) and fail on `useNativeDriver: true` and on a JSX `pointerEvents=` prop (allow `style` objects and the `AnimatedView` prop *declaration*); a second test in `client/showcase/__tests__` or `app/__tests__` covers `app/` + `client/`. Unit tests: `AnimatedView` renders `pointerEvents` into the flattened style (`toHaveStyle`), and one kit animation (`Switch` or `Skeleton`) passes `useNativeDriver: false` under `forceWebPlatform` (spy on `Animated.timing`).
4. **SSR first render.** After the changes, restart Metro (fresh module cache) and fetch `/`, `/showcase`, `/components`, `/blocks` once each — the first body must not contain "Maximum call stack" and `metro` must log no "SSR streaming render error". If any route still overflows, capture the new top frame from the Metro log, note it in the PR, and stop there (do not chase Metro internals).
5. **Production check (time-boxed, 20 min).** `bun run build` (heavy slot) then `PORT=3133 bun run start` (check `server.bun.ts` for the port variable), first-fetch `/` and `/showcase`, record whether the export shows the error before/after; stop the server by PID. Skip and say so if the build does not fit.
6. **Docs.** CHANGELOG `## [Unreleased]` `### Fixed`: web console warnings (`pointerEvents` prop, `useNativeDriver`) and the dev-server first-render overflow on deep routes; note `nativeDriver` under `### Added`. LLM_USAGE/README: mention `style.pointerEvents`, not the prop, for kit consumers. `bun run docs:llms`.

## Validation
- Targeted jest for the touched components + the new contract tests (`--maxWorkers=2`), then `bun run verify` gates (typecheck, ui typecheck, lint, gen --check, test:ci) through the heavy slot.
- Web: Metro on 8133; `node /tmp/fleet/ui/expo-ui/sweep.mjs /tmp/fleet/ui/expo-ui/console/after --schemes=light` — every route reports `0 warnings` and no `SSR-STACK-OVERFLOW`; before snapshot is `/tmp/fleet/ui/expo-ui/w4-before/sweep-{a,b}.json`. Screenshots of `/`, `/components/Select` (open), `/components/Popover` (open) light+dark under `/tmp/fleet/ui/expo-ui/console/{before,after}/` to show overlays still pass touches through (tap-through on `box-none` layers).
- Native behaviour unchanged (`nativeDriver` is `true` off web); no device check required.

## Out of scope
- The dark-mode hydration mismatch (Radix `useId` ids in the Explore rail) — separate spec.
- Removing the `pointerEvents` *prop* from `AnimatedView`'s public type.

## Open questions
None.
