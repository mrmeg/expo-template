/**
 * Cookieless visitor ids and user-agent classification.
 *
 * A web visitor without storage is identified by
 * sha256(daily salt, app id, ip, user agent), truncated. The salt rotates at
 * UTC midnight and old salts are deleted, so ids link one visitor within a day
 * and never across days, and neither the IP nor the user agent is stored
 * anywhere: only the hash and the coarse device, browser and OS classes are.
 */
import { createHash, randomBytes } from "node:crypto";

import type { Names } from "./schema";
import type { SqlClient } from "./sql";

const VISITOR_ID_LENGTH = 32;
/** Unit separator: cannot occur in an IP and is vanishingly rare in a user agent. */
const SEPARATOR = "\u001f";

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Deletes every salt but today's. Nothing reads an older salt, and while one
 * exists, anyone who can read the database can test a guessed IP and user
 * agent against that day's visitor ids. Also called from `prune`, so the last
 * salt does not outlive cookieless traffic stopping.
 */
export async function pruneSalts(sql: SqlClient, names: Names, now: Date): Promise<void> {
  await sql.query(`delete from ${names.t.salts} where day < $1::date`, [utcDay(now)]);
}

/**
 * Today's salt, created on first use. `on conflict do nothing` then a read
 * makes concurrent first requests agree on one salt. Earlier days' salts are
 * deleted on the way, which is what makes earlier ids unlinkable.
 */
export async function getDailySalt(sql: SqlClient, names: Names, now: Date): Promise<string> {
  const day = utcDay(now);
  await sql.query(`insert into ${names.t.salts} (day, salt) values ($1::date, $2) on conflict (day) do nothing`, [
    day,
    randomBytes(32).toString("hex"),
  ]);
  const rows = await sql.query<{ salt: string }>(`select salt from ${names.t.salts} where day = $1::date`, [day]);
  await pruneSalts(sql, names, now);
  const salt = rows[0]?.salt;
  if (!salt) throw new Error("expo-analytics: could not read the daily salt");
  return salt;
}

/**
 * Per-process memo of `getDailySalt`, keyed by table and day, so a busy server
 * reads the salt once a day instead of on every batch.
 */
export function createSaltCache(): (sql: SqlClient, names: Names, now: Date) => Promise<string> {
  const cache = new Map<string, Promise<string>>();
  return (sql, names, now) => {
    const key = `${names.t.salts}|${utcDay(now)}`;
    let salt = cache.get(key);
    if (!salt) {
      cache.clear();
      salt = getDailySalt(sql, names, now);
      cache.set(key, salt);
      salt.catch(() => cache.delete(key));
    }
    return salt;
  };
}

export interface VisitorInput {
  salt: string;
  appId: string;
  ip: string | null;
  userAgent: string | null;
}

export function visitorId({ salt, appId, ip, userAgent }: VisitorInput): string {
  return createHash("sha256")
    .update([salt, appId, ip ?? "", userAgent ?? ""].join(SEPARATOR))
    .digest("hex")
    .slice(0, VISITOR_ID_LENGTH);
}

export type DeviceClass = "desktop" | "mobile" | "tablet";

export interface UserAgentInfo {
  device: DeviceClass | null;
  browser: string | null;
  os: string | null;
  isBot: boolean;
}

/**
 * Crawlers, link unfurlers, headless browsers and scripted HTTP clients.
 * Deliberately absent: `okhttp` (React Native on Android) and `CFNetwork`
 * (React Native on iOS), which is what the native trackers send.
 */
