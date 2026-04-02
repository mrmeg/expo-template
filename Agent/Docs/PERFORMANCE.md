# Performance

<!-- Owned by: Performance Expert persona -->

## React Query Configuration

Global QueryClient settings in `app/_layout.tsx`:

| Setting | Value | Rationale |
|---------|-------|-----------|
| staleTime | 5 minutes (`1000 * 60 * 5`) | Prevents unnecessary refetches for data that changes infrequently |
| gcTime | 10 minutes (`1000 * 60 * 10`) | Keeps inactive query data in cache for quick revisits |
| refetchOnWindowFocus | `false` | Avoids surprise refetches when tabbing back; data freshness managed by staleTime |
| retry (queries) | Smart function | Skips retry for 4xx client errors (no point retrying bad requests); retries up to 2 times for server errors and transient failures |
| retry (mutations) | `false` | Mutations are never retried automatically to avoid duplicate side effects |

```ts
retry: (failureCount, error) => {
  // Don't retry 4xx errors (client errors)
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status;
    if (status >= 400 && status < 500) return false;
  }
  return failureCount < 2;
},
```

## API Client (`client/lib/api/apiClient.ts`)

The typed API client (`api` singleton) provides discriminated-union responses and built-in retry:

| Setting | Value | Source |
|---------|-------|--------|
| Default timeout | 10 seconds | `Config.apiTimeout` in `config.base.ts` (`apiTimeout: 10000`) |
| Retry backoff | Exponential with jitter, capped at 30 seconds | `client/lib/api/retry.ts` |
| GET default retries | 2 | `api.get()` passes `{ retry: 2 }` by default |
| POST/PUT/PATCH/DELETE retries | 0 | No retry by default; callers can opt in via `options.retry` |
| Retry base delay | 1000ms | `options.retryDelay ?? 1000` |
| Retry eligibility | Only temporary failures | Non-temporary errors (4xx) break the retry loop immediately |

### Backoff Formula

```ts
function calculateBackoff(attempt: number, baseDelay: number = 1000): number {
  const exponential = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelay * 0.5;
  return Math.min(exponential + jitter, 30000); // 30s cap
}
```

For 2 retries with default base delay: attempt 0 = ~1000-1500ms, attempt 1 = ~2000-2500ms.

## Authenticated Fetch (`client/lib/api/authenticatedFetch.ts`)

The Amplify-aware fetch wrapper for authenticated requests:

| Setting | Value | Notes |
|---------|-------|-------|
| Default timeout | 30 seconds | `options.timeout ?? 30000` |
| Auth token | Injected from `fetchAuthSession()` | Auto-retrieves current Cognito access token |
| Timeout mechanism | AbortController | Ignored when caller provides their own `signal` |
| 401 handling | Throws `Error("Unauthorized")` | Caller is responsible for redirecting to sign-in |

## Font Loading

Fonts loaded in `client/hooks/useResources.ts`:

| Setting | Value |
|---------|-------|
| Timeout | 5 seconds |
| Fonts loaded | Lato_400Regular, Lato_700Bold, Feather icons |
| Fallback behavior | Proceeds with system fonts on timeout or error |
| Loading source | Local files from `assets/fonts/` (bundled, no network request) |

The splash screen stays visible until both fonts and i18n initialization complete. If font loading times out, the app still renders (with system fallback fonts) rather than hanging.

## Metro Configuration

Settings in `metro.config.js`:

### Transform Optimizations

```js
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: true,
    inlineRequires: true,
  },
});
```

- **inlineRequires**: Defers `require()` calls until first use, reducing startup time by not evaluating unused modules upfront.
- **experimentalImportSupport**: Enables tree-shaking-friendly import resolution.

### Reanimated Wrapper

The final config export wraps everything with `wrapWithReanimatedMetroConfig(config)` from `react-native-reanimated/metro-config`, which configures the Reanimated Babel plugin for worklet compilation.

### @react-navigation Deduplication

Bun's hoisting can create duplicate `@react-navigation/native` and `@react-navigation/core` packages (one hoisted, one nested inside expo-router). The custom `resolveRequest` override forces all imports of these packages to resolve to the root `node_modules` copy, preventing React context mismatches.

### FFmpeg Worker (Optional)

A custom middleware serves `ffmpeg-worker.js` for web-based video conversion. This is optional and can be removed along with `client/lib/videoConversion/`.

## App Configuration

Settings from `app.json` and `app.config`:

