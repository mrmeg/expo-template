/**
 * `POST <basePath>/e`: validate a `WireBatch`, write its events, and maintain
 * the sessions and users rows derived from them.
 *
 * Replay safety is the organizing rule. Events are inserted with
 * `on conflict (id) do nothing returning id`, and every counter (session
 * pageviews, custom events, user last seen) is derived only from the rows that
 * insert actually returned, all in one transaction. A retried batch therefore
 * inserts nothing and changes nothing.
 */
import { randomUUID } from "node:crypto";

import { EVENT_NAME_PATTERN, LIMITS, RESERVED_EVENTS, type IngestResponse } from "../shared/wire";
import { sanitizeAcquisition, sanitizePath, sanitizeReferrerHost, type Acquisition } from "./acquisition";
import type { StoreContext } from "./config";
import type { SqlClient } from "./sql";
import { upsertUser, validPlatform } from "./users";
import { createSaltCache, deviceClass, parseUserAgent, visitorId } from "./visitor";
import { ADVISORY_LOCK_SPACE, asUuid, cleanText, isPlainObject, jsonParam, sameHost } from "./util";

const RESERVED_NAMES: ReadonlySet<string> = new Set(Object.values(RESERVED_EVENTS));
const VIEW_EVENTS: ReadonlySet<string> = new Set([RESERVED_EVENTS.pageview, RESERVED_EVENTS.screen]);
/** Client ids (`session_id`, `anonymous_id`): opaque, but only characters that are safe to log and group by. */
const CLIENT_ID_PATTERN = new RegExp(`^[A-Za-z0-9._:-]{1,${LIMITS.idMaxLength}}$`);
const APP_VERSION_MAX_LENGTH = 64;

export const EMPTY_RESPONSE: Readonly<IngestResponse> = { received: 0, inserted: 0, rejected: 0, duplicates: 0 };

export function validClientId(value: unknown): string | null {
  return typeof value === "string" && CLIENT_ID_PATTERN.test(value) ? value : null;
}

/** One event that passed validation, ready to write. */
export interface PreparedEvent {
  id: string;
  name: string;
  occurredAt: Date;
  sessionId: string | null;
  path: string | null;
  props: Record<string, unknown> | null;
}

/**
 * `event.occurredAt` is the client's time as sent, or server time when
 * unparseable (`restamped`). Window and clock-skew correction is a batch step
 * (`correctBatchTimes`), because correcting events one by one reorders them.
 */
export type EventCheck =
  | { ok: true; event: PreparedEvent; clientTime: number | null; truncated: boolean; restamped: boolean }
  | { ok: false; reason: string };

/** Client times within this of the corrected time count as untouched; also the skew ignored as noise. */
export const CLOCK_SKEW_TOLERANCE_MS = 5_000;
/** A `sent_at` further off than this is a broken clock or a forged value, not skew. */
const SENT_AT_MAX_SKEW_MS = 10 * 365.25 * 24 * 60 * 60 * 1000;

