/**
 * @jest-environment node
 */
import { resolveLinkRedirect, type LinkConfig } from "../links";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36";
const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";
const CLICK = "7d1f3c1e-2b9a-4c55-9a0e-0f4d1c2b3a49";

const config: LinkConfig = {
  ios: "https://apps.apple.com/app/id123456789?mt=8",
  android: "https://play.google.com/store/apps/details?id=com.example.app",
  web: "https://example.com/sign-up",
  appleCampaignToken: "118000",
};

function redirect(over: Partial<{ channel: string; campaign: string | null; userAgent: string | null }>, cfg = config) {
  return resolveLinkRedirect(cfg, { channel: "tiktok", campaign: null, userAgent: DESKTOP, clickId: CLICK, ...over });
}

describe("resolveLinkRedirect", () => {
  it("sends iOS to the App Store with Apple campaign parameters", () => {
    const url = new URL(redirect({ userAgent: IPHONE, campaign: "spring" })!);
    expect(url.origin + url.pathname).toBe("https://apps.apple.com/app/id123456789");
    expect(url.searchParams.get("mt")).toBe("8");
    expect(url.searchParams.get("pt")).toBe("118000");
    expect(url.searchParams.get("ct")).toBe("tiktok-spring");
  });

  it("sends no campaign to the App Store without a provider token", () => {
    const url = new URL(redirect({ userAgent: IPHONE }, { ...config, appleCampaignToken: undefined })!);
    expect(url.searchParams.has("pt")).toBe(false);
    expect(url.searchParams.has("ct")).toBe(false);
  });

  it("sends Android to Play with an encoded UTM referrer", () => {
    const location = redirect({ userAgent: ANDROID, campaign: "spring" })!;
    expect(location).toContain("referrer=utm_source%3Dtiktok%26utm_medium%3Dsocial%26utm_campaign%3Dspring");
    const url = new URL(location);
    expect(url.searchParams.get("id")).toBe("com.example.app");
    expect(url.searchParams.get("referrer")).toBe("utm_source=tiktok&utm_medium=social&utm_campaign=spring");
  });

  it("sends everything else to the web with UTM parameters and the click id", () => {
    const url = new URL(redirect({ campaign: "spring" })!);
    expect(url.origin + url.pathname).toBe("https://example.com/sign-up");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      utm_source: "tiktok",
      utm_medium: "social",
      utm_campaign: "spring",
      link_click: CLICK,
    });
  });

  it("adds utm_medium only for social channels", () => {
    const url = new URL(redirect({ channel: "newsletter" })!);
    expect(url.searchParams.has("utm_medium")).toBe(false);
    const custom = new URL(redirect({ channel: "newsletter" }, { ...config, socialChannels: ["newsletter"] })!);
    expect(custom.searchParams.get("utm_medium")).toBe("social");
  });

  it("falls back to the web when a store is not configured", () => {
    const url = new URL(redirect({ userAgent: IPHONE }, { web: "https://example.com/" })!);
    expect(url.host).toBe("example.com");
    expect(url.searchParams.get("link_click")).toBe(CLICK);
  });

  it("rejects channels and campaigns outside the strict patterns", () => {
    expect(redirect({ channel: "TikTok" })).toBeNull();
    expect(redirect({ channel: "a/b" })).toBeNull();
    expect(redirect({ channel: "x".repeat(33) })).toBeNull();
    expect(redirect({ campaign: "Spring Sale" })).toBeNull();
    expect(redirect({ campaign: "<script>" })).toBeNull();
  });
});