| Setting | Value | Impact |
|---------|-------|--------|
| `newArchEnabled` | `true` | Enables React Native New Architecture (Fabric renderer, TurboModules) |
| `asyncRoutes.web` | `true` | Code-splits route components on web for smaller initial bundle |
| `typedRoutes` | `true` | Build-time route validation (no runtime cost) |
| `web.output` | `"server"` | Server-side rendering support via Metro bundler |
| `web.bundler` | `"metro"` | Uses Metro for web builds (shared config with native) |

## Animation

### Reanimated as Default

All animations use `react-native-reanimated` for worklet-thread execution, keeping the JS thread free. The single exception is the `Skeleton` component's indeterminate shimmer, which uses React Native's built-in `Animated` API (adequate for a simple looping opacity animation and avoids a Reanimated dependency for a lightweight component).

### useReducedMotion

The `useReducedMotion` hook (`client/hooks/useReduceMotion.tsx`) respects the user's OS-level motion preferences:

- **Native**: Reads `AccessibilityInfo.isReduceMotionEnabled()` and listens for changes.
- **Web**: Uses `prefers-reduced-motion: reduce` media query.
- **Shared singleton**: Multiple hook consumers share a single OS listener to avoid duplicate subscriptions.
- **Polling**: Lightweight 500ms interval checks a shared boolean to propagate changes across components.

Components should check `useReducedMotion()` and skip or simplify animations when it returns `true`.

## Bundle Analysis

Two scripts for monitoring bundle size:

### `bun run analyze`

Runs a full web export with source maps and opens `source-map-explorer` for interactive visualization:

```bash
expo export -p web --output-dir dist --dump-sourcemap && npx source-map-explorer dist/**/*.js --no-border-checks
```

Use this to identify which dependencies contribute most to bundle weight.

### `bun run bundle-size`

CI-friendly budget check (`scripts/check-bundle-size.js`):

| Setting | Value |
|---------|-------|
| Growth threshold | 10% over baseline |
| Baseline file | `scripts/bundle-baseline.json` |
| Update baseline | `bun run bundle-size --update` |
| Exit code | 1 if budget exceeded, 0 if within budget |

Workflow: establish a baseline after intentional changes (`--update`), then run `bun run bundle-size` in CI to catch regressions.

## Known Considerations

### Component Surface Area

- **35 UI components** in `client/components/ui/` loaded at app level.
- **13 screen templates** in `client/screens/` available for the showcase.
- **18 @rn-primitives packages** in dependencies (accordion, alert-dialog, checkbox, collapsible, dialog, dropdown-menu, label, popover, portal, radio-group, select, separator, slot, switch, tabs, toggle, toggle-group, tooltip). These provide accessible, unstyled primitives but add to the dependency graph.

### Zustand Stores (7 total)

Feature stores: `authStore`, `languageStore`, `globalUIStore`, `onboardingStore`, `compressionStore`.
Shared stores: `themeStore`, `drawerStore`.

Best practices:
- Use selectors to subscribe to specific slices (`useAuthStore(s => s.state)`) rather than the full store.
- Stores persist to AsyncStorage (native) or localStorage (web) with `Platform.OS` checks.

### Sentry

- Initialized once at startup in `_layout.tsx` via `setupSentry()`.
- No-op when `EXPO_PUBLIC_SENTRY_DSN` is not set (no network requests, no global handlers).
- Production traces sampled at 20% (`tracesSampleRate: 0.2`), development at 100%.
- ErrorBoundary reports caught errors to Sentry with component stack context.

## Web-Specific Performance

### getShadowStyle Returns Empty on Web

The `useTheme().getShadowStyle()` helper returns an empty object `{}` on web. React Native Web has known crashes with `boxShadow` in certain style combinations. All shadow effects are native-only.

### StyleSheet.flatten Required for Primitives

`@rn-primitives` components crash on React Native Web when passed style arrays. Always flatten:

```tsx
// Crashes on web
<DropdownMenuItem style={[styles.item, { color: theme.primary }]} />

// Safe
<DropdownMenuItem style={StyleSheet.flatten([styles.item, { color: theme.primary }])} />
```

### Async Routes

With `asyncRoutes.web: true`, each route screen is code-split into a separate chunk on web. This means the initial page load only downloads the code for the landing route, with other screens loaded on-demand during navigation.

## Test Performance

| Setting | Value | Source |
|---------|-------|--------|
| Test timeout | 10,000ms | Jest global config |
| Preset | `jest-expo` | Handles platform-specific module resolution |
| Coverage target | `client/**` | Excludes devtools, test files, index re-exports |
