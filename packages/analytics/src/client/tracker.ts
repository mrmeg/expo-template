/**
 * Platform-neutral event tracker: queues events, batches them into `WireBatch`
 * POSTs and retries what the server did not take. Everything environmental
 * (transport, storage, clock, ids) is injected, so the same core runs under the
 * web wrapper, the React Native wrapper, a server, or a test without a DOM.
 */
import { EVENT_NAME_PATTERN, LIMITS, RESERVED_EVENTS } from "../shared/wire";
import type {
  Platform,
  WireAcquisition,
  WireBatch,
  WireContext,
  WireEvent,
} from "../shared/wire";

export type EventMap = Record<string, Record<string, unknown> | undefined>;

/** `track` arguments for one event: props are required exactly when the map's type excludes `undefined`. */
export type TrackArgs<Events extends EventMap, Name extends keyof Events> =
  undefined extends Events[Name]
    ? [props?: Exclude<Events[Name], undefined>]
    : [props: Events[Name]];

export interface TransportRequest {
  url: string;
  /** JSON-encoded `WireBatch`. */
  body: string;
  headers: Record<string, string>;
  /** The page may be unloading: the request must outlive it (`fetch` `keepalive` or a beacon). */
  keepalive: boolean;
}

export interface TransportResponse {
  status: number;
}

/** Sends one batch. Reject (or throw) on a network error; resolve with the HTTP status otherwise. */
export type Transport = (request: TransportRequest) => Promise<TransportResponse>;

/** AsyncStorage-compatible key-value store. */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface FlushOptions {
  /** The page is going away: send one size-capped request that survives unload. */
  keepalive?: boolean;
}

export interface TrackerOptions {
  /** Full URL of the ingest endpoint, e.g. "https://app.example.com/analytics/e". */
  endpoint: string;
  platform: Platform;
  appVersion?: string;
  /** Extra request headers, typically the auth token the server resolves the user from. */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  /** Default: global fetch. */
  transport?: Transport;
  /** Persists the anonymous id, first-touch acquisition and the unsent queue. Omit for memory only. */
  storage?: KeyValueStorage;
  /** Storage key namespace. Default "expo-analytics". */
  storageKey?: string;
  /** Send an anonymous id and session ids. False is the cookieless mode. Default true. */
  identify?: boolean;
  /** Default 30_000. */
  flushIntervalMs?: number;
  /** Queue length that triggers a flush. Default 20. */
  flushAt?: number;
  /** Oldest events are dropped beyond this. Default 1000. */
  maxQueue?: number;
  /** Default true. False is the consent switch: nothing is queued, stored or sent. */
  enabled?: boolean;
  now?: () => number;
  /** UUID v4. Default uses crypto.getRandomValues when present. */
  generateId?: () => string;
  onError?: (error: unknown) => void;
}

export interface Tracker<Events extends EventMap = EventMap> {
  track<Name extends keyof Events & string>(name: Name, ...args: TrackArgs<Events, Name>): void;
  /** Emits `$screen` and makes `name` the path of the events that follow. */
  screen(name: string, props?: Record<string, unknown>): void;
  /** Emits `$pageview` and makes `path` the path of the events that follow. */
  page(path: string, props?: Record<string, unknown>): void;
  /** Ends any open session, then opens a new one. A no-op in cookieless mode. */
  startSession(): void;
  /** Emits `$session_end` with `duration_ms`. A no-op in cookieless mode or with no open session. */
  endSession(): void;
  /** Merges first-touch acquisition: a field already set is kept. */
  setAcquisition(acquisition: WireAcquisition): void;
  /** Stops sending acquisition, typically once the server has attached it to the user. */
  clearAcquisition(): void;
  /** Never rejects. */
  flush(options?: FlushOptions): Promise<void>;
  setEnabled(enabled: boolean): void;
  /**
   * Sign-out: ends the session, clears acquisition and flushes, keeping the
   * anonymous id. Call it before dropping the auth token: when no flush is in
   * flight, the first batch reads `headers()` synchronously. Best effort; with
   * a flush in flight, the remaining events go out with the headers of the time.
   */
  reset(): Promise<void>;
  /** Stops timers and flushes; the tracker ignores calls afterwards. */
  shutdown(): Promise<void>;
}

/**
 * Hooks the web and native wrappers need that are not part of the public API:
 * resuming a session restored from storage and ending one at a past time.
 */
