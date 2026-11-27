/**
 * @jest-environment node
 */
import { describeDb } from "../../__tests__/dbHarness";
import { install, status, uninstall } from "../install";
import { createAnalyticsServer } from "../server";

/**
 * The package may only ever touch tables it created. A host table that shares
 * one of its names must survive install, status and uninstall untouched.
 */
describeDb("table ownership", (ctx) => {
  it("refuses to install over a host table and changes nothing", async () => {
    await ctx.raw.unsafe("create table own_users (id integer primary key, email text)");
    await ctx.raw.unsafe("insert into own_users values (1, 'kept@example.com')");

    await expect(install(ctx.sql, { prefix: "own_" })).rejects.toThrow(/own_users already exists and was not created by this package/);

    const tables = await ctx.raw.unsafe(
      "select table_name from information_schema.tables where table_schema = $1 and table_name like 'own\\_%' order by 1",
      [ctx.schema],
    );
    expect(tables.map((row) => row.table_name)).toEqual(["own_users"]);
    await expect(status(ctx.sql, { prefix: "own_" })).resolves.toMatchObject({ installed: false, tables: [] });
  });

  it("never drops a host table that shares a name", async () => {
    const result = await uninstall(ctx.sql, { prefix: "own_" }, { cascade: true });
    expect(result).toEqual({ dropped: [], droppedSchema: false, skipped: ["own_users"] });
    const rows = await ctx.raw.unsafe("select email from own_users");
    expect(rows.map((row) => row.email)).toEqual(["kept@example.com"]);
  });

  it("does not trust a host table named like the migrations log", async () => {
    await ctx.raw.unsafe("create table log_migrations (version integer primary key, name text)");
    await ctx.raw.unsafe("insert into log_migrations values (1, 'theirs')");
    await expect(install(ctx.sql, { prefix: "log_" })).rejects.toThrow(/log_migrations already exists/);
    await expect(status(ctx.sql, { prefix: "log_" })).resolves.toMatchObject({ installed: false });
    await expect(uninstall(ctx.sql, { prefix: "log_" })).resolves.toMatchObject({ dropped: [], skipped: ["log_migrations"] });
  });

  it("stamps what it creates, and drops only that", async () => {
    await install(ctx.sql, { prefix: "mine_" });
    const stamped = await ctx.raw.unsafe(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = $1 and c.relkind = 'r' and obj_description(c.oid, 'pg_class') = 'expo-analytics' order by 1`,
      [ctx.schema],
    );
    expect(stamped.map((row) => row.relname)).toEqual([
      "mine_events",
      "mine_link_clicks",
      "mine_migrations",
      "mine_revenue_events",
      "mine_salts",
      "mine_sessions",
      "mine_users",
    ]);
    const result = await uninstall(ctx.sql, { prefix: "mine_" });
    expect(result.dropped).toHaveLength(7);
    expect(result.skipped).toEqual([]);
  });

  it("deletes earlier salts when pruning, without waiting for cookieless traffic", async () => {
    let clock = new Date("2026-06-02T12:00:00.000Z");
    const server = createAnalyticsServer({ sql: ctx.sql, appId: "app", prefix: "salt_", now: () => clock });
    await server.install();
    await ctx.raw.unsafe("insert into salt_salts (day, salt) values ('2026-06-01', 'old'), ('2026-06-02', 'today')");
    await server.prune({ olderThanDays: 30 });
    const left = await ctx.raw.unsafe("select salt from salt_salts order by day");
    expect(left.map((row) => row.salt)).toEqual(["today"]);
    clock = new Date("2026-06-03T00:00:01.000Z");
    await server.prune({ olderThanDays: 30 });
    expect(await ctx.raw.unsafe("select 1 from salt_salts")).toHaveLength(0);
  });
});
