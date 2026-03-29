# Architecture

> System design, data flow, and key decisions for the Expo template.

---

## High-Level Overview

A cross-platform (iOS, Android, Web) mobile-first application built with Expo SDK 55, React Native 0.83, and React 19. The app follows a **feature-folder architecture** with strict dependency boundaries: features are self-contained and only import from the shared layer.

```
┌─────────────────────────────────────────────────┐
│                    app/                          │
│  Expo Router (file-based routing, typed routes)  │
│  Layouts → Tabs → Screens                        │
├─────────────────────────────────────────────────┤
│              client/features/                    │
│  auth │ media │ i18n │ notifications │ keyboard  │
│  onboarding │ navigation                         │
├─────────────────────────────────────────────────┤
│              client/ (shared layer)              │
│  components/ui │ hooks │ lib │ constants │ state │
├─────────────────────────────────────────────────┤
│                   shared/                        │
│  Code shared between client and server           │
├─────────────────────────────────────────────────┤
│            app/api/ (API Routes)                 │
│  Expo Router serverless endpoints                │
├─────────────────────────────────────────────────┤
│              server/ (Production)                │
│  Express server for web deployment               │
└─────────────────────────────────────────────────┘
```

## Directory Structure

### `app/` — Routing Layer
File-based routing via Expo Router. Typed routes enabled. Async routes on web.

- `_layout.tsx` — Root layout, provider nesting (see Provider Order below)
- `+html.tsx` — Web-only HTML config, global CSS, theme handling
- `(main)/` — Main app group (Stack navigator)
  - `(tabs)/` — Bottom tab navigator (4 tabs: Explore, Media, Profile, Settings)
  - `(demos)/` — Demo/showcase screens (11 screens)
- `api/media/` — Serverless API routes (list, upload, download, delete)

### `client/features/` — Feature Folders (7 features)
Each feature is portable and self-contained. Features never import from other features — only from the shared layer.

| Feature | Purpose | Key Files |
|---------|---------|-----------|
| `auth/` | AWS Cognito authentication | store, hook, 7 components, config |
| `media/` | Upload/list/delete/compress media | 6 hooks, store, VideoPlayer, compression lib |
| `i18n/` | Internationalization | store, translations (en/es), translate helper |
| `notifications/` | Global toast/banner notifications | store (globalUIStore), Notification component |
| `onboarding/` | Onboarding carousel flow | store, OnboardingFlow component |
| `keyboard/` | Cross-platform keyboard handling | provider, components, platform shims |
| `navigation/` | Web back button + history handling | WebBackButton, backBehavior |

### `client/` — Shared Layer
- `components/ui/` — 35+ design system primitives (including Dialog, AlertDialog, Tabs, Select, RadioGroup, Progress, Slider, InputOTP)
- `hooks/` — Shared hooks (useTheme, useStyles, useScalePress, useStaggeredEntrance, useDimensions, useReduceMotion, useResources, useDebounce, useClipboard, useToggle)
- `lib/` — Utilities (api/, storage/, haptics, gesture-handler, devtools)
- `constants/` — Design tokens (colors, fonts, spacing)
- `state/` — Shared stores (themeStore, drawerStore)
- `screens/` — 12 pre-built screen templates (Detail, Welcome, Pricing, Profile, Settings, List, Error, Form, SearchResults, CardGrid, NotificationList, Chat, Dashboard)
- `lib/form/` — Form system (react-hook-form + zod adapters: FormTextInput, FormCheckbox, FormSwitch, FormSelect)
- `showcase/` — Demo/showcase helpers
- `config/` — App config (base, dev, prod — merges via `__DEV__`)

### `shared/` — Client/Server Shared Code
- `media.ts` — R2/S3 path constants (MEDIA_PATHS) and file type helpers

### `server/` — Production Web Server
- `index.ts` — Express 5 with compression, CORS, rate limiting, static serving, Morgan logging

## Data Flow

### State Management

```
Zustand Stores (client state)
├── Feature stores (persist to AsyncStorage/localStorage)
│   ├── authStore — Auth state (loading | authenticated | unauthenticated)
│   ├── languageStore — i18n language preference
│   ├── globalUIStore — Notification state (ephemeral)
│   ├── onboardingStore — Completion tracking
│   └── compressionStore — Image compression presets
└── Shared stores
    ├── themeStore — Light/dark/system preference
    └── drawerStore — Multi-drawer open/close state

React Query (server state)
├── Media list queries (with pagination)
├── Signed URL queries (with caching)
└── Mutations (upload, delete) with cache invalidation
```

### Auth Flow

```
App Launch → initAuth() → fetchAuthSession()
  ├── Token exists → authenticated
  ├── No token → unauthenticated
  └── Hub listener watches for:
      ├── signedIn → update store
      ├── signedOut → clear store
      ├── tokenRefresh → re-fetch session
      └── confirmSignUp → auto sign-in
```

2-second throttle prevents initialization loops. Tokens auto-injected via `authenticatedFetch`.

### Media Upload Flow

```
User picks file → Process (compress, EXIF, thumbnails)
  → POST /api/media/getUploadUrl (get presigned URL)
  → PUT to R2/S3 via presigned URL
  → Invalidate media-list query cache
  → POST /api/media/getSignedUrls (for display)
```

### API Route Pattern

All API routes in `app/api/` implement CORS + OPTIONS preflight. They use AWS SDK v3 for S3/R2 operations. Presigned URLs expire in 5 minutes (upload) or 24 hours (download).

## Provider Nesting Order

Critical — changing this order can break the app:

```
QueryClientProvider
  └─ SafeAreaProvider
       └─ ThemeProvider (React Navigation)
            └─ KeyboardProvider
                 ├─ ErrorBoundary → Stack
                 └─ StatusBar
  ├─ Notification (sibling to SafeAreaProvider)
  └─ PortalHost (sibling to SafeAreaProvider)
```

## Key Architectural Decisions

1. **Feature folder isolation** — Features cannot import from other features. This makes features copy-portable across projects. Exception: media imports `globalUIStore` from notifications.

2. **Two API clients** — `apiClient.ts` (typed discriminated union responses) for general use; `authenticatedFetch.ts` (Amplify-aware) for authenticated endpoints. Both in `client/lib/api/`.

3. **Platform-aware storage abstraction** — All stores check `Platform.OS` at runtime: AsyncStorage for native, localStorage for web.

4. **Serverless API routes** — Media operations use Expo Router API routes (`+api.ts` convention), which run as serverless functions in production.

5. **Express for production web** — Static asset serving with rate limiting, compression, and optional SSR via Expo request handler.

6. **@rn-primitives for UI** — Accessible, unstyled primitives (dropdown, switch, toggle, etc.) styled in-house for consistent cross-platform behavior.

7. **Reanimated for all animations** — Spring/timing animations with reduced motion support. No Animated API usage.

8. **Lazy i18n loading** — English always bundled; other locales loaded on demand.

## Cross-Platform Considerations

- **Web shadows**: `getShadowStyle()` returns empty object on web (boxShadow crashes RN Web)
- **Style arrays**: `@rn-primitives` components crash on nested style arrays on web — always use `StyleSheet.flatten()`
- **Keyboard**: Native uses react-native-keyboard-controller; web uses passthrough components
- **Gestures**: Platform-specific setup via `client/lib/gesture-handler/`
- **Storage**: Runtime `Platform.OS` check for AsyncStorage vs localStorage
- **Haptics**: No-op on web; safe try-catch on native
