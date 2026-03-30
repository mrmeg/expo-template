# Spec: Error Tracking Integration

**Status:** Draft
**Priority:** Medium
**Scope:** Client

---

## What

Integrate `@sentry/react-native` as the error tracking service. Wire it into the existing `ErrorBoundary.componentDidCatch`, add `Sentry.init()` to app startup, include navigation breadcrumbs, and document source map upload for production builds.

## Why

The app currently logs errors to `console.error` in development and does nothing in production. Unhandled exceptions, component crashes, and JS errors in production are invisible. Without error tracking, bugs that only appear on user devices go undetected until users complain (or leave). Sentry provides crash reports, breadcrumbs, and release health metrics that close this gap.

## Current State

- `client/components/ui/ErrorBoundary.tsx` has a `componentDidCatch` method that logs to `console.error` in `__DEV__` and includes a comment placeholder: `// Here you could send to an error tracking service like Sentry`.
- `app/_layout.tsx` initializes the app with providers, splash screen, i18n, and font loading. No error tracking initialization exists.
- `client/config/config.base.ts` defines `ConfigBaseProps` with `catchErrors` and `apiUrl` but has no Sentry DSN or error tracking configuration.
- `package.json` has `build-sourcemap` (`npx expo export --dump-sourcemap`) and `view-sourcemap` scripts already present, but no Sentry CLI or source map upload step.
- No `sentry.properties`, `Sentry.init()`, or `@sentry/react-native` dependency exists anywhere in the project.

## Changes

### 1. Install `@sentry/react-native`

```bash
bun add @sentry/react-native
```

This package provides React Native-specific integrations including native crash reporting, navigation breadcrumbs, and source map support.

### 2. Add Sentry configuration to app config

**File:** `client/config/config.base.ts`

Add a `sentryDsn` field to `ConfigBaseProps`:

```ts
sentryDsn: string;
```

Set it to an empty string in `BaseConfig` (requires an env var or manual config to activate). Add `EXPO_PUBLIC_SENTRY_DSN` as the expected environment variable.

**File:** `client/config/config.dev.ts`

Override with a dev-specific DSN (empty string by default, users fill in their own):

```ts
sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? "",
```

**File:** `client/config/config.prod.ts`

Same pattern:

```ts
sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? "",
```

### 3. Create Sentry initialization module

**New file:** `client/lib/sentry.ts`

- Export a `setupSentry()` function that calls `Sentry.init()` with:
  - `dsn` from `Config.sentryDsn`
  - `enabled: !!Config.sentryDsn` (no-op if DSN is empty)
  - `debug: __DEV__`
  - `tracesSampleRate: 0.2` in production, `1.0` in dev
  - `environment: __DEV__ ? "development" : "production"`
- Export `Sentry` re-export for use elsewhere.
- Guard: if DSN is empty, `setupSentry()` should be a no-op that logs a warning in dev.

### 4. Initialize Sentry in root layout

**File:** `app/_layout.tsx`

- Import `setupSentry` from `@/client/lib/sentry`.
- Call `setupSentry()` at module scope (before component definition), after gesture handler and Reactotron imports. Sentry must initialize before any errors can be caught.
- Wrap the default export with `Sentry.wrap()` if the DSN is configured (this enables automatic error boundary and performance monitoring from Sentry).

### 5. Wire ErrorBoundary to Sentry

**File:** `client/components/ui/ErrorBoundary.tsx`

- Import `Sentry` from `@/client/lib/sentry`.
- In `componentDidCatch`, replace the placeholder comment with:

```ts
Sentry.captureException(error, {
  contexts: {
    react: {
      componentStack: errorInfo?.componentStack,
    },
  },
});
```

- Keep the existing `__DEV__` console logging alongside the Sentry call.

### 6. Add navigation breadcrumbs

**File:** `app/_layout.tsx`

- Import `useNavigationContainerRef` from `expo-router` if available, or use Expo Router's built-in navigation state.
- Add `Sentry.reactNavigationIntegration` to the Sentry init integrations array.
- Register the navigation container ref with the integration in the root layout component via a `useEffect`.

