/**
 * Wire contract between the trackers (`.`, `./web`, `./native`) and the ingest
 * endpoint (`./server`). Pure types and constants: no runtime dependencies, so
 * both sides import it and the format is declared once.
 *
 * Identity rules the server enforces, not the client:
 * - `user_id` never travels on the wire. The host resolves it from the request
 *   (`resolveUserId`), so a client cannot write events as someone else.
 * - `anonymous_id` and `session_id` are optional. A cookieless web tracker
 *   sends neither, and the server derives both from a daily-salted hash of the
 *   request (see `server/visitor.ts`).
 */

/** Platforms a tracker reports. `server` is for events the host emits itself. */
export const PLATFORMS = ["ios", "android", "web", "server"] as const;
export type Platform = (typeof PLATFORMS)[number];

/**
 * Event names the package writes itself. Everything else is the host's.
 * A `$` prefix is reserved: the server rejects unknown `$` names.
 */
export const RESERVED_EVENTS = {
  /** A web page was viewed. `path` is the URL path. */
  pageview: "$pageview",
  /** A native screen was shown. `path` is the screen or route name. */
  screen: "$screen",
  /** A native session began (app foregrounded after the idle timeout). */
  sessionStart: "$session_start",
  /** A native session ended; `props.duration_ms` is its length. */
  sessionEnd: "$session_end",
} as const;
export type ReservedEventName = (typeof RESERVED_EVENTS)[keyof typeof RESERVED_EVENTS];

/** Lowercase snake case, optionally `$`-prefixed for the reserved names. */
export const EVENT_NAME_PATTERN = /^\$?[a-z][a-z0-9_]*$/;

export const LIMITS = {
  eventNameMaxLength: 64,
  pathMaxLength: 512,
  idMaxLength: 64,
  propertiesMaxBytes: 4096,
  propertiesMaxKeys: 50,
  batchMaxEvents: 100,
  bodyMaxBytes: 1_048_576,
  /**
   * Events still older than this after the batch's clock correction are
   * clamped to the window's start, in their original order, 1 ms apart.
   */
  timestampMaxAgeMs: 30 * 24 * 60 * 60 * 1000,
  /**
   * A batch without `sent_at` whose newest event is further ahead than this is
   * shifted back as a whole, so that event lands at server time.
   */
  timestampMaxFutureMs: 5 * 60 * 1000,
  utmMaxLength: 100,
  referrerMaxLength: 512,
  /** Web sessions the server derives end after this much inactivity. */
  sessionIdleMs: 30 * 60 * 1000,
} as const;

/**
 * Query parameter a tracked link (`<basePath>/go/:channel`) appends to its web
 * destination. The web tracker reads it into `acquisition.link_click_id`, which
 * ties a later sign-up to the click that brought the visitor.
 */
export const LINK_CLICK_PARAM = "link_click";

/** One captured event. */
export interface WireEvent {
  /** Client-generated UUID. Replays are dropped on it, so retries are safe. */
  id: string;
  name: string;
  /** ISO 8601 client time. */
  ts: string;
  /** Client session id (native, or web with storage enabled). */
  session_id?: string;
  /** URL path for `$pageview`, screen or route name otherwise. No query string. */
  path?: string;
  /** Flat JSON. Oversized payloads are replaced with `{ _truncated: true }`. */
  props?: Record<string, unknown>;
}

/** Sent once per batch; applies to every event in it. */
export interface WireContext {
  platform?: Platform;
  app_version?: string;
  /** Stable per-install id (native) or per-browser id (web with storage). */
  anonymous_id?: string;
  /** `document.referrer` on web. Stored as host only. */
  referrer?: string;
  /** Viewport width in CSS pixels, used for the device class on web. */
  screen_width?: number;
}

/**
 * First-touch acquisition data. The tracker captures it once (landing URL on
 * web, the onboarding answer on any platform) and repeats it on each batch
 * until the server has attached it to a signed-in user. First touch wins on
 * the server: a field already set is never overwritten.
 */
export interface WireAcquisition {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  landing_path?: string;
  /** Ad click id value, with `click_id_kind` naming the parameter it came from. */
  click_id?: string;
  click_id_kind?: "fbclid" | "gclid" | "ttclid" | "msclkid" | "link";
  /** Id of the tracked-link click (`/go/:channel`) this visitor arrived through. */
  link_click_id?: string;
  /** The user's own answer to "where did you find us?". */
  self_reported_source?: string;
}

export interface WireBatch {
  /**
   * ISO 8601 client time at the moment this request is sent, set afresh on
   * every attempt (a retried or persisted batch gets a new value). The server
   * reads the client's clock offset from it and shifts every event in the
   * batch by that one offset, so a fast or slow device clock is corrected
   * without reordering events, and events queued offline keep their true age.
   * Optional: without it the server only pulls a batch whose newest event is
   * in the future back to server time.
   */
  sent_at?: string;
  context?: WireContext;
  acquisition?: WireAcquisition;
  events: WireEvent[];
}

/** `POST <basePath>/e` response body. */
export interface IngestResponse {
  received: number;
  inserted: number;
  rejected: number;
  duplicates: number;
}
