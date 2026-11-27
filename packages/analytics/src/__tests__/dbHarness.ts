/**
 * Harness for `*.db.test.ts`: tests that need a real Postgres.
 *
 * - `ANALYTICS_TEST_DATABASE_URL` set: the suite runs against it.
 * - Unset: the suite is skipped, so `bun run pkg analytics test` needs no database.
 * - `REQUIRE_TEST_DB=1` (set by `bun run --cwd packages/analytics test:db`):
 *   unset becomes a failure, so a green `test:db` always ran against Postgres.
 *
 * Each `describeDb` block gets its own throwaway schema, dropped afterwards, so
 * suites never see each other's rows and nothing outside that schema is touched.
 */
import postgres from "postgres";

import { fromPostgresJs, type SqlClient } from "../server/sql";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** The suites create and drop schemas, so refuse anything that is not clearly a local test database. */
export function assertSafeTestDatabase(url: string): void {
  const parsed = new URL(url);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!LOOPBACK_HOSTS.has(parsed.hostname) || !/test/i.test(database)) {
    throw new Error(
      `Refusing ANALYTICS_TEST_DATABASE_URL: the host must be loopback and the database name must contain "test" (got host "${parsed.hostname}", database "${database}")`,
    );
  }
}

export const TEST_DATABASE_URL = process.env.ANALYTICS_TEST_DATABASE_URL;
const REQUIRE_TEST_DB = process.env.REQUIRE_TEST_DB === "1";

export interface DbContext {
  /** The adapter under test, with `search_path` set to the throwaway schema. */
  sql: SqlClient;
  /** The raw postgres.js client behind `sql`, for setup and assertions. */
  raw: postgres.Sql;
  /** The throwaway schema's name. */
  schema: string;
}

/**
 * `describe` for database suites. `ctx` is filled in `beforeAll`, so read its
 * fields inside tests and hooks, never at describe time.
 */
export function describeDb(name: string, body: (ctx: DbContext) => void): void {
  if (!TEST_DATABASE_URL) {
    if (REQUIRE_TEST_DB) {
      describe(name, () => {
        it("needs ANALYTICS_TEST_DATABASE_URL", () => {
          throw new Error("REQUIRE_TEST_DB=1 but ANALYTICS_TEST_DATABASE_URL is not set");
        });
      });
    } else {
      describe.skip(name, () => {
        it("skipped: ANALYTICS_TEST_DATABASE_URL is not set", () => {});
      });
    }
    return;
  }

  assertSafeTestDatabase(TEST_DATABASE_URL);
  const url = TEST_DATABASE_URL;
  const ctx = {} as DbContext;

  describe(name, () => {
    jest.setTimeout(30_000);

    beforeAll(async () => {
      const schema = `expo_analytics_test_${Math.random().toString(36).slice(2, 10)}`;
      const admin = postgres(url, { max: 1, onnotice: () => {} });
      await admin.unsafe(`create schema "${schema}"`);
      await admin.end();
      ctx.schema = schema;
      ctx.raw = postgres(url, { max: 4, onnotice: () => {}, connection: { search_path: schema } });
      ctx.sql = fromPostgresJs(ctx.raw);
    });

    afterAll(async () => {
      if (!ctx.raw) return;
      await ctx.raw.unsafe(`drop schema if exists "${ctx.schema}" cascade`);
      await ctx.raw.end();
    });

    body(ctx);
  });
}
