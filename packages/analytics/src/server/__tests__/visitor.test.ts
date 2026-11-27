/**
 * @jest-environment node
 */
import { deviceClass, parseUserAgent, visitorId } from "../visitor";

const UA = {
  chromeMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  chromeIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  safariIpad:
    "Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
  firefoxWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  chromeAndroidTablet:
    "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  samsung:
    "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  opera:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0",
  firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
  chromeOs:
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

describe("parseUserAgent", () => {
  it.each([
    ["chromeMac", "desktop", "Chrome", "macOS"],
    ["safariMac", "desktop", "Safari", "macOS"],
    ["safariIphone", "mobile", "Safari", "iOS"],
    ["chromeIphone", "mobile", "Chrome", "iOS"],
    ["safariIpad", "tablet", "Safari", "iOS"],
    ["firefoxWindows", "desktop", "Firefox", "Windows"],
    ["edgeWindows", "desktop", "Edge", "Windows"],
    ["chromeAndroid", "mobile", "Chrome", "Android"],
    ["chromeAndroidTablet", "tablet", "Chrome", "Android"],
    ["samsung", "mobile", "Samsung Internet", "Android"],
    ["opera", "desktop", "Opera", "Windows"],
    ["firefoxLinux", "desktop", "Firefox", "Linux"],
    ["chromeOs", "desktop", "Chrome", "ChromeOS"],
  ] as const)("classifies %s", (key, device, browser, os) => {
    expect(parseUserAgent(UA[key])).toEqual({ device, browser, os, isBot: false });
  });

  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36",
    "curl/8.7.1",
    "python-requests/2.32.3",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
  ])("flags %s as a bot", (ua) => {
    expect(parseUserAgent(ua).isBot).toBe(true);
  });

  it("never flags the native trackers' HTTP clients", () => {
    expect(parseUserAgent("okhttp/4.12.0").isBot).toBe(false);
    expect(parseUserAgent("MyApp/42 CFNetwork/1568.200.51 Darwin/24.1.0").isBot).toBe(false);
    expect(parseUserAgent("Mozilla/5.0 (Linux; Android 13; CUBOT X70) AppleWebKit/537.36 Mobile").isBot).toBe(false);
  });

  it("returns nulls for a missing user agent", () => {
    expect(parseUserAgent(null)).toEqual({ device: null, browser: null, os: null, isBot: false });
    expect(parseUserAgent("")).toEqual({ device: null, browser: null, os: null, isBot: false });
  });
});

describe("deviceClass", () => {
  it("trusts a mobile user agent and otherwise uses the viewport", () => {
    expect(deviceClass("mobile", 1400)).toBe("mobile");
    expect(deviceClass("desktop", 390)).toBe("mobile");
    expect(deviceClass("desktop", 820)).toBe("tablet");
    expect(deviceClass(null, 1440)).toBe("desktop");
    expect(deviceClass("desktop", undefined)).toBe("desktop");
    expect(deviceClass(null, "wide")).toBeNull();
  });
});

describe("visitorId", () => {
  const base = { salt: "s1", appId: "app", ip: "203.0.113.7", userAgent: UA.chromeMac };

  it("is a stable 32-character hex hash that never contains its inputs", () => {
    const id = visitorId(base);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(visitorId(base)).toBe(id);
    expect(id).not.toContain("203");
  });

  it("changes with the salt, app, ip and user agent", () => {
    const id = visitorId(base);
    expect(visitorId({ ...base, salt: "s2" })).not.toBe(id);
    expect(visitorId({ ...base, appId: "other" })).not.toBe(id);
    expect(visitorId({ ...base, ip: "203.0.113.8" })).not.toBe(id);
    expect(visitorId({ ...base, userAgent: UA.safariMac })).not.toBe(id);
  });
});
