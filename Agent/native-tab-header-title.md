---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Native tab header shows the focused tab's title

## Goal

On iOS and Android the stack header above the tab bar reads "Profile", "Media"
or "Settings" on those tabs instead of "Explore" everywhere.

## Context

- `client/features/navigation/mainStackScreens.tsx:28` gives the `(tabs)`
  stack screen a fixed `title: "Explore"`. The native tab bar
  (`app/(main)/(tabs)/_layout.native.tsx`, `NativeTabs`) has no header of its
  own, so that stack header is the only top chrome and every tab shows
  "Explore" (seen in the 09-26 iOS dev-client pass on the Profile tab).
- Web is unaffected: `WEB_SHELL_ALWAYS_HEADERLESS` hides the `(tabs)` header
  and `WebMainLayout` spreads the same options object.
- Tab names and labels: `NAV_DESTINATIONS` (`index` → Explore, `media`,
  `profile`, `settings`).

## Work

1. `client/features/navigation/tabTitle.ts`: `tabTitleFromRoute(route)` reads
   the nested tab navigator's focused route (`route.state.routes[index].name`,
   else `route.params.screen`) and returns the matching `NAV_DESTINATIONS`
   label; unknown or absent → "Explore".
2. `MainLayout.tsx` passes `(tabs)` a function `options` that spreads the table
   entry and sets `title` from the route; the table stays an object so
   `WebMainLayout` is untouched.
3. Test first: `__tests__/tabTitle.test.ts` for each tab, `params.screen`,
   missing state, unknown name.

## Validation

- `bun run test:ci -- client/features/navigation`, `bun run typecheck`,
  `bun run lint`, `bun run verify`; iOS dev-client check of the Profile tab
  header if the pool simulator is free (else pending).

## Out of scope

Per-tab header buttons; web headers.

## Open questions

None.
