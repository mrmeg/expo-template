/**
 * `createAnalyticsServer(config)`: one object the host mounts (`handle`, or
 * `toNodeHandler` for Express) and calls (`install`, `track`, `identify`,
 * `recordRevenueEvents`, `prune`).
 *
 * Every route is a row in `ROUTES`. Later features (the query API, the
 * dashboard) add rows there with `access: "admin"`, and dispatch keeps them
 * closed unless `config.isAdmin` opens them.
 */
import { randomUUID } from "node:crypto";

import { type IngestResponse, type WireAcquisition } from "../shared/wire";
import { sanitizeAcquisition } from "./acquisition";
import type { AnalyticsServerConfig } from "./config";
import {
  checkOrigin,
  declaresTooLarge,
  defaultClientIp,
  defaultCountry,
  dispatch,
  json,
  normalizeBasePath,
  notFound,
  preflight,
  readBodyText,
  requestHost,
  type AnalyticsContext,
  type Route,
} from "./http";
import { EMPTY_RESPONSE, ingestBatch, insertEvents, validClientId, validateEvent, type EventRow } from "./ingest";
import { install, status, uninstall, type InstallResult, type InstallStatus, type UninstallOptions, type UninstallResult } from "./install";
import { detectLinkPlatform, linkDestination, recordLinkClick, resolveLinkRedirect, type LinkClickInput } from "./links";
import { recordRevenueEvents, type RevenueEventInput } from "./revenue";
import { resolveNames } from "./schema";
import { upsertUser, validPlatform, validUserId } from "./users";
import { parseUserAgent } from "./visitor";
import { cleanText, hostOf, isPlainObject, toDate } from "./util";

async function postEvents(ctx: AnalyticsContext, { request }: { request: Request }): Promise<Response> {
  const origin = checkOrigin(request, ctx.config.allowedOrigins);
  if (!origin.allowed) return json({ error: "origin not allowed" }, 403);
  const cors = origin.headers;
  if (declaresTooLarge(request)) return json({ error: "payload too large" }, 413, cors);
  // Any content type: `navigator.sendBeacon` posts `text/plain`.
  const text = await readBodyText(request);
  if (text === null) return json({ error: "payload too large" }, 413, cors);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "body must be JSON" }, 400, cors);
  }

  let userId: string | null = null;
  try {
    userId = validUserId(await ctx.config.resolveUserId?.(request));
  } catch (error) {
    // Keep the events, unattributed, rather than lose them to an auth hiccup.
    ctx.reportError(error, "resolveUserId");
  }

  const outcome = await ingestBatch(ctx, {
    body,
    userId,
    request: {
      ip: (ctx.config.clientIp ?? defaultClientIp)(request),
      userAgent: request.headers.get("user-agent"),
      country: (ctx.config.country ?? defaultCountry)(request),
      host: requestHost(request),
    },
  });
  if (!outcome.ok) return json({ error: outcome.error }, 400, cors);
  return json(outcome.response, 200, cors);
}

async function followLink(ctx: AnalyticsContext, { request, url, params }: { request: Request; url: URL; params: Record<string, string> }): Promise<Response> {
  const links = ctx.config.links;
  if (!links) return notFound();
  const channel = params.channel ?? "";
  const campaign = url.searchParams.get("c") || null;
  const userAgent = request.headers.get("user-agent");
  const clickId = randomUUID();
  const location = resolveLinkRedirect(links, { channel, campaign, userAgent, clickId });
  if (!location) return notFound();

  // HEAD is a link checker and a crawler is a preview card; neither is a click.
  if (request.method === "GET" && !parseUserAgent(userAgent).isBot) {
    const platform = detectLinkPlatform(userAgent);
    try {
      await recordLinkClick(ctx, {
        id: clickId,
        channel,
        campaign,
        destination: linkDestination(links, platform),
        platform,
        referrerHost: hostOf(request.headers.get("referer")),
      });
    } catch (error) {
      // The visitor still gets where they were going.
      ctx.reportError(error, "links.recordClick");
    }
  }
  return new Response(null, { status: 302, headers: { location, "cache-control": "no-store" } });
}

