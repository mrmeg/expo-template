# End-to-End Smoke Tests (Maestro)

The Jest suites cover components, hooks, and server handlers, but they can't see
the things that only exist in a real native build: the startup gate, the native
tab bar, the onboarding shell branch, and the generated screen-template
registry. `.maestro/` holds a small [Maestro](https://maestro.dev) suite that
covers exactly those.

The suite targets the **blank-env path**: no auth, no billing, no media storage
configured. That's the state a fresh clone boots in, and the template is
required to stay fully explorable there (see `AGENTS.md`), so the flows need
zero secrets.

## Flows

| Flow | What it proves |
|------|----------------|
| [`.maestro/launch.yml`](../.maestro/launch.yml) | Cold launch resolves `useAppStartup` (fonts, i18n, onboarding persistence, auth bootstrap), the splash hides, and the onboarding gate renders. A provider crash or a gate that never resolves fails here. |
| [`.maestro/onboarding.yml`](../.maestro/onboarding.yml) | Both exits from the onboarding gate — paging through all three pages, and Skip from page 1 — flip the persisted flag and swap the shell over to the `(main)` Stack. |
| [`.maestro/tabs.yml`](../.maestro/tabs.yml) | All four `NAV_DESTINATIONS` tabs mount and render: Explore, Media (fails closed), Profile, Settings. |
| [`.maestro/templates.yml`](../.maestro/templates.yml) | Tapping a screen-template card on Explore reaches the rendered template, validating `client/templates/registry.generated` end to end. Also walks Explore → components gallery → a component detail, and proves the kitchen-sink showcase is still reachable from the gallery header. |

Every flow is independent and launches with `clearState: true`, which wipes
AsyncStorage — including the `has-seen-onboarding` key. That makes the suite
idempotent and order-free: run any flow twice and it starts from a fresh
install both times.

## Setup

1. Install the Maestro CLI (once):

   ```sh
   curl -fsSL "https://get.maestro.mobile.dev" | bash
   ```

   Verify with `maestro --version` (the suite was authored against 2.8.0).

2. Build and install the app on a booted simulator. A Release build is closest
   to what ships:

   ```sh
   bunx expo run:ios --configuration Release
   ```

   A dev-client build (`bun run ios`) also works, as long as Metro is running
   and the JS bundle is current — the flows only touch app UI, not any
   dev-client menu.

3. Make sure the env you build with is blank. The flows assert the fails-closed
   states (media degrading to its "not configured" / "couldn't load" branch,
   `AuthGate` passing through), so a populated `.env` changes what renders and
   fails the assertions. Move it aside for the run:

   ```sh
   mv .env .env.local.bak   # restore afterwards
   ```

4. **Pin the device.** Maestro picks a booted simulator on its own, and if more
   than one is booted it may well choose one the app was never installed on —
   which surfaces as every flow failing its *first* assertion, looking exactly
   like an app regression. Prefer being explicit:

   ```sh
   xcrun simctl list devices booted           # find the one you built onto
   maestro --device <UDID> test .maestro
   ```

   `bun run e2e` deliberately doesn't hardcode a UDID, so use the pinned form
   whenever a second simulator might be running (Xcode and other tooling boot
   them without asking).

## Running

```sh
bun run e2e                       # whole suite
maestro test .maestro/launch.yml  # single flow
```

Point the flows at a renamed app by overriding `APP_ID` — it defaults to
`com.mrmeg.template`, matching `app.identity.js`:

```sh
maestro test -e APP_ID=com.your.app .maestro
```

The suite takes a few minutes — every flow cold-launches the app with cleared
state, and several do it more than once.

Debug output lands in `~/.maestro/tests/<timestamp>/<flow>/` after every run:
`screenshots/` has a PNG of the exact failing step and `screen-hierarchy/` the
matching accessibility tree as JSON. Those two answer nearly every "why didn't
that selector match" question — the tree shows the real
`accessibilityText` / `resource-id` values, which is how the composite-pressable
and duplicate-"Explore" traps below were found. `maestro studio` opens an
interactive inspector against the running app for exploring selectors live.

## Selector conventions

These are the non-obvious ones, all of them learned from flows that failed on a
real iOS run before they passed. Read this section before adding a flow.

- **Prefer `testID`** for app-owned containers. The tab screens expose one
  stable root id each: `explore-screen`, `profile-screen`, `settings-screen`;
  `media.tsx` exposes its state branches (`media-disabled`,
  `media-auth-required`, `media-error`); the onboarding pager exposes
  `onboarding-gate`, `onboarding-flow`, `onboarding-title`,
  `onboarding-next-button`, `onboarding-skip-button`, and friends.

- **Tab bar items are matched by visible label.** `(tabs)/_layout.tsx` uses
  `NativeTabs` (`expo-router/unstable-native-tabs`), so the tab bar is a real
  `UITabBar` / `BottomNavigationView` and can't carry a React `testID`. The
  labels come from `NAV_DESTINATIONS` — rename a destination and the flows need
  the same rename.

- **"Explore" needs scoping to the tab bar.** `MainLayout` titles the whole
  `(tabs)` group "Explore", so that string appears twice on every tab — once in
  the stack header, once in the tab bar — and Maestro matches the header first.
  Use `childOf: { text: "Tab Bar" }`. Media / Profile / Settings are unique and
  need no scoping. The header back button is also labelled "Explore", which is
  the same trap from the other direction.

- **Composite pressables need regex text selectors.** A Pressable whose
  children are several `<Text>` nodes collapses into one accessibility string:
  an Explore grid card reads `", Pricing, Plans & comparison"`, not `"Pricing"`.
  Maestro matches against the whole string, so `.*Pricing.*` works and a bare
  `"Pricing"` matches nothing. Same for the featured card
  (`.*Component Library.*`).

- **Don't rely on `back` to pop a native stack.** On iOS Maestro's `back` is an
  edge-swipe and does not reliably pop an Expo Router stack. Give each
  navigation its own `launchApp: { clearState: true }` instead — slower, but
  deterministic, and it keeps every assertion block independent.

- **Assert the *shape* of a fails-closed state, not one specific branch.** The
  Media tab is a good example: `media-disabled` requires the server to report
  `kind: "disabled"`, but a native build with no API origin can't even form the
  request URL and lands on `media-error` instead. Both are correct blank-env
  outcomes, so `tabs.yml` accepts either via
  `id: "media-(disabled|error|auth-required)"`. Pinning one branch makes the
  flow fail for a reason that isn't a regression.

- **Avoid platform-specific selectors** so these flows can be reused on
  Android later.

## Not wired into CI (yet)

CI intentionally does not run this suite. It needs a macOS runner plus a full
native build and simulator boot per run, which is a real cost and time decision
rather than a technical blocker. When that's worth paying, the follow-up is a
separate workflow (not a job bolted onto the existing lint/test matrix) that
boots a simulator, runs `bunx expo run:ios --configuration Release`, and calls
`bun run e2e`. Until then, run it locally before native releases.

## Out of scope

- **Android runs.** The flows deliberately avoid iOS-only selectors, but they
  have not been verified on an emulator.
- **Auth-provider flows.** Sign-in / sign-up need real Clerk or Cognito keys;
  this suite is the no-env path only.
