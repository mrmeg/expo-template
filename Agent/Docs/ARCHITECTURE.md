# Architecture

> System design, data flow, and key decisions for the Expo Template app.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Expo Router                       │
│              (File-based routing)                    │
│  app/_layout.tsx → (main)/_layout.tsx → (tabs)/     │
│                                       → (demos)/    │
│                                   api/ (server)     │
├─────────────────────────────────────────────────────┤
│                  Client Layer                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │
│  │ Features │ │   UI     │ │  Shared Hooks/   │    │
│  │ (auth,   │ │Components│ │  Lib / State     │    │
│  │  media,  │ │ (35 prim)│ │  (Zustand)       │    │
│  │  i18n…)  │ │          │ │                  │    │
│  └──────────┘ └──────────┘ └──────────────────┘    │
├─────────────────────────────────────────────────────┤
│                 Shared Layer                         │
│            shared/media.ts (paths, types)            │
├─────────────────────────────────────────────────────┤
│                 Server Layer                         │
│     Express (prod web) │ API Routes (Expo Server)    │
│     S3/R2 media APIs   │ CORS, rate limiting         │
└─────────────────────────────────────────────────────┘
          │                          │
     AWS Cognito              AWS S3 / R2
     (Auth)                   (Media Storage)
```

## Platform Targets

| Platform | Entry | Bundler | Notes |
|----------|-------|---------|-------|
| iOS | expo-router/entry | Metro | New Architecture enabled |
| Android | expo-router/entry | Metro | New Architecture enabled |
| Web | expo-router/entry | Metro → server export | Server-rendered by Express in prod |

## Directory Architecture

### Routing Layer (`app/`)

File-based routing via Expo Router with nested layouts:

- **Root layout** (`_layout.tsx`) — Provider stack, splash screen, error boundary
- **Main group** (`(main)/`) — Stack navigator, header config
  - **Tabs** (`(tabs)/`) — 4 bottom tabs: Explore, Media, Profile, Settings
  - **Demos** (`(demos)/`) — 17 screen templates and demos
- **API routes** (`api/`) — Server-side endpoints:
  - `api/media/` — S3 presigned URLs (upload, read, list, delete)
  - `api/billing/` — Stripe Checkout / Portal / Webhook / Summary routes driven by the process-wide `BillingRegistry` (`server/api/billing/registry.ts`). Unconfigured registries return `503 billing-disabled`.
  - `api/_shared/` — Cross-route helpers: `auth.ts` (`requireAuthenticatedUser` fronted by a `TokenVerifier` port — returns structured 401s and fails closed when no verifier is registered), `errors.ts` (typed JSON error responses), `cors.ts`
- **Web HTML** (`+html.tsx`) — Server-only root document, global CSS, theme-aware styles, font loading

### Client Layer (`client/`)

Organized by concern:

- **`features/`** — Self-contained domain modules (auth, media, i18n, keyboard, navigation, onboarding, app, billing)
  - `features/billing/` (baseline, hosted-external) owns the client side of Stripe Checkout / Billing Portal: `useBillingSummary` (React Query over `/api/billing/summary`, scoped to the authenticated user with `placeholderData = freeBillingSummary()`), plus the planned `useCheckout` / `usePortal` hooks and entitlement helper. UI code consumes the normalized `BillingSummary` from `shared/billing.ts` — never raw Stripe. Server-side identity mapping lives in `server/api/billing/account.ts` (`BillingAccountResolver`). See `Agent/Docs/BILLING.md`.
  - `features/app/` owns the shell contract: `useAppStartup` (single startup gate), `AuthGate` (per-surface auth policy), `OnboardingGate` (first-run flow), `isAuthEnabled` (env predicate)
- **`components/ui/`** — 35 design system primitives (shadcn-inspired)
- **`hooks/`** — 8 shared hooks (useTheme, useDimensions, useScalePress, etc.)
- **`lib/`** — Utilities (API client, haptics, storage, gesture handler, devtools)
- **`state/`** — Global stores (theme, drawer, globalUI)
- **`config/`** — Environment-aware config (base + dev/prod overrides)
- **`constants/`** — Design tokens (colors, spacing, fonts)

### Feature Isolation

Features follow tiered boundaries — *self-contained by default*, with two
named exceptions that the script + test in
`scripts/check-feature-isolation.js` and
`client/features/__tests__/featureIsolation.test.ts` enforce in CI:

**Shared layer (always allowed):** `client/lib/*`, `client/hooks/*`,
`client/components/ui/*`, `client/constants/*`, `client/state/*`,
`shared/*`, `@rn-primitives`. Any feature can import from these.

**Allowed cross-feature dependencies (the contract the test pins):**

| Feature | May import from | Why |
|---------|-----------------|-----|
| `app/` | `auth/`, `onboarding/` | Shell composition — `useAppStartup`, `OnboardingGate`, and `AuthGate` orchestrate auth + onboarding at startup. |
| `billing/` | `auth/` | Identity-only — `useBillingSummary` / `useBillingActions` read `useAuthStore` to learn whether the viewer is signed in. They never touch auth UI components. |
| All others (`auth`, `onboarding`, `media`, `i18n`, `notifications`, `navigation`, `keyboard`) | — | Self-contained. No cross-feature imports allowed. |

**Conventions:**
- Internal imports inside a feature use relative paths so the folder stays copy-portable.
- External consumers (routes, the shell, allowed cross-feature edges above) use the feature's `index.ts` barrel via `@/client/features/<name>`.
- Adding a new edge requires updating `ALLOWED_DEPENDENCIES` in `scripts/check-feature-isolation.js` *and* the table above; the Jest test fails if the two drift apart.

**Copy-with-feature notes (when extracting a feature into a new project):**
- `auth/` → standalone. Needs the shared layer plus AWS Amplify + Cognito env vars.
- `onboarding/` → standalone. Needs AsyncStorage on native (already in shared layer).
- `media/` → standalone. Needs `app/api/media/*` + `server/api/media/storage.ts` + `shared/media.ts` + R2/S3 env vars. Toast feedback uses `client/state/globalUIStore` from the shared layer.
- `billing/` → copy with `auth/` (identity dependency) and the `app/api/billing/*` server routes + `server/api/billing/*` registry + `shared/billing.ts`.
- `app/` → copy with `auth/` and `onboarding/` (composition dependency); this folder is the shell, not portable on its own.
- `i18n/`, `notifications/`, `navigation/`, `keyboard/` → standalone with shared-layer dependencies only.

Run `bun run check:features` locally to validate; `bun run test:ci` runs the same scan as part of the suite.

## Provider Nesting Order

```
QueryClientProvider (staleTime=5min, gcTime=10min)
  └─ SafeAreaProvider
       └─ ThemeProvider (React Navigation, dark/light)
            └─ KeyboardProvider (platform-aware)
                 └─ ErrorBoundary (Sentry-backed)
                      └─ Stack Navigator
  ├─ Notification (global toast portal)
  └─ PortalHost (@rn-primitives modals/tooltips)
```

## Data Flow

### State Management

**Zustand** for client state with platform-aware persistence:
- Native: AsyncStorage
- Web: localStorage

Store categories:
- **Feature stores** — `authStore`, `languageStore`, `compressionStore`, `onboardingStore`
- **Shared stores** — `themeStore`, `drawerStore`, `globalUIStore`

**TanStack React Query** for server state:
- Default stale time: 5 minutes
- GC time: 10 minutes
- Retry: 2 attempts with exponential backoff (not on 401/403/404)

### API Architecture

Two API layers:

1. **`apiClient`** — Typed fetch wrapper returning discriminated unions (`ApiOk | ApiProblem`). Methods: `get`, `post`, `put`, `patch`, `delete`. Built-in retry with exponential backoff.
2. **`authenticatedFetch`** — Amplify-aware wrapper injecting Cognito session tokens.

### Media Pipeline

```
Client (pick/capture)
  → Image compression (HEIC → JPEG, resize)
  → Optional web video conversion (WebM/AVI/MKV → MP4 via FFmpeg.wasm worker)
  → POST /api/media/getUploadUrl (get presigned S3 URL)
  → PUT to S3 presigned URL (direct upload)
  → POST /api/media/getSignedUrls (read-back URLs, 24hr expiry)
```

Web video conversion is optional and governed by a single worker-path
contract (`server/ffmpegWorker.js`) consumed by both `metro.config.js`
(dev) and `server/index.ts` (prod). See `PERFORMANCE.md` for the URL,
file path, and graceful failure behavior.

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Expo Router (file-based) | Convention-driven routing, typed routes, API routes in same project |
| Zustand over Redux | Simpler API, smaller bundle, first-class persistence |
| @rn-primitives over RNP | Unstyled primitives allow full design system control |
| Feature folders | Portable, self-contained modules; easy to add/remove features |
| AWS Amplify for auth | Managed Cognito integration, session token handling |
| Express for prod web | Rate limiting, security headers, compression — missing from static hosts |
| Expo Router SSR for web | Request-time HTML for dynamic routes while preserving Expo Router API routes and a single universal route tree |
| Discriminated union API responses | Type-safe error handling without exceptions |
| Platform-specific files (.native.ts) | Clean platform splits without runtime checks |
| Stripe Checkout + Billing Portal (hosted-external) as the billing baseline | One flow works web/iOS/Android without store-specific IAP integrations; webhooks own server state. Adopters needing native IAP introduce a new billing mode rather than mutating the default. See `BILLING.md`. |

## Build & Deploy

- **Dev**: `npx expo start` (Metro dev server)
- **Web prod**: `expo export -p web` → `dist/client` static assets plus
  `dist/server` renderer → Express serves and renders requests.
- **Local SSR verification**: `bun run build` then `bun run serve:ssr` for the
  Expo production server, or `bun run start-local` to exercise the custom
  Express adapter.
- **Native**: EAS Build (configured in app.json)
- **Local verification**: `bun run typecheck`, `bun run lint`, `bun run test:ci`
