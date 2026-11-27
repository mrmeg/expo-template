# LLM Usage: @mrmeg/expo-analytics

## Imports

| Subpath | Contents |
|---|---|
| `@mrmeg/expo-analytics` | `createTracker` (core; transport and storage injected), `EVENT_NAME_PATTERN`, `LIMITS`, `RESERVED_EVENTS`, wire types |
| `/web` | `createWebTracker` (browsers) |
| `/native` | `createNativeTracker` (React Native; the only entry that imports `react-native`) |
| `/metrics` | report types, pure metric functions, `resolveDateRange`, `toCsv`, `formatRateCell` / `formatCents` / `formatCount` / `formatDuration` |
| `/server` | `createAnalyticsServer`, `toNodeHandler`, `fromPostgresJs`, `fromPg`, `install`, `uninstall`, `status`, `resolveNames`, report functions |

`/server` needs Node or Bun (`node:crypto`, `Buffer`): never import it into an
app bundle. The package ships no Postgres driver; the host passes its own
`postgres` or `pg` client through an adapter. `react-native` is the only peer,
optional, used by `/native` alone.

## Setup in four steps

1. Server object, once, in server code:

```ts
import { createAnalyticsServer, fromPostgresJs } from "@mrmeg/expo-analytics/server";
import postgres from "postgres";

export const analytics = createAnalyticsServer({
  sql: fromPostgresJs(postgres(process.env.DATABASE_URL!)),   // or fromPg(new Pool(...))
  appId: "my-app",
  resolveUserId: async (request) => (await verifySession(request))?.userId ?? null,
  isAdmin: async (request) => (await verifySession(request))?.role === "admin",
  metrics: { timezone: "UTC", activation: { event: "first_project_created", withinDays: 7 } },
});
```

2. Tables: `await analytics.install()` on boot (idempotent, advisory-locked,
   applies pending migrations), or `npx expo-analytics install` in a deploy
   step. Default placement: tables `analytics_*` in the connection's
   `search_path`; `schema: "analytics"` for a dedicated schema. `uninstall()`
   drops exactly the seven tables; nothing references host tables.

3. Mount under `basePath` (default `/analytics`). `handle(request)` returns a
   `Response` or `null` for paths outside it:
   - Express: `app.use(toNodeHandler(analytics))`.
   - Expo Router: `app/analytics/[...path]+api.ts` exporting `GET`, `HEAD`,
     `POST`, `OPTIONS`, plus `app/analytics/index+api.ts` exporting `GET` for
     the dashboard at `/analytics`; each calls
     `(await analytics.handle(request)) ?? new Response("Not found", { status: 404 })`.
   - Next.js: `app/analytics/[[...path]]/route.ts` with `runtime = "nodejs"`.

4. Client tracker, once per platform (a `.native.ts` file beside the web one):

```ts
// web: cookieless unless persist: true; pageviews automatic
export const tracker = createWebTracker<AppEvents>({ endpoint: "https://app.example.com/analytics/e" });

// native: storage keeps the anonymous id and queue; AppState drives sessions
export const tracker = createNativeTracker<AppEvents>({
  endpoint: "https://app.example.com/analytics/e",
  storage: AsyncStorage,
  headers: async () => ({ Authorization: `Bearer ${await getToken()}` }),
});
```

On native, record routes with `tracker.screen(usePathname())` in a root-layout
effect. Web pageviews come from the History API already.

## Rules that are easy to get wrong

- Never send a user id from the client. There is no field for it: the server
  attributes events with `resolveUserId(request)` from your session cookie or
  bearer token (`headers` on the tracker). Cross-origin web posts need
  `allowedOrigins`.
- The dashboard and every `/api/*` route answer 404 until `isAdmin` returns true
  for the request. Supply `isAdmin`; there is no other switch.
- Event names are lowercase snake case, `^[a-z][a-z0-9_]*$`, at most 64
  characters. `$` names are reserved (`$pageview`, `$screen`, `$session_start`,
  `$session_end`). Props: flat JSON, at most 50 keys and 4 KB.
- Event maps and their props are `type` aliases, never `interface`s (an interface
  does not satisfy the `Record<string, ...>` constraint). `undefined` props mean
  the event takes none.
- Server-side events: `analytics.track({ name, userId, props, id })`. Users:
  `analytics.identify(userId, { createdAt, traits, excluded })`; pass
  `createdAt` for existing users so cohorts use the real sign-up date, and
  `excluded: true` for staff and test accounts. `track` never creates a user row.
- Revenue: `analytics.recordRevenueEvents(rows)`, idempotent on (`provider`,
  `providerEventId`, `eventType`). A paid row counts toward MRR only with a
  `providerSubscriptionId` and a `periodEnd`; `@mrmeg/expo-purchases`
  `buildLedgerRows` rows have no period, so spread in
  `periodStart: event.purchasedAtMs, periodEnd: event.expirationAtMs`. Stripe
  timestamps are seconds: multiply by 1000. Only `environment: "production"` rows
  count.
- Writing your own SQL against the tables: bind arrays and objects as one JSON
  string cast `$1::text::jsonb`, never `$1::jsonb` (postgres.js double-encodes
  it). Every row has `app_id`; filter on it.
- Sign-out: `await tracker.reset()` before dropping the auth token. Consent:
  `tracker.setEnabled(false)` drops the queue and sends nothing.
- Behind no proxy (no `x-forwarded-for` / `x-real-ip`), pass `clientIp`, or
  every cookieless visitor with one user agent hashes to one id.

## Reports

`analytics.metrics.overview|product|acquisition|web|revenue(range?)`,
`.retention(range?, { mode })`, `.funnels(range?, { key })`, `.events(params)`.
A range is `{ from, to }` inclusive `YYYY-MM-DD` in `metrics.timezone`, default
the last 30 days, at most 400. HTTP: `GET <basePath>/api/<report>?from&to`, `?format=csv`
(with `?table=` where a report has several), `GET <basePath>/api/events?from&to&name&user&limit&before`.
409 `{ error: "not_installed" }` before install; 400 for bad input.

Definitions (actor and stitching, active users, retention modes and maturity,
funnels, channel resolution, web, MRR normalization, trial conversion, churn)
are in the README's Metric definitions section; the dashboard shows each
report's `notes`.
