/**
 * The tables this package owns, and the migrations that create them.
 *
 * Nothing here references a host table: `user_id` is the host's id stored as
 * text with no foreign key. That is what makes the package removable. Install
 * creates only objects named `<prefix>*` inside one schema, and uninstall drops
 * exactly that list.
 *
 * Two placements are supported:
 * - Shared schema (default): `schema` unset, so tables land wherever the
 *   connection's `search_path` points, named `analytics_events`, and so on. This
 *   suits a database where each app has one schema and one role that cannot
 *   create others.
 * - Dedicated schema: `schema: "analytics"` qualifies every name. Install
 *   creates the schema when the role may; uninstall drops it only when install
 *   created it.
 *
 * Every row carries `app_id`, so several apps can share one set of tables (a
 * central collector) without a schema change.
 */

export const DEFAULT_PREFIX = "analytics_";

/** Unquoted lowercase identifier. Prefix is capped so index names fit in 63 bytes. */
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const PREFIX_MAX_LENGTH = 20;
const SCHEMA_MAX_LENGTH = 63;

export interface PlacementOptions {
  /** Schema to qualify names with. Unset uses the connection's `search_path`. */
  schema?: string;
  /** Table and index name prefix. Default `analytics_`. */
  prefix?: string;
}

/** Logical table keys, in creation order. Uninstall drops them in reverse. */
export const TABLE_KEYS = [
  "migrations",
  "events",
  "sessions",
  "users",
  "linkClicks",
  "revenueEvents",
  "salts",
] as const;
export type TableKey = (typeof TABLE_KEYS)[number];

const TABLE_SUFFIX: Record<TableKey, string> = {
  migrations: "migrations",
  events: "events",
  sessions: "sessions",
  users: "users",
  linkClicks: "link_clicks",
  revenueEvents: "revenue_events",
  salts: "salts",
};

export interface Names {
  /** Validated schema, or null when names are unqualified. */
  schema: string | null;
  prefix: string;
  /** Fully qualified, quoted table names, ready to interpolate into SQL. */
  t: Record<TableKey, string>;
  /** Bare table names (no schema, no quotes), for catalog lookups. */
  bare: Record<TableKey, string>;
  /** Bare index name for a suffix, e.g. `ix("events_app_time")`. */
  ix(suffix: string): string;
}

/**
 * Validates the placement and returns the names to interpolate. These are the
 * only values this package ever interpolates into SQL text; everything else is
 * a bound parameter.
 */
export function resolveNames(options: PlacementOptions = {}): Names {
  const prefix = options.prefix ?? DEFAULT_PREFIX;
  if (!IDENTIFIER.test(prefix) || prefix.length > PREFIX_MAX_LENGTH) {
    throw new Error(
      `expo-analytics: invalid table prefix "${prefix}" (lowercase letters, digits and underscores, at most ${PREFIX_MAX_LENGTH} characters)`,
    );
  }
  const schema = options.schema ?? null;
  if (schema !== null && (!IDENTIFIER.test(schema) || schema.length > SCHEMA_MAX_LENGTH)) {
    throw new Error(`expo-analytics: invalid schema "${schema}" (lowercase letters, digits and underscores)`);
  }
  const qualify = (bare: string) => (schema ? `"${schema}"."${bare}"` : `"${bare}"`);
  const bare = {} as Record<TableKey, string>;
  const t = {} as Record<TableKey, string>;
  for (const key of TABLE_KEYS) {
    bare[key] = `${prefix}${TABLE_SUFFIX[key]}`;
    t[key] = qualify(bare[key]);
  }
  return { schema, prefix, t, bare, ix: (suffix) => `${prefix}${suffix}_idx` };
}

export interface Migration {
  version: number;
  name: string;
  /** Statements run in order inside one transaction. */
  up(names: Names): string[];
}

