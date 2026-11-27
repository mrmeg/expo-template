/**
 * A local demo of the dashboard with 90 days of made-up but realistic data:
 * sign-ups from a few channels, onboarding, daily use that decays the way real
 * retention does, trials, subscriptions, renewals, cancellations and refunds,
 * tracked-link clicks, and web traffic with referrers, UTM tags, devices and
 * countries. An example, not shipped code.
 *
 *   ANALYTICS_DEMO_DATABASE_URL=postgres://postgres@127.0.0.1:5432/analytics_demo \
 *     bun packages/analytics/examples/demo-server.ts [--reset]
 *
 * - Refuses any database host that is not loopback.
 * - Uses its own table prefix (`demo_`), so it never touches other tables.
 * - Seeds once: a later start finds the seed and serves it. `--reset`
 *   uninstalls the demo tables first and seeds again. A seed that stopped
 *   halfway is detected (the marker is written last) and redone.
 * - Deterministic: one seeded pseudo-random generator drives everything, so
 *   every run builds the same 90 days relative to the moment it starts (event
 *   ids, users, amounts); only what falls after "now" is left out.
 * - Serves on 127.0.0.1 only.
 * - Seeds through the public server API: `identify` with a backdated
 *   `createdAt`, the ingest endpoint for app and web sessions, `track`,
 *   `recordRevenueEvents` and `recordLinkClick`. The server's clock is moved
 *   along with the simulation while seeding (ingest accepts timestamps up to
 *   30 days behind its clock), so nothing is inserted directly.
 * - Serves `handle` on PORT (default 4319) with every request treated as an
 *   admin: never expose it beyond your machine.
 *
 * Typecheck with `bunx tsc --noEmit -p packages/analytics/examples` (the
 * package's own typecheck covers `src` only).
 */
import { createServer } from "node:http";

import postgres from "postgres";

import { createAnalyticsServer, fromPostgresJs, toNodeHandler, type RevenueEventInput } from "../src/server";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const PREFIX = "demo_";
const APP_ID = "demo-app";
const SEED = 20261127;
const DAYS = 90;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const SEED_MARKER = "__demo_seed_complete__";
const PORT = Number(process.env.PORT ?? 4319);
const HOST = "127.0.0.1";

// ── Connection ───────────────────────────────────────────────────────────────

const databaseUrl = process.env.ANALYTICS_DEMO_DATABASE_URL;
if (!databaseUrl) {
  console.error("Set ANALYTICS_DEMO_DATABASE_URL to a local Postgres, e.g. postgres://postgres@127.0.0.1:5432/analytics_demo");
  process.exit(1);
}
const parsedUrl = new URL(databaseUrl);
if (!LOOPBACK_HOSTS.has(parsedUrl.hostname)) {
  console.error(`Refusing ANALYTICS_DEMO_DATABASE_URL: the demo writes made-up data, so the host must be loopback (got "${parsedUrl.hostname}").`);
  process.exit(1);
}
const reset = process.argv.includes("--reset");

const raw = postgres(databaseUrl, { max: 4, onnotice: () => {} });
const sql = fromPostgresJs(raw);

// ── Server ───────────────────────────────────────────────────────────────────

/** While seeding, the server's clock follows the simulation; afterwards it is real time. */
let clock: Date | null = null;
/** The signed-in user for an ingest request while seeding; nobody afterwards. */
let seedingUser: string | null = null;

const analytics = createAnalyticsServer({
  sql,
  appId: APP_ID,
  prefix: PREFIX,
  now: () => clock ?? new Date(),
  resolveUserId: () => seedingUser,
  isAdmin: () => true,
  links: {
    ios: "https://apps.apple.com/app/id000000000",
    android: "https://play.google.com/store/apps/details?id=com.example.demo",
    web: "https://demo.example.com/start",
  },
  metrics: {
    timezone: "America/New_York",
    activation: { event: "project_created", withinDays: 7 },
    funnels: [
      {
        key: "onboarding",
        name: "Onboarding",
        steps: ["onboarding_started", "profile_completed", "project_created"],
        windowDays: 7,
      },
    ],
  },
  onError: (error, where) => console.error(`[demo] ${where}:`, error),
});