const hasLinks = (config: AnalyticsServerConfig) => config.links !== undefined;

export const ROUTES: readonly Route[] = [
  { method: "POST", pattern: "/e", access: "public", handler: postEvents },
  {
    method: "OPTIONS",
    pattern: "/e",
    access: "public",
    handler: async (ctx, { request }) => preflight(request, ctx.config.allowedOrigins),
  },
  { method: "GET", pattern: "/go/:channel", access: "public", enabled: hasLinks, handler: followLink },
  { method: "HEAD", pattern: "/go/:channel", access: "public", enabled: hasLinks, handler: followLink },
];

/** A trusted, server-side event. */
export interface TrackEvent {
  name: string;
  /** Event id for idempotent retries; generated when absent. */
  id?: string;
  userId?: string | null;
  anonymousId?: string | null;
  sessionId?: string | null;
  path?: string | null;
  props?: Record<string, unknown> | null;
  /** Default: now. */
  ts?: number | Date | string;
}

export interface IdentifyOptions {
  /** The host's sign-up time. Moves `first_seen_at` earlier, never later. */
  createdAt?: number | Date | string;
  /** Merged into stored traits. */
  traits?: Record<string, unknown>;
  /** Staff and test accounts: kept out of every metric. */
  excluded?: boolean;
  /** First touch: fills only fields that are still empty. */
  acquisition?: WireAcquisition;
  platform?: string;
  appVersion?: string;
}

export interface PruneOptions {
  /** Events older than this, and sessions last seen before it, are deleted. */
  olderThanDays: number;
}

export interface PruneResult {
  events: number;
  sessions: number;
}

export interface AnalyticsServer {
  /** The normalized mount point, e.g. `/analytics`. */
  readonly basePath: string;
  /** The response for a request under `basePath`, or null for any other path. Never throws. */
  handle(request: Request): Promise<Response | null>;
  install(): Promise<InstallResult>;
  uninstall(options?: UninstallOptions): Promise<UninstallResult>;
  status(): Promise<InstallStatus>;
  track(events: TrackEvent | readonly TrackEvent[]): Promise<IngestResponse>;
  identify(userId: string, options?: IdentifyOptions): Promise<void>;
  recordRevenueEvents(rows: readonly RevenueEventInput[]): Promise<number>;
  recordLinkClick(input: LinkClickInput): Promise<string>;
  /** Deletes old events and sessions only; users and revenue are kept. */
  prune(options: PruneOptions): Promise<PruneResult>;
}

const APP_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;
const APP_VERSION_MAX_LENGTH = 64;

function defaultOnError(error: unknown, where: string): void {
  console.error(`[expo-analytics] ${where}:`, error);
}

