import { MIGRATIONS, TABLE_KEYS, resolveNames } from "../server/schema";
import { describeDb } from "./dbHarness";

describeDb("schema migrations", (ctx) => {
  it("creates every owned table with the default prefix", async () => {
    const names = resolveNames();
    await ctx.sql.transaction(async (tx) => {
      // The migrations table belongs to the installer; create a stand-in so the
      // owned-table list below is complete.
      await tx.query(`create table ${names.t.migrations} (version integer primary key)`);
      for (const migration of MIGRATIONS) {
        for (const statement of migration.up(names)) await tx.query(statement);
      }
    });

    const rows = await ctx.sql.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = $1 order by table_name",
      [ctx.schema],
    );
    expect(rows.map((row) => row.table_name)).toEqual(TABLE_KEYS.map((key) => names.bare[key]).sort());
  });

  it("rolls back a failed transaction", async () => {
    await expect(
      ctx.sql.transaction(async (tx) => {
        await tx.query("create table rollback_probe (id integer)");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const rows = await ctx.sql.query(
      "select 1 from information_schema.tables where table_schema = $1 and table_name = 'rollback_probe'",
      [ctx.schema],
    );
    expect(rows).toHaveLength(0);
  });
});

describe("resolveNames", () => {
  it("qualifies names with a schema and prefix", () => {
    const names = resolveNames({ schema: "stats", prefix: "a_" });
    expect(names.t.events).toBe('"stats"."a_events"');
    expect(names.bare.linkClicks).toBe("a_link_clicks");
    expect(names.ix("events_app_time")).toBe("a_events_app_time_idx");
  });

  it("rejects identifiers that would need quoting", () => {
    expect(() => resolveNames({ prefix: "bad-prefix" })).toThrow(/invalid table prefix/);
    expect(() => resolveNames({ schema: 'x"; drop table users; --' })).toThrow(/invalid schema/);
    expect(() => resolveNames({ prefix: "a".repeat(21) })).toThrow(/invalid table prefix/);
  });
});