// ── Deterministic randomness ─────────────────────────────────────────────────

/** mulberry32: small, fast, and the same sequence for the same seed everywhere. */
function generator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = generator(SEED);
const chance = (p: number) => random() < p;
const between = (min: number, max: number) => min + random() * (max - min);
const integer = (min: number, max: number) => Math.floor(between(min, max + 1));
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}
function weighted<T>(items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [item, weight] of items) {
    roll -= weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1][0];
}
function uuid(): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(random() * 16).toString(16));
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

// ── The simulation, as a time-ordered list of actions ────────────────────────

interface Action {
  at: number;
  order: number;
  run: () => Promise<unknown>;
}

const actions: Action[] = [];
let actionOrder = 0;
const nowMs = Date.now();
const startMs = nowMs - DAYS * DAY_MS;

/** Schedules `run` at `at`; anything in the future of the real clock never happens. */
function at(time: number, run: () => Promise<unknown>) {
  if (time > nowMs - MINUTE_MS) return;
  actions.push({ at: time, order: actionOrder++, run });
}

/** A wire event, timed. */
interface Timed {
  name: string;
  ts: number;
  path?: string;
  session_id?: string;
  props?: Record<string, unknown>;
}

interface BatchOptions {
  userId: string | null;
  userAgent: string;
  ip: string;
  country: string;
  context: Record<string, unknown>;
  acquisition?: Record<string, string>;
}

/** Posts one batch to the real ingest endpoint, as a tracker would. */
function ingest(events: Timed[], options: BatchOptions) {
  const last = Math.max(...events.map((event) => event.ts));
  at(last, async () => {
    seedingUser = options.userId;
    const body = {
      context: options.context,
      acquisition: options.acquisition,
      events: events.map((event) => ({
        id: uuid(),
        name: event.name,
        ts: new Date(event.ts).toISOString(),
        session_id: event.session_id,
        path: event.path,
        props: event.props,
      })),
    };
    const response = await analytics.handle(
      new Request("http://127.0.0.1/analytics/e", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": options.userAgent,
          "x-forwarded-for": options.ip,
          "cf-ipcountry": options.country,
        },
        body: JSON.stringify(body),
      }),
    );
    seedingUser = null;
    if (response?.status !== 200) throw new Error(`ingest answered ${response?.status}: ${await response?.text()}`);
  });
}

const COUNTRIES = [["US", 38], ["GB", 10], ["DE", 8], ["CA", 7], ["IN", 9], ["BR", 6], ["AU", 4], ["FR", 5], ["NL", 3], ["JP", 3]] as const;
const ipFor = (n: number) => `203.0.${(n >> 8) & 255}.${n & 255}`;

// ── App users ────────────────────────────────────────────────────────────────

type Platform = "ios" | "android" | "web";

const CHANNELS = [
  ["organic", 34],
  ["tiktok", 18],
  ["instagram", 11],
  ["reddit", 9],
  ["newsletter", 8],
  ["youtube", 6],
  ["friend", 6],
  ["google", 8],
] as const;
const CAMPAIGNS: Record<string, readonly string[]> = {
  tiktok: ["launch-week", "offline-sync-demo"],
  instagram: ["reels-nov", "launch-week"],
  youtube: ["review-collab"],
  newsletter: ["november-update", "october-update"],
};
const LINK_CHANNELS = new Set(["tiktok", "instagram", "youtube", "newsletter"]);
const REASONS = [["too_expensive", 4], ["not_using", 5], ["missing_feature", 2], ["switched_app", 1], ["other", 1]] as const;
const SCREENS = ["Home", "Projects", "ProjectDetail", "Editor", "Search", "Settings", "Profile"];

const nativeAgent = (platform: Platform) =>
  platform === "ios" ? "DemoApp/1.4.2 CFNetwork/1568.200.51 Darwin/24.1.0" : "okhttp/4.12.0";