export interface TrackerInternals {
  session(): { id: string; startedAt: number } | undefined;
  /** Adopts an existing session without emitting `$session_start`. */
  resumeSession(id: string, startedAt: number): void;
  /** Ends the open session with its duration measured to `endedAt`. */
  endSessionAt(endedAt: number): void;
  isEnabled(): boolean;
}

export interface TrackerHooks {
  /** Extra batch context, read when each batch is built. */
  context?: () => Partial<WireContext>;
}

const DEFAULT_STORAGE_KEY = "expo-analytics";
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;
/**
 * Browsers cap the bodies of all in-flight keepalive requests (and beacons) at
 * 64 KiB together, so a keepalive flush is one request below that.
 */
const KEEPALIVE_MAX_BYTES = 60_000;
/** Server columns with no `LIMITS` entry; generous enough for real ad click ids. */
const CLICK_ID_MAX_LENGTH = 512;
const SELF_REPORTED_SOURCE_MAX_LENGTH = LIMITS.utmMaxLength;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLICK_ID_KINDS: readonly NonNullable<WireAcquisition["click_id_kind"]>[] = [
  "fbclid",
  "gclid",
  "ttclid",
  "msclkid",
  "link",
];
const RESERVED_NAMES: ReadonlySet<string> = new Set(Object.values(RESERVED_EVENTS));

type SendOutcome = "ok" | "dropped" | "retry";
type HeaderSource = Record<string, string> | Promise<Record<string, string>> | undefined;

export function createTracker<Events extends EventMap = EventMap>(
  options: TrackerOptions,
): Tracker<Events> {
  return createTrackerCore<Events>(options).tracker;
}

