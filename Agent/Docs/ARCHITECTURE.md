# Architecture

## Overview

**Expo SDK 55** | **React Native 0.83.2** | **React 19.2.0** | **TypeScript (strict)** | **Zustand 5** | **React Query 5**

Cross-platform mobile and web application built with Expo Router for file-based routing, Zustand for state management, React Query for server-state caching, AWS Amplify/Cognito for authentication, and Cloudflare R2 (S3-compatible) for media storage. Package manager is **bun**.

## Layer Stack

```
+------------------------------------------------------------------+
|  app/                                                            |
|  Expo Router file-based routing + API routes                     |
|  Screens, layouts, tabs, nested groups                           |
+------------------------------------------------------------------+
        |                           |
        v                           v
+----------------------------+  +----------------------------+
|  client/features/          |  |  app/api/                  |
|  Auth, Media, i18n,        |  |  Server-side API routes    |
|  Keyboard, Navigation,     |  |  (media CRUD, CORS)        |
|  Onboarding               |  +----------------------------+
+----------------------------+              |
        |                                   v
        v                         +----------------------------+
+----------------------------+   |  shared/                    |
|  client/ (shared layer)    |   |  Code shared between       |
|  components/ui, hooks,     |   |  client and server          |
|  lib, screens, state,      |   |  (media path constants)     |
|  config, constants         |   +----------------------------+
+----------------------------+
                                  +----------------------------+
                                  |  server/                    |
                                  |  Express production server  |
                                  |  (compression, CORS, rate   |
                                  |   limiting, security)       |
                                  +----------------------------+
```

Features import from the shared layer but never from other features. The shared layer provides UI components, hooks, utilities, and state stores. API routes run server-side via Expo Router and share types/constants with the client through `shared/`.

## Directory Structure

### `app/` -- Routing (Expo Router)

File-based routing with typed routes enabled. Async routes enabled for web.

```
app/
  _layout.tsx               Root layout (providers, splash, i18n init)
  +html.tsx                 Custom HTML shell for web
  api/
    _shared/cors.ts         Shared CORS utility
    media/
      getUploadUrl+api.ts   POST  Presigned upload URL
      delete+api.ts         DELETE single / POST batch delete
      list+api.ts           GET   Paginated listing
      getSignedUrls+api.ts  POST  Batch signed download URLs
  (main)/
    _layout.tsx             Main layout
    (tabs)/
      _layout.tsx           Tab bar layout
      index.tsx             Home tab
      media.tsx             Media tab
      profile.tsx           Profile tab
      settings.tsx          Settings tab
    (demos)/                Demo/showcase screens (18 files)
      auth-demo.tsx
      form-demo.tsx
      showcase/             Component showcase sub-routes
      screen-*.tsx          Screen template demos (13 screens)
```

Path alias: `@/*` maps to project root (`./`).

### `client/features/` -- 6 Feature Folders

Each feature is self-contained with its own components, hooks, stores, and lib.

| Feature | Contents | Purpose |
|---------|----------|---------|
| `auth/` | 7 components, 1 hook, 1 store, config | AWS Cognito authentication |
| `media/` | components, 6 hooks, 1 store, lib (imageCompression, videoConversion) | Upload, list, delete, compress media |
| `i18n/` | translations (en, es), 1 store | Internationalization via i18next |
| `keyboard/` | 3 components, platform shims | Keyboard handling (KeyboardProvider, StickyFooter) |
| `navigation/` | WebBackButton, backBehavior | Web back button + back behavior |
| `onboarding/` | OnboardingFlow component, 1 store | Onboarding flow |

### `client/` -- Shared Layer