function simulateUser(index: number, signupAt: number) {
  const userId = `user_${String(index).padStart(4, "0")}`;
  const platform = weighted<Platform>([["ios", 46], ["android", 30], ["web", 24]]);
  const source = weighted(CHANNELS);
  const campaign = CAMPAIGNS[source] ? pick(CAMPAIGNS[source]) : undefined;
  const device = `dev_${index.toString(36)}_${integer(1000, 9999)}`;
  const country = weighted(COUNTRIES);
  const ip = ipFor(1000 + index);
  const appVersion = pick(["1.3.0", "1.4.1", "1.4.2"]);
  const userAgent = platform === "web" ? pick(WEB_AGENTS)[0] : nativeAgent(platform);
  const context = platform === "web" ? { platform, anonymous_id: device, screen_width: 1280 } : { platform, app_version: appVersion, anonymous_id: device };
  // The web app records pageviews under URL paths; the native apps record screens.
  const view = (screen: string, ts: number, sessionId: string): Timed =>
    platform === "web"
      ? { name: "$pageview", ts, session_id: sessionId, path: `/app/${screen.toLowerCase()}` }
      : { name: "$screen", ts, session_id: sessionId, path: screen };
  const acquisition: Record<string, string> = {};
  if (source !== "organic" && source !== "friend" && source !== "google") acquisition.utm_source = source;
  if (campaign) acquisition.utm_campaign = campaign;
  if (source === "friend") acquisition.self_reported_source = "friend";
  if (source === "google") acquisition.utm_source = "google";

  // A tracked-link click a few minutes before the install.
  if (LINK_CHANNELS.has(source) && chance(0.75)) {
    const clickAt = signupAt - integer(3, 40) * MINUTE_MS;
    at(clickAt, () =>
      analytics.recordLinkClick({
        channel: source,
        campaign: campaign ?? null,
        destination: platform === "ios" ? "app_store" : platform === "android" ? "play_store" : "web",
        platform,
        referrerHost: source === "newsletter" ? null : `www.${source}.com`,
      }),
    );
  }

  // Onboarding starts before sign-in, on the device alone; stitching ties it to the user later.
  const session0 = `s_${index}_0`;
  ingest([{ name: "onboarding_started", ts: signupAt - 2 * MINUTE_MS, session_id: session0 }], {
    userId: null,
    userAgent,
    ip,
    country,
    context,
    acquisition,
  });
  at(signupAt, () =>
    analytics.identify(userId, {
      createdAt: new Date(signupAt),
      platform,
      appVersion: platform === "web" ? undefined : appVersion,
      acquisition,
    }),
  );
  const onboarding: Timed[] = [view("SignUp", signupAt + 20_000, session0)];
  const completesProfile = chance(0.72);
  if (completesProfile) onboarding.push({ name: "profile_completed", ts: signupAt + integer(2, 25) * MINUTE_MS, session_id: session0 });
  ingest(onboarding, { userId, userAgent, ip, country, context, acquisition });

  // Engagement decides both activation and how long they keep coming back.
  const engagement = Math.pow(random(), 0.8);
  let activated = false;
  if (completesProfile && chance(0.25 + engagement * 0.6)) {
    const createdAt = signupAt + (chance(0.6) ? integer(10, 120) * MINUTE_MS : integer(1, 6) * DAY_MS + integer(0, 600) * MINUTE_MS);
    activated = true;
    ingest([{ name: "project_created", ts: createdAt, session_id: `s_${index}_p`, props: { template: pick(["blank", "notes", "tasks"]) } }], {
      userId,
      userAgent,
      ip,
      country,
      context,
    });
    if (chance(0.3)) at(createdAt + 4 * MINUTE_MS, () => analytics.track({ name: "export_completed", userId, ts: createdAt + 4 * MINUTE_MS, props: { format: "pdf" } }));
  }

  // Daily use: falls off quickly, then settles at a plateau set by engagement.
  for (let day = 1; signupAt + day * DAY_MS < nowMs; day++) {
    const p = engagement * (0.42 * Math.exp(-day / 7) + (activated ? 0.2 : 0.05) * engagement);
    if (!chance(p)) continue;
    const start = signupAt + day * DAY_MS + integer(-180, 300) * MINUTE_MS;
    const sessionId = `s_${index}_${day}`;
    const events: Timed[] = [{ name: "$session_start", ts: start, session_id: sessionId }];
    let t = start;
    for (let i = integer(1, 5); i > 0; i--) {
      t += integer(10, 240) * 1000;
      events.push(view(pick(SCREENS), t, sessionId));
    }
    if (chance(0.5)) events.push({ name: "project_opened", ts: (t += 30_000), session_id: sessionId });
    if (chance(0.15)) events.push({ name: "item_shared", ts: (t += 45_000), session_id: sessionId, props: { via: pick(["link", "email"]) } });
    events.push({ name: "$session_end", ts: (t += 20_000), session_id: sessionId, props: { duration_ms: t - start } });
    ingest(events, { userId, userAgent, ip, country, context });
  }

  simulateRevenue(index, userId, platform, signupAt, engagement);
}