function timeInput(value: number | Date | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function createAnalyticsServer(config: AnalyticsServerConfig): AnalyticsServer {
  if (typeof config.appId !== "string" || !APP_ID_PATTERN.test(config.appId)) {
    throw new Error(`expo-analytics: invalid appId "${String(config.appId)}" (1-64 letters, digits, . _ : -)`);
  }
  const placement = { schema: config.schema, prefix: config.prefix };
  const names = resolveNames(placement);
  const basePath = normalizeBasePath(config.basePath);

  const ctx: AnalyticsContext = {
    config,
    names,
    sql: config.sql,
    appId: config.appId,
    now: () => config.now?.() ?? new Date(),
    reportError(error, where) {
      try {
        (config.onError ?? defaultOnError)(error, where);
      } catch {
        // A failing logger must not turn into a failing request.
      }
    },
  };

  async function track(input: TrackEvent | readonly TrackEvent[]): Promise<IngestResponse> {
    const list: readonly TrackEvent[] = Array.isArray(input) ? input : [input as TrackEvent];
    const now = ctx.now();
    const rows: EventRow[] = [];
    const seen = new Set<string>();
    let rejected = 0;
    let duplicates = 0;
    for (const event of list) {
      const userId = event.userId == null ? null : validUserId(event.userId);
      const anonymousId = event.anonymousId == null ? null : validClientId(event.anonymousId);
      const check = validateEvent(
        {
          id: event.id ?? randomUUID(),
          name: event.name,
          ts: timeInput(event.ts) ?? now.toISOString(),
          session_id: event.sessionId ?? undefined,
          path: event.path ?? undefined,
          props: event.props ?? undefined,
        },
        now,
      );
      if (!check.ok || (event.userId != null && !userId) || (event.anonymousId != null && !anonymousId)) {
        rejected++;
        continue;
      }
      if (seen.has(check.event.id)) {
        duplicates++;
        continue;
      }
      seen.add(check.event.id);
      rows.push({
        id: check.event.id,
        name: check.event.name,
        occurred_at: check.event.occurredAt.toISOString(),
        user_id: userId,
        anonymous_id: anonymousId,
        session_id: check.event.sessionId,
        platform: "server",
        app_version: null,
        path: check.event.path,
        properties: check.event.props,
      });
    }
    const inserted = (await insertEvents(ctx.sql, ctx, rows)).size;
    return { ...EMPTY_RESPONSE, received: list.length, inserted, rejected, duplicates: duplicates + rows.length - inserted };
  }

  async function identify(userId: string, options: IdentifyOptions = {}): Promise<void> {
    const id = validUserId(userId);
    if (!id) throw new Error("expo-analytics: identify needs a non-empty user id");
    let createdAt: Date | null = null;
    if (options.createdAt !== undefined) {
      createdAt = toDate(options.createdAt);
      if (Number.isNaN(createdAt.getTime())) throw new Error("expo-analytics: identify createdAt is not a valid time");
    }
    await ctx.sql.transaction((tx) =>
      upsertUser(tx, ctx, {
        userId: id,
        touch: false,
        createdAt,
        excluded: options.excluded ?? null,
        traits: isPlainObject(options.traits) ? options.traits : null,
        signupPlatform: validPlatform(options.platform),
        signupAppVersion: cleanText(options.appVersion, APP_VERSION_MAX_LENGTH),
        acquisition: sanitizeAcquisition(options.acquisition),
      }),
    );
  }

  async function prune({ olderThanDays }: PruneOptions): Promise<PruneResult> {
    if (typeof olderThanDays !== "number" || !Number.isFinite(olderThanDays) || olderThanDays <= 0) {
      throw new Error("expo-analytics: prune needs a positive olderThanDays");
    }
    const cutoff = new Date(ctx.now().getTime() - olderThanDays * 24 * 60 * 60 * 1000);
    const count = async (table: string, column: string) => {
      const rows = await ctx.sql.query<{ n: number }>(
        `with gone as (delete from ${table} where app_id = $1 and ${column} < $2::timestamptz returning 1)
         select count(*)::int as n from gone`,
        [ctx.appId, cutoff],
      );
      return Number(rows[0]?.n ?? 0);
    };
    return { events: await count(names.t.events, "occurred_at"), sessions: await count(names.t.sessions, "last_seen_at") };
  }

  return {
    basePath,
    async handle(request) {
      try {
        return await dispatch(ctx, ROUTES, basePath, request);
      } catch (error) {
        let where = "handle";
        try {
          where = `${request.method} ${new URL(request.url).pathname}`;
        } catch {
          // Keep the generic label.
        }
        ctx.reportError(error, where);
        return json({ error: "internal error" }, 500);
      }
    },
    install: () => install(config.sql, placement),
    uninstall: (options) => uninstall(config.sql, placement, options),
    status: () => status(config.sql, placement),
    track,
    identify,
    recordRevenueEvents: (rows) => recordRevenueEvents(ctx, rows),
    recordLinkClick: (input) => recordLinkClick(ctx, input),
    prune,
  };
}

export { toNodeHandler } from "./http";
