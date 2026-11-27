/**
 * Browser tracker. Cookieless by default: no id, no storage, nothing written to
 * the browser; the server derives visitors from a daily-salted request hash.
 * `persist: true` opts into an anonymous id and idle sessions in localStorage.
 *
 * Every browser access goes through `WebEnvironment`, read only when
 * `createWebTracker` runs, so importing this module on a server touches nothing.
 */
import { cleanPath, createTrackerCore, fetchTransport } from "../client/tracker";
import type {
  EventMap,
  KeyValueStorage,
  Tracker,
  TrackerInternals,
  TrackerOptions,
  Transport,
} from "../client/tracker";
import { LIMITS, LINK_CLICK_PARAM } from "../shared/wire";
import type { WireAcquisition } from "../shared/wire";

export type {
  EventMap,
  FlushOptions,
  KeyValueStorage,
  TrackArgs,
  Tracker,
  TrackerOptions,
  Transport,
  TransportRequest,
  TransportResponse,
} from "../client/tracker";

type HistoryMethod = (data: unknown, unused: string, url?: string | URL | null) => void;

/** The slice of the browser the web tracker uses. Defaults to the real globals. */
export interface WebEnvironment {
  /** Current page URL. */
  href(): string;
  /** `document.referrer`. */
  referrer(): string;
  /** `document.visibilityState`. */
  visibilityState(): string;
  /** Wrapped in place to see client-side navigations. */
  history?: { pushState: HistoryMethod; replaceState: HistoryMethod };
  /** `popstate` and `pagehide` on the window, `visibilitychange` on the document. Returns the unsubscribe. */
  listen(type: "popstate" | "pagehide" | "visibilitychange", listener: () => void): () => void;
  sendBeacon?: (url: string, body: string) => boolean;
  /** A getter because merely reading `window.localStorage` throws in some sandboxed frames. */
  localStorage?: () => Pick<Storage, "getItem" | "setItem" | "removeItem"> | null | undefined;
  /** Viewport width in CSS pixels. */
  viewportWidth(): number | undefined;
  /** True when the browser sends Do Not Track. */
  doNotTrack(): boolean;
}

export interface WebTrackerOptions extends Omit<TrackerOptions, "platform" | "identify" | "storage"> {
  /** Keep an anonymous id and 30-minute idle sessions in localStorage. Default false (cookieless). */
  persist?: boolean;
  /** `$pageview` on creation and on each History navigation. Default true. */
  autoPageviews?: boolean;
  /** Landing URL parameter carrying the tracked-link click id. Default `LINK_CLICK_PARAM` ("link_click"). */
  linkClickParam?: string;
  /** Stay inert when the browser sends Do Not Track. Default false. */
  respectDoNotTrack?: boolean;
}

export type WebTracker<Events extends EventMap = EventMap> = Tracker<Events> & {
  /** Restores the wrapped History methods and removes the listeners. */
  destroy(): void;
};

const AD_CLICK_PARAMS = ["fbclid", "gclid", "ttclid", "msclkid"] as const;
const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const DEFAULT_STORAGE_KEY = "expo-analytics";