// ── Revenue ──────────────────────────────────────────────────────────────────

const PLANS = {
  monthly: { productId: "pro_monthly", cents: 999, days: 30 },
  annual: { productId: "pro_annual", cents: 7999, days: 365 },
} as const;

function simulateRevenue(index: number, userId: string, platform: Platform, signupAt: number, engagement: number) {
  const store = platform === "ios" ? "app_store" : platform === "android" ? "play_store" : "stripe";
  const provider = platform === "web" ? "stripe" : "revenuecat";
  const subscription = `${provider}:sub_${index}`;
  let seq = 0;
  const row = (eventType: string, occurredAt: number, extra: Partial<RevenueEventInput> = {}) => {
    const input: RevenueEventInput = {
      userId,
      provider,
      eventType,
      providerEventId: `demo_${index}_${seq++}`,
      providerSubscriptionId: subscription,
      store,
      currency: "usd",
      environment: "production",
      occurredAt,
      ...extra,
    };
    at(occurredAt, () => analytics.recordRevenueEvents([input]));
  };

  const trials = chance(0.2 + engagement * 0.3);
  const buysOutright = !trials && chance(0.04);
  if (!trials && !buysOutright) return;
  const plan = chance(0.22) ? PLANS.annual : PLANS.monthly;
  let periodStart = signupAt + integer(2, 72) * 60 * MINUTE_MS;

  if (trials) {
    const trialEnd = periodStart + 7 * DAY_MS;
    row("trial_started", periodStart, { productId: plan.productId, periodType: "trial", periodStart, periodEnd: trialEnd, amountCents: 0 });
    if (!chance(0.3 + engagement * 0.45)) {
      if (chance(0.5)) row("cancel_scheduled", periodStart + integer(1, 6) * DAY_MS, { productId: plan.productId, cancelReason: weighted(REASONS) });
      row("expired", trialEnd + integer(1, 30) * MINUTE_MS, { productId: plan.productId });
      return;
    }
    periodStart = trialEnd;
    row("trial_converted", periodStart, { productId: plan.productId, periodType: "normal", periodStart, periodEnd: periodStart + plan.days * DAY_MS, amountCents: plan.cents, renewalNumber: 1 });
  } else {
    row("purchased", periodStart, { productId: plan.productId, periodType: "normal", periodStart, periodEnd: periodStart + plan.days * DAY_MS, amountCents: plan.cents, renewalNumber: 1 });
  }

  for (let renewal = 2; ; renewal++) {
    const periodEnd = periodStart + plan.days * DAY_MS;
    if (chance(0.03)) {
      const refundAt = periodStart + integer(1, 5) * DAY_MS;
      row("refunded", refundAt, { productId: plan.productId, amountCents: -plan.cents, periodStart, periodEnd });
      return;
    }
    if (chance(0.2 - engagement * 0.1)) {
      row("cancel_scheduled", periodStart + integer(3, plan.days - 2) * DAY_MS, { productId: plan.productId, cancelReason: weighted(REASONS) });
      row("expired", periodEnd + integer(1, 60) * MINUTE_MS, { productId: plan.productId });
      return;
    }
    if (periodEnd > nowMs) return;
    periodStart = periodEnd;
    row("renewed", periodStart, { productId: plan.productId, periodType: "normal", periodStart, periodEnd: periodStart + plan.days * DAY_MS, amountCents: plan.cents, renewalNumber: renewal });
  }
}

// ── Web traffic ──────────────────────────────────────────────────────────────

