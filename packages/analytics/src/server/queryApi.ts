/**
 * The query API: `GET <basePath>/api/<report>` for each report, the raw event
 * list, and `/api/meta`, all admin-only. The same report functions back
 * `server.metrics`, so a host building its own admin screen gets the figures
 * the dashboard shows.
 *
 * Responses:
 * - 200 with the report as JSON, or as CSV with `?format=csv` (see `reportCsv.ts`).
 *   An events CSV is one page; when older events remain, `X-Next-Before`
 *   carries the cursor to pass as `before` for the next one.
 * - 400 `{ error }` for a range, option, format or table the request got wrong.
 * - 409 `{ error: "not_installed" }` while the tables are missing or a
 *   migration is pending, so the dashboard can say so instead of showing a
 *   SQL error.
 * - 500 with a generic body for anything else, after `reportError`.
 * Every response is `Cache-Control: no-store`: the figures are private and move.
 */

import {
  isTimezone,
  resolveMetricsConfig,
  toCsv,
  zonedDate,
  type AcquisitionReport,
  type EventPage,
  type FunnelReport,
  type MetricsConfig,
  type OverviewReport,
  type ProductReport,
  type RetentionMode,
  type RetentionReport,
  type RevenueReport,
  type WebReport,
} from "../metrics";
import type { AnalyticsServerConfig } from "./config";
import { json, normalizeBasePath, type AnalyticsContext, type Route } from "./http";
import { status, type InstallStatus } from "./install";
import {
  LIST_EVENTS_MAX_LIMIT,
  MetricsInputError,
  getAcquisitionReport,
  getFunnelReport,
  getOverviewReport,
  getProductReport,
  getRetentionReport,
  getRevenueReport,
  getWebReport,
  listEvents,
  type MetricsDeps,
  type RangeInput,
} from "./queries";
import { CSV_TABLES, REPORT_NAMES, csvFilename, eventsTable, reportTable, type CsvTable, type ReportName, type ReportShapes } from "./reportCsv";

/** `server.metrics.events` parameters. Range defaults as for the reports; `limit` defaults to 100. */
export interface EventsQuery extends RangeInput {
  name?: string;
  userId?: string;
  /** Clamped to 1..1000. Default 100. */
  limit?: number;
  /** `next_before` from the previous page. */
  before?: string;
}

/** The reports, for a host's own admin screen. Each throws `MetricsInputError` for a range or option it cannot serve. */
export interface AnalyticsMetrics {
  overview(range?: RangeInput): Promise<OverviewReport>;
  product(range?: RangeInput): Promise<ProductReport>;
  retention(range?: RangeInput, options?: { mode?: RetentionMode }): Promise<RetentionReport>;
  funnels(range?: RangeInput, options?: { key?: string }): Promise<FunnelReport>;
  acquisition(range?: RangeInput): Promise<AcquisitionReport>;
  web(range?: RangeInput): Promise<WebReport>;
  revenue(range?: RangeInput): Promise<RevenueReport>;
  events(params?: EventsQuery): Promise<EventPage>;
}

export const DEFAULT_EVENTS_LIMIT = 100;

/** Rejects a metrics config no report could use, so `createAnalyticsServer` fails at boot. */
export function validateMetricsConfig(config: MetricsConfig | undefined): void {
  const resolved = resolveMetricsConfig(config);
  if (!isTimezone(resolved.timezone)) throw new Error(`expo-analytics: unknown time zone "${resolved.timezone}"`);
  const keys = new Set<string>();
  for (const funnel of resolved.funnels) {
    if (keys.has(funnel.key)) throw new Error(`expo-analytics: two funnels share the key "${funnel.key}"`);
    keys.add(funnel.key);
  }
}

/** Deps for one report call; `now` is read per call so a long-lived server keeps moving. */
export function metricsDeps(ctx: AnalyticsContext): MetricsDeps {
  return { sql: ctx.sql, names: ctx.names, appId: ctx.appId, config: ctx.config.metrics ?? {}, now: ctx.now() };
}

