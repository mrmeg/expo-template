/**
 * Host-facing configuration for `createAnalyticsServer`, and the narrow
 * context the database modules take. Kept as interfaces so later options
 * (metrics, dashboard) extend them without a breaking change.
 */
import type { LinkConfig } from "./links";
import type { Names } from "./schema";
import type { SqlClient } from "./sql";

export interface AnalyticsServerConfig {
  sql: SqlClient;
  /** Stamped on every row; lets several apps share one set of tables. */
  appId: string;
  schema?: string;
  prefix?: string;
  /** Mount point. Default "/analytics". */
  basePath?: string;
  /** The signed-in user for a request, or null. Client-sent user ids are never trusted. */
  resolveUserId?: (request: Request) => string | null | Promise<string | null>;
  /** Gates the dashboard and query API. Default: always false (closed). */
  isAdmin?: (request: Request) => boolean | Promise<boolean>;
  /** Origins allowed to POST events cross-origin. Default: none (same-origin only). */
  allowedOrigins?: readonly string[] | "*";
  /** Default: first hop of x-forwarded-for, then x-real-ip. */
  clientIp?: (request: Request) => string | null;
  /** Default: the cf-ipcountry header. */
  country?: (request: Request) => string | null;
  links?: LinkConfig;
  now?: () => Date;
  onError?: (error: unknown, where: string) => void;
}

/** What the database modules need: where the tables are, which app, and the clock. */
export interface StoreContext {
  sql: SqlClient;
  names: Names;
  appId: string;
  now(): Date;
}