const WEB_AGENTS = [
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", 1440],
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15", 1512],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0", 1920],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", 1366],
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1", 390],
  ["Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36", 412],
  ["Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1", 820],
] as const;
const LANDINGS = [["/", 40], ["/pricing", 12], ["/blog/offline-sync", 14], ["/blog/launch", 9], ["/features", 8], ["/docs/getting-started", 7], ["/changelog", 4]] as const;
const NEXT_PAGES = ["/", "/pricing", "/features", "/docs/getting-started", "/download", "/blog", "/about"];
interface WebSource {
  referrer: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}
const SOURCES: readonly (readonly [WebSource, number])[] = [
  [{ referrer: "" }, 30],
  [{ referrer: "https://www.google.com/" }, 26],
  [{ referrer: "https://news.ycombinator.com/item?id=4242" }, 7],
  [{ referrer: "https://www.reddit.com/r/reactnative/comments/x" }, 8],
  [{ referrer: "https://t.co/abc123" }, 5],
  [{ referrer: "https://duckduckgo.com/" }, 4],
  [{ referrer: "", utm_source: "newsletter", utm_medium: "email", utm_campaign: "november-update" }, 7],
  [{ referrer: "https://www.tiktok.com/", utm_source: "tiktok", utm_medium: "social", utm_campaign: "launch-week" }, 9],
  [{ referrer: "https://l.instagram.com/", utm_source: "instagram", utm_medium: "social", utm_campaign: "reels-nov" }, 4],
];

function simulateWebDay(day: number, visitorPool: string[]) {
  const dayStart = startMs + day * DAY_MS;
  const weekday = new Date(dayStart).getUTCDay();
  const weekend = weekday === 0 || weekday === 6;
  // A launch spike three weeks in, gentle growth, and quieter weekends.
  const spike = day >= 62 && day <= 64 ? 2.4 : 1;
  const visits = Math.round((18 + day * 0.32) * (weekend ? 0.7 : 1) * spike * between(0.85, 1.15));
  for (let v = 0; v < visits; v++) {
    const returning = visitorPool.length > 20 && chance(0.28);
    const visitor = returning ? pick(visitorPool) : `web_${day}_${v}_${integer(100, 999)}`;
    if (!returning) visitorPool.push(visitor);
    const [userAgent, width] = pick(WEB_AGENTS);
    const source = weighted(SOURCES);
    let t = dayStart + integer(0, 24 * 60 - 30) * MINUTE_MS;
    const landing = weighted(LANDINGS);
    const events: Timed[] = [{ name: "$pageview", ts: t, path: landing }];
    const depth = chance(0.42) ? 0 : integer(1, 5);
    for (let i = 0; i < depth; i++) {
      t += integer(15, 200) * 1000;
      events.push({ name: "$pageview", ts: t, path: pick(NEXT_PAGES) });
    }
    if (depth > 0 && chance(0.12)) events.push({ name: "download_clicked", ts: (t += 10_000), path: "/download", props: { store: pick(["app_store", "play_store"]) } });
    const acquisition: Record<string, string> = { landing_path: landing };
    if (source.utm_source) acquisition.utm_source = source.utm_source;
    if (source.utm_medium) acquisition.utm_medium = source.utm_medium;
    if (source.utm_campaign) acquisition.utm_campaign = source.utm_campaign;
    ingest(events, {
      userId: null,
      userAgent,
      ip: ipFor(day * 97 + v),
      country: weighted(COUNTRIES),
      context: { platform: "web", anonymous_id: visitor, referrer: source.referrer || undefined, screen_width: width },
      acquisition,
    });
  }
}

