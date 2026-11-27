/**
 * @jest-environment node
 */
import postgres from "postgres";

import { TEST_DATABASE_URL, describeDb } from "../../__tests__/dbHarness";
import { install, status, uninstall } from "../install";
import { LATEST_VERSION, TABLE_KEYS, resolveNames } from "../schema";
import { fromPostgresJs } from "../sql";

describeDb("install", (ctx) => {
  const allTables = TABLE_KEYS.map((key) => resolveNames().bare[key]);

  it("reports nothing installed before install", async () => {
    await expect(status(ctx.sql)).resolves.toEqual({
      installed: false,
      version: 0,
      latest: LATEST_VERSION,
      pending: [1],
      tables: [],
    });
  });

  it("installs once and is idempotent", async () => {
    const first = await install(ctx.sql);
    expect(first).toEqual({ applied: [1], version: LATEST_VERSION, createdSchema: false });
    const second = await install(ctx.sql);
    expect(second).toEqual({ applied: [], version: LATEST_VERSION, createdSchema: false });

    await expect(status(ctx.sql)).resolves.toEqual({
      installed: true,
      version: LATEST_VERSION,
      latest: LATEST_VERSION,
      pending: [],
      tables: allTables,
    });
  });

  it("serializes concurrent installs", async () => {
    const other = { prefix: "race_" };
    const results = await Promise.all([install(ctx.sql, other), install(ctx.sql, other), install(ctx.sql, other)]);
    expect(results.map((result) => result.applied.length).sort()).toEqual([0, 0, 1]);
    await uninstall(ctx.sql, other);
  });

  it("uninstalls exactly the owned tables and reinstalls", async () => {
    await ctx.raw.unsafe("create table host_table (id integer)");
    const result = await uninstall(ctx.sql);
    expect(result.dropped).toEqual([...allTables].reverse());
    expect(result.droppedSchema).toBe(false);
    expect((await status(ctx.sql)).tables).toEqual([]);

    const rows = await ctx.raw.unsafe(
      "select table_name from information_schema.tables where table_schema = $1",
      [ctx.schema],
    );
    expect(rows.map((row) => row.table_name)).toEqual(["host_table"]);

    await expect(uninstall(ctx.sql)).resolves.toEqual({ dropped: [], droppedSchema: false });
    await expect(install(ctx.sql)).resolves.toMatchObject({ applied: [1] });
    expect((await status(ctx.sql)).installed).toBe(true);
  });

  it("refuses to drop a table a host object depends on unless cascading", async () => {
    await ctx.raw.unsafe(`create view host_view as select id from analytics_events`);
    await expect(uninstall(ctx.sql)).rejects.toThrow(/cascade/);
    // The failed uninstall rolled back as a whole.
    expect((await status(ctx.sql)).tables).toEqual(allTables);
    const result = await uninstall(ctx.sql, {}, { cascade: true });
    expect(result.dropped).toHaveLength(allTables.length);
  });

  it("uses a custom prefix", async () => {
    await install(ctx.sql, { prefix: "stats_" });
    const state = await status(ctx.sql, { prefix: "stats_" });
    expect(state.tables).toContain("stats_events");
    expect(state.installed).toBe(true);
    expect((await status(ctx.sql)).installed).toBe(false);
    await uninstall(ctx.sql, { prefix: "stats_" });
    expect((await status(ctx.sql, { prefix: "stats_" })).tables).toEqual([]);
  });
});

describeDb("install into a dedicated schema", (ctx) => {
  const schema = `expo_analytics_dedicated_${Math.random().toString(36).slice(2, 8)}`;
  const kept = `expo_analytics_kept_${Math.random().toString(36).slice(2, 8)}`;

  afterAll(async () => {
    if (!TEST_DATABASE_URL) return;
    const admin = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
    await admin.unsafe(`drop schema if exists "${schema}" cascade`);
    await admin.unsafe(`drop schema if exists "${kept}" cascade`);
    await admin.end();
  });

  it("reports a missing schema as not installed", async () => {
    await expect(status(ctx.sql, { schema })).resolves.toMatchObject({ installed: false, tables: [] });
    await expect(uninstall(ctx.sql, { schema })).resolves.toEqual({ dropped: [], droppedSchema: false });
  });

  it("creates the schema and drops it on uninstall", async () => {
    await expect(install(ctx.sql, { schema })).resolves.toEqual({
      applied: [1],
      version: LATEST_VERSION,
      createdSchema: true,
    });
    const state = await status(ctx.sql, { schema });
    expect(state.tables).toHaveLength(TABLE_KEYS.length);
    // The connection's own schema is untouched.
    expect((await status(ctx.sql)).tables).toEqual([]);

    const result = await uninstall(ctx.sql, { schema });
    expect(result.droppedSchema).toBe(true);
    const rows = await ctx.raw.unsafe("select 1 from pg_namespace where nspname = $1", [schema]);
    expect(rows).toHaveLength(0);
  });

  it("keeps a created schema that holds someone else's table", async () => {
    await install(ctx.sql, { schema });
    await ctx.raw.unsafe(`create table "${schema}".host_table (id integer)`);
    const result = await uninstall(ctx.sql, { schema });
    expect(result).toEqual({ dropped: expect.arrayContaining(["analytics_events"]), droppedSchema: false });
    const rows = await ctx.raw.unsafe("select table_name from information_schema.tables where table_schema = $1", [
      schema,
    ]);
    expect(rows.map((row) => row.table_name)).toEqual(["host_table"]);
  });

  it("never drops a schema it did not create", async () => {
    await ctx.raw.unsafe(`create schema "${kept}"`);
    await expect(install(ctx.sql, { schema: kept })).resolves.toMatchObject({ createdSchema: false });
    const result = await uninstall(ctx.sql, { schema: kept });
    expect(result.droppedSchema).toBe(false);
    expect(await ctx.raw.unsafe("select 1 from pg_namespace where nspname = $1", [kept])).toHaveLength(1);
  });

  it("works through a second connection with a different search_path", async () => {
    const raw = postgres(TEST_DATABASE_URL!, { max: 1, onnotice: () => {} });
    try {
      const sql = fromPostgresJs(raw);
      await install(sql, { schema: kept });
      expect((await status(sql, { schema: kept })).installed).toBe(true);
      await uninstall(sql, { schema: kept });
    } finally {
      await raw.end();
    }
  });
});