/** `createTracker` plus the internal hooks. Not exported from the package root. */
export function createTrackerCore<Events extends EventMap = EventMap>(
  options: TrackerOptions,
  hooks: TrackerHooks = {},
): { tracker: Tracker<Events>; internals: TrackerInternals } {
  const now = options.now ?? Date.now;
  const generateId = options.generateId ?? defaultGenerateId;
  const transport = options.transport ?? fetchTransport;
  const storage = options.storage;
  const identify = options.identify !== false;
  const flushIntervalMs = options.flushIntervalMs ?? 30_000;
  const flushAt = Math.max(1, options.flushAt ?? 20);
  const maxQueue = Math.max(1, options.maxQueue ?? 1000);
  const namespace = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const keys = {
    anonymousId: `${namespace}:anonymous_id`,
    acquisition: `${namespace}:acquisition`,
    queue: `${namespace}:queue`,
  };

  let enabled = options.enabled !== false;
  let stopped = false;
  let queue: WireEvent[] = [];
  let anonymousId: string | undefined;
  let session: { id: string; startedAt: number } | undefined;
  let currentPath: string | undefined;
  let acquisition: WireAcquisition | undefined;
  let acquisitionEpoch = 0;

  let loadPromise: Promise<void> | undefined;
  let inFlight: Promise<void> | undefined;
  let intervalTimer: ReturnType<typeof setInterval> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  /** Ids in an unsettled keepalive request, so back-to-back unload events don't post them twice. */
  const keepaliveIds = new Set<string>();

  let persistChain: Promise<void> = Promise.resolve();
  let persistScheduled = false;
  let queueDirty = false;
  let acquisitionDirty = false;

  function report(error: unknown): void {
    try {
      options.onError?.(error);
    } catch {
      // A throwing onError must not break the caller either.
    }
  }

  // ---- storage --------------------------------------------------------------

  function ensureLoaded(): Promise<void> {
    loadPromise ??= load();
    return loadPromise;
  }

  async function load(): Promise<void> {
    if (!storage) return;
    const epoch = acquisitionEpoch;
    try {
      const [storedId, storedAcquisition, storedQueue] = await Promise.all([
        identify ? storage.getItem(keys.anonymousId) : Promise.resolve(null),
        storage.getItem(keys.acquisition),
        storage.getItem(keys.queue),
      ]);
      if (storedId && storedId.length <= LIMITS.idMaxLength && !anonymousId) {
        anonymousId = storedId;
      }
      // A clear or a disable that happened while we were reading wins over what was stored.
      if (storedAcquisition && epoch === acquisitionEpoch) {
        const stored = sanitizeAcquisition(parseJson(storedAcquisition), report);
        if (stored) {
          // Stored acquisition is older, so it is the first touch.
          const merged = mergeFirstTouch(stored, acquisition ?? {});
          if (!sameAcquisition(merged, acquisition)) acquisitionDirty = true;
          acquisition = merged;
        }
      }
      if (storedQueue && enabled) {
        const restored = parseQueue(parseJson(storedQueue));
        if (restored.length > 0) {
          const present = new Set(queue.map((event) => event.id));
          queue = [...restored.filter((event) => !present.has(event.id)), ...queue];
          capQueue();
        }
      }
    } catch (error) {
      report(error);
    }
  }

  function schedulePersist(): void {
    if (!storage || persistScheduled) return;
    persistScheduled = true;
    // Writes wait for the load, or the first write would replace the previous launch's queue.
    persistChain = persistChain
      .then(() => ensureLoaded())
      .then(async () => {
        persistScheduled = false;
        const writes: Promise<void>[] = [];
        if (queueDirty) {
          queueDirty = false;
          writes.push(
            queue.length > 0
              ? storage.setItem(keys.queue, JSON.stringify(queue))
              : storage.removeItem(keys.queue),
          );
        }
        if (acquisitionDirty && enabled) {
          acquisitionDirty = false;
          writes.push(
            acquisition
              ? storage.setItem(keys.acquisition, JSON.stringify(acquisition))
              : storage.removeItem(keys.acquisition),
          );
        }
        await Promise.all(writes);
      })
      .catch((error: unknown) => {
        persistScheduled = false;
        report(error);
      });
  }

  function markQueueDirty(): void {
    queueDirty = true;
    schedulePersist();
  }

  function ensureAnonymousId(): void {
    if (!identify || anonymousId) return;
    anonymousId = generateId();
    if (storage) {
      storage.setItem(keys.anonymousId, anonymousId).catch(report);
    }
  }

  // ---- queue ----------------------------------------------------------------

  function capQueue(): void {
    if (queue.length > maxQueue) queue.splice(0, queue.length - maxQueue);
  }

  function removeEvents(ids: readonly string[]): void {
    const settled = new Set(ids);
    const before = queue.length;
    queue = queue.filter((event) => !settled.has(event.id));
    if (queue.length !== before) markQueueDirty();
  }

  function enqueue(
    name: string,
    props: Record<string, unknown> | undefined,
    fields: { path?: string; sessionId?: string; at?: number } = {},
  ): void {
    const event: WireEvent = {
      id: generateId(),
      name,
      ts: new Date(fields.at ?? now()).toISOString(),
    };
    const sessionId = fields.sessionId ?? session?.id;
    if (identify && sessionId) event.session_id = sessionId;
    const path = fields.path ?? currentPath;
    if (path) event.path = path;
    const cleanProps = sanitizeProps(props, report);
    if (cleanProps) event.props = cleanProps;

    queue.push(event);
    capQueue();
    if (!loadPromise && storage) void ensureLoaded();
    markQueueDirty();
    if (queue.length >= flushAt && !retryTimer) void flush();
  }

  function active(): boolean {
    return enabled && !stopped;
  }

  // ---- delivery -------------------------------------------------------------

  function readHeaders(): HeaderSource {
    if (!options.headers) return undefined;
    try {
      return options.headers();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /** Built per send attempt, never cached: `sent_at` must be the time of this attempt. */
  function buildBatch(events: WireEvent[]): WireBatch {
    const context: WireContext = { platform: options.platform };
    if (options.appVersion) context.app_version = options.appVersion;
    if (identify && anonymousId) context.anonymous_id = anonymousId;
    if (hooks.context) {
      try {
        Object.assign(context, hooks.context());
      } catch (error) {
        report(error);
      }
    }
    const batch: WireBatch = { sent_at: new Date(now()).toISOString(), context, events };
    if (acquisition && Object.keys(acquisition).length > 0) batch.acquisition = { ...acquisition };
    return batch;
  }

  async function send(
    events: WireEvent[],
    headerSource: HeaderSource,
    keepalive: boolean,
    body?: string,
  ): Promise<SendOutcome> {
    let status: number;
    try {
      const extra = (await headerSource) ?? {};
      const response = await transport({
        url: options.endpoint,
        body: body ?? JSON.stringify(buildBatch(events)),
        headers: { "Content-Type": "application/json", ...extra },
        keepalive,
      });
      status = response.status;
    } catch (error) {
      report(error);
      return "retry";
    }
    const ids = events.map((event) => event.id);
    if (status >= 200 && status < 300) {
      removeEvents(ids);
      failures = 0;
      // A pending retry would otherwise keep pausing the interval and threshold flushes.
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = undefined;
      return "ok";
    }
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
      // The server will reject this batch every time; keeping it would block the queue.
      removeEvents(ids);
      report(new Error(`expo-analytics: ingest rejected a batch of ${ids.length} with ${status}`));
      return "dropped";
    }
    report(new Error(`expo-analytics: ingest answered ${status}; retrying`));
    return "retry";
  }

  function scheduleRetry(): void {
    if (!active()) return;
    failures += 1;
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** (failures - 1), MAX_BACKOFF_MS);
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void flush();
    }, delay);
    unref(retryTimer);
  }

  async function drain(): Promise<void> {
    // Read synchronously so `reset()` sends with the headers of the user signing out.
    let headerSource = readHeaders();
    await ensureLoaded();
    while (enabled && queue.length > 0) {
      ensureAnonymousId();
      const events = queue.slice(0, LIMITS.batchMaxEvents);
      const outcome = await send(events, headerSource, false);
      if (outcome === "retry") {
        scheduleRetry();
        return;
      }
      headerSource = readHeaders();
    }
  }

  async function sendKeepalive(): Promise<void> {
    // No timers between the unload event and the request: only resolved-promise
    // continuations, which run before the page is torn down.
    const headerSource = readHeaders();
    if (storage) await ensureLoaded();
    if (!enabled) return;
    ensureAnonymousId();
    const events: WireEvent[] = [];
    let body = "";
    for (const event of queue) {
      if (keepaliveIds.has(event.id)) continue;
      if (events.length >= LIMITS.batchMaxEvents) break;
      events.push(event);
      const candidate = JSON.stringify(buildBatch(events));
      if (utf8Length(candidate) > KEEPALIVE_MAX_BYTES && events.length > 1) {
        events.pop();
        break;
      }
      body = candidate;
    }
    if (events.length === 0) return;
    for (const event of events) keepaliveIds.add(event.id);
    try {
      await send(events, headerSource, true, body);
    } finally {
      for (const event of events) keepaliveIds.delete(event.id);
    }
  }

  function flush(flushOptions?: FlushOptions): Promise<void> {
    if (!enabled) return Promise.resolve();
    if (flushOptions?.keepalive) return sendKeepalive().catch(report);
    if (inFlight) return inFlight;
    const run = drain()
      .catch(report)
      .finally(() => {
        inFlight = undefined;
      });
    inFlight = run;
    return run;
  }

  // ---- timers ---------------------------------------------------------------

  function startTimers(): void {
    if (intervalTimer || stopped || !enabled) return;
    intervalTimer = setInterval(() => {
      if (!retryTimer) void flush();
    }, flushIntervalMs);
    unref(intervalTimer);
  }

  function stopTimers(): void {
    if (intervalTimer) clearInterval(intervalTimer);
    if (retryTimer) clearTimeout(retryTimer);
    intervalTimer = undefined;
    retryTimer = undefined;
  }

  // ---- sessions -------------------------------------------------------------

  function endSessionAt(endedAt: number): void {
    if (!session) return;
    const ending = session;
    session = undefined;
    if (!active() || !identify) return;
    enqueue(
      RESERVED_EVENTS.sessionEnd,
      { duration_ms: Math.max(0, endedAt - ending.startedAt) },
      { sessionId: ending.id, at: endedAt },
    );
  }

  function startSession(): void {
    if (!active() || !identify) return;
    if (session) endSessionAt(now());
    session = { id: generateId(), startedAt: now() };
    enqueue(RESERVED_EVENTS.sessionStart, undefined, { sessionId: session.id });
  }

  // ---- public API -----------------------------------------------------------

  function guard<Args extends unknown[]>(fn: (...args: Args) => void): (...args: Args) => void {
    return (...args) => {
      try {
        fn(...args);
      } catch (error) {
        report(error);
      }
    };
  }

  const track = guard((name: string, props?: Record<string, unknown>) => {
    if (!active()) return;
    const problem = invalidEventName(name);
    if (problem) {
      report(new Error(`expo-analytics: dropped event "${String(name)}": ${problem}`));
      return;
    }
    enqueue(name, props);
  });

  const tracker: Tracker<Events> = {
    track: track as Tracker<Events>["track"],
    screen: guard((name: string, props?: Record<string, unknown>) => {
      if (!active()) return;
      currentPath = cleanPath(name);
      enqueue(RESERVED_EVENTS.screen, props);
    }),
    page: guard((path: string, props?: Record<string, unknown>) => {
      if (!active()) return;
      currentPath = cleanPath(path) ?? "/";
      enqueue(RESERVED_EVENTS.pageview, props);
    }),
    startSession: guard(startSession),
    endSession: guard(() => endSessionAt(now())),
    setAcquisition: guard((partial: WireAcquisition) => {
      if (stopped) return;
      const incoming = sanitizeAcquisition(partial, report);
      if (!incoming) return;
      const merged = mergeFirstTouch(acquisition ?? {}, incoming);
      if (sameAcquisition(merged, acquisition)) return;
      acquisition = merged;
      acquisitionDirty = true;
      // Kept in memory while disabled, so a later consent still sends the landing data.
      if (enabled) schedulePersist();
    }),
    clearAcquisition: guard(() => {
      if (!acquisition && !acquisitionDirty) return;
      acquisition = undefined;
      acquisitionEpoch += 1;
      acquisitionDirty = true;
      if (enabled) schedulePersist();
    }),
    flush: (flushOptions) => {
      try {
        return flush(flushOptions);
      } catch (error) {
        report(error);
        return Promise.resolve();
      }
    },
    setEnabled: guard((next: boolean) => {
      if (stopped || next === enabled) return;
      enabled = next;
      if (next) {
        void ensureLoaded();
        startTimers();
        if (acquisitionDirty) schedulePersist();
        return;
      }
      stopTimers();
      failures = 0;
      session = undefined;
      keepaliveIds.clear();
      if (queue.length > 0 || storage) {
        queue = [];
        markQueueDirty();
      }
    }),
    reset: () => {
      try {
        endSessionAt(now());
        tracker.clearAcquisition();
        currentPath = undefined;
        return flush();
      } catch (error) {
        report(error);
        return Promise.resolve();
      }
    },
    shutdown: () => {
      if (stopped) return Promise.resolve();
      stopTimers();
      const done = flush();
      stopped = true;
      return done;
    },
  };

  const internals: TrackerInternals = {
    session: () => (session ? { ...session } : undefined),
    resumeSession: (id, startedAt) => {
      if (!active() || !identify) return;
      session = { id, startedAt };
    },
    endSessionAt: (endedAt) => {
      try {
        endSessionAt(endedAt);
      } catch (error) {
        report(error);
      }
    },
    isEnabled: () => active(),
  };

  if (enabled) {
    if (storage) void ensureLoaded();
    startTimers();
  }

  return { tracker, internals };
}