| Directory | Count | Contents |
|-----------|-------|----------|
| `components/ui/` | 35 components | Design system primitives (Button, Card, Dialog, TextInput, Switch, Badge, BottomSheet, DropdownMenu, Select, Tabs, etc.) |
| `components/` | 2 extra | ErrorScreen, SEO |
| `hooks/` | 9 hooks | useTheme, useClipboard, useDebounce, useDimensions, useReduceMotion, useResources, useScalePress, useStaggeredEntrance, useToggle |
| `screens/` | 13 templates | CardGrid, Chat, Dashboard, DetailHero, Error, Form, List, NotificationList, Pricing, Profile, SearchResults, Settings, Welcome |
| `lib/api/` | 5 files | apiClient, authenticatedFetch, apiProblem, types, retry |
| `lib/form/` | 7 files | FormProvider, FormTextInput, FormSelect, FormCheckbox, FormSwitch, FormMessage, useFormField (react-hook-form + zod) |
| `lib/storage/` | 1 file | AsyncStorage wrapper (loadString, saveString, load, save, remove, clear, getAllKeys, loadMultiple) |
| `lib/devtools/` | -- | Reactotron setup (dev only) |
| `lib/gesture-handler/` | -- | Platform gesture setup |
| `lib/haptics.ts` | 1 file | Platform-aware haptic feedback (no-op on web) |
| `lib/sentry.ts` | 1 file | Sentry error tracking wrapper |
| `lib/validateEnv.ts` | 1 file | Client + server env var validation |
| `config/` | 3 files | config.base, config.dev, config.prod (merged at runtime via `__DEV__`) |
| `constants/` | 3 files | colors (zinc palette + semantic themes), fonts (typography scale), spacing (radius, padding tokens) |
| `state/` | 3 stores | themeStore, drawerStore, globalUIStore |
| `showcase/` | 4 files | Demo helpers (Section, SubSection, ThemeToggle) |

### `shared/` -- Client/Server Shared Code

- `media.ts` -- R2/S3 path constants (`MEDIA_PATHS`), media type helpers (`isVideoKey`, `isImageKey`, `getVideoThumbnailKey`)

### `server/` -- Production Express Server

- `index.ts` -- Express with compression, security headers, CORS, rate limiting (500 req/15min general, 10 req/min for uploads), Morgan logging, static file serving, Expo Router SSR handler, optional FFmpeg worker serving

## Provider Nesting Order

Defined in `app/_layout.tsx`:

```
QueryClientProvider (client)
  SafeAreaProvider
    ThemeProvider (@react-navigation/native)
      KeyboardProvider (keyboard feature)
        ErrorBoundary (Config.catchErrors)
          Stack (Expo Router)
        StatusBar
  Notification    (sibling to SafeAreaProvider -- renders outside safe area)
  PortalHost      (sibling to SafeAreaProvider -- @rn-primitives portal target)
```

The `Notification` and `PortalHost` are siblings to `SafeAreaProvider` but children of `QueryClientProvider`. This allows notifications and portals (dropdowns, dialogs) to render above all content.

## Data Flow

### Zustand Stores (7 total)

| Store | Location | Purpose | Persisted |
|-------|----------|---------|-----------|
| `useThemeStore` | `client/state/themeStore.ts` | Light/dark/system theme preference | Yes (AsyncStorage / localStorage) |
| `drawerStore` | `client/state/drawerStore.ts` | Multi-instance drawer open/close state | No |
| `globalUIStore` | `client/state/globalUIStore.ts` | Global notification/alert display | No |
| `useAuthStore` | `client/features/auth/stores/authStore.ts` | Auth state (loading/authenticated/unauthenticated), user data | No (derives from Cognito) |
| `useLanguageStore` | `client/features/i18n/stores/languageStore.ts` | User language preference | Yes (AsyncStorage / localStorage) |
| `useOnboardingStore` | `client/features/onboarding/onboardingStore.ts` | Onboarding completion flag | Yes (AsyncStorage / localStorage) |
| `useCompressionStore` | `client/features/media/stores/compressionStore.ts` | Image compression presets and settings | No |

Persisted stores use the same pattern: `Platform.OS !== "web"` chooses AsyncStorage (native) vs `localStorage` (web).

### React Query Configuration

Configured in `app/_layout.tsx`:

| Option | Value |
|--------|-------|
| `staleTime` | 5 minutes (`300,000ms`) |
| `gcTime` | 10 minutes (`600,000ms`) |
| `refetchOnWindowFocus` | `false` |
| Query retry | Up to 2 retries, skips 4xx client errors |
| Mutation retry | `false` (no retries) |

## Auth Flow

All in `client/features/auth/`.

1. **Lazy Amplify init** -- `ensureAmplifyConfigured()` initializes Amplify on first auth call, not at import time
2. **Hub listener** -- `initAuth()` sets up an Amplify Hub listener for auth events (`signedIn`, `signedOut`, `tokenRefresh`, `tokenRefresh_failure`, `signInWithRedirect`, etc.)
3. **2-second throttle** -- `authStore.initialize()` throttles re-initialization to prevent loops (checks `isInitializing` flag + `lastInitializeTime`)
4. **Auto sign-in** -- After signup confirmation, Hub event triggers `autoSignIn()` flow
5. **Token injection** -- `authenticatedFetch` calls `fetchAuthSession()` to get the current access token and injects it as a Bearer token
6. **Env vars** -- `EXPO_PUBLIC_USER_POOL_ID` and `EXPO_PUBLIC_USER_POOL_CLIENT_ID`

Auth state machine: `loading` -> `authenticated` | `unauthenticated`

## Media Flow

Client-side hooks in `client/features/media/hooks/` (6 hooks: useMediaUpload, useMediaList, useMediaDelete, useSignedUrls, useMediaLibrary, useVideoThumbnails).

Upload pipeline:

1. **Pick** -- `useMediaLibrary` uses `expo-image-picker` to select images/videos
2. **Compress** -- `imageCompression` lib with preset system (avatar, thumbnail, product, gallery, highQuality, none) using `expo-image-manipulator`
3. **Get presigned URL** -- POST to `/api/media/getUploadUrl` with extension + mediaType, receives presigned S3/R2 PUT URL (5-minute expiry)
4. **Upload to R2** -- Direct PUT to the presigned URL (bypasses server)
5. **Cache invalidation** -- React Query cache invalidated after upload

Shared path constants in `shared/media.ts`: `avatars`, `videos`, `thumbnails`, `uploads`.

## API Route Pattern

API routes live in `app/api/` using Expo Router convention (`+api.ts` suffix).

- **CORS** -- Shared utility in `app/api/_shared/cors.ts`. Validates request Origin against `ALLOWED_ORIGINS` env var (defaults to `localhost:8081`, `localhost:3000`). Echoes matching origin, omits CORS headers for same-origin/native requests. Always includes `Vary: Origin` to prevent cache poisoning.
- **Preflight** -- Every route exports an `OPTIONS` handler returning CORS headers + `Access-Control-Max-Age: 86400`
- **Error sanitization** -- `sanitizeErrorDetails()` returns full error messages in development, nothing in production
- **S3 Client** -- Each route creates its own `S3Client` instance pointed at R2 (`region: "auto"`, `forcePathStyle: true`)

