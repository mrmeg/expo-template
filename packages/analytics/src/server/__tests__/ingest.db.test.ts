/**
 * @jest-environment node
 */
import { randomUUID } from "node:crypto";

import { describeDb } from "../../__tests__/dbHarness";
import type { IngestResponse, WireBatch } from "../../shared/wire";
import { createAnalyticsServer, type AnalyticsServer } from "../server";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const BOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const IP = "198.51.100.23";
const MINUTE = 60_000;

describeDb("ingest", (ctx) => {
  let clock = new Date("2026-06-01T12:00:00.000Z");
  let signedIn: string | null = null;
  let server: AnalyticsServer;

  beforeAll(async () => {
    server = createAnalyticsServer({
      sql: ctx.sql,
      appId: "app_a",
      now: () => clock,
      resolveUserId: () => signedIn,
      onError: (error) => {
        throw error;
      },
    });
    await server.install();
  });

  beforeEach(() => {
    signedIn = null;
  });

  const at = (offsetMs: number) => new Date(clock.getTime() + offsetMs).toISOString();

  async function send(batch: unknown, headers: Record<string, string> = {}): Promise<IngestResponse> {
    const response = await server.handle(
      new Request("https://www.example.com/analytics/e", {
        method: "POST",
        body: JSON.stringify(batch),
        headers: {
          "content-type": "text/plain",
          "user-agent": CHROME_MAC,
          "x-forwarded-for": `${IP}, 10.0.0.1`,
          "cf-ipcountry": "de",
          ...headers,
        },
      }),
    );
    if (response?.status !== 200) throw new Error(`status ${response?.status}: ${await response?.text()}`);
    return response.json();
  }

  async function sessionsFor(anonymousId: string) {
    return ctx.raw.unsafe(
      `select * from analytics_sessions where app_id = 'app_a' and anonymous_id = $1 order by started_at`,
      [anonymousId],
    );
  }

  describe("native batches with client session ids", () => {
    const sessionId = `s_${randomUUID()}`;
    const anonymousId = `anon_${randomUUID().slice(0, 8)}`;
    const batch: WireBatch = {
      context: { platform: "ios", app_version: "1.2.3", anonymous_id: anonymousId },
      acquisition: { utm_source: "TikTok", utm_campaign: "Launch" },
      events: [
        { id: randomUUID(), name: "$session_start", ts: at(-3 * MINUTE), session_id: sessionId },
        { id: randomUUID(), name: "$screen", ts: at(-2 * MINUTE), session_id: sessionId, path: "home" },
        { id: randomUUID(), name: "task_created", ts: at(-MINUTE), session_id: sessionId, path: "tasks", props: { n: 1 } },
        { id: randomUUID(), name: "$screen", ts: at(0), session_id: sessionId, path: "settings" },
      ],
    };

    it("writes events, the session and the user", async () => {
      signedIn = "user_native";
      await expect(send(batch, { "user-agent": "MyApp/1 CFNetwork/1568 Darwin/24.1.0" })).resolves.toEqual({
        received: 4,
        inserted: 4,
        rejected: 0,
        duplicates: 0,
      });

      const events = await ctx.raw.unsafe(
        "select user_id, anonymous_id, session_id, platform, app_version from analytics_events where session_id = $1",
        [sessionId],
      );
      expect(events).toHaveLength(4);
      expect(events[0]).toEqual({
        user_id: "user_native",
        anonymous_id: anonymousId,
        session_id: sessionId,
        platform: "ios",
        app_version: "1.2.3",
      });

      const [session] = await ctx.raw.unsafe("select * from analytics_sessions where id = $1", [sessionId]);
      expect(session).toMatchObject({
        user_id: "user_native",
        anonymous_id: anonymousId,
        pageviews: 2,
        custom_events: 1,
        entry_path: "home",
        exit_path: "settings",
        utm_source: "tiktok",
        utm_campaign: "launch",
        platform: "ios",
        country: "DE",
      });
      expect(new Date(session.started_at).toISOString()).toBe(at(-3 * MINUTE));
      expect(new Date(session.last_seen_at).toISOString()).toBe(at(0));

      const [user] = await ctx.raw.unsafe("select * from analytics_users where user_id = 'user_native'");
      expect(user).toMatchObject({
        signup_platform: "ios",
        signup_app_version: "1.2.3",
        first_anonymous_id: anonymousId,
        utm_source: "tiktok",
        channel: "tiktok",
        excluded: false,
      });
    });

    it("changes nothing when the batch is replayed", async () => {
      signedIn = "user_native";
      const [sessionBefore] = await ctx.raw.unsafe("select * from analytics_sessions where id = $1", [sessionId]);
      const [userBefore] = await ctx.raw.unsafe("select * from analytics_users where user_id = 'user_native'");
      clock = new Date(clock.getTime() + 5 * MINUTE);

      await expect(send(batch)).resolves.toEqual({ received: 4, inserted: 0, rejected: 0, duplicates: 4 });

      const [sessionAfter] = await ctx.raw.unsafe("select * from analytics_sessions where id = $1", [sessionId]);
      const [userAfter] = await ctx.raw.unsafe("select * from analytics_users where user_id = 'user_native'");
      expect(sessionAfter).toEqual(sessionBefore);
      expect(userAfter).toEqual(userBefore);
    });

    it("extends the session with a later batch", async () => {
      const more: WireBatch = {
        context: batch.context,
        events: [{ id: randomUUID(), name: "$screen", ts: at(0), session_id: sessionId, path: "profile" }],
      };
      await send(more);
      const [session] = await ctx.raw.unsafe("select * from analytics_sessions where id = $1", [sessionId]);
      expect(session).toMatchObject({ pageviews: 3, exit_path: "profile", entry_path: "home", user_id: "user_native" });
    });
  });

  describe("validation", () => {
    it("rejects bad events individually, restamps and truncates", async () => {
      const ok = randomUUID();
      const stale = randomUUID();
      const big = randomUUID();
      const sessionId = `v_${randomUUID()}`;
      const result = await send({
        context: { anonymous_id: "anon_validation" },
        events: [
          { id: ok, name: "clicked", ts: at(0), session_id: sessionId },
          { id: stale, name: "clicked", ts: "2001-01-01T00:00:00Z", session_id: sessionId },
          { id: big, name: "clicked", ts: at(0), session_id: sessionId, props: { blob: "x".repeat(5000) } },
          { id: ok, name: "clicked", ts: at(0), session_id: sessionId },
          { id: "nope", name: "clicked", ts: at(0) },
          { id: randomUUID(), name: "$custom", ts: at(0) },
          { id: randomUUID(), name: "Bad Name", ts: at(0) },
          "garbage",
        ],
      });
      expect(result).toEqual({ received: 8, inserted: 3, rejected: 4, duplicates: 1 });

      const rows = await ctx.raw.unsafe(
        "select id::text as id, occurred_at, properties from analytics_events where id = any($1::uuid[])",
        [[stale, big]],
      );
      const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
      expect(new Date(byId[stale].occurred_at).toISOString()).toBe(clock.toISOString());
      expect(byId[big].properties).toEqual({ _truncated: true });
    });

    it("stores nothing for a bot", async () => {
      const id = randomUUID();
      const result = await send({ events: [{ id, name: "$pageview", ts: at(0), path: "/" }] }, { "user-agent": BOT });
      expect(result).toEqual({ received: 1, inserted: 0, rejected: 0, duplicates: 0 });
      const rows = await ctx.raw.unsafe("select 1 from analytics_events where id = $1", [id]);
      expect(rows).toHaveLength(0);
    });

    it("survives strings Postgres would refuse", async () => {
      const id = randomUUID();
      await send({
        context: { anonymous_id: "anon_nul" },
        events: [{ id, name: "typed", ts: at(0), path: "/a\u0000b", props: { "k\u0000": "v\u0000\ud800" } }],
      });
      const [row] = await ctx.raw.unsafe("select path, properties from analytics_events where id = $1", [id]);
      expect(row).toEqual({ path: "/ab", properties: { k: "v�" } });
    });
  });

  describe("cookieless web sessions", () => {
    const ua = IPHONE;
    const pageview = (path: string, offset = 0) => ({ id: randomUUID(), name: "$pageview", ts: at(offset), path });

    async function visitorId(): Promise<string> {
      const [row] = await ctx.raw.unsafe(
        "select anonymous_id from analytics_events where name = '$pageview' and path = '/landing' order by received_at desc limit 1",
      );
      return row.anonymous_id;
    }

    it("opens a session from the visitor hash with first-touch context", async () => {
      clock = new Date("2026-06-02T09:00:00.000Z");
      await send(
        {
          context: { platform: "web", referrer: "https://news.example.org/item?id=1", screen_width: 390 },
          acquisition: { utm_source: "Newsletter", utm_medium: "Email" },
          events: [pageview("/landing")],
        },
        { "user-agent": ua },
      );
      const anonymousId = await visitorId();
      expect(anonymousId).toMatch(/^[0-9a-f]{32}$/);
      const sessions = await sessionsFor(anonymousId);
      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toMatchObject({
        platform: "web",
        pageviews: 1,
        custom_events: 0,
        entry_path: "/landing",
        exit_path: "/landing",
        referrer_host: "news.example.org",
        utm_source: "newsletter",
        utm_medium: "email",
        device: "mobile",
        browser: "Safari",
        os: "iOS",
        country: "DE",
        user_id: null,
      });
    });

    it("joins the open session within the idle timeout", async () => {
      clock = new Date("2026-06-02T09:10:00.000Z");
      await send(
        {
          context: { platform: "web", referrer: "https://www.example.com/landing" },
          acquisition: { utm_source: "other" },
          events: [pageview("/pricing"), { id: randomUUID(), name: "plan_selected", ts: at(1000) }],
        },
        { "user-agent": ua },
      );
      const sessions = await sessionsFor(await visitorId());
      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toMatchObject({
        pageviews: 2,
        custom_events: 1,
        entry_path: "/landing",
        exit_path: "/pricing",
        utm_source: "newsletter",
      });
    });

    it("starts a new session after the idle timeout, without a same-site referrer", async () => {
      clock = new Date("2026-06-02T09:45:00.000Z");
      await send(
        { context: { platform: "web", referrer: "https://example.com/pricing" }, events: [pageview("/docs")] },
        { "user-agent": ua },
      );
      const sessions = await sessionsFor(await visitorId());
      expect(sessions).toHaveLength(2);
      expect(sessions[1]).toMatchObject({ pageviews: 1, entry_path: "/docs", referrer_host: null, utm_source: null });
    });

    it("never stores the raw IP or user agent", async () => {
      const rows = await ctx.raw.unsafe(
        `select (select string_agg(t::text, ' ') from analytics_events t) ||
                (select string_agg(t::text, ' ') from analytics_sessions t) ||
                (select coalesce(string_agg(t::text, ' '), '') from analytics_users t) as dump`,
      );
      expect(rows[0].dump).not.toContain(IP);
      expect(rows[0].dump).not.toContain("AppleWebKit");
    });

    it("gives a different visitor id on a different day", async () => {
      const first = await visitorId();
      clock = new Date("2026-06-03T09:00:00.000Z");
      await send({ context: { platform: "web" }, events: [pageview("/landing")] }, { "user-agent": ua });
      expect(await visitorId()).not.toBe(first);
      const salts = await ctx.raw.unsafe("select to_char(day, 'YYYY-MM-DD') as day from analytics_salts order by day");
      expect(salts.map((row) => row.day)).toEqual(["2026-06-02", "2026-06-03"]);
    });

    it("opens one session for concurrent batches from one visitor", async () => {
      clock = new Date("2026-06-03T15:00:00.000Z");
      const headers = { "user-agent": ua, "x-forwarded-for": "192.0.2.99" };
      await Promise.all(
        [0, 1, 2, 3].map(() => send({ context: { platform: "web" }, events: [pageview("/landing")] }, headers)),
      );
      const [row] = await ctx.raw.unsafe(
        "select count(distinct session_id)::int as sessions, count(*)::int as events from analytics_events where occurred_at = $1",
        [clock],
      );
      expect(row).toEqual({ sessions: 1, events: 4 });
    });
  });

  describe("users", () => {
    it("keeps first touch and recomputes the channel", async () => {
      signedIn = "user_web";
      clock = new Date("2026-06-04T10:00:00.000Z");
      await send({
        context: { platform: "web", anonymous_id: "anon_web_user" },
        events: [{ id: randomUUID(), name: "$pageview", ts: at(0), path: "/" }],
      });
      let [user] = await ctx.raw.unsafe("select * from analytics_users where user_id = 'user_web'");
      expect(user).toMatchObject({ channel: "web_direct", utm_source: null, signup_platform: "web" });
      expect(new Date(user.first_seen_at).toISOString()).toBe(clock.toISOString());

      clock = new Date("2026-06-04T11:00:00.000Z");
      await send({
        context: { platform: "ios", anonymous_id: "anon_web_user" },
        acquisition: { self_reported_source: "Podcast", utm_campaign: "first", referrer: "https://www.example.com/x" },
        events: [{ id: randomUUID(), name: "onboarded", ts: at(0) }],
      });
      [user] = await ctx.raw.unsafe("select * from analytics_users where user_id = 'user_web'");
      expect(user).toMatchObject({
        channel: "podcast",
        self_reported_source: "podcast",
        utm_campaign: "first",
        signup_platform: "web",
        referrer: null,
      });
      expect(new Date(user.last_seen_at).toISOString()).toBe(clock.toISOString());

      await send({
        context: { platform: "web", anonymous_id: "anon_web_user" },
        acquisition: { utm_source: "instagram", utm_campaign: "second", self_reported_source: "friend" },
        events: [{ id: randomUUID(), name: "onboarded", ts: at(0) }],
      });
      [user] = await ctx.raw.unsafe("select * from analytics_users where user_id = 'user_web'");
      // utm_source was empty, so it fills and now outranks the self-reported answer; the rest stay first touch.
      expect(user).toMatchObject({
        utm_source: "instagram",
        utm_campaign: "first",
        self_reported_source: "podcast",
        channel: "instagram",
      });
      expect(new Date(user.first_seen_at).toISOString()).toBe("2026-06-04T10:00:00.000Z");
    });

    it("never takes a user id from the body", async () => {
      signedIn = null;
      const id = randomUUID();
      await send({
        context: { anonymous_id: "anon_spoof" },
        user_id: "victim",
        events: [{ id, name: "clicked", ts: at(0), user_id: "victim" }],
      });
      const [row] = await ctx.raw.unsafe("select user_id from analytics_events where id = $1", [id]);
      expect(row.user_id).toBeNull();
    });
  });
});
