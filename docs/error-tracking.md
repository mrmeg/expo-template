# Error Tracking (Sentry)

## Quick Setup

1. Create a project at [sentry.io](https://sentry.io)
2. Copy your DSN
3. Add to `.env`:
   ```
   EXPO_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/123
   ```
4. Restart the dev server

That's it for runtime error reporting. The app initializes Sentry when the DSN
is present and does nothing when it's empty.

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

## Native Upload Integration

Native debug-symbol and source-map upload is intentionally separate from the
runtime DSN so the template still builds before Sentry is set up.

Set all three private values in your local shell or EAS secrets before running
`expo prebuild` / native builds:

```bash
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

When all three are present, `app.config.ts` registers the Sentry native config
plugin. When any value is missing, generated native projects do not get Sentry
upload steps, so local builds skip upload instead of failing before Sentry is
set up.

## Disabling Sentry

Remove or leave empty the Sentry env vars. With no
`EXPO_PUBLIC_SENTRY_DSN`, runtime tracking is inert. With any of
`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, or `SENTRY_PROJECT` missing, native upload
steps are skipped.
