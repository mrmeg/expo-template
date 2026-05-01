# Expo Template

A production-ready starter for cross-platform Expo apps. Ships with a
shadcn-inspired design system, optional auth/billing/media features that
each fail closed when unconfigured, an Express production server, and a
spec-driven agent workflow under `Agent/`.

## Features

### Core
- **Universal app** — iOS, Android, Web (React Native Web 0.21) on Expo SDK 55 / React 19 / RN 0.83 / TypeScript strict.
- **Design system** — 35+ shadcn-inspired components on `@rn-primitives` with a zinc palette, teal accent, dark/light themes, and WCAG contrast helpers.
- **File-based routing** — Expo Router with typed routes, async web routes, and a server-rendered web build.
- **State** — Zustand for client state, TanStack React Query for server state, persisted via `AsyncStorage` (native) or `localStorage` (web).
- **i18n** — `i18next` + `expo-localization`, English/Spanish bundles, RTL support, type-safe translation keys.

### Optional features (all default off, enabled by env)
- **Auth** — AWS Amplify / Cognito; without `EXPO_PUBLIC_USER_POOL_ID` and `EXPO_PUBLIC_USER_POOL_CLIENT_ID` the auth shell stays disabled and the template remains explorable.
- **Billing** — Stripe Checkout + Billing Portal (`hosted-external`). Without `STRIPE_*` env vars every `/api/billing/*` route returns a typed `503 billing-disabled` and the UI hides purchase CTAs.
- **Media** — R2/S3 uploads, signed URLs, browse, delete, client-side compression, video thumbnails. Without the four `R2_*` env vars every `/api/media/*` route returns a typed `503 media-disabled` and the Media tab renders a setup state.
- **Sentry** — `@sentry/react-native`, no-op when `EXPO_PUBLIC_SENTRY_DSN` is unset.

### Developer experience
- **Express production server** — gzip compression, CORS, rate limiting (a strict 10/min bucket on `/api/media/getUploadUrl` and the billing checkout/portal routes), security headers, Morgan logging.
- **Generator CLI** — `bun run generate component|screen|hook|form <Name>` — paths and imports match the rest of the template.
- **Reactotron** — auto-connects in dev mode for native runs.
- **Spec-driven Night/Day Shift workflow** — see `Agent/AGENTS.md`.

## Getting Started

This project uses **bun** as the package manager. The lockfile is `bun.lock`.

```bash
git clone <repo-url> my-app
cd my-app
bun install
npx expo start          # Press i / a / w for iOS / Android / Web
```

The `.env.example` file enumerates every optional feature flag — copy it to
`.env` and fill in only the credentials you need. A blank `.env` boots the
app with auth, billing, and media all disabled.

## Renaming the Template

App identity (name, slug, native scheme, iOS bundle id, Android package)
lives in **one** place: `app.identity.ts`. Both `app.config.ts` (the
native build config) and `client/lib/identity.ts` (the runtime accessor
the billing return URL uses) read from it.

To rename without searching the tree, set these five env vars in `.env`
(any subset can be overridden — the rest fall back to template defaults):

```bash
EXPO_PUBLIC_APP_NAME="Acme"
EXPO_PUBLIC_APP_SLUG="acme-app"
EXPO_PUBLIC_APP_SCHEME="acme"
EXPO_PUBLIC_APP_IOS_BUNDLE_ID="com.acme.app"
EXPO_PUBLIC_APP_ANDROID_PACKAGE="com.acme.app"
```

`getAppIdentity()` validates each override at config-load time — a
malformed scheme or non-reverse-DNS package throws before native build
runs, so a typo can't quietly ship into TestFlight. After changing
identity for native, re-run `expo prebuild` to regenerate the iOS /
Android projects with the new bundle ids.

## Scripts

