/**
 * Database test helpers for the metric queries: create the package's tables
 * the way `schema.db.test.ts` does (the installer belongs elsewhere), and
 * insert rows directly. Not a test file: jest only runs `*.test.ts`.
 */

import type { MetricsConfig } from "../../../metrics";
import { MIGRATIONS, resolveNames, type Names } from "../../schema";
import type { SqlClient } from "../../sql";
import type { MetricsDeps } from "../context";

export const APP = "app_test";

export async function installTables(sql: SqlClient, names: Names = resolveNames()): Promise<Names> {
  await sql.transaction(async (tx) => {
    // The migrations table belongs to the installer; a stand-in keeps the set complete.
    await tx.query(`create table ${names.t.migrations} (version integer primary key)`);
    for (const migration of MIGRATIONS) {
      for (const statement of migration.up(names)) await tx.query(statement);
    }
  });
  return names;
}

export async function truncateAll(sql: SqlClient, names: Names): Promise<void> {
  await sql.query(
    `truncate ${names.t.events}, ${names.t.sessions}, ${names.t.users}, ${names.t.linkClicks}, ${names.t.revenueEvents}`,
  );
}

export function deps(sql: SqlClient, names: Names, config: MetricsConfig = {}, now = "2026-11-27T12:00:00Z"): MetricsDeps {
  return { sql, names, appId: APP, config, now: new Date(now) };
}

export interface EventSeed {
  /** Defaults to a random uuid. */
  id?: string;
  name: string;
  at: string;
  user?: string | null;
  anon?: string | null;
  session?: string | null;
  platform?: string | null;
  path?: string | null;
  app?: string;
  properties?: Record<string, unknown>;
}

export async function insertEvents(sql: SqlClient, names: Names, events: EventSeed[]): Promise<void> {
  for (const e of events) {
    await sql.query(
      `insert into ${names.t.events} (id, app_id, name, occurred_at, user_id, anonymous_id, session_id, platform, path, properties)
      values (coalesce($10::uuid, gen_random_uuid()), $1, $2, $3::timestamptz, $4, $5, $6, $7, $8, $9::text::jsonb)`,
      [
        e.app ?? APP,
        e.name,
        e.at,
        e.user ?? null,
        e.anon ?? null,
        e.session ?? null,
        e.platform ?? "ios",
        e.path ?? null,
        e.properties ? JSON.stringify(e.properties) : null,
        e.id ?? null,
      ],
    );
  }
}

export interface UserSeed {
  user: string;
  firstSeen: string;
  channel?: string;
  platform?: string | null;
  excluded?: boolean;
}

export async function insertUsers(sql: SqlClient, names: Names, users: UserSeed[]): Promise<void> {
  for (const u of users) {
    await sql.query(
      `insert into ${names.t.users} (app_id, user_id, first_seen_at, last_seen_at, channel, signup_platform, excluded)
      values ($1, $2, $3::timestamptz, $3::timestamptz, $4, $5, $6)`,
      [APP, u.user, u.firstSeen, u.channel ?? "unknown", u.platform ?? null, u.excluded ?? false],
    );
  }
}

export interface SessionSeed {
  id: string;
  anon: string | null;
  user?: string | null;
  started: string;
  lastSeen?: string;
  platform?: string;
  entry?: string | null;
  exit?: string | null;
  pageviews?: number;
  customEvents?: number;
  referrer?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  country?: string | null;
}

export async function insertSessions(sql: SqlClient, names: Names, sessions: SessionSeed[]): Promise<void> {
  for (const s of sessions) {
    await sql.query(
      `insert into ${names.t.sessions} (id, app_id, anonymous_id, user_id, started_at, last_seen_at, platform, entry_path, exit_path,
        pageviews, custom_events, referrer_host, utm_source, utm_campaign, device, browser, os, country)
      values ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        s.id,
        APP,
        s.anon,
        s.user ?? null,
        s.started,
        s.lastSeen ?? s.started,
        s.platform ?? "web",
        s.entry ?? null,
        s.exit ?? null,
        s.pageviews ?? 1,
        s.customEvents ?? 0,
        s.referrer ?? null,
        s.utmSource ?? null,
        s.utmCampaign ?? null,
        s.device ?? null,
        s.browser ?? null,
        s.os ?? null,
        s.country ?? null,
      ],
    );
  }
}

export interface RevenueSeed {
  type: string;
  at: string;
  user?: string | null;
  sub?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  amount?: number | null;
  /** Default "usd"; null records no currency. */
  currency?: string | null;
  environment?: string;
  cancelReason?: string | null;
  providerEventId?: string;
}

let revenueSeq = 0;

export async function insertRevenue(sql: SqlClient, names: Names, rows: RevenueSeed[]): Promise<void> {
  for (const r of rows) {
    revenueSeq += 1;
    await sql.query(
      `insert into ${names.t.revenueEvents} (app_id, user_id, provider, event_type, provider_event_id, provider_subscription_id,
        period_start, period_end, amount_cents, currency, cancel_reason, environment, occurred_at)
      values ($1, $2, 'revenuecat', $3, $4, $5, $6::timestamptz, $7::timestamptz, $8, $9, $10, $11, $12::timestamptz)`,
      [
        APP,
        r.user ?? null,
        r.type,
        r.providerEventId ?? `evt_${revenueSeq}`,
        r.sub ?? null,
        r.periodStart ?? null,
        r.periodEnd ?? null,
        r.amount ?? null,
        r.currency === undefined ? "usd" : r.currency,
        r.cancelReason ?? null,
        r.environment ?? "production",
        r.at,
      ],
    );
  }
}

export async function insertLinkClicks(sql: SqlClient, names: Names, clicks: { channel: string; at: string }[]): Promise<void> {
  for (const c of clicks) {
    await sql.query(
      `insert into ${names.t.linkClicks} (app_id, channel, destination, occurred_at) values ($1, $2, 'https://example.com', $3::timestamptz)`,
      [APP, c.channel, c.at],
    );
  }
}