/**
 * Append-only. Never edit a released migration: add the next version.
 * `server/install.ts` applies the ones missing from `<prefix>migrations`.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "init",
    up: ({ t, ix }) => [
      // One row per captured event. `id` is client-generated, so a retried
      // batch is dropped on conflict instead of double counted.
      `create table ${t.events} (
        id uuid primary key,
        app_id text not null,
        name text not null,
        occurred_at timestamptz not null,
        received_at timestamptz not null default now(),
        user_id text,
        anonymous_id text,
        session_id text,
        platform text,
        app_version text,
        path text,
        properties jsonb
      )`,
      `create index ${ix("events_app_time")} on ${t.events} (app_id, occurred_at)`,
      `create index ${ix("events_app_name_time")} on ${t.events} (app_id, name, occurred_at)`,
      `create index ${ix("events_app_user_time")} on ${t.events} (app_id, user_id, occurred_at) where user_id is not null`,
      `create index ${ix("events_app_session")} on ${t.events} (app_id, session_id) where session_id is not null`,
      // Identity stitching: which user a device's anonymous id belongs to.
      `create index ${ix("events_app_anon_user")} on ${t.events} (app_id, anonymous_id, occurred_at) where user_id is not null and anonymous_id is not null`,

      // One row per visit, maintained at ingest so web traffic queries never
      // scan events. `custom_events` counts non-reserved events; a bounce is a
      // session with at most one pageview and none of them.
      `create table ${t.sessions} (
        id text primary key,
        app_id text not null,
        anonymous_id text,
        user_id text,
        started_at timestamptz not null,
        last_seen_at timestamptz not null,
        platform text,
        app_version text,
        entry_path text,
        exit_path text,
        pageviews integer not null default 0,
        custom_events integer not null default 0,
        referrer_host text,
        utm_source text,
        utm_medium text,
        utm_campaign text,
        utm_content text,
        utm_term text,
        device text,
        browser text,
        os text,
        country text
      )`,
      `create index ${ix("sessions_app_started")} on ${t.sessions} (app_id, started_at)`,
      `create index ${ix("sessions_app_visitor_seen")} on ${t.sessions} (app_id, anonymous_id, last_seen_at)`,

      // One row per signed-in user the host has told us about, with first-touch
      // acquisition. `first_seen_at` is the sign-up time every cohort is cut on.
      // `excluded` removes staff and test accounts from every metric.
      `create table ${t.users} (
        app_id text not null,
        user_id text not null,
        first_seen_at timestamptz not null default now(),
        last_seen_at timestamptz not null default now(),
        excluded boolean not null default false,
        traits jsonb,
        first_anonymous_id text,
        signup_platform text,
        signup_app_version text,
        utm_source text,
        utm_medium text,
        utm_campaign text,
        utm_content text,
        utm_term text,
        referrer text,
        landing_path text,
        click_id text,
        click_id_kind text,
        link_click_id uuid,
        self_reported_source text,
        channel text not null default 'unknown',
        primary key (app_id, user_id)
      )`,
      `create index ${ix("users_app_first_seen")} on ${t.users} (app_id, first_seen_at)`,
      `create index ${ix("users_app_channel")} on ${t.users} (app_id, channel)`,

      // One row per hit on a tracked redirect link (`/go/:channel`).
      `create table ${t.linkClicks} (
        id uuid primary key default gen_random_uuid(),
        app_id text not null,
        channel text not null,
        campaign text,
        destination text not null,
        platform text,
        referrer_host text,
        occurred_at timestamptz not null default now()
      )`,
      `create index ${ix("link_clicks_app_channel_time")} on ${t.linkClicks} (app_id, channel, occurred_at)`,

      // Append-only money ledger: subscriptions and one-time purchases from any
      // provider, normalized to one vocabulary. `amount_cents` is positive on
      // paid rows, negative on refunds, 0 on trial starts and null on
      // state-only rows, so sum(amount_cents) is net revenue. `period_start`
      // and `period_end` bound the paid period and drive MRR normalization;
      // both are null for one-time purchases.
      `create table ${t.revenueEvents} (
        id uuid primary key default gen_random_uuid(),
        app_id text not null,
        user_id text,
        provider text not null,
        event_type text not null,
        provider_event_id text not null,
        provider_event_type text,
        provider_subscription_id text,
        product_id text,
        store text,
        period_type text,
        period_start timestamptz,
        period_end timestamptz,
        amount_cents integer,
        currency text,
        renewal_number integer,
        cancel_reason text,
        environment text not null default 'production',
        occurred_at timestamptz not null,
        payload jsonb,
        created_at timestamptz not null default now()
      )`,
      `create unique index ${ix("revenue_events_provider_event")} on ${t.revenueEvents} (app_id, provider, provider_event_id, event_type)`,
      `create index ${ix("revenue_events_app_time")} on ${t.revenueEvents} (app_id, occurred_at)`,
      `create index ${ix("revenue_events_app_type_time")} on ${t.revenueEvents} (app_id, event_type, occurred_at)`,
      `create index ${ix("revenue_events_app_user_time")} on ${t.revenueEvents} (app_id, user_id, occurred_at)`,
      `create index ${ix("revenue_events_app_sub_time")} on ${t.revenueEvents} (app_id, provider_subscription_id, occurred_at)`,

      // Daily salts for cookieless visitor ids. Only today's and yesterday's
      // rows exist; deleting a salt makes that day's ids unlinkable.
      `create table ${t.salts} (
        day date primary key,
        salt text not null,
        created_at timestamptz not null default now()
      )`,
    ],
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;
