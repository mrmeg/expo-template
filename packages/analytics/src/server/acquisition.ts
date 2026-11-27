/**
 * Acquisition channel vocabulary, resolution, and sanitizers for the
 * `WireAcquisition` fields. Pure.
 *
 * Resolution rule (first touch wins upstream, in the users upsert; this only
 * picks the label):
 *
 *   channel = normalizeChannel(utm_source)
 *          ?? normalizeChannel(self_reported_source)
 *          ?? PLATFORM_DEFAULT_CHANNEL[signup_platform]
 *          ?? "unknown"
 */
import { LIMITS, type WireAcquisition } from "../shared/wire";
import { asUuid, cleanText, hostOf, isPlainObject } from "./util";

/** `/go/:channel` path segment and the stored channel shape. */
export const CHANNEL_PATTERN = /^[a-z0-9_-]{1,32}$/;
/** `/go/:channel?c=` campaign shape. */
export const CAMPAIGN_PATTERN = /^[a-z0-9_-]{1,64}$/;

/** Channel assigned when nothing else is known, keyed by sign-up platform. */
export const PLATFORM_DEFAULT_CHANNEL: Readonly<Record<string, string>> = {
  web: "web_direct",
  ios: "app_store_organic",
  android: "play_store_organic",
};

/**
 * Common `utm_source` spellings and referrer hosts folded onto one channel id,
 * so "TikTok", "tiktok.com" and a `/go/tiktok` link count as one channel.
 */
export const CHANNEL_ALIASES: Readonly<Record<string, string>> = {
  tt: "tiktok",
  "tiktok.com": "tiktok",
  "vm.tiktok.com": "tiktok",
  ig: "instagram",
  insta: "instagram",
  "instagram.com": "instagram",
  "l.instagram.com": "instagram",
  fb: "facebook",
  meta: "facebook",
  "facebook.com": "facebook",
  "m.facebook.com": "facebook",
  "l.facebook.com": "facebook",
  "lm.facebook.com": "facebook",
  yt: "youtube",
  "youtube.com": "youtube",
  "m.youtube.com": "youtube",
  "youtu.be": "youtube",
  twitter: "x",
  "twitter.com": "x",
  "x.com": "x",
  "t.co": "x",
  "linkedin.com": "linkedin",
  "lnkd.in": "linkedin",
  "reddit.com": "reddit",
  "threads.net": "threads",
  "pinterest.com": "pinterest",
};

export const CLICK_ID_KINDS = ["fbclid", "gclid", "ttclid", "msclkid", "link"] as const;
export type ClickIdKind = (typeof CLICK_ID_KINDS)[number];

/** Ad click ids run past 100 characters (fbclid), so they get their own cap. */
const CLICK_ID_MAX_LENGTH = 256;
const CHANNEL_MAX_LENGTH = 32;

/**
 * Fold a raw `utm_source` (or a host) onto a channel id: lowercase, trim, strip
 * a leading `www.`, apply `CHANNEL_ALIASES`, then accept a value already
 * matching `CHANNEL_PATTERN` or sanitize it (runs of anything else become one
 * underscore, capped at 32). Null for empty or unusable input, so callers fall
 * through to the next signal.
 */
export function normalizeChannel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let v = value.trim().toLowerCase();
  if (v.length === 0) return null;
  if (v.startsWith("www.")) v = v.slice(4);
  const alias = CHANNEL_ALIASES[v];
  if (alias) return alias;
  if (CHANNEL_PATTERN.test(v)) return v;
  const sanitized = v
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, CHANNEL_MAX_LENGTH)
    .replace(/_+$/g, "");
  return sanitized.length > 0 ? sanitized : null;
}

export interface ChannelSignals {
  utm_source?: string | null;
  self_reported_source?: string | null;
  signup_platform?: string | null;
}

/** The rule in the module comment. Never returns an empty string. */
export function resolveChannel(signals: ChannelSignals): string {
  return (
    normalizeChannel(signals.utm_source) ??
    normalizeChannel(signals.self_reported_source) ??
    (signals.signup_platform ? PLATFORM_DEFAULT_CHANNEL[signals.signup_platform] : undefined) ??
    "unknown"
  );
}

/** UTM values compare case-insensitively everywhere they are grouped, so they are stored lowercased. */
export function sanitizeUtm(value: unknown): string | null {
  const text = cleanText(value, LIMITS.utmMaxLength);
  return text === null ? null : text.toLowerCase();
}

/**
 * Referrers are stored as host only: full referrer URLs carry search terms,
 * tokens and other people's paths, and the host is all any metric groups by.
 */
export function sanitizeReferrerHost(value: unknown): string | null {
  if (typeof value !== "string" || value.length > LIMITS.referrerMaxLength * 4) return null;
  const host = hostOf(value);
  return host && host.length <= LIMITS.referrerMaxLength ? host : null;
}

/** Path only: the query string and fragment are dropped, as on events. */
export function sanitizePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.split(/[?#]/, 1)[0] ?? "";
  return cleanText(path, LIMITS.pathMaxLength);
}

export function sanitizeClickIdKind(value: unknown): ClickIdKind | null {
  return typeof value === "string" && (CLICK_ID_KINDS as readonly string[]).includes(value)
    ? (value as ClickIdKind)
    : null;
}

/** Acquisition as stored on a user row; every field nullable. */
export interface Acquisition {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  /** Host only (see `sanitizeReferrerHost`). */
  referrer: string | null;
  landing_path: string | null;
  click_id: string | null;
  click_id_kind: ClickIdKind | null;
  link_click_id: string | null;
  self_reported_source: string | null;
}

export const EMPTY_ACQUISITION: Readonly<Acquisition> = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  referrer: null,
  landing_path: null,
  click_id: null,
  click_id_kind: null,
  link_click_id: null,
  self_reported_source: null,
};

/**
 * Untrusted `WireAcquisition` → stored shape. Bad fields are dropped one by
 * one rather than failing the batch: acquisition is best effort, events are not.
 * A click id without a known kind is dropped too, since it cannot be attributed.
 */
export function sanitizeAcquisition(raw: unknown): Acquisition {
  if (!isPlainObject(raw)) return { ...EMPTY_ACQUISITION };
  const input = raw as WireAcquisition;
  const clickIdKind = sanitizeClickIdKind(input.click_id_kind);
  const clickId = clickIdKind ? cleanText(input.click_id, CLICK_ID_MAX_LENGTH) : null;
  return {
    utm_source: sanitizeUtm(input.utm_source),
    utm_medium: sanitizeUtm(input.utm_medium),
    utm_campaign: sanitizeUtm(input.utm_campaign),
    utm_content: sanitizeUtm(input.utm_content),
    utm_term: sanitizeUtm(input.utm_term),
    referrer: sanitizeReferrerHost(input.referrer),
    landing_path: sanitizePath(input.landing_path),
    click_id: clickId,
    click_id_kind: clickId ? clickIdKind : null,
    link_click_id: asUuid(input.link_click_id),
    self_reported_source: sanitizeUtm(input.self_reported_source),
  };
}