function buildSimulation() {
  let index = 0;
  const visitorPool: string[] = [];
  for (let day = 0; day < DAYS; day++) {
    const dayStart = startMs + day * DAY_MS;
    const weekday = new Date(dayStart).getUTCDay();
    const spike = day >= 62 && day <= 64 ? 2.2 : 1;
    const signups = Math.round((1.4 + day * 0.045) * (weekday === 0 || weekday === 6 ? 0.75 : 1) * spike * between(0.6, 1.4));
    for (let s = 0; s < signups; s++) {
      index++;
      simulateUser(index, dayStart + integer(7 * 60, 23 * 60) * MINUTE_MS);
    }
    simulateWebDay(day, visitorPool);
    // Link clicks that never turned into a sign-up.
    for (let c = integer(0, 4); c > 0; c--) {
      const channel = pick(["tiktok", "instagram", "youtube", "newsletter"]);
      const platform = pick(["ios", "android", "web"] as const);
      at(dayStart + integer(0, 24 * 60 - 1) * MINUTE_MS, () =>
        analytics.recordLinkClick({ channel, campaign: CAMPAIGNS[channel] ? pick(CAMPAIGNS[channel]) : null, destination: platform === "ios" ? "app_store" : platform === "android" ? "play_store" : "web", platform }),
      );
    }
  }
  // A staff account: present in the raw data, left out of every figure.
  at(startMs + 2 * DAY_MS, () => analytics.identify("staff_owner", { createdAt: new Date(startMs + 2 * DAY_MS), excluded: true, platform: "ios" }));
  for (let day = 3; day < DAYS; day += 2) {
    ingest([{ name: "$session_start", ts: startMs + day * DAY_MS + 9 * 60 * MINUTE_MS, session_id: `staff_${day}` }], {
      userId: "staff_owner",
      userAgent: nativeAgent("ios"),
      ip: ipFor(9),
      country: "US",
      context: { platform: "ios", app_version: "1.5.0-beta", anonymous_id: "dev_staff" },
    });
  }
  return { users: index };
}

// ── Seed ─────────────────────────────────────────────────────────────────────

async function seedState(): Promise<"seeded" | "partial" | "empty"> {
  const [row] = await raw.unsafe(
    `select
       exists (select 1 from ${PREFIX}users where app_id = $1 and user_id = $2) as marker,
       exists (select 1 from ${PREFIX}events where app_id = $1) or exists (select 1 from ${PREFIX}users where app_id = $1)
         or exists (select 1 from ${PREFIX}revenue_events where app_id = $1) or exists (select 1 from ${PREFIX}link_clicks where app_id = $1) as rows`,
    [APP_ID, SEED_MARKER],
  );
  return row.marker ? "seeded" : row.rows ? "partial" : "empty";
}

async function seed() {
  const { users } = buildSimulation();
  actions.sort((a, b) => a.at - b.at || a.order - b.order);
  console.log(`[demo] seeding ${users} users and ${actions.length} actions over ${DAYS} days…`);
  const started = Date.now();
  let done = 0;
  for (const action of actions) {
    // A second ahead of the action, so its own timestamps are never "in the future".
    clock = new Date(action.at + 1000);
    await action.run();
    done++;
    if (done % 1000 === 0) console.log(`[demo]   ${done}/${actions.length}`);
  }
  clock = null;
  // Written last: its presence means the seed finished.
  await analytics.identify(SEED_MARKER, { excluded: true, traits: { seed: SEED, seededAt: new Date().toISOString() } });
  console.log(`[demo] seeded in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

async function main() {
  if (reset) {
    const result = await analytics.uninstall();
    console.log(`[demo] --reset: dropped ${result.dropped.length} demo tables`);
  }
  const installed = await analytics.install();
  if (installed.applied.length) console.log(`[demo] installed the ${PREFIX}* tables (version ${installed.version})`);

  const found = await seedState();
  if (found === "partial") {
    console.log("[demo] found a seed that did not finish; starting it over");
    await analytics.uninstall();
    await analytics.install();
  }
  if (found === "seeded") console.log("[demo] demo data already present (pass --reset to seed again)");
  else await seed();

  const handler = toNodeHandler(analytics);
  const server = createServer((req, res) => {
    if (req.url === "/" || req.url === "") {
      res.writeHead(302, { location: `${analytics.basePath}/` });
      res.end();
      return;
    }
    void handler(req, res);
  });
  server.listen(PORT, HOST, () => {
    console.log(`[demo] dashboard: http://${HOST}:${PORT}${analytics.basePath}/`);
  });
  const stop = () => {
    server.close();
    void raw.end({ timeout: 2 }).finally(() => process.exit(0));
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch(async (error) => {
  console.error("[demo] failed:", error);
  await raw.end({ timeout: 2 }).catch(() => {});
  process.exit(1);
});
