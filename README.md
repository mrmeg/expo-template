# Expo Template

Cross-platform Expo starter: shadcn-inspired design system, optional
auth/billing/media features that fail closed when unconfigured, a Bun
production server, and LLM-facing docs under `docs/`.

## Features

### Core

- **Universal app** — iOS, Android, and Web from one codebase; TypeScript strict. Versions under Tech Stack.
- **Design system** — 35+ shadcn-inspired components on `@rn-primitives`: zinc palette, teal accent, dark/light themes, WCAG contrast helpers.
- **Routing** — Expo Router typed routes; server-rendered web build (routes render per request on the Bun server).
- **State** — Zustand for client state, TanStack React Query for server state, persisted via `AsyncStorage` (native) or `localStorage` (web).
- **i18n** — `i18next` + `expo-localization`, English/Spanish bundles, RTL support, type-safe translation keys.

### Optional features (all default off, enabled by env)

**Auth** — AWS Amplify / Cognito or Clerk behind one shared `AuthClient`, selected by env:

| Env | Provider |
|-----|----------|
| `EXPO_PUBLIC_USER_POOL_ID` + `EXPO_PUBLIC_USER_POOL_CLIENT_ID` | Cognito |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk |
| both of the above | Cognito |
| `EXPO_PUBLIC_AUTH_PROVIDER` = `"cognito"` \| `"clerk"` | forces that one |
| neither | auth shell disabled; template stays explorable |

