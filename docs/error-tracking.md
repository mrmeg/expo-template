# Error Tracking (Sentry)

## Runtime Setup

1. Create a project at [sentry.io](https://sentry.io) and copy the DSN.
2. Add to `.env`: `EXPO_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/123`
3. Restart the dev server.

Sentry initializes only when the DSN is set; an empty DSN is a no-op.

| | Native | Web |
|---|---|---|
| Module | `client/lib/sentry.ts` | `client/lib/sentry.web.ts` |
| SDK | `@sentry/react-native` | `@sentry/react` — keep pinned to the version `@sentry/react-native` depends on, so both platforms report through one release |
| Load | lazy `import()`, so the SDK never sits in the eager bundle | lazy `import()` deferred to `requestIdleCallback` (3 s cap) after hydration |
| Extra | — | errors thrown before `init` are buffered from the global `error` / `unhandledrejection` handlers (max 20) and forwarded after `init`; `browserTracingIntegration()` must be passed explicitly or `tracesSampleRate` is inert in the browser SDK |

`captureException` forces the load immediately on both platforms. The server render
has no `window`, so the web module is inert there. Both use `debug: __DEV__` and
`tracesSampleRate` 1.0 in development, 0.2 in production.

`packages/ui` does not depend on Sentry. `RootLayout` passes `onError` to
`ErrorBoundary`, forwarding caught errors to `captureException` with the React
`componentStack` under `contexts.react`.

## Source Maps (Production)

```bash
bun run build-sourcemap

npx sentry-cli sourcemaps upload \
  --org YOUR_ORG \
  --project YOUR_PROJECT \
  --auth-token YOUR_AUTH_TOKEN \
  dist/
```

## Native Upload Integration

Native debug-symbol and source-map upload is gated separately from the runtime DSN,
so the template still builds before Sentry is set up. Set all three in your local
shell or EAS secrets before `expo prebuild` / native builds:

```bash
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

With all three present, `app.config.ts` registers both config plugins —
`@sentry/react-native` and `@sentry/react-native/expo` (passed `organization` and
`project`) — wiring sentry-cli into the iOS and Android build phases. If any is
missing, neither plugin is registered and native builds skip Sentry upload entirely
instead of invoking sentry-cli without credentials.

## Disabling Sentry

- No `EXPO_PUBLIC_SENTRY_DSN` → runtime tracking is inert.
- Any of `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` missing → both
  config plugins are skipped and native builds run with no sentry-cli steps.