function parseTime(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export interface BatchTimes {
  /** Stored time per event, in input order (epoch ms). */
  times: number[];
  /** True where the stored time differs from the client's by more than the tolerance. */
  restamped: boolean[];
  /** The offset applied to every parsed client time. */
  offsetMs: number;
}

/**
 * Clock-skew correction for one batch. Every event moves by the same offset,
 * so order and spacing survive:
 *
 * - With a usable `sent_at`, offset = server now - sent_at, ignored within
 *   `CLOCK_SKEW_TOLERANCE_MS`. This fixes fast and slow clocks alike and keeps
 *   the true age of events queued offline.
 * - Without one, a batch whose newest event is more than
 *   `LIMITS.timestampMaxFutureMs` ahead is pulled back so that event lands at
 *   server time; otherwise nothing moves.
 *
 * What is still out of range afterwards cannot be trusted: events older than
 * `LIMITS.timestampMaxAgeMs` are clamped to the window's start, and events in
 * the future to server time, one millisecond apart in their original order so
 * a funnel still sees each step. Unparseable times get server time.
 */
export function correctBatchTimes(clientTimes: readonly (number | null)[], sentAt: unknown, now: number): BatchTimes {
  const parsed = clientTimes.filter((time): time is number => time !== null);
  const sent = parseTime(sentAt);
  const trusted = sent !== null && Math.abs(now - sent) <= SENT_AT_MAX_SKEW_MS;

  let offsetMs = 0;
  if (trusted) {
    const skew = now - sent;
    if (Math.abs(skew) > CLOCK_SKEW_TOLERANCE_MS) offsetMs = skew;
  } else if (parsed.length > 0) {
    const newest = Math.max(...parsed);
    if (newest > now + LIMITS.timestampMaxFutureMs) offsetMs = now - newest;
  }

  // With a trusted `sent_at` an event after it is nonsense; without one the
  // usual future allowance applies, so in-window batches stay untouched.
  const latest = now + (trusted ? CLOCK_SKEW_TOLERANCE_MS : LIMITS.timestampMaxFutureMs);
  const earliest = now - LIMITS.timestampMaxAgeMs;
  const times = clientTimes.map((time) => (time === null ? now : time + offsetMs));

  const spread = (indexes: number[], base: number) => {
    indexes
      .sort((a, b) => times[a] - times[b] || a - b)
      .forEach((index, rank) => {
        times[index] = base + rank;
      });
  };
  spread(
    times.flatMap((time, index) => (clientTimes[index] !== null && time < earliest ? [index] : [])),
    earliest,
  );
  spread(
    times.flatMap((time, index) => (clientTimes[index] !== null && time > latest ? [index] : [])),
    now,
  );

  const restamped = clientTimes.map(
    (time, index) => time === null || Math.abs(times[index] - time) > CLOCK_SKEW_TOLERANCE_MS,
  );
  return { times, restamped, offsetMs };
}

/**
 * Oversized props are replaced, not rejected, so the event itself (name,
 * session, timing) is still counted.
 */
function isOversized(props: Record<string, unknown>): boolean {
  if (Object.keys(props).length > LIMITS.propertiesMaxKeys) return true;
  return Buffer.byteLength(jsonParam(props), "utf8") > LIMITS.propertiesMaxBytes;
}

/**
 * Validates one untrusted wire event. Never throws: anything the checks choke
 * on (for example props nested deep enough to overflow the stack) rejects that
 * one event, so it cannot take the rest of the batch with it.
 */
export function validateEvent(raw: unknown, now: Date): EventCheck {
  try {
    return checkEvent(raw, now);
  } catch {
    return { ok: false, reason: "invalid event" };
  }
}

function checkEvent(raw: unknown, now: Date): EventCheck {
  if (!isPlainObject(raw)) return { ok: false, reason: "not an object" };
  const id = asUuid(raw.id);
  if (!id) return { ok: false, reason: "invalid id" };
  const name = raw.name;
  if (typeof name !== "string" || name.length > LIMITS.eventNameMaxLength || !EVENT_NAME_PATTERN.test(name)) {
    return { ok: false, reason: "invalid name" };
  }
  if (name.startsWith("$") && !RESERVED_NAMES.has(name)) return { ok: false, reason: "unknown reserved name" };

  let sessionId: string | null = null;
  if (raw.session_id !== undefined && raw.session_id !== null) {
    sessionId = validClientId(raw.session_id);
    if (!sessionId) return { ok: false, reason: "invalid session_id" };
  }

  let path: string | null = null;
  if (raw.path !== undefined && raw.path !== null) {
    if (typeof raw.path !== "string" || raw.path.length > LIMITS.pathMaxLength) {
      return { ok: false, reason: "invalid path" };
    }
    path = sanitizePath(raw.path);
  }

  let props: Record<string, unknown> | null = null;
  let truncated = false;
  if (raw.props !== undefined && raw.props !== null) {
    if (!isPlainObject(raw.props)) return { ok: false, reason: "invalid props" };
    props = raw.props;
    if (isOversized(props)) {
      props = { _truncated: true };
      truncated = true;
    }
  }

  const clientTime = parseTime(raw.ts);
  return {
    ok: true,
    event: { id, name, occurredAt: new Date(clientTime ?? now.getTime()), sessionId, path, props },
    clientTime,
    truncated,
    restamped: clientTime === null,
  };
}

export interface EventRow {
  id: string;
  name: string;
  occurred_at: string;
  user_id: string | null;
  anonymous_id: string | null;
  session_id: string | null;
  platform: string | null;
  app_version: string | null;
  path: string | null;
  properties: Record<string, unknown> | null;
}

/**
 * Inserts the rows through one JSON parameter and returns the ids actually
 * inserted (lowercase, as Postgres prints `uuid`). Callers dedupe ids first.
 */
export async function insertEvents(sql: SqlClient, ctx: StoreContext, rows: readonly EventRow[]): Promise<Set<string>> {
  if (rows.length === 0) return new Set();
  const inserted = await sql.query<{ id: string }>(
    `insert into ${ctx.names.t.events} (
       id, app_id, name, occurred_at, received_at, user_id, anonymous_id, session_id, platform, app_version, path, properties
     )
     select r.id, $1, r.name, r.occurred_at, $2::timestamptz, r.user_id, r.anonymous_id, r.session_id, r.platform,
       r.app_version, r.path, r.properties
     from jsonb_to_recordset($3::text::jsonb) as r(
       id uuid, name text, occurred_at timestamptz, user_id text, anonymous_id text, session_id text, platform text,
       app_version text, path text, properties jsonb
     )
     on conflict (id) do nothing
     returning id::text as id`,
    [ctx.appId, ctx.now(), jsonParam(rows)],
  );
  return new Set(inserted.map((row) => row.id));
}

export interface IngestRequestFacts {
  ip: string | null;
  userAgent: string | null;
  country: string | null;
  /** The request's own host, so a same-site referrer is not counted as a source. */
  host: string | null;
}

export interface IngestInput {
  /** The parsed JSON body. Untrusted. */
  body: unknown;
  /** From the host's `resolveUserId`, never from the body. */
  userId: string | null;
  request: IngestRequestFacts;
}

export type IngestOutcome = { ok: true; response: IngestResponse } | { ok: false; error: string };

/** Per-batch facts stamped on sessions this batch creates. */
interface SessionFacts {
  platform: string | null;
  app_version: string | null;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
}

interface Batch {
  events: PreparedEvent[];
  userId: string | null;
  anonymousId: string;
  platform: string | null;
  appVersion: string | null;
  facts: SessionFacts;
  acquisition: Acquisition;
}

const saltCaches = new WeakMap<object, ReturnType<typeof createSaltCache>>();

function saltFor(ctx: StoreContext): ReturnType<typeof createSaltCache> {
  let cache = saltCaches.get(ctx);
  if (!cache) {
    cache = createSaltCache();
    saltCaches.set(ctx, cache);
  }
  return cache;
}

export async function ingestBatch(ctx: StoreContext, input: IngestInput): Promise<IngestOutcome> {
  const { body, request } = input;
  if (!isPlainObject(body) || !Array.isArray(body.events)) return { ok: false, error: "events array is required" };
  const rawEvents: unknown[] = body.events;
  if (rawEvents.length > LIMITS.batchMaxEvents) {
    return { ok: false, error: `at most ${LIMITS.batchMaxEvents} events per batch` };
  }

  const received = rawEvents.length;
  const agent = parseUserAgent(request.userAgent);
  // Accepted so a crawler sees success and does not retry, but nothing is kept.
  if (agent.isBot) return { ok: true, response: { ...EMPTY_RESPONSE, received } };

  const now = ctx.now();
  const events: PreparedEvent[] = [];
  const clientTimes: (number | null)[] = [];
  const seen = new Set<string>();
  let rejected = 0;
  let duplicates = 0;
  for (const raw of rawEvents) {
    const check = validateEvent(raw, now);
    if (!check.ok) {
      rejected++;
    } else if (seen.has(check.event.id)) {
      duplicates++;
    } else {
      seen.add(check.event.id);
      events.push(check.event);
      clientTimes.push(check.clientTime);
    }
  }
  if (events.length === 0) return { ok: true, response: { received, inserted: 0, rejected, duplicates } };

  const { times } = correctBatchTimes(clientTimes, body.sent_at, now.getTime());
  events.forEach((event, index) => {
    event.occurredAt = new Date(times[index]);
  });

  const context = isPlainObject(body.context) ? body.context : {};
  const acquisition = sanitizeAcquisition(body.acquisition);
  if (sameHost(acquisition.referrer, request.host)) acquisition.referrer = null;
  const referrerHost = sanitizeReferrerHost(context.referrer);

  let anonymousId = validClientId(context.anonymous_id);
  if (!anonymousId) {
    const salt = await saltFor(ctx)(ctx.sql, ctx.names, now);
    anonymousId = visitorId({ salt, appId: ctx.appId, ip: request.ip, userAgent: request.userAgent });
  }

  const platform = validPlatform(context.platform);
  const appVersion = cleanText(context.app_version, APP_VERSION_MAX_LENGTH);
  const batch: Batch = {
    events,
    userId: input.userId,
    anonymousId,
    platform,
    appVersion,
    acquisition,
    facts: {
      platform,
      app_version: appVersion,
      referrer_host: sameHost(referrerHost, request.host) ? null : referrerHost,
      utm_source: acquisition.utm_source,
      utm_medium: acquisition.utm_medium,
      utm_campaign: acquisition.utm_campaign,
      utm_content: acquisition.utm_content,
      utm_term: acquisition.utm_term,
      device: deviceClass(agent.device, context.screen_width),
      browser: agent.browser,
      os: agent.os,
      country: request.country,
    },
  };

  const inserted = await ctx.sql.transaction((tx) => writeBatch(tx, ctx, batch));
  return {
    ok: true,
    response: { received, inserted, rejected, duplicates: duplicates + events.length - inserted },
  };
}

/**
 * Cookieless session derivation: events without a `session_id` join the
 * visitor's most recent session while it is within the idle timeout of the
 * event, else open a new one. A per-visitor advisory lock keeps two concurrent
 * batches from the same visitor from each opening a session.
 */
async function assignSessions(tx: SqlClient, ctx: StoreContext, batch: Batch): Promise<void> {
  const pending = batch.events.filter((event) => event.sessionId === null);
  if (pending.length === 0) return;
  await tx.query("select pg_advisory_xact_lock($1::int, hashtext($2))", [
    ADVISORY_LOCK_SPACE,
    `session:${ctx.names.t.sessions}:${ctx.appId}:${batch.anonymousId}`,
  ]);
  const rows = await tx.query<{ id: string; last_seen_at: Date | string }>(
    `select id, last_seen_at from ${ctx.names.t.sessions}
     where app_id = $1 and anonymous_id = $2
     order by last_seen_at desc limit 1`,
    [ctx.appId, batch.anonymousId],
  );
  let current = rows[0] ? { id: rows[0].id, lastSeen: new Date(rows[0].last_seen_at).getTime() } : null;
  pending.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  for (const event of pending) {
    const time = event.occurredAt.getTime();
    if (current && Math.abs(time - current.lastSeen) <= LIMITS.sessionIdleMs) {
      current.lastSeen = Math.max(current.lastSeen, time);
    } else {
      // A new id costs nothing if every event turns out to be a duplicate:
      // sessions are written only from inserted rows.
      current = { id: randomUUID(), lastSeen: time };
    }
    event.sessionId = current.id;
  }
}

interface SessionRow extends SessionFacts {
  id: string;
  anonymous_id: string;
  user_id: string | null;
  started_at: string;
  last_seen_at: string;
  entry_path: string | null;
  exit_path: string | null;
  pageviews: number;
  custom_events: number;
}

/** One row per session from the inserted events, so the upsert never touches a row twice. */
function sessionRows(batch: Batch, inserted: readonly PreparedEvent[]): SessionRow[] {
  const bySession = new Map<string, PreparedEvent[]>();
  for (const event of inserted) {
    if (!event.sessionId) continue;
    const list = bySession.get(event.sessionId) ?? [];
    list.push(event);
    bySession.set(event.sessionId, list);
  }
  return [...bySession].map(([id, list]) => {
    list.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    const withPath = list.filter((event) => event.path !== null);
    return {
      ...batch.facts,
      id,
      anonymous_id: batch.anonymousId,
      user_id: batch.userId,
      started_at: list[0].occurredAt.toISOString(),
      last_seen_at: list[list.length - 1].occurredAt.toISOString(),
      entry_path: withPath[0]?.path ?? null,
      exit_path: withPath[withPath.length - 1]?.path ?? null,
      pageviews: list.filter((event) => VIEW_EVENTS.has(event.name)).length,
      custom_events: list.filter((event) => !event.name.startsWith("$")).length,
    };
  });
}

const SESSION_FACT_COLUMNS = [
  "platform",
  "app_version",
  "referrer_host",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "device",
  "browser",
  "os",
  "country",
] as const satisfies readonly (keyof SessionFacts)[];

async function upsertSessions(tx: SqlClient, ctx: StoreContext, rows: readonly SessionRow[]): Promise<void> {
  if (rows.length === 0) return;
  const facts = SESSION_FACT_COLUMNS.join(", ");
  await tx.query(
    `insert into ${ctx.names.t.sessions} as s (
       id, app_id, anonymous_id, user_id, started_at, last_seen_at, entry_path, exit_path, pageviews, custom_events, ${facts}
     )
     select r.id, $1, r.anonymous_id, r.user_id, r.started_at, r.last_seen_at, r.entry_path, r.exit_path, r.pageviews,
       r.custom_events, ${SESSION_FACT_COLUMNS.map((c) => `r.${c}`).join(", ")}
     from jsonb_to_recordset($2::text::jsonb) as r(
       id text, anonymous_id text, user_id text, started_at timestamptz, last_seen_at timestamptz, entry_path text,
       exit_path text, pageviews integer, custom_events integer, ${SESSION_FACT_COLUMNS.map((c) => `${c} text`).join(", ")}
     )
     on conflict (id) do update set
       started_at = least(s.started_at, excluded.started_at),
       last_seen_at = greatest(s.last_seen_at, excluded.last_seen_at),
       entry_path = coalesce(s.entry_path, excluded.entry_path),
       exit_path = case when excluded.last_seen_at >= s.last_seen_at
         then coalesce(excluded.exit_path, s.exit_path) else s.exit_path end,
       pageviews = s.pageviews + excluded.pageviews,
       custom_events = s.custom_events + excluded.custom_events,
       user_id = coalesce(excluded.user_id, s.user_id),
       anonymous_id = coalesce(s.anonymous_id, excluded.anonymous_id)
     -- Session ids are client-chosen; never let one app's batch update another app's row.
     where s.app_id = excluded.app_id`,
    [ctx.appId, jsonParam(rows)],
  );
}

async function writeBatch(tx: SqlClient, ctx: StoreContext, batch: Batch): Promise<number> {
  await assignSessions(tx, ctx, batch);

  const ids = await insertEvents(
    tx,
    ctx,
    batch.events.map((event) => ({
      id: event.id,
      name: event.name,
      occurred_at: event.occurredAt.toISOString(),
      user_id: batch.userId,
      anonymous_id: batch.anonymousId,
      session_id: event.sessionId,
      platform: batch.platform,
      app_version: batch.appVersion,
      path: event.path,
      properties: event.props,
    })),
  );
  if (ids.size === 0) return 0;
  const inserted = batch.events.filter((event) => ids.has(event.id));

  await upsertSessions(tx, ctx, sessionRows(batch, inserted));
  if (batch.userId) {
    await upsertUser(tx, ctx, {
      userId: batch.userId,
      touch: true,
      firstAnonymousId: batch.anonymousId,
      signupPlatform: batch.platform,
      signupAppVersion: batch.appVersion,
      acquisition: batch.acquisition,
    });
  }
  return ids.size;
}