export function createMetrics(ctx: AnalyticsContext): AnalyticsMetrics {
  return {
    overview: (range) => getOverviewReport(metricsDeps(ctx), range),
    product: (range) => getProductReport(metricsDeps(ctx), range),
    retention: (range, options) => getRetentionReport(metricsDeps(ctx), range, options),
    funnels: (range, options) => getFunnelReport(metricsDeps(ctx), range, options),
    acquisition: (range) => getAcquisitionReport(metricsDeps(ctx), range),
    web: (range) => getWebReport(metricsDeps(ctx), range),
    revenue: (range) => getRevenueReport(metricsDeps(ctx), range),
    events: (params = {}) =>
      listEvents(metricsDeps(ctx), {
        from: params.from ?? "",
        to: params.to ?? "",
        name: params.name,
        userId: params.userId,
        limit: params.limit ?? DEFAULT_EVENTS_LIMIT,
        before: params.before,
      }),
  };
}

// ── Install state ────────────────────────────────────────────────────────────

function placement(config: AnalyticsServerConfig) {
  return { schema: config.schema, prefix: config.prefix };
}

function isCurrent(install: InstallStatus): boolean {
  return install.installed && install.pending.length === 0;
}

/**
 * Servers whose tables were seen installed and current. Only that answer is
 * cached: a missing install must be re-checked on the next request, because
 * the host may run `install()` at any moment.
 */
const verified = new WeakSet<AnalyticsContext>();

async function installState(ctx: AnalyticsContext): Promise<InstallStatus> {
  const install = await status(ctx.sql, placement(ctx.config));
  if (isCurrent(install)) verified.add(ctx);
  else verified.delete(ctx);
  return install;
}

function notInstalled(install: InstallStatus): Response {
  return json(
    { error: "not_installed", installed: install.installed, version: install.version, latest: install.latest, pending: install.pending },
    409,
    API_HEADERS,
  );
}

const API_HEADERS = { "x-content-type-options": "nosniff" };

function badRequest(message: string): Response {
  return json({ error: message }, 400, API_HEADERS);
}

function serverError(ctx: AnalyticsContext, error: unknown, where: string): Response {
  ctx.reportError(error, where);
  return json({ error: "internal error" }, 500, API_HEADERS);
}

/**
 * Runs a query for an API route. The install check runs first (some reports
 * issue no query at all, such as funnels with none configured, so a SQL error
 * alone would not reveal a missing install), and again after a database error
 * in case the tables went away since they were last seen.
 */
async function answer(ctx: AnalyticsContext, where: string, run: () => Promise<Response>): Promise<Response> {
  try {
    if (!verified.has(ctx)) {
      const install = await installState(ctx);
      if (!isCurrent(install)) return notInstalled(install);
    }
  } catch (error) {
    return serverError(ctx, error, where);
  }
  try {
    return await run();
  } catch (error) {
    if (error instanceof MetricsInputError) return badRequest(error.message);
    try {
      const install = await installState(ctx);
      if (!isCurrent(install)) return notInstalled(install);
    } catch {
      // The original error is the one worth reporting.
    }
    return serverError(ctx, error, where);
  }
}

// ── Parameters ───────────────────────────────────────────────────────────────

/** A query parameter, with an empty value treated as absent. */
function param(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name);
  return value === null || value.trim() === "" ? undefined : value.trim();
}

function rangeOf(url: URL): RangeInput {
  return { from: param(url, "from") ?? null, to: param(url, "to") ?? null };
}

type Format = { kind: "json" } | { kind: "csv"; table?: string };

/** Validated before any query runs, so a typo costs nothing. */
function formatOf(url: URL, tables: readonly string[] | null): Format {
  const format = param(url, "format") ?? "json";
  if (format === "json") return { kind: "json" };
  if (format !== "csv") throw new MetricsInputError("format must be json or csv");
  const table = param(url, "table");
  if (table === undefined || tables === null) return { kind: "csv" };
  if (!tables.includes(table)) throw new MetricsInputError(`table must be one of ${tables.join(", ")}`);
  return { kind: "csv", table: table === tables[0] ? undefined : table };
}

function csvResponse(table: CsvTable, filename: string, headers: Record<string, string> = {}): Response {
  return new Response(toCsv(table.rows, table.columns), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
      ...API_HEADERS,
      ...headers,
    },
  });
}

// ── Routes ───────────────────────────────────────────────────────────────────

type ReportRunner<K extends ReportName> = (deps: MetricsDeps, range: RangeInput, url: URL) => Promise<ReportShapes[K]>;