Server env vars: `R2_JURISDICTION_SPECIFIC_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

## Key Architectural Decisions

### Feature Isolation
Features never import from other features -- only from the shared layer (`client/lib/`, `client/components/`, `client/hooks/`, `client/state/`). Internal imports use relative paths for portability. External consumers import via `@/client/features/<name>`.

### Two API Clients
1. **`apiClient`** (class-based singleton) -- Typed discriminated union responses (`ApiResult<T>`), exponential backoff retry, configurable timeout, manual token management. Use for general API calls.
2. **`authenticatedFetch`** (function) -- Amplify-aware, auto-injects Cognito tokens via `fetchAuthSession()`, 30s default timeout. Use for authenticated requests to your own backend.

### Platform-Aware Storage
Stores check `Platform.OS` at write/read time: AsyncStorage for native, `window.localStorage` for web. The `client/lib/storage/` module wraps AsyncStorage with typed helpers.

### @rn-primitives for Accessible UI
Uses `@rn-primitives/*` packages (14 packages) as accessible, unstyled primitives under the design system components. These provide cross-platform accessibility (aria attributes, keyboard navigation) on web and native.

### Reanimated for All Animations
Uses `react-native-reanimated` 4.2.1 for all animations. Metro config wraps with `wrapWithReanimatedMetroConfig`. Includes `react-native-worklets` 0.7.2.

### Lazy i18n
i18n initialization is async (`initI18n()`) and blocks splash screen until ready. Languages: English (`en`) and Spanish (`es`). Uses `i18next` + `react-i18next` + `expo-localization`. Type-safe keys via `TxKeyPath`.

### Form Library
`client/lib/form/` provides a `react-hook-form` + `zod` integration layer with pre-built form field components (FormTextInput, FormSelect, FormCheckbox, FormSwitch) and `FormProvider` wrapper.

## Cross-Platform Considerations

| Concern | Approach |
|---------|----------|
| **Web shadows** | `getShadowStyle()` returns empty object on web (boxShadow causes RN Web crashes). Native uses subtle shadows (opacity 0.05-0.15). |
| **Style arrays** | DropdownMenu items and `@rn-primitives` components must use `StyleSheet.flatten()`, never raw style arrays (nested arrays crash RN Web). |
| **Keyboard** | `client/features/keyboard/` with platform shims. Uses `react-native-keyboard-controller` on native, no-op provider on web. |
| **Gestures** | `react-native-gesture-handler` imported at app entry (`client/lib/gesture-handler/`). Platform-specific setup. |
| **Storage** | `Platform.OS` check: AsyncStorage (native) vs localStorage (web) in every persisted store. |
| **Haptics** | `client/lib/haptics.ts` wraps `expo-haptics` with `Platform.OS === "web"` guard. No-op on web, lazy-requires on native. |
| **HEIC** | `heic2any` package for web-side HEIC-to-JPEG conversion. |

## Error Tracking (Sentry)

`client/lib/sentry.ts` wraps `@sentry/react-native`. Called at app startup in `_layout.tsx`.

- **Zero-impact without DSN** -- If `EXPO_PUBLIC_SENTRY_DSN` is not set, `setupSentry()` is a no-op (no network requests, no global handlers)
- **Configuration** -- `tracesSampleRate: 1.0` in dev, `0.2` in production
- **Environment** -- `"development"` when `__DEV__`, otherwise `"production"`

## CI/CD (GitHub Actions)

Single workflow in `.github/workflows/ci.yml`:

| Step | Command |
|------|---------|
| Trigger | Push or PR to `main` or `dev` |
| Runner | `ubuntu-latest`, 15-minute timeout |
| Install | `bun install --frozen-lockfile` |
| Type check | `bun run typecheck` (`tsc --noEmit`) |
| Lint | `bun run lint` (`expo lint`) |
| Test | `bun run test:ci` (`jest --ci --coverage --forceExit`) |

Concurrency group cancels in-progress runs for the same branch.

## Environment Variables

### Client (EXPO_PUBLIC_*)

| Variable | Required | Context |
|----------|----------|---------|
| `EXPO_PUBLIC_USER_POOL_ID` | Yes | Auth (Cognito) |
| `EXPO_PUBLIC_USER_POOL_CLIENT_ID` | Yes | Auth (Cognito) |
| `EXPO_PUBLIC_API_URL` | Yes | API base URL |
| `EXPO_PUBLIC_SENTRY_DSN` | No | Sentry error tracking |

### Server

| Variable | Required | Context |
|----------|----------|---------|
| `R2_JURISDICTION_SPECIFIC_URL` | Yes | Cloudflare R2 endpoint |
| `R2_ACCESS_KEY_ID` | Yes | R2 credentials |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 credentials |
| `R2_BUCKET` | Yes | R2 bucket name |
| `ALLOWED_ORIGINS` | No | CORS (defaults: localhost:8081, localhost:3000) |
| `PORT` | No | Express port (default: 3000) |

Validation runs at startup via `validateClientEnv()` (warns in dev, throws in prod).
