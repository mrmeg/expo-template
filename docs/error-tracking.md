# Error Tracking (Sentry)

## Quick Setup

1. Create a project at [sentry.io](https://sentry.io)
2. Copy your DSN
3. Add to `.env`:
   ```
   EXPO_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/123
   ```
4. Restart the dev server

That's it. The app automatically initializes Sentry when the DSN is present and does nothing when it's empty.

## How It Works

- `client/lib/sentry.ts` calls `Sentry.init()` at startup if DSN is set
- `ErrorBoundary.componentDidCatch` sends caught errors to Sentry with component stack
- In development: `debug: true`, `tracesSampleRate: 1.0`
- In production: `debug: false`, `tracesSampleRate: 0.2`

## Source Maps (Production)

For readable stack traces in production, upload source maps after building:

```bash
# Build with source maps
bun run build-sourcemap

# Upload to Sentry
npx sentry-cli sourcemaps upload \
  --org YOUR_ORG \
  --project YOUR_PROJECT \
  --auth-token YOUR_AUTH_TOKEN \
  dist/
```

## EAS Build Integration

For native builds, add the Sentry Expo plugin to `app.json`:

```json
{
  "expo": {
    "plugins": [
      ["@sentry/react-native/expo", {
        "organization": "YOUR_ORG",
        "project": "YOUR_PROJECT"
      }]
    ]
  }
}
```

This automatically uploads native source maps during EAS builds. Requires `SENTRY_AUTH_TOKEN` in EAS secrets.

## Disabling Sentry

Remove or leave empty the `EXPO_PUBLIC_SENTRY_DSN` env var. The integration is completely inert when no DSN is configured — no network requests, no global handlers.
