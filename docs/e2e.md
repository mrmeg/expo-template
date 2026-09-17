# End-to-End Smoke Tests (Maestro)

`.maestro/` holds a [Maestro](https://maestro.dev) suite covering what only a real
native build exercises: the startup gate, the native tab bar, the onboarding shell
branch, and the generated screen-template registry.

The suite targets the **blank-env path** — no auth, no billing, no media storage.
That is the state a fresh clone boots in, and the template must stay fully
explorable there (see `AGENTS.md`), so the flows need zero secrets.

## Flows

| Flow | What it proves |
|------|----------------|
| [`.maestro/launch.yml`](../.maestro/launch.yml) | Cold launch resolves `useAppStartup` (fonts, i18n, onboarding persistence, auth bootstrap), the splash hides, the onboarding gate renders. A provider crash or an unresolved gate fails here. |
| [`.maestro/onboarding.yml`](../.maestro/onboarding.yml) | Both exits from the gate — paging all three pages, and Skip from page 1 — flip the persisted flag and swap the shell to the `(main)` Stack. |
| [`.maestro/tabs.yml`](../.maestro/tabs.yml) | All four `NAV_DESTINATIONS` tabs (`client/features/navigation/navDestinations.ts`) mount and render: Explore, Media (fails closed), Profile, Settings. |
| [`.maestro/templates.yml`](../.maestro/templates.yml) | Tapping the Pricing card on Explore reaches the rendered template, validating `client/templates/registry.generated` end to end. Also walks Explore → components gallery → the Button detail, and that the kitchen-sink showcase is still reachable from the gallery header. |

Every flow is independent and launches with `clearState: true`, wiping
AsyncStorage including `has-seen-onboarding`, so the suite is idempotent and
order-free.

## Setup

1. Install the Maestro CLI once (suite authored against 2.8.0):

   ```sh
   curl -fsSL "https://get.maestro.mobile.dev" | bash
   maestro --version
   ```

2. Build and install on a booted simulator. Release is closest to what ships:

   ```sh
   bunx expo run:ios --configuration Release
   ```

   A dev-client build (`bun run ios`) also works, as long as Metro is running and
   the JS bundle is current — the flows touch only app UI, no dev-client menu.

3. Build with a blank env. The flows assert fails-closed states, so a populated
   `.env` changes what renders and fails the assertions:

   ```sh
   mv .env .env.local.bak   # restore afterwards
   ```

4. **Pin the device.** Maestro picks a booted simulator on its own; with more than
   one booted it may pick one the app was never installed on, which surfaces as
   every flow failing its *first* assertion — indistinguishable from an app
   regression.

   ```sh
   xcrun simctl list devices booted           # find the one you built onto
   maestro --device <UDID> test .maestro
   ```

   `bun run e2e` hardcodes no UDID, so use the pinned form whenever a second
   simulator might be running (Xcode and other tooling boot them without asking).

## Running

```sh
bun run e2e                                    # maestro test .maestro — whole suite
maestro test .maestro/launch.yml               # single flow
maestro test -e APP_ID=com.your.app .maestro   # renamed app
```

`APP_ID` defaults to `com.mrmeg.template`, matching `app.identity.js`. The suite
takes a few minutes: every flow cold-launches with cleared state, several more
than once.

Debug output lands in `~/.maestro/tests/<timestamp>/<flow>/`: `screenshots/` has a
PNG of the failing step, `screen-hierarchy/` the matching accessibility tree as
JSON with the real `accessibilityText` / `resource-id` values — that answers
nearly every "why didn't that selector match". `maestro studio` opens an
interactive inspector against the running app.

## Selector conventions

Read before adding a flow.

- **Prefer `testID`** for app-owned containers. Available ids: tab screen roots
  `explore-screen`, `profile-screen`, `settings-screen`; media state branches
  `media-disabled`, `media-auth-required`, `media-error`; onboarding
  `onboarding-gate`, `onboarding-flow`, `onboarding-title`,
  `onboarding-next-button`, `onboarding-skip-button` and friends; showcase
  `explore-components-link`, `components-gallery`, `components-kitchen-sink-link`,
  `component-card-<id>`, `component-detail`.

- **Tab bar items match by visible label.** `(tabs)/_layout.tsx` uses `NativeTabs`
  (`expo-router/native-tabs`), so the bar is a real `UITabBar` /
  `BottomNavigationView` and cannot carry a React `testID`. Labels come from
  `NAV_DESTINATIONS`; rename a destination and the flows need the same rename.

- **"Explore" needs scoping to the tab bar.** `MainLayout` titles the whole
  `(tabs)` group "Explore", so the string appears twice on every tab — stack
  header and tab bar — and Maestro matches the header first. Use
  `childOf: { text: "Tab Bar" }`. Media / Profile / Settings are unique. The
  header back button is also labelled "Explore", the same trap from the other
  direction.

- **Composite pressables need regex text selectors.** A Pressable whose children
  are several `<Text>` nodes collapses into one accessibility string: the Explore
  Pricing card reads `", Pricing, Plans & comparison"`, not `"Pricing"`, and
  Maestro matches the whole string — so `.*Pricing, Plans & comparison.*` works
  and a bare `"Pricing"` matches nothing. Pricing (order 40) is within
  `EXPLORE_TEMPLATE_PREVIEW_COUNT` (4, in `client/showcase/filters.ts`), so the
  tap needs no gallery detour.

- **Don't rely on `back` to pop a native stack.** On iOS Maestro's `back` is an
  edge-swipe and does not reliably pop an Expo Router stack. Give each navigation
  its own `launchApp: { clearState: true }` — slower, deterministic, and every
  assertion block stays independent.

- **Assert the *shape* of a fails-closed state, not one branch.** `tabs.yml`
  accepts `id: "media-(disabled|error|auth-required)"`. A native build with no
  `EXPO_PUBLIC_API_URL` has no absolute origin, skips the request, and lands on
  `media-disabled`; with an origin configured the same id comes from the server's
  own 503 response; a signed-in build with denied access lands on
  `media-auth-required`. All are correct blank-env outcomes, so pinning one branch
  makes the flow fail for a non-regression.

- **Avoid platform-specific selectors** so these flows can be reused on Android.

## Not wired into CI (yet)

CI does not run this suite: it needs a macOS runner plus a full native build and
simulator boot per run — a cost decision, not a technical blocker. The follow-up
is a separate workflow (not a job on the existing lint/test matrix) that boots a
simulator, runs `bunx expo run:ios --configuration Release`, and calls
`bun run e2e`. Until then, run it locally before native releases.

## Android keyboard regression checks

These are separate from the Maestro smoke suite above. Use an exclusively owned
device/emulator. The `/showcase` auth forms use demo callbacks, so submission and
resend checks can run without real credentials. `/auth-demo` uses `AuthWrapper`
and the configured auth provider: use it for focus, typing, mode-switching, and
scroll checks; submissions there require a configured test account/provider.

The Android input fixes were reproduced against UI 0.25.0 and rechecked with the
fixed package dist on an Android 16/API 36 arm64 emulator, Expo SDK 58/RN 0.88 RC,
at 300 and 420 dpi:

- Focus password, establish a known value, show/type/hide/type, then rapidly
  toggle six times and type again. The same Compose Host and live input
  connection must survive; native text and the form value must agree.
- Keep **email** focused while switching password/code mode both ways. The
  control must fire without selectable label text taking focus. Removing a
  focused password field is a different case, not evidence of an unwanted blur.
- Drag horizontally over empty space by more than 100 logical units. Verify
  unchanged scroll offset and that field focus, input connection, text, and IME
  survive both during the gesture and after release.
- Tap the same empty space: it must dismiss once. Actually scroll vertically:
  it must dismiss through the configured scroll handler. `interactive` alone
  only covers iOS; Android needs its explicit scroll-begin handler.
- Verify field-to-field handoff, long-press selection, and the showcase resend
  callback while its code field remains focused. Control labels are
  nonselectable; ordinary content and input text remain selectable.

All of these cases passed on that emulator. This does not replace a Camera App
SDK 57 device check after consuming the release and porting the template's
app-owned auth labels/scroll-shell changes. The SDK 57 package compatibility
gate checks declarations and bundling, not native IME behavior.

## Out of scope

- **Android runs.** The flows avoid iOS-only selectors but are unverified on an
  emulator.
- **Auth-provider flows.** Sign-in / sign-up need real Clerk or Cognito keys; this
  suite is the no-env path only.