export function createWebTracker<Events extends EventMap = EventMap>(
  options: WebTrackerOptions,
  environment: WebEnvironment | undefined = defaultWebEnvironment(),
): WebTracker<Events> {
  if (!environment) return createInertTracker<Events>();
  const env = environment;
  if (options.respectDoNotTrack && safe(() => env.doNotTrack(), false)) {
    return createInertTracker<Events>();
  }

  const persist = options.persist === true;
  const now = options.now ?? Date.now;
  const sessionKey = `${options.storageKey ?? DEFAULT_STORAGE_KEY}:session`;
  const local = persist ? safe(() => env.localStorage?.() ?? undefined, undefined) : undefined;
  const landingHref = safe(() => env.href(), "");
  const referrer = safe(() => env.referrer(), "");

  const baseTransport = options.transport ?? fetchTransport;
  // A beacon cannot carry custom headers, so a configured `headers` needs the fetch path.
  const transport: Transport = (request) => {
    if (request.keepalive && !options.headers && env.sendBeacon) {
      try {
        // A string body goes out as text/plain, which needs no CORS preflight.
        if (env.sendBeacon(request.url, request.body)) return Promise.resolve({ status: 202 });
      } catch {
        // Fall through to keepalive fetch.
      }
    }
    return baseTransport(request);
  };

  const { tracker: core, internals } = createTrackerCore<Events>(
    {
      ...options,
      platform: "web",
      identify: persist,
      storage: local ? localStorageAdapter(local) : undefined,
      transport,
    },
    {
      context: () => {
        const context: { referrer?: string; screen_width?: number } = {};
        if (referrer) context.referrer = referrer.slice(0, LIMITS.referrerMaxLength);
        const width = safe(() => env.viewportWidth(), undefined);
        if (typeof width === "number" && Number.isFinite(width) && width > 0) {
          context.screen_width = Math.round(width);
        }
        return context;
      },
    },
  );

  const landing = landingAcquisition(landingHref, referrer, options.linkClickParam ?? LINK_CLICK_PARAM);
  if (landing) core.setAcquisition(landing);

  // Without usable localStorage the sessions still work, for this page only.
  const sessions = persist
    ? webSessions(local ?? memoryStorage(), sessionKey, internals, core, now)
    : undefined;

  const tracker: Tracker<Events> = {
    ...core,
    track: ((...args: Parameters<Tracker<Events>["track"]>) => {
      sessions?.touch();
      core.track(...args);
    }) as Tracker<Events>["track"],
    screen: (name, props) => {
      sessions?.touch();
      core.screen(name, props);
    },
    page: (path, props) => {
      sessions?.touch();
      core.page(path, props);
    },
    startSession: () => {
      core.startSession();
      sessions?.save();
    },
    endSession: () => {
      core.endSession();
      sessions?.forget();
    },
    setEnabled: (enabled) => {
      core.setEnabled(enabled);
      if (!enabled) sessions?.forget();
    },
    reset: () => {
      const done = core.reset();
      sessions?.forget();
      return done;
    },
  };

  const cleanups: (() => void)[] = [];
  const listen = (type: "popstate" | "pagehide" | "visibilitychange", listener: () => void) => {
    try {
      cleanups.push(env.listen(type, listener));
    } catch {
      // A missing target only loses that signal.
    }
  };

  if (options.autoPageviews !== false) {
    let lastPath: string | undefined;
    const pageview = () => {
      const path = pathOf(safe(() => env.href(), ""));
      if (path === lastPath) return;
      lastPath = path;
      tracker.page(path);
    };
    pageview();

    const history = env.history;
    if (history) {
      const originalPush = history.pushState;
      const originalReplace = history.replaceState;
      const wrap = (original: HistoryMethod): HistoryMethod =>
        function wrapped(this: unknown, data, unused, url) {
          original.call(this, data, unused, url);
          // The URL has changed by now; a tracker failure must not break navigation.
          safe(pageview, undefined);
        };
      const wrappedPush = wrap(originalPush);
      const wrappedReplace = wrap(originalReplace);
      history.pushState = wrappedPush;
      history.replaceState = wrappedReplace;
      cleanups.push(() => {
        // Someone may have wrapped after us; restoring then would discard their wrapper.
        if (history.pushState === wrappedPush) history.pushState = originalPush;
        if (history.replaceState === wrappedReplace) history.replaceState = originalReplace;
      });
    }
    listen("popstate", pageview);
  }

  const flushForUnload = () => {
    void tracker.flush({ keepalive: true });
  };
  listen("visibilitychange", () => {
    if (safe(() => env.visibilityState(), "visible") === "hidden") flushForUnload();
  });
  listen("pagehide", flushForUnload);

  let destroyed = false;
  return {
    ...tracker,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      for (const cleanup of cleanups.splice(0)) safe(cleanup, undefined);
    },
  };
}

/** The real browser globals, or undefined on a server. Read only when called. */
function defaultWebEnvironment(): WebEnvironment | undefined {
  if (typeof window === "undefined" || typeof document === "undefined") return undefined;
  const win = window;
  const doc = document;
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  return {
    href: () => win.location.href,
    referrer: () => doc.referrer,
    visibilityState: () => doc.visibilityState,
    history: win.history,
    listen: (type, listener) => {
      const target: Pick<EventTarget, "addEventListener" | "removeEventListener"> =
        type === "visibilitychange" ? doc : win;
      target.addEventListener(type, listener);
      return () => target.removeEventListener(type, listener);
    },
    sendBeacon:
      nav && typeof nav.sendBeacon === "function"
        ? (url, body) => nav.sendBeacon(url, body)
        : undefined,
    localStorage: () => win.localStorage,
    viewportWidth: () => win.innerWidth,
    doNotTrack: () => {
      const flags = [
        (nav as { doNotTrack?: string | null } | undefined)?.doNotTrack,
        (win as { doNotTrack?: string | null }).doNotTrack,
        (nav as { msDoNotTrack?: string | null } | undefined)?.msDoNotTrack,
      ];
      return flags.some((flag) => flag === "1" || flag === "yes");
    },
  };
}

/** Same interface, does nothing: for servers, Do Not Track, and non-browser runtimes. */
function createInertTracker<Events extends EventMap>(): WebTracker<Events> {
  const noop = () => {};
  const resolved = () => Promise.resolve();
  return {
    track: noop as Tracker<Events>["track"],
    screen: noop,
    page: noop,
    startSession: noop,
    endSession: noop,
    setAcquisition: noop,
    clearAcquisition: noop,
    flush: resolved,
    setEnabled: noop,
    reset: resolved,
    shutdown: resolved,
    destroy: noop,
  };
}