### 7. Document source map upload

**New file:** `docs/error-tracking.md` (project root `docs/`, not Agent docs)

Document:
- How to set `EXPO_PUBLIC_SENTRY_DSN` in `.env`
- How to upload source maps using `npx sentry-cli sourcemaps upload` after running `npm run build-sourcemap`
- EAS Build integration: adding `@sentry/react-native/expo` plugin to `app.json` for automatic native source map upload
- Note that source map upload is optional for dev and required for readable production stack traces

### 8. Update Agent docs

**File:** `Agent/Docs/ARCHITECTURE.md`

Add a section on error tracking describing the Sentry integration, the no-op behavior when DSN is empty, and the ErrorBoundary wiring.

## Acceptance Criteria

1. `Sentry.init()` is called at app startup when `EXPO_PUBLIC_SENTRY_DSN` is set.
2. When DSN is empty (default), no Sentry code executes at runtime and no errors are thrown.
3. `ErrorBoundary.componentDidCatch` sends exceptions to Sentry with component stack context.
4. Navigation events appear as breadcrumbs in Sentry event payloads.
5. The app starts and runs identically to before when no DSN is configured (zero behavioral change for existing users).
6. A `docs/error-tracking.md` file documents setup, source map upload, and EAS Build integration.
7. TypeScript compiles with no new errors.
8. All existing tests pass.

## Constraints

- The integration must be zero-impact when no DSN is configured. Template users who don't want Sentry should notice no difference.
- Do not add `@sentry/react-native/expo` to `app.json` plugins by default -- document it as an opt-in step. Adding it without Sentry configured could break EAS builds.
- Do not modify the `ErrorBoundary` component's public API (props, state shape, render behavior).
- Keep `client/lib/sentry.ts` as a thin wrapper. Do not add business logic there.

## Out of Scope

- Performance monitoring / transaction tracing beyond the default sample rate
- Custom Sentry tags per feature (can be added later per-feature)
- Server-side error tracking (Express server)
- Sentry release management / deploy tracking
- Alerts and notification rules (configured in Sentry dashboard, not in code)
- Native crash symbolication setup (platform-specific, documented only)

## Files Likely Affected

**Client:**
- `client/config/config.base.ts` (add `sentryDsn` to interface and defaults)
- `client/config/config.dev.ts` (add `sentryDsn` override)
- `client/config/config.prod.ts` (add `sentryDsn` override)
- `client/lib/sentry.ts` (new -- Sentry init wrapper)
- `client/components/ui/ErrorBoundary.tsx` (wire `componentDidCatch` to Sentry)
- `app/_layout.tsx` (call `setupSentry()`, add navigation breadcrumbs)

**Docs:**
- `docs/error-tracking.md` (new -- setup and source map docs)
- `Agent/Docs/ARCHITECTURE.md` (update with error tracking section)

## Edge Cases

- **Empty DSN:** `setupSentry()` should be a complete no-op. No network requests, no global handlers installed, no console warnings in production (warn only in dev).
- **Invalid DSN:** Sentry SDK handles this gracefully (logs a warning, disables itself). No special handling needed.
- **ErrorBoundary with `catchErrors: "never"`:** `componentDidCatch` is never called by React in this mode since `getDerivedStateFromError` returns the error but `render()` returns children. Sentry's global handler will still catch unhandled errors independently.
- **Web platform:** `@sentry/react-native` works on React Native Web. Verify no web-specific crashes from the SDK initialization.
- **Multiple `Sentry.init()` calls:** Guard against double initialization if root layout re-mounts (use a module-level `initialized` flag).

## Risks

- **Bundle size increase:** `@sentry/react-native` adds approximately 200-300KB to the JS bundle. This is acceptable for the functionality provided but should be noted in docs.
- **Expo compatibility:** `@sentry/react-native` has an official Expo plugin and is well-supported. Low risk, but verify against Expo SDK 55 specifically.
- **Navigation integration:** Expo Router's navigation ref access may differ from vanilla React Navigation. Test that `useNavigationContainerRef` from `expo-router` works with Sentry's integration. If it does not, fall back to manual breadcrumb logging.
