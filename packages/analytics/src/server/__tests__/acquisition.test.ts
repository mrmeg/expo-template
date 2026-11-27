/**
 * @jest-environment node
 */
import { LIMITS } from "../../shared/wire";
import {
  normalizeChannel,
  resolveChannel,
  sanitizeAcquisition,
  sanitizePath,
  sanitizeReferrerHost,
  sanitizeUtm,
} from "../acquisition";

describe("normalizeChannel", () => {
  it("folds spellings and hosts onto one channel", () => {
    expect(normalizeChannel("TikTok")).toBe("tiktok");
    expect(normalizeChannel(" www.tiktok.com ")).toBe("tiktok");
    expect(normalizeChannel("IG")).toBe("instagram");
    expect(normalizeChannel("t.co")).toBe("x");
  });

  it("sanitizes anything else and returns null for nothing usable", () => {
    expect(normalizeChannel("Spring Newsletter!")).toBe("spring_newsletter");
    expect(normalizeChannel("news.ycombinator.com")).toBe("news_ycombinator_com");
    expect(normalizeChannel("x".repeat(40))).toHaveLength(32);
    expect(normalizeChannel("   ")).toBeNull();
    expect(normalizeChannel("!!!")).toBeNull();
    expect(normalizeChannel(42)).toBeNull();
  });
});

describe("resolveChannel", () => {
  it("prefers utm_source, then the self-reported answer, then the platform default", () => {
    expect(resolveChannel({ utm_source: "FB", self_reported_source: "friend", signup_platform: "ios" })).toBe(
      "facebook",
    );
    expect(resolveChannel({ self_reported_source: "Friend", signup_platform: "ios" })).toBe("friend");
    expect(resolveChannel({ signup_platform: "ios" })).toBe("app_store_organic");
    expect(resolveChannel({ signup_platform: "android" })).toBe("play_store_organic");
    expect(resolveChannel({ signup_platform: "web" })).toBe("web_direct");
    expect(resolveChannel({ signup_platform: "server" })).toBe("unknown");
    expect(resolveChannel({})).toBe("unknown");
  });
});

describe("sanitizers", () => {
  it("lowercases, trims and caps UTM values", () => {
    expect(sanitizeUtm("  Spring_Sale ")).toBe("spring_sale");
    expect(sanitizeUtm("A".repeat(200))).toHaveLength(LIMITS.utmMaxLength);
    expect(sanitizeUtm("")).toBeNull();
    expect(sanitizeUtm(7)).toBeNull();
  });

  it("reduces referrers to the host", () => {
    expect(sanitizeReferrerHost("https://WWW.Google.com/search?q=secret")).toBe("www.google.com");
    expect(sanitizeReferrerHost("tiktok.com")).toBe("tiktok.com");
    expect(sanitizeReferrerHost("not a url at all")).toBeNull();
    expect(sanitizeReferrerHost("")).toBeNull();
  });

  it("keeps the path only", () => {
    expect(sanitizePath("/pricing?coupon=abc#plans")).toBe("/pricing");
    expect(sanitizePath("x".repeat(600))).toHaveLength(LIMITS.pathMaxLength);
  });

  it("drops invalid acquisition fields one by one", () => {
    const acquisition = sanitizeAcquisition({
      utm_source: "Newsletter",
      utm_medium: 12,
      referrer: "https://news.example.com/item?id=1",
      landing_path: "/welcome?ref=1",
      click_id: "abc123",
      click_id_kind: "nonsense",
      link_click_id: "4B0F6C2E-6E7A-4D0B-9C1A-2B3C4D5E6F70",
      self_reported_source: " Podcast ",
    });
    expect(acquisition).toEqual({
      utm_source: "newsletter",
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      referrer: "news.example.com",
      landing_path: "/welcome",
      click_id: null,
      click_id_kind: null,
      link_click_id: "4b0f6c2e-6e7a-4d0b-9c1a-2b3c4d5e6f70",
      self_reported_source: "podcast",
    });
    expect(sanitizeAcquisition({ click_id: "fb.1", click_id_kind: "fbclid" })).toMatchObject({
      click_id: "fb.1",
      click_id_kind: "fbclid",
    });
    expect(sanitizeAcquisition("nope").utm_source).toBeNull();
  });
});
