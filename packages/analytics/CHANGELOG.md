# Changelog

All notable changes to `@mrmeg/expo-analytics` are documented here. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] (unreleased)

First release: self-hosted, first-party analytics for Expo and web apps, stored
in the host's own Postgres.

### Added

- Trackers: `createTracker` (`@mrmeg/expo-analytics`, transport and storage
  injected), `createWebTracker` (`/web`: cookieless by default, `persist` for a
  localStorage id and idle sessions, automatic pageviews from the History API,
  landing-URL acquisition, unload flush by beacon) and `createNativeTracker`
  (`/native`: injected AsyncStorage-compatible storage, `AppState` sessions).
  Typed event maps, batching, retries with backoff, `setEnabled` consent,
  `reset` on sign-out.
- `createAnalyticsServer` (`/server`): `POST <basePath>/e` ingest with
  server-side user resolution (`resolveUserId`), cookieless visitor ids from a
  daily-rotated salt, sessions maintained at ingest, bot filtering, and an
  origin check; `track`, `identify` (with `createdAt` backfill and `excluded`),
  `recordRevenueEvents`, tracked links (`/go/:channel`), and `prune`.
- Mounting: `handle(request)` for Fetch runtimes (Expo Router API routes,
  Next.js, Bun) and `toNodeHandler` for Express and `node:http`.
- Seven tables installed by `install()` or `expo-analytics install`, in the
  connection's schema with a prefix (default) or a dedicated schema; `status()`,
  and `uninstall()` that drops exactly those tables. No foreign keys to host
  tables. `fromPostgresJs` and `fromPg` adapters; the package ships no driver.
- Reports: overview, product (active users, new users, activation), retention
  (three modes, daily cohorts, weekly grid), funnels, acquisition by channel,
  web traffic, and revenue (MRR, movements, trial conversion, churn, totals),
  as `server.metrics.*`, an admin-only JSON and CSV query API, and a built-in
  dashboard closed until `isAdmin` is supplied.
- `/metrics`: the report types, the pure functions behind every figure,
  `resolveDateRange`, `toCsv`, and display formatting.
