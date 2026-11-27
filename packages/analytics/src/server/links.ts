/**
 * Tracked redirect links: `GET <basePath>/go/:channel?c=<campaign>`.
 *
 * One link per channel (a social profile, a newsletter) records a click and
 * sends the visitor where their device can install or open the app: iOS to the
 * App Store (with Apple campaign parameters when a provider token is set),
 * Android to Google Play with a UTM install referrer, and everything else to
 * the web URL with UTM parameters and the click id, so a web sign-up can link
 * back to the click.
 */
import { randomUUID } from "node:crypto";

import { LINK_CLICK_PARAM } from "../shared/wire";

import { CAMPAIGN_PATTERN, CHANNEL_PATTERN } from "./acquisition";
import type { StoreContext } from "./config";

export interface LinkConfig {
  /** App Store URL, e.g. `https://apps.apple.com/app/id123456789`. */
  ios?: string;
  /** Google Play URL, e.g. `https://play.google.com/store/apps/details?id=com.example`. */
  android?: string;
  /** Where every other device lands, e.g. `https://example.com/sign-up`. */
  web: string;
  /** Apple App Analytics provider token (`pt`). Without it no campaign is sent: Apple ignores `ct` alone. */
  appleCampaignToken?: string;
  /** Channels whose links get `utm_medium=social`. Default `DEFAULT_SOCIAL_CHANNELS`. */
  socialChannels?: readonly string[];
}

export const DEFAULT_SOCIAL_CHANNELS: readonly string[] = [
  "tiktok",
  "instagram",
  "facebook",
  "youtube",
  "x",
  "linkedin",
  "reddit",
  "threads",
  "pinterest",
];

/**
 * Query parameter carrying the click id on the web destination. The web
 * tracker reads it into `acquisition.link_click_id`.
 */
export { LINK_CLICK_PARAM };

/** Apple caps the campaign token (`ct`) at 40 characters. */
const APPLE_CAMPAIGN_TOKEN_MAX_LENGTH = 40;

export type LinkPlatform = "ios" | "android" | "web";
export type LinkDestination = "app_store" | "play_store" | "web";

export function detectLinkPlatform(userAgent: string | null | undefined): LinkPlatform {
  if (typeof userAgent !== "string") return "web";
  if (/\b(iPhone|iPad|iPod)\b/.test(userAgent)) return "ios";
  if (/\bAndroid\b/.test(userAgent)) return "android";
  return "web";
}

/** Where a platform is sent given the configured stores; a missing store URL falls back to the web. */
export function linkDestination(config: LinkConfig, platform: LinkPlatform): LinkDestination {
  if (platform === "ios" && config.ios) return "app_store";
  if (platform === "android" && config.android) return "play_store";
  return "web";
}

export interface LinkRequest {
  channel: string;
  campaign: string | null;
  userAgent: string | null;
  clickId: string;
}

function utmParams(config: LinkConfig, channel: string, campaign: string | null): URLSearchParams {
  const params = new URLSearchParams({ utm_source: channel });
  if ((config.socialChannels ?? DEFAULT_SOCIAL_CHANNELS).includes(channel)) params.set("utm_medium", "social");
  if (campaign) params.set("utm_campaign", campaign);
  return params;
}

/**
 * The redirect target, or null when the channel or campaign fails its pattern
 * (the route answers 404). Pure, so it is tested without a database.
 */
export function resolveLinkRedirect(config: LinkConfig, request: LinkRequest): string | null {
  const { channel, campaign, userAgent, clickId } = request;
  if (!CHANNEL_PATTERN.test(channel)) return null;
  if (campaign !== null && !CAMPAIGN_PATTERN.test(campaign)) return null;

  const destination = linkDestination(config, detectLinkPlatform(userAgent));
  if (destination === "app_store") {
    const url = new URL(config.ios!);
    const token = config.appleCampaignToken?.trim();
    if (token) {
      url.searchParams.set("pt", token);
      url.searchParams.set("ct", (campaign ? `${channel}-${campaign}` : channel).slice(0, APPLE_CAMPAIGN_TOKEN_MAX_LENGTH));
    }
    return url.toString();
  }
  if (destination === "play_store") {
    const url = new URL(config.android!);
    // Play hands `referrer` to the app verbatim via the Install Referrer API,
    // so it is itself a UTM query string, encoded as one parameter.
    url.searchParams.set("referrer", utmParams(config, channel, campaign).toString());
    return url.toString();
  }
  const url = new URL(config.web);
  for (const [key, value] of utmParams(config, channel, campaign)) url.searchParams.set(key, value);
  url.searchParams.set(LINK_CLICK_PARAM, clickId);
  return url.toString();
}

export interface LinkClickInput {
  /** Defaults to a random UUID. Pass the one put in the redirect URL. */
  id?: string;
  channel: string;
  campaign?: string | null;
  destination: string;
  platform?: string | null;
  referrerHost?: string | null;
}

/** Records one click and returns its id. */
export async function recordLinkClick(ctx: StoreContext, input: LinkClickInput): Promise<string> {
  if (!CHANNEL_PATTERN.test(input.channel)) throw new Error(`expo-analytics: invalid link channel "${input.channel}"`);
  const campaign = input.campaign ?? null;
  if (campaign !== null && !CAMPAIGN_PATTERN.test(campaign)) {
    throw new Error(`expo-analytics: invalid link campaign "${campaign}"`);
  }
  const id = input.id ?? randomUUID();
  await ctx.sql.query(
    `insert into ${ctx.names.t.linkClicks} (id, app_id, channel, campaign, destination, platform, referrer_host, occurred_at)
     values ($1::uuid, $2, $3, $4, $5, $6, $7, $8::timestamptz)`,
    [id, ctx.appId, input.channel, campaign, input.destination, input.platform ?? null, input.referrerHost ?? null, ctx.now()],
  );
  return id;
}