// ---- helpers ----------------------------------------------------------------

export const fetchTransport: Transport = async (request) => {
  const response = await fetch(request.url, {
    method: "POST",
    headers: request.headers,
    body: request.body,
    keepalive: request.keepalive,
  });
  return { status: response.status };
};

/** Lets a server process exit with a tracker alive; a no-op where timers are numbers. */
function unref(timer: unknown): void {
  const maybe = timer as { unref?: () => void } | null;
  if (maybe && typeof maybe.unref === "function") maybe.unref();
}

function defaultGenerateId(): string {
  const bytes = new Uint8Array(16);
  const cryptoLike = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } })
    .crypto;
  if (cryptoLike && typeof cryptoLike.getRandomValues === "function") {
    cryptoLike.getRandomValues(bytes);
  } else {
    // Hermes without a crypto polyfill. Ids only need to be unique, not secret.
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  let hex = "";
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
    if (i === 3 || i === 5 || i === 7 || i === 9) hex += "-";
  }
  return hex;
}

function invalidEventName(name: unknown): string | undefined {
  if (typeof name !== "string" || name.length === 0) return "the name must be a non-empty string";
  if (name.length > LIMITS.eventNameMaxLength) {
    return `longer than ${LIMITS.eventNameMaxLength} characters`;
  }
  if (!EVENT_NAME_PATTERN.test(name)) return "names are lowercase snake_case";
  if (name.startsWith("$") && !RESERVED_NAMES.has(name)) return "the $ prefix is reserved";
  return undefined;
}

