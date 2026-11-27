/**
 * Metric queries: the reports, the thin fetchers they are built from, and the
 * types a host or HTTP layer needs to call them. The report contract lives in
 * `../../metrics`. SQL fragments stay internal to this directory.
 */

export {
  LIST_EVENTS_MAX_LIMIT,
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
} from "./reports";
export type { RangeInput } from "./reports";

export { MetricsInputError } from "./context";
export type { MetricsDeps, QueryScope } from "./context";

export {
  fetchActivityRows,
  fetchChannelCohorts,
  fetchCohortActivity,
  fetchCohortMembers,
  fetchLinkClicksByChannel,
  fetchNewUsersByDay,
  fetchSignupsByPlatform,
} from "./product";
export type { ChannelCohortOptions } from "./product";
export { fetchFunnelEvents } from "./funnels";
export { fetchSessionBreakdowns, fetchTopPages, fetchWebTotals } from "./web";
export { fetchCancellationReasons, fetchLedgerForReplay, fetchRevenueTotals } from "./revenue";
export { fetchEvents } from "./events";
export type { EventCursor, EventListFilter } from "./events";