- **Sign-in (Cognito)** — email one-time code (default; `USER_AUTH` + `EMAIL_OTP`, no Lambdas), password (behind a toggle), Google/Apple via Managed Login. Email codes require `EMAIL_OTP` as a pool first auth factor and `ALLOW_USER_AUTH` on the client. Social also requires `EXPO_PUBLIC_COGNITO_DOMAIN`, `EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS="google,apple"`, registered identity providers, and a dev build on native (Expo Go can't autolink `@aws-amplify/rtn-web-browser`). `bash scripts/create-cognito-pool.sh` provisions all of it; without it the extra buttons stay hidden and password sign-in still works. Clerk: `unsupported`.
- **Sign-up (Cognito)** — email-first and password-optional: the default action creates the account with no password (confirmed by the emailed code, then signed in with email codes); "Add a password" reveals the password + confirm fields. Needs the same `EMAIL_OTP`-as-first-factor pool setting; a pool without it rejects the request with a surfaced error naming the requirement, leaving the password path usable. Clerk: `unsupported`.
- **Startup** — the provider's context mounts under the native splash (`client/features/app/StartupGate.tsx`); the splash hides once the provider has loaded and the session has been read, so a signed-in user never sees the signed-out shell. Clerk reports its load to the auth client instead of being polled; a load that fails or never finishes continues signed out after 10 s, and a session restored later still signs the user in.
- **Auth emails (Cognito)** — sign-up confirmation, sign-in code, password reset, and admin invite render from the HTML in `scripts/cognito-email/` with the app's name. Edit those files, then `bun run auth:emails` (`--dry-run` validates without touching AWS) stores them on the pool; `scripts/create-cognito-pool.sh` applies them at pool creation. `scripts/cognito-email/README.md` lists the placeholders and Cognito's limits, enforced by `scripts/__tests__/cognitoEmailTemplates.test.ts`.

**Billing** — Stripe Checkout + Billing Portal (`hosted-external`). Without `STRIPE_*` env vars every `/api/billing/*` route returns a typed `503 billing-disabled` and the UI hides purchase CTAs.

**Media** — R2/S3 uploads, signed URLs, browse, delete, client-side compression, video thumbnails. Without the four `R2_*` env vars every `/api/media/*` route returns a typed `503 media-disabled` and the Media tab renders a setup state. With storage configured, media routes require auth; `EXPO_TEMPLATE_ALLOW_PUBLIC_MEDIA=true` is a local/demo-only bypass ignored in production.

**Sentry** — `@sentry/react-native` on native, `@sentry/react` on web; no-op without `EXPO_PUBLIC_SENTRY_DSN`. See `docs/error-tracking.md`.

### Developer experience

- **Bun production server** — Expo Router API routes, middleware, and data loaders through `expo-server/adapter/bun`; static Brotli/gzip compression, CORS, rate limiting (strict 10/min on `/api/media/getUploadUrl` and the billing checkout/portal routes), security headers, request logging.
- **Generator CLI** — `bun run generate component|screen|hook|form <Name>`; paths and imports match the rest of the template.
- **Reactotron** — auto-connects in dev mode for native runs.

## Getting Started

Package manager: **bun** (lockfile `bun.lock`).

```bash
git clone <repo-url> my-app
cd my-app
bun install
bun run init            # Optional: name the project, pick auth, prune templates
npx expo start          # Press i / a / w for iOS / Android / Web
```

`bun run init` writes `.env` from `.env.example` with the five
`EXPO_PUBLIC_APP_*` identity vars filled in (validated before it writes), sets
`EXPO_PUBLIC_AUTH_PROVIDER` for the provider you pick, optionally deletes the
screen templates you don't want, and offers to re-run
`bunx expo prebuild --clean`. Non-interactive form:

```bash
bun run init --name "Acme" --auth clerk --templates list,pricing --yes
```

It refuses to overwrite an existing `.env` without `--force`, and keeps (with a
warning) any template that app code still imports, so pruning can't leave the
project failing `tsc`. Init is optional: a fresh clone with no `.env` boots with
auth, billing, and media disabled. `.env.example` enumerates every optional
feature flag.

## Renaming the Template

App identity (name, slug, native scheme, iOS bundle id, Android package) lives
in `app.identity.js` (typed by `app.identity.d.ts`), read by `app.config.ts`
(native build config) and `client/lib/identity.ts` (the runtime accessor the
billing return URL uses).

Override any subset in `.env`; the rest fall back to template defaults:

```bash
EXPO_PUBLIC_APP_NAME="Acme"
EXPO_PUBLIC_APP_SLUG="acme-app"
EXPO_PUBLIC_APP_SCHEME="acme"
EXPO_PUBLIC_APP_IOS_BUNDLE_ID="com.acme.app"
EXPO_PUBLIC_APP_ANDROID_PACKAGE="com.acme.app"
```

`getAppIdentity()` validates each override at config-load time: a malformed
scheme or non-reverse-DNS package throws before native build runs. Re-run
`expo prebuild` after changing native identity.

## Scripts

| Script | Description |
|--------|-------------|
| `bun run init` | Name the project, pick an auth provider, prune screen templates |
| `npx expo start` | Expo dev server (interactive) |
| `bun run web` | Expo web dev server |
| `bun run ios` / `bun run android` | Build + run on simulator / emulator |
| `bun run scan:showcase` | Open React Scan against the local showcase route on port 8081 |
| `bun run build` | Production web export → `dist/` (client bundle + server output) |
| `bun run start` | Run the Bun production server (`server.bun.ts`) |
| `bun run start-local` | Same, with `.env` autoloaded |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | `expo lint` (ESLint flat config; lints `app/` only by default — pass paths to widen) |
| `bun lint:ui` | Design-system rules only, over `app`, `client`, `shared`; `--changed` for touched files, `--doctor` to check wiring — see [`packages/lint/README.md`](packages/lint/README.md) |
| `bun run lint:release` | Release `@mrmeg/eslint-plugin-expo-ui`: version bump, the `lint:typecheck`/`test`/`build`/`pack`/`consumer-smoke` gates, `--publish` to push it — see [`packages/lint/README.md`](packages/lint/README.md#release) |
| `bun run verify` | Every CI `validate` gate locally, in CI order |
| `bun run test:ci` | `jest --ci --coverage --forceExit` |
| `bun run e2e` | Maestro native smoke suite — see `docs/e2e.md` |
| `bun run bundle-size` | Compare client JS against `scripts/bundle-baseline.json` |
| `bun run analyze` | `source-map-explorer` treemap of the client bundle |
| `bun run generate component\|screen\|hook\|form <Name>` | Scaffold a module — see [Generator CLI](#generator-cli) |

## Render Performance Checks

The web document injects React Scan only when a local URL includes `?scan`:

```bash
bun run web
# open http://localhost:8081/showcase?scan
bun run scan:showcase   # same, against an already-running dev server
```

If another Expo app holds `8081`, pass a port to both sides:

```bash
EXPO_DEV_SERVER_PORT=8087 bunx expo start --web --port 8087
EXPO_DEV_SERVER_PORT=8087 bun run scan:showcase
```

Use it when editing `client/showcase` or `packages/ui`. Keep frequently updated
demos in small local-state components so typing, sliders, OTP input, and
toggles do not re-render the entire showcase route.

## Generator CLI

```bash
bun run generate component MyButton    # packages/ui/src/components/MyButton.tsx
bun run generate screen Settings       # client/templates/settings/ (Screen.tsx + demo.tsx + meta.ts) + app/(main)/(demos)/screen-settings.tsx
bun run generate hook Debounce         # client/hooks/useDebounce.ts
bun run generate form ContactInfo      # client/components/forms/ContactInfoForm.tsx
```

The generator never overwrites existing files. PascalCase, kebab-case, and
snake_case names are accepted and normalized to PascalCase exports.

## Testing

```bash
bun jest --watchAll                    # interactive
bun jest --testPathPattern=<path>      # single suite
bun run test:ci                        # CI-style with coverage
```

Coverage spans `client/**`, `app/api/**`, `server/**`, `shared/**`,
`packages/ui/src/**`, `packages/media/src/**`, and `packages/purchases/src/**`,
so CI flags drift in the
route-level seams (CORS, rate limiting, auth bootstrap, media storage, billing)
and in the packaged UI. The lint plugin's own suites live in
`packages/lint/__tests__` and run with the rest of jest.

## Architecture

```
/app                          # Expo Router routes (file-based)
  ├── _layout.tsx             # Root layout: providers, splash, error boundary
  ├── (main)/(tabs)/          # Tab nav: home, profile, settings, media
  ├── (main)/(demos)/         # Component / block / template galleries + demo routes
  └── api/                    # Expo Server routes (media, billing, etc.)

/client
  ├── blocks/                 # Scale 02: composed screen sections (generated registry)
  ├── components/             # App-local shared components
  ├── config/                 # Base / dev / prod app config (merged at runtime)
  ├── features/               # Self-contained feature folders
  │   ├── auth/               #   Cognito or Clerk, env-selected (optional)
  │   ├── billing/            #   Stripe hosted-external (optional)
  │   ├── media/              #   R2/S3 uploads (optional)
  │   ├── i18n/               #   i18next + translations
  │   ├── onboarding/         #   First-run flow
  │   ├── keyboard/           #   Cross-platform keyboard handling
  │   ├── navigation/         #   Web back-button + back behavior
  │   ├── server-alpha/       #   Server rendering / loader demos
  │   └── app/                #   Startup sequencing + auth gates
  ├── hooks/                  # App-local hooks
  ├── lib/                    # Shared utilities
  │   ├── api/                #   authenticatedFetch
  │   ├── form/               #   FormProvider, FormTextInput, FormCheckbox, …
  │   ├── storage/            #   Cross-platform AsyncStorage wrapper
  │   └── devtools/           #   Reactotron config
  ├── showcase/               # Gallery registry, filters, previews, details, and screen bodies
  └── templates/              # Scale 03: pre-built screens (generated registry)

/packages/ui                  # @mrmeg/expo-ui npm package source
/packages/media               # @mrmeg/expo-media npm package source
/packages/purchases           # @mrmeg/expo-purchases npm package source

/server.bun.ts                # Bun production server (compression, CORS, rate limits)
/server                       # Shared server helpers (rate limits, API helpers, media handlers)
/shared                       # Code shared between client & server (e.g. media path constants)
/scripts                      # Generator CLI, registry codegen, docs and bundle checks
/test                         # Jest setup
```

Five gallery routes — `showcase/index.tsx`, `themed-showcase.tsx`,
`components/index.tsx`, `components/[id].tsx`, `blocks/index.tsx` under
`app/(main)/(demos)` — are one-line lazy shells. Their bodies live in
`client/showcase/*Screen.tsx` behind the single split point
`client/showcase/gallery.tsx` / `lazyGallery.tsx`.

## Internationalization

```tsx
import { useTranslation } from "react-i18next";

function Greeting() {
  const { t } = useTranslation();
  return <Text>{t("common.save")}</Text>;
}

// Or use the tx prop on the styled text components:
import { SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
<SansSerifText tx="common.save" />;
```

Bundles live in `client/features/i18n/translations/` (`en`, `es`). Add a
language by dropping a new bundle there and wiring it into
`client/features/i18n/index.ts`.

## API Layer

`authenticatedFetch` (`client/lib/api/`) attaches the bearer token from a
getter the auth feature registers at startup — `registerApiTokenGetter()`,
called at module scope in the root layout, mirroring the server's
`setTokenVerifier()`. The API client imports no feature code; with auth
disabled no getter is registered and requests carry no token.

```tsx
import { api as authedApi } from "@/client/lib/api/authenticatedFetch";

await authedApi.post("/api/media/getUploadUrl", { extension: "jpg", mediaType: "uploads" });
```

Paths resolve per platform (`client/lib/api/apiOrigin.ts`). Web keeps
same-origin relative requests. Native has no page origin, so `/api/*` goes to
`EXPO_PUBLIC_API_URL` (the server hosting `app/api/*`; a trailing `/api` is
fine). A native development build without it uses the dev server; a native
release build without it rejects with `ApiOriginError` before any request.
expo-router's `origin` stays blank. Call the app's routes through `api.*` or
`authenticatedFetch`: a raw `fetch("/api/…")` has no origin in a native release
build.

## Configuration

```tsx
import Config from "@/client/config";

Config.apiUrl;          // Display form of the API base: "/api" on web, "<EXPO_PUBLIC_API_URL>/api" on native, "" when a native release build has none
Config.catchErrors;     // ErrorBoundary policy
Config.billingEnabled;  // Stripe billing UI flag (mirrors EXPO_PUBLIC_BILLING_ENABLED)
```

Runtime merges `client/config/config.base.ts` with `config.dev.ts` or
`config.prod.ts` based on `__DEV__`.

## Theming

```tsx
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";

function Card({ children }) {
  // useTheme also returns getContrastingColor(bg, a?, b?)
  const { theme, getShadowStyle } = useTheme();
  return (
    <View style={[
      {
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
        borderRadius: spacing.radiusMd,
        padding: spacing.md,
      },
      getShadowStyle("subtle"),
    ]}>
      <Text style={{ color: theme.colors.foreground }}>{children}</Text>
    </View>
  );
}
```

Color tokens live in `packages/ui/src/constants/colors.ts`, imported through
`@mrmeg/expo-ui/constants`. The primitives, theme hooks, resource-loading hook,
toast store, and UI helpers ship from the workspace package `@mrmeg/expo-ui`.

Fonts: native loads Inter through `useResources()` (from
`@expo-google-fonts/inter`). Web self-hosts it: `app/+html.tsx` preloads
`public/fonts/inter/` (copied from the `@fontsource-variable/inter`
devDependency; a guardrail test fails if they drift) and inlines the
`@font-face` rules in `<style id="mrmeg-expo-ui-inter">`, the id that makes
`useResources()` skip injecting its render-blocking Google Fonts stylesheet.

Package validation:

```bash
bun run ui:typecheck
bun run ui:test
bun run ui:build
bun run ui:pack
bun run ui:consumer-smoke
```

To publish, authenticate through your developer or CI npm config:

```sh
bun run ui:release -- --patch --publish
```

Use `--patch`, `--minor`, `--major`, or an exact version such as `0.2.0`.
Without `--publish` the command performs the same version bump and gates as a
dry run. Do not commit `.npmrc` tokens or registry secrets. Consumer Expo apps
install `@mrmeg/expo-ui` plus the native and Expo peer dependencies listed in
`packages/ui/package.json` (including `react-native-svg` and
`lucide-react-native` for `Icon`); implementation details such as
`@rn-primitives/*` are managed by the package.

If local npm login is blocked, use GitHub Actions trusted publishing. After
one-time npm package setup, pushing a commit that changes
`packages/ui/package.json` on `main` publishes the exact committed version when
npm does not already have it. The same `Publish UI Package` workflow also runs
manually with `version=patch` and `ref=main`; manual runs bump the version, run
the package gates, commit the bump, and publish through npm OIDC — no npm token
or local auth email.

`.github/workflows/publish-lint.yml` does the same for
`@mrmeg/eslint-plugin-expo-ui`, `publish-media.yml` for `@mrmeg/expo-media`, and
`publish-purchases.yml` for `@mrmeg/expo-purchases`. The lint and purchases ones
are `workflow_dispatch` only until their first release exists on npm — a package
npm does not have yet cannot be set up for trusted publishing, so that first run
needs an `NPM_TOKEN` secret.

Full design system: `packages/ui/README.md`.

### Design-system lint

`@mrmeg/eslint-plugin-expo-ui` (`packages/lint`) turns the design system's
theme and text rules into ESLint diagnostics over `app/`, `client/`, and
`shared/`: raw colors in style properties and color props, off-scale spacing
and radius literals, appearance overrides pushed through `style` onto
`@mrmeg/expo-ui` components, and raw primitives the design system already
wraps. Each message names the replacement — the token, the variant or preset
prop, or the component to import.

`bun run lint` is `expo lint`, which reaches `app/` only, so it does not see
`client/` or `shared/`. Run `bun lint:ui` for the design-system rules across
all three: `--changed` lints touched files, `--doctor` checks the wiring, and
`--rules` lists what each rule catches.

Where a rule is genuinely wrong for one line, disable it with a reason —
`// eslint-disable-next-line expo-ui/no-restyle -- reason` — never bare.

Another project adopts the plugin with
`bun add -d @mrmeg/eslint-plugin-expo-ui` alongside `@mrmeg/expo-ui`: with no
design-system sources on disk, the rules read the `design-system.json` manifest
the UI package's build ships, so the messages quote the presets and tokens of the
installed release. Config block, settings, and the resolution order are in
[`packages/lint/README.md`](packages/lint/README.md). Here the rules read
`packages/ui/src` directly.

## Billing (Stripe, hosted-external)

Off by default. To turn on:

```bash
# .env
EXPO_PUBLIC_BILLING_ENABLED=true
EXPO_PUBLIC_APP_URL=http://localhost:8081
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...             # from `stripe listen`
STRIPE_PRICE_ID_PRO_MONTH=price_...
STRIPE_PRICE_ID_PRO_YEAR=price_...
```

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

Billing contracts and disabling behavior: `docs/template-modernization-guide.md`.

## CI

`.github/workflows/ci.yml` runs on every push and pull request to `main`. Two
parallel jobs, no app credentials required:

- **Lint, Type Check, Test** (`validate`) — `bun install --frozen-lockfile` →
  `packages:peer-check` → `typecheck` → `lint` → `check:features` →
  `gen:templates:check` → `gen:blocks:check` → `docs:llms:check` →
  `docs:versions:check` → `test:ci`. `bun run verify` runs the same gates
  locally in the same order (without coverage). `lint` there is `expo lint`, so
  it gates `app/` only; run `bun lint:ui` for `client/` and `shared/`.
- **Web Build + Bundle Size** — `bun run build` → `bun run bundle-size`. Fails
  the PR on >10% client bundle growth against `scripts/bundle-baseline.json`.

Tests mock the AWS / Stripe surfaces, so a blank `.env` is enough.

## Deployment

`eas.json` ships build profiles, `.eas/workflows/` two starter pipelines. The
template is **not** linked to an EAS project — wire it to yours first:

```bash
npm install -g eas-cli
eas login
eas init          # creates the EAS project, prints its id
```

Put the id in `.env` (or an EAS environment variable) so `app.config.ts` turns
EAS Update on:

```bash
EAS_PROJECT_ID=00000000-0000-0000-0000-000000000000
```

While `EAS_PROJECT_ID` is blank, `app.config.ts` omits `extra.eas.projectId`,
`updates.url`, and `runtimeVersion` entirely — cloud builds still work, only OTA
updates are off, so a fresh clone stays valid with a blank `.env`.

### Build profiles

| Profile | Distribution | Update channel | Notes |
|---------|--------------|----------------|-------|
| `development` | `internal` | — | Dev client build (`expo-dev-client`); loads JS from `expo start` |
| `development-simulator` | `internal` | — | Extends `development`, adds `ios.simulator: true` |
| `preview` | `internal` | `preview` | Internal QA builds |
| `production` | `store` | `production` | Store-ready, `autoIncrement: true` |

```bash
eas build --profile development --platform ios
eas build --profile preview --platform all
eas build --profile production --platform all
```

`cli.appVersionSource` is `remote`, so EAS owns the build number / version code.
The dev profiles set no `channel` — a dev client pulls JS from the local dev
server, not from EAS Update.

A build's update channel comes only from its profile's `channel` in `eas.json`;
`app.config.ts` does not derive one, so renaming a profile needs no config change.

### Workflows

| File | Trigger | Does |
|------|---------|------|
| `.eas/workflows/build-preview.yml` | Manual (`workflow_dispatch`) | iOS + Android `preview` builds in parallel |
| `.eas/workflows/update-production.yml` | Push to `main` | Publishes an EAS Update to the branch of the same name |

```bash
eas workflow:run .eas/workflows/build-preview.yml
```

`update-production.yml` is gated on `if: ${{ env.EAS_PROJECT_ID }}`, so it is
skipped (not failed) on a checkout that has not run `eas init`. Point the
`production` channel at the `main` branch once, so updates published by that
workflow reach production builds:

```bash
eas channel:edit production --branch main
```

Store submission (`eas submit`), Apple/Google credentials, and migrating the
GitHub Actions CI to EAS Workflows are not configured here.

## Tech Stack

- Expo SDK 58 (beta), React 19.2, React Native 0.88 (RC), React Native Web 0.21 (exact pins in `package.json`)
- TypeScript 6 (strict), path alias `@/*` -> repo root
- Expo Router 58 (typed routes, server-rendered web build)
- Zustand 5, TanStack React Query 5
- AWS Amplify 6 + Cognito or Clerk (optional; env-selected, fail-closed to disabled)
- Stripe 22 (server, hosted-external Checkout + Billing Portal)
- AWS S3 client + presigner (R2-compatible)
- react-hook-form 7 + Zod 4 + `@hookform/resolvers`
- React Native `Animated` for package UI motion
- `lucide-react-native` + `react-native-svg` (SVG icon set in `Icon`; `@expo/vector-icons` Feather only for the native tab bar)
- Jest 29 + jest-expo + RNTL 14
- ESLint 10 flat config
- Bun + Expo Server (production web server), Bun as package manager + script runner

## Template Docs

`docs/template-modernization-guide.md` is the LLM-facing component,
screen-template, and modernization reference. `AGENTS.md` holds compact repo
guidance and the docs index.

To apply this template's components and patterns from another project, point
your agent at the root `llms.txt` (index of fetchable docs) or `llms-full.txt`
(every LLM-facing doc in one file):

> Read https://raw.githubusercontent.com/mrmeg/expo-template/main/llms-full.txt
> and use this template's components and best practices in this project.

`llms-full.txt` and `llms-examples.txt` are generated — rebuild them with
`bun run docs:llms` after editing source docs or adding/removing demo routes,
screens, or components. CI fails when they drift (`bun run docs:llms:check`).

## License

MIT