const BOT_PATTERN = new RegExp(
  [
    "(?<!cu)bot\\b",
    "bot/",
    "crawl",
    "spider",
    "slurp",
    "mediapartners",
    "facebookexternalhit",
    "meta-externalagent",
    "embedly",
    "quora link preview",
    "whatsapp",
    "bingpreview",
    "skypeuripreview",
    "headlesschrome",
    "phantomjs",
    "puppeteer",
    "playwright",
    "selenium",
    "webdriver",
    "lighthouse",
    "pagespeed",
    "gtmetrix",
    "pingdom",
    "uptimerobot",
    "statuscake",
    "^curl/",
    "^wget",
    "python-requests",
    "python-urllib",
    "aiohttp",
    "httpx",
    "^axios/",
    "node-fetch",
    "undici",
    "go-http-client",
    "^java/",
    "apache-httpclient",
    "libwww-perl",
    "scrapy",
    "ahrefs",
    "semrush",
    "mj12",
    "petalbot",
    "yandex",
    "baiduspider",
    "duckduckbot",
    "applebot",
    "gptbot",
    "chatgpt-user",
    "claudebot",
    "claude-web",
    "anthropic-ai",
    "ccbot",
    "perplexity",
    "bytespider",
    "amazonbot",
  ].join("|"),
  "i",
);

function detectOs(ua: string): string | null {
  if (/\b(iPhone|iPad|iPod)\b/.test(ua)) return "iOS";
  if (/\bAndroid\b/.test(ua)) return "Android";
  if (/\bCrOS\b/.test(ua)) return "ChromeOS";
  if (/\bWindows\b/.test(ua)) return "Windows";
  if (/\bMac OS X\b|\bMacintosh\b/.test(ua)) return "macOS";
  if (/\bLinux\b|\bX11\b/.test(ua)) return "Linux";
  return null;
}

/** Order matters: Chromium forks also carry `Chrome/` and `Safari/`, and every iOS browser carries `Safari/`. */
function detectBrowser(ua: string): string | null {
  if (/\bEdg(e|A|iOS)?\//.test(ua)) return "Edge";
  if (/\bOPR\/|\bOPiOS\/|\bOpera\b/.test(ua)) return "Opera";
  if (/\bSamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/\bFirefox\/|\bFxiOS\//.test(ua)) return "Firefox";
  if (/\bChrome\/|\bCriOS\/|\bChromium\//.test(ua)) return "Chrome";
  // Two linear tests, not one pattern with `.*` between them: that form
  // backtracks quadratically on a crafted header, and this runs on a public route.
  if (/\bSafari\//.test(ua) && /\bVersion\/\d/.test(ua)) return "Safari";
  return null;
}

function detectDevice(ua: string, os: string | null): DeviceClass | null {
  if (/\biPad\b|\bTablet\b|\bKindle\b|\bSilk\//.test(ua)) return "tablet";
  if (/\bAndroid\b/.test(ua) && !/\bMobile\b/.test(ua)) return "tablet";
  if (/\bMobi|\biPhone\b|\biPod\b|\bWindows Phone\b/.test(ua)) return "mobile";
  if (os === "Windows" || os === "macOS" || os === "Linux" || os === "ChromeOS") return "desktop";
  return null;
}

const USER_AGENT_MAX_LENGTH = 1024;

export function parseUserAgent(ua: string | null | undefined): UserAgentInfo {
  if (typeof ua !== "string" || ua.trim().length === 0) {
    return { device: null, browser: null, os: null, isBot: false };
  }
  // Real user agents are a few hundred characters; the cap bounds the work an
  // unauthenticated caller can ask of the patterns below.
  const head = ua.slice(0, USER_AGENT_MAX_LENGTH);
  const os = detectOs(head);
  return { device: detectDevice(head, os), browser: detectBrowser(head), os, isBot: BOT_PATTERN.test(head) };
}

/**
 * The device class for a session. A user agent that says mobile or tablet is
 * trusted; otherwise a viewport width, when the web tracker sends one, decides,
 * because desktop-mode iPads and resized windows report a desktop user agent.
 */
export function deviceClass(uaDevice: DeviceClass | null, screenWidth: unknown): DeviceClass | null {
  if (uaDevice === "mobile" || uaDevice === "tablet") return uaDevice;
  if (typeof screenWidth === "number" && Number.isFinite(screenWidth) && screenWidth > 0) {
    if (screenWidth < 768) return "mobile";
    if (screenWidth < 1024) return "tablet";
    return "desktop";
  }
  return uaDevice;
}