| Script | Description |
|--------|-------------|
| `npx expo start` | Expo dev server (interactive) |
| `bun run web` | Start the Expo web dev server |
| `bun run ios` / `bun run android` | Build + run on simulator / emulator |
| `bun run build` | Production web export → `dist/` (client + SSR server) |
| `bun run start` | Run the Express production server (`server/index.ts`) |
| `bun run start-local` | Same, with `.env` autoloaded by Bun |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | `expo lint` (ESLint flat config) |
| `bun run test:ci` | `jest --ci --coverage --forceExit` |
| `bun run bundle-size` | Compare client JS against `scripts/bundle-baseline.json` |
| `bun run analyze` | `source-map-explorer` treemap of the client bundle |
| `bun run generate component\|screen\|hook\|form <Name>` | Scaffold a new module — see [Generator CLI](#generator-cli) |

## Generator CLI

```bash
bun run generate component MyButton    # client/components/ui/MyButton.tsx
bun run generate screen Settings       # client/screens/SettingsScreen.tsx + app/(main)/(demos)/screen-settings.tsx
bun run generate hook Debounce         # client/hooks/useDebounce.ts
bun run generate form ContactInfo      # client/components/forms/ContactInfoForm.tsx
```

The generator never overwrites existing files. PascalCase, kebab-case, and
snake_case names are all accepted and normalized to PascalCase exports.

## Testing

```bash
bun jest --watchAll                    # interactive
bun jest --testPathPattern=<path>      # single suite
bun run test:ci                        # CI-style with coverage
```

Coverage is collected from `client/**`, `app/api/**`, `server/**`, and
`shared/**` so CI flags drift in the route-level seams (CORS, rate
limiting, auth bootstrap, media storage, billing) — not just UI.

## Architecture

```
/app                          # Expo Router routes (file-based)
  ├── _layout.tsx             # Root layout: providers, splash, error boundary
  ├── (main)/(tabs)/          # Tab nav: home, profile, settings, media
  ├── (main)/(demos)/         # Showcase + screen-template demo routes
  └── api/                    # Expo Server routes (media, billing, etc.)

/client
  ├── components/ui/          # 35+ design system components on @rn-primitives
  ├── config/                 # Base / dev / prod app config (merged at runtime)
  ├── constants/              # Design tokens (colors, fonts, spacing)
  ├── features/               # Self-contained feature folders
  │   ├── auth/               #   Cognito (optional)
  │   ├── billing/            #   Stripe hosted-external (optional)
  │   ├── media/              #   R2/S3 uploads (optional)
  │   ├── i18n/               #   i18next + translations
  │   ├── notifications/      #   Global toast/alert
  │   ├── onboarding/         #   First-run flow
  │   ├── keyboard/           #   Cross-platform keyboard handling
  │   ├── navigation/         #   Web back-button + back behavior
  │   └── app/                #   Startup sequencing + auth gates
  ├── hooks/                  # Shared hooks (useTheme, useResources, …)
  ├── lib/                    # Shared utilities
  │   ├── api/                #   apiClient + authenticatedFetch
  │   ├── form/               #   FormProvider, FormTextInput, FormCheckbox, …
  │   ├── storage/            #   Cross-platform AsyncStorage wrapper
  │   └── devtools/           #   Reactotron config
  ├── screens/                # 13+ pre-built screen templates
  └── state/                  # Shared Zustand stores (theme, drawer)

/server                       # Express production server (compression, CORS, rate limits)
/shared                       # Code shared between client & server (e.g. media path constants)
/scripts                      # Generator CLI + bundle-size check
/test                         # Jest setup
/Agent                        # Spec-driven workflow (specs, playbooks, docs)
```

For deeper architecture, see `Agent/Docs/ARCHITECTURE.md`. For the current
docs index, start at `Agent/AGENTS.md`.

## Internationalization

```tsx
import { useTranslation } from "react-i18next";

function Greeting() {
  const { t } = useTranslation();
  return <Text>{t("common.ok")}</Text>;
}

// Or use the tx prop on the styled text components:
import { SansSerifText } from "@/client/components/ui/StyledText";
<SansSerifText tx="common.ok" />;
```

Translation bundles live in `client/features/i18n/translations/` (`en`,
`es`). Add a language by dropping a new bundle in that folder and wiring
it into `client/features/i18n/index.ts`.

## API Layer

Two complementary clients live under `client/lib/api/`:

```tsx
// 1. apiClient — typed fetch wrapper with discriminated-union responses.
import { api } from "@/client/lib/api/apiClient";

const result = await api.get<User>("/users/me");
if (result.kind === "ok") {
  console.log(result.data);
} else {
  console.error(result.kind); // "timeout" | "unauthorized" | "bad-data" | …
}
api.setAuthToken(token); // optional manual token

// 2. authenticatedFetch — pulls the Cognito access token from Amplify
//    and is the default for code that uses the bundled auth shell.
import { api as authedApi } from "@/client/lib/api/authenticatedFetch";

await authedApi.post("/api/media/getUploadUrl", { extension: "jpg", mediaType: "uploads" });
```

## Configuration

```tsx
import Config from "@/client/config";

Config.apiUrl;          // External API base URL (or "" for local /api/* routes)
Config.catchErrors;     // ErrorBoundary policy
Config.billingEnabled;  // Stripe billing UI flag (mirrors EXPO_PUBLIC_BILLING_ENABLED)
Config.appUrl;          // Absolute web origin used by hosted-billing return URLs
```

Runtime merges `client/config/config.base.ts` with either `config.dev.ts`
or `config.prod.ts` based on `__DEV__`.

## Theming

```tsx
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";

function Card({ children }) {
  const { theme, getShadowStyle, getContrastingColor } = useTheme();
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

Color tokens live in `client/constants/colors.ts` (`background`,
`foreground`, `card`, `cardForeground`, `primary`, `primaryForeground`,
`accent`, `border`, `muted`, `mutedForeground`, `destructive`, …). For
the full design system see `Agent/Docs/DESIGN.md`.

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

Full walkthrough (products, prices, disabling cleanly) is in
[`Agent/Docs/BILLING.md`](./Agent/Docs/BILLING.md). Without Stripe env
vars `/api/billing/*` returns `503 billing-disabled` and the UI hides
purchase CTAs — no Stripe traffic is ever generated.

## Tech Stack

- Expo SDK 55, React 19, React Native 0.83, React Native Web 0.21
- TypeScript 5.9 (strict), path alias `@/*` → repo root
- Expo Router ~55 (typed, async web routes, server-rendered web build)
- Zustand 5, TanStack React Query 5
- AWS Amplify 6 + Cognito (optional)
- Stripe 22 (server, hosted-external Checkout + Billing Portal)
- AWS S3 client + presigner (R2-compatible)
- react-hook-form 7 + Zod 4 + `@hookform/resolvers`
- `react-native-reanimated` 4.2, `react-native-keyboard-controller` 1.20
- `@expo/vector-icons` (Feather icon set in `Icon`)
- `@expo-google-fonts/lato` for the typography scale
- Jest 29 + jest-expo + RNTL 13
- ESLint 10 (flat config) + `@tanstack/eslint-plugin-query`
- Express 5 (production web server)
- Bun (package manager + script runner)

## Agent Workflow

The `Agent/` directory ships a spec-driven workflow:

- `/nightshift` — autonomous overnight loop that picks specs from `Agent/Specs/` and ships them
- `/dayshift` — interactive mode for writing specs, investigating issues, reviewing
- Slash commands: `/investigate`, `/write-spec`, `/review-spec`, `/morning-review`, `/status`, `/update-docs`, `/bootstrap-docs`

Start at `Agent/AGENTS.md` for the router and the docs index.

## License

MIT