/**
 * Idle sessions shared by every tab through localStorage. Each event first
 * checks the stored session: a live one is adopted, an expired one is ended at
 * its last activity and replaced.
 */
function webSessions<Events extends EventMap>(
  local: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  key: string,
  internals: TrackerInternals,
  core: Tracker<Events>,
  now: () => number,
) {
  type Stored = { id: string; startedAt: number; lastAt: number };
  const read = (): Stored | undefined => {
    const raw = safe(() => local.getItem(key), null);
    if (!raw) return undefined;
    try {
      const value = JSON.parse(raw) as Partial<Stored>;
      if (
        typeof value.id === "string" &&
        typeof value.startedAt === "number" &&
        typeof value.lastAt === "number"
      ) {
        return { id: value.id, startedAt: value.startedAt, lastAt: value.lastAt };
      }
    } catch {
      // Corrupt entry: treat as no session.
    }
    return undefined;
  };
  const write = (value: Stored) => safe(() => local.setItem(key, JSON.stringify(value)), undefined);
  const save = () => {
    const open = internals.session();
    if (open) write({ ...open, lastAt: now() });
  };

  return {
    touch: () => {
      if (!internals.isEnabled()) return;
      const at = now();
      const stored = read();
      if (stored && at - stored.lastAt <= LIMITS.sessionIdleMs) {
        if (internals.session()?.id !== stored.id) internals.resumeSession(stored.id, stored.startedAt);
        write({ ...stored, lastAt: at });
        return;
      }
      if (stored) {
        // Expired, possibly from an earlier visit: end it where its activity stopped.
        if (internals.session()?.id !== stored.id) internals.resumeSession(stored.id, stored.startedAt);
        internals.endSessionAt(stored.lastAt);
      }
      core.startSession();
      save();
    },
    save,
    forget: () => safe(() => local.removeItem(key), undefined),
  };
}

function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

function localStorageAdapter(local: Pick<Storage, "getItem" | "setItem" | "removeItem">): KeyValueStorage {
  return {
    getItem: async (key) => local.getItem(key),
    setItem: async (key, value) => local.setItem(key, value),
    removeItem: async (key) => local.removeItem(key),
  };
}

/** First touch from the landing URL. Parsed by hand: React Native's URL polyfill lacks searchParams. */
function landingAcquisition(
  href: string,
  referrer: string,
  linkClickParam: string,
): WireAcquisition | undefined {
  const { host, path, query } = splitUrl(href);
  const params = parseQuery(query);
  const acquisition: WireAcquisition = {};
  for (const name of UTM_PARAMS) {
    const value = params[name];
    if (value) acquisition[name] = value;
  }
  for (const kind of AD_CLICK_PARAMS) {
    const value = params[kind];
    if (value) {
      acquisition.click_id = value;
      acquisition.click_id_kind = kind;
      break;
    }
  }
  const linkClickId = params[linkClickParam];
  if (linkClickId) acquisition.link_click_id = linkClickId;
  // A same-site referrer is internal navigation, not where the visitor came from.
  if (referrer && splitUrl(referrer).host !== host) acquisition.referrer = referrer;
  const landingPath = cleanPath(path);
  if (landingPath) acquisition.landing_path = landingPath;
  return Object.keys(acquisition).length > 0 ? acquisition : undefined;
}

function pathOf(href: string): string {
  return cleanPath(splitUrl(href).path) ?? "/";
}

function splitUrl(href: string): { host: string; path: string; query: string } {
  const withoutHash = href.split("#", 1)[0] ?? "";
  const queryAt = withoutHash.indexOf("?");
  const beforeQuery = queryAt < 0 ? withoutHash : withoutHash.slice(0, queryAt);
  const query = queryAt < 0 ? "" : withoutHash.slice(queryAt + 1);
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/]*)(.*)$/i.exec(beforeQuery);
  if (!match) return { host: "", path: beforeQuery || "/", query };
  const authority = match[1]!.toLowerCase();
  const host = authority.slice(authority.lastIndexOf("@") + 1);
  return { host, path: match[2] || "/", query };
}

function parseQuery(query: string): Record<string, string> {
  // No prototype, so names like "constructor" are not mistaken for present.
  const params: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const name = decode(eq < 0 ? pair : pair.slice(0, eq));
    const value = decode(eq < 0 ? "" : pair.slice(eq + 1));
    // The first occurrence wins, like URLSearchParams.get.
    if (name && !(name in params)) params[name] = value;
  }
  return params;
}

function decode(text: string): string {
  try {
    return decodeURIComponent(text.replace(/\+/g, " "));
  } catch {
    return text;
  }
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