const RUNNERS: { [K in ReportName]: ReportRunner<K> } = {
  overview: (deps, range) => getOverviewReport(deps, range),
  product: (deps, range) => getProductReport(deps, range),
  // The report validates `mode`; the cast only lets an unknown value reach that check.
  retention: (deps, range, url) => getRetentionReport(deps, range, { mode: param(url, "mode") as RetentionMode | undefined }),
  funnels: (deps, range, url) => getFunnelReport(deps, range, { key: param(url, "key") }),
  acquisition: (deps, range) => getAcquisitionReport(deps, range),
  web: (deps, range) => getWebReport(deps, range),
  revenue: (deps, range) => getRevenueReport(deps, range),
};

function reportRoute<K extends ReportName>(name: K): Route {
  return {
    method: "GET",
    pattern: `/api/${name}`,
    access: "admin",
    handler: (ctx, { url }) =>
      answer(ctx, `GET /api/${name}`, async () => {
        const format = formatOf(url, CSV_TABLES[name]);
        const report = await RUNNERS[name](metricsDeps(ctx), rangeOf(url), url);
        if (format.kind === "json") return json(report, 200, API_HEADERS);
        return csvResponse(reportTable(name, report, format.table), csvFilename(name, report.range, format.table));
      }),
  };
}

const LIMIT_PATTERN = /^\d{1,7}$/;

const eventsRoute: Route = {
  method: "GET",
  pattern: "/api/events",
  access: "admin",
  handler: (ctx, { url }) =>
    answer(ctx, "GET /api/events", async () => {
      const format = formatOf(url, null);
      const limitParam = param(url, "limit");
      if (limitParam !== undefined && !LIMIT_PATTERN.test(limitParam)) throw new MetricsInputError("limit must be a whole number");
      // An export wants the whole page it can get; the screen wants a quick first page.
      const fallback = format.kind === "csv" ? LIST_EVENTS_MAX_LIMIT : DEFAULT_EVENTS_LIMIT;
      const range = rangeOf(url);
      const page = await listEvents(metricsDeps(ctx), {
        from: range.from ?? "",
        to: range.to ?? "",
        name: param(url, "name"),
        userId: param(url, "user"),
        limit: limitParam === undefined ? fallback : Number(limitParam),
        before: param(url, "before"),
      });
      if (format.kind === "json") return json(page, 200, API_HEADERS);
      // A CSV is one page (at most 1000 rows, newest first); this header says more are older and how to ask for them.
      const more: Record<string, string> = page.next_before ? { "x-next-before": page.next_before } : {};
      return csvResponse(eventsTable(page), csvFilename("events", page.range), more);
    }),
};

/** What the dashboard needs to lay itself out before it asks for any report. */
export interface MetaResponse {
  appId: string;
  basePath: string;
  timezone: string;
  /** Today in `timezone`; the dashboard computes its range presets from it. */
  today: string;
  install: Pick<InstallStatus, "installed" | "version" | "latest" | "pending">;
  /** Null when no activation event is configured. */
  activation: { event: string; withinDays: number } | null;
  /** True when tracked links (`/go/:channel`) are configured. */
  links: boolean;
  funnels: { key: string; name: string; steps: string[]; windowDays: number }[];
  retentionDays: number[];
}

const metaRoute: Route = {
  method: "GET",
  pattern: "/api/meta",
  access: "admin",
  handler: async (ctx) => {
    let install: InstallStatus;
    try {
      install = await installState(ctx);
    } catch (error) {
      return serverError(ctx, error, "GET /api/meta");
    }
    const config = resolveMetricsConfig(ctx.config.metrics);
    const body: MetaResponse = {
      appId: ctx.appId,
      basePath: normalizeBasePath(ctx.config.basePath),
      timezone: config.timezone,
      today: zonedDate(ctx.now(), config.timezone),
      install: { installed: install.installed, version: install.version, latest: install.latest, pending: install.pending },
      activation: config.activation,
      links: ctx.config.links !== undefined,
      funnels: config.funnels.map((funnel) => ({ key: funnel.key, name: funnel.name, steps: funnel.steps, windowDays: funnel.windowDays })),
      retentionDays: config.retentionDays,
    };
    return json(body, 200, API_HEADERS);
  },
};

export const API_ROUTES: readonly Route[] = [metaRoute, ...REPORT_NAMES.map((name) => reportRoute(name)), eventsRoute];