/** Drops the query string and fragment (they can carry tokens) and cuts to the server limit. */
export function cleanPath(path: unknown): string | undefined {
  if (typeof path !== "string") return undefined;
  const bare = path.split(/[?#]/, 1)[0]!.trim();
  if (!bare) return undefined;
  return bare.slice(0, LIMITS.pathMaxLength);
}

function sanitizeProps(
  props: unknown,
  report: (error: unknown) => void,
): Record<string, unknown> | undefined {
  if (props === undefined || props === null) return undefined;
  if (typeof props !== "object" || Array.isArray(props)) {
    report(new Error("expo-analytics: props must be a plain object; dropped them"));
    return undefined;
  }
  let json: string;
  try {
    json = JSON.stringify(props);
  } catch (error) {
    report(error);
    return { _truncated: true };
  }
  const copy = JSON.parse(json) as Record<string, unknown>;
  // The server would replace these anyway; do it here and save the bytes.
  if (
    Object.keys(copy).length > LIMITS.propertiesMaxKeys ||
    utf8Length(json) > LIMITS.propertiesMaxBytes
  ) {
    return { _truncated: true };
  }
  return Object.keys(copy).length > 0 ? copy : undefined;
}

function sanitizeAcquisition(
  input: unknown,
  report: (error: unknown) => void,
): WireAcquisition | undefined {
  if (!input || typeof input !== "object") return undefined;
  const source = input as Record<string, unknown>;
  const out: WireAcquisition = {};
  const text = (key: string, max: number): string | undefined => {
    const value = source[key];
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, max) : undefined;
  };
  const assign = <K extends keyof WireAcquisition>(key: K, value: WireAcquisition[K] | undefined) => {
    if (value !== undefined) out[key] = value;
  };
  assign("utm_source", text("utm_source", LIMITS.utmMaxLength));
  assign("utm_medium", text("utm_medium", LIMITS.utmMaxLength));
  assign("utm_campaign", text("utm_campaign", LIMITS.utmMaxLength));
  assign("utm_content", text("utm_content", LIMITS.utmMaxLength));
  assign("utm_term", text("utm_term", LIMITS.utmMaxLength));
  assign("referrer", text("referrer", LIMITS.referrerMaxLength));
  assign("landing_path", cleanPath(source.landing_path));
  assign("self_reported_source", text("self_reported_source", SELF_REPORTED_SOURCE_MAX_LENGTH));

  const clickId = text("click_id", CLICK_ID_MAX_LENGTH);
  const kind = source.click_id_kind;
  if (clickId && CLICK_ID_KINDS.includes(kind as never)) {
    out.click_id = clickId;
    out.click_id_kind = kind as WireAcquisition["click_id_kind"];
  }

  const linkClickId = text("link_click_id", LIMITS.idMaxLength);
  if (linkClickId) {
    // The server stores it as a uuid; anything else would fail the whole batch.
    if (UUID_PATTERN.test(linkClickId)) out.link_click_id = linkClickId;
    else report(new Error("expo-analytics: link_click_id is not a UUID; dropped it"));
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** `earlier` wins field by field; the click id and its kind move together. */
function mergeFirstTouch(earlier: WireAcquisition, later: WireAcquisition): WireAcquisition {
  const merged: WireAcquisition = { ...later, ...earlier };
  if (earlier.click_id) {
    merged.click_id = earlier.click_id;
    merged.click_id_kind = earlier.click_id_kind;
  }
  return merged;
}

function sameAcquisition(a: WireAcquisition | undefined, b: WireAcquisition | undefined): boolean {
  if (!a || !b) return a === b;
  const aKeys = Object.keys(a) as (keyof WireAcquisition)[];
  return aKeys.length === Object.keys(b).length && aKeys.every((key) => a[key] === b[key]);
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function parseQueue(value: unknown): WireEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (event): event is WireEvent =>
      !!event &&
      typeof event === "object" &&
      typeof (event as WireEvent).id === "string" &&
      typeof (event as WireEvent).name === "string" &&
      typeof (event as WireEvent).ts === "string",
  );
}

export function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      // A surrogate pair is one 4-byte code point.
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}
