/**
 * `@mrmeg/expo-analytics/server`: ingest endpoint, installable tables, the
 * host-side API (`track`, `identify`, revenue, tracked links, pruning), the
 * admin query API and dashboard, and `server.metrics` for a host's own screens.
 */
export { createAnalyticsServer, ROUTES, toNodeHandler } from "./server";
export type {
  AnalyticsServer,
  IdentifyOptions,
  PruneOptions,
  PruneResult,
  TrackEvent,
} from "./server";
export type { AnalyticsServerConfig, StoreContext } from "./config";
export type { AnalyticsContext, NodeHandlerTarget, NodeNext, NodeRequestLike, Route, RouteRequest } from "./http";

export { install, status, uninstall } from "./install";
export type { InstallResult, InstallStatus, UninstallOptions, UninstallResult } from "./install";

export { ingestBatch, validateEvent } from "./ingest";
export type { EventCheck, IngestInput, IngestOutcome, IngestRequestFacts, PreparedEvent } from "./ingest";

export { getDailySalt, parseUserAgent, visitorId } from "./visitor";
export type { DeviceClass, UserAgentInfo, VisitorInput } from "./visitor";

export {
  CAMPAIGN_PATTERN,
  CHANNEL_ALIASES,
  CHANNEL_PATTERN,
  PLATFORM_DEFAULT_CHANNEL,
  normalizeChannel,
  resolveChannel,
  sanitizeAcquisition,
  sanitizePath,
  sanitizeReferrerHost,
  sanitizeUtm,
} from "./acquisition";
export type { Acquisition, ChannelSignals, ClickIdKind } from "./acquisition";

export {
  DEFAULT_SOCIAL_CHANNELS,
  LINK_CLICK_PARAM,
  detectLinkPlatform,
  linkDestination,
  recordLinkClick,
  resolveLinkRedirect,
} from "./links";
export type { LinkClickInput, LinkConfig, LinkDestination, LinkPlatform, LinkRequest } from "./links";

export { REVENUE_ENVIRONMENTS, REVENUE_EVENT_TYPES, recordRevenueEvents } from "./revenue";
export type { RevenueEnvironment, RevenueEventInput, RevenueEventType } from "./revenue";

export { fromPg, fromPostgresJs } from "./sql";
export type { PgClientLike, PgPoolLike, PostgresJsLike, SqlClient, SqlParam } from "./sql";

export { DEFAULT_PREFIX, LATEST_VERSION, MIGRATIONS, TABLE_KEYS, resolveNames } from "./schema";
export type { Migration, Names, PlacementOptions, TableKey } from "./schema";

export {
  LIST_EVENTS_MAX_LIMIT,
  MetricsInputError,
  decodeEventCursor,
  encodeEventCursor,
  getAcquisitionReport,
  getFunnelReport,
  getOverviewReport,
  getProductReport,
  getRetentionReport,
  getRevenueReport,
  getWebReport,
  listEvents,
} from "./queries";
export type { EventCursor, MetricsDeps, QueryScope, RangeInput } from "./queries";

export type { AnalyticsMetrics, EventsQuery, MetaResponse } from "./queryApi";
export { CSV_TABLES, eventsTable, reportTable } from "./reportCsv";
export type { CsvTable, ReportName, ReportShapes } from "./reportCsv";
