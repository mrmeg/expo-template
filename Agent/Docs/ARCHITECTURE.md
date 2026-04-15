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
| Web | expo-router/entry | Metro → static export | Served by Express in prod |

## Directory Architecture

### Routing Layer (`app/`)

File-based routing via Expo Router with nested layouts:

- **Root layout** (`_layout.tsx`) — Provider stack, splash screen, error boundary
- **Main group** (`(main)/`) — Stack navigator, header config
  - **Tabs** (`(tabs)/`) — 4 bottom tabs: Explore, Media, Profile, Settings
  - **Demos** (`(demos)/`) — 17 screen templates and demos
- **API routes** (`api/`) — Server-side media endpoints (S3 presigned URLs, list, delete)
- **Web HTML** (`+html.tsx`) — Global CSS, theme-aware styles, font loading

### Client Layer (`client/`)

Organized by concern:

- **`features/`** — Self-contained domain modules (auth, media, i18n, keyboard, navigation, onboarding, app)
  - `features/app/` owns the shell contract: `useAppStartup` (single startup gate), `AuthGate` (per-surface auth policy), `OnboardingGate` (first-run flow), `isAuthEnabled` (env predicate)
- **`components/ui/`** — 35 design system primitives (shadcn-inspired)
- **`hooks/`** — 8 shared hooks (useTheme, useDimensions, useScalePress, etc.)
- **`lib/`** — Utilities (API client, haptics, storage, gesture handler, devtools)
- **`state/`** — Global stores (theme, drawer, globalUI)
- **`config/`** — Environment-aware config (base + dev/prod overrides)
- **`constants/`** — Design tokens (colors, spacing, fonts)

### Feature Isolation

Features follow strict boundaries:
- **Never import from other features** — only from the shared layer
- **Internal imports use relative paths** — makes features copy-portable
- **Barrel exports via `index.ts`** — external consumers use `@/client/features/<name>`
- Exception: media imports `globalUIStore` from notifications for toast feedback

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
  → POST /api/media/getUploadUrl (get presigned S3 URL)
  → PUT to S3 presigned URL (direct upload)
  → POST /api/media/getSignedUrls (read-back URLs, 24hr expiry)
```

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Expo Router (file-based) | Convention-driven routing, typed routes, API routes in same project |
| Zustand over Redux | Simpler API, smaller bundle, first-class persistence |
| @rn-primitives over RNP | Unstyled primitives allow full design system control |
| Feature folders | Portable, self-contained modules; easy to add/remove features |
| AWS Amplify for auth | Managed Cognito integration, session token handling |
| Express for prod web | Rate limiting, security headers, compression — missing from static hosts |
| Discriminated union API responses | Type-safe error handling without exceptions |
| Platform-specific files (.native.ts) | Clean platform splits without runtime checks |

## Build & Deploy

- **Dev**: `npx expo start` (Metro dev server)
- **Web prod**: `expo export -p web` → Express serves `dist/`
- **Native**: EAS Build (configured in app.json)
- **CI**: GitHub Actions — typecheck → lint → test (Bun)
