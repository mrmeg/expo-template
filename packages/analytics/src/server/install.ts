/**
 * Install, uninstall and status for the tables in `schema.ts`.
 *
 * Install is safe to call on every boot: it runs in one transaction under an
 * advisory lock keyed on the placement, so two servers starting together
 * serialize instead of racing, and it applies only the versions missing from
 * `<prefix>migrations`. Uninstall drops exactly `TABLE_KEYS` and, when install
 * created the schema, the schema once it is empty. Nothing else is touched.
 */
import { LATEST_VERSION, MIGRATIONS, TABLE_KEYS, resolveNames, type Names, type PlacementOptions } from "./schema";
import type { SqlClient } from "./sql";
import { jsonParam } from "./util";

export interface InstallResult {
  /** Versions applied by this call; empty when already current. */
  applied: number[];
  version: number;
  /** True when this call created the dedicated schema. */
  createdSchema: boolean;
}

export interface UninstallOptions {
  /** Also drop objects that depend on the tables (host views, foreign keys). */
  cascade?: boolean;
}

export interface UninstallResult {
  /** Bare names of the tables dropped by this call. */
  dropped: string[];
  droppedSchema: boolean;
}

export interface InstallStatus {
  installed: boolean;
  /** Highest applied migration, 0 when nothing is installed. */
  version: number;
  latest: number;
  pending: number[];
  /** Bare names of the owned tables that exist, in `TABLE_KEYS` order. */
  tables: string[];
}

/** Postgres SQLSTATE for "permission denied". */
const INSUFFICIENT_PRIVILEGE = "42501";

function lockKey(names: Names): string {
  return `expo-analytics:${names.schema ?? ""}:${names.prefix}`;
}

async function lock(tx: SqlClient, names: Names): Promise<void> {
  await tx.query("select pg_advisory_xact_lock(hashtext($1)::bigint)", [lockKey(names)]);
}

async function schemaExists(sql: SqlClient, schema: string): Promise<boolean> {
  const rows = await sql.query<{ exists: boolean }>(
    "select exists (select 1 from pg_namespace where nspname = $1) as exists",
    [schema],
  );
  return rows[0]?.exists === true;
}

/** Bare names of the owned tables that exist. `to_regclass` follows `search_path` when unqualified. */
async function existingTables(sql: SqlClient, names: Names): Promise<string[]> {
  if (names.schema && !(await schemaExists(sql, names.schema))) return [];
  const keys = TABLE_KEYS.map((key) => ({ key, name: names.t[key] }));
  const rows = await sql.query<{ key: string }>(
    "select r.key from jsonb_to_recordset($1::text::jsonb) as r(key text, name text) where to_regclass(r.name) is not null",
    [jsonParam(keys)],
  );
  const present = new Set(rows.map((row) => row.key));
  return TABLE_KEYS.filter((key) => present.has(key)).map((key) => names.bare[key]);
}

async function appliedVersions(sql: SqlClient, names: Names): Promise<number[]> {
  const rows = await sql.query<{ version: number }>(
    `select version::int as version from ${names.t.migrations} order by version`,
  );
  return rows.map((row) => Number(row.version));
}

function isPermissionError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === INSUFFICIENT_PRIVILEGE;
}

export async function install(sql: SqlClient, placement: PlacementOptions = {}): Promise<InstallResult> {
  const names = resolveNames(placement);
  return sql.transaction(async (tx) => {
    await lock(tx, names);

    let createdSchema = false;
    if (names.schema && !(await schemaExists(tx, names.schema))) {
      try {
        await tx.query(`create schema "${names.schema}"`);
      } catch (error) {
        if (!isPermissionError(error)) throw error;
        throw new Error(
          `expo-analytics: the database role may not create schema "${names.schema}". ` +
            `Pre-create it (create schema "${names.schema}" authorization <role>) or omit the \`schema\` option to use the connection's search_path.`,
          { cause: error },
        );
      }
      createdSchema = true;
    }

    await tx.query(
      `create table if not exists ${names.t.migrations} (
        version integer primary key,
        name text not null,
        applied_at timestamptz not null default now(),
        created_schema boolean not null default false
      )`,
    );

    const done = new Set(await appliedVersions(tx, names));
    const applied: number[] = [];
    for (const migration of MIGRATIONS) {
      if (done.has(migration.version)) continue;
      for (const statement of migration.up(names)) await tx.query(statement);
      await tx.query(`insert into ${names.t.migrations} (version, name, created_schema) values ($1, $2, $3)`, [
        migration.version,
        migration.name,
        createdSchema,
      ]);
      applied.push(migration.version);
    }

    const version = Math.max(0, ...done, ...applied);
    return { applied, version, createdSchema };
  });
}

export async function uninstall(
  sql: SqlClient,
  placement: PlacementOptions = {},
  options: UninstallOptions = {},
): Promise<UninstallResult> {
  const names = resolveNames(placement);
  return sql.transaction(async (tx) => {
    await lock(tx, names);
    if (names.schema && !(await schemaExists(tx, names.schema))) return { dropped: [], droppedSchema: false };

    const present = new Set(await existingTables(tx, names));
    let createdSchema = false;
    if (present.has(names.bare.migrations)) {
      const rows = await tx.query<{ created: boolean }>(
        `select coalesce(bool_or(created_schema), false) as created from ${names.t.migrations}`,
      );
      createdSchema = rows[0]?.created === true;
    }

    const dropped: string[] = [];
    for (const key of [...TABLE_KEYS].reverse()) {
      if (!present.has(names.bare[key])) continue;
      try {
        await tx.query(`drop table ${names.t[key]} ${options.cascade ? "cascade" : "restrict"}`);
      } catch (error) {
        throw new Error(
          `expo-analytics: could not drop ${names.bare[key]}: ${error instanceof Error ? error.message : String(error)}. ` +
            "Remove the objects that depend on it, or uninstall with cascade.",
          { cause: error },
        );
      }
      dropped.push(names.bare[key]);
    }

    let droppedSchema = false;
    if (names.schema && createdSchema) {
      // `restrict` refuses a non-empty schema; the savepoint keeps that refusal
      // from rolling back the table drops above.
      try {
        await tx.transaction(async (inner) => {
          await inner.query(`drop schema "${names.schema}" restrict`);
        });
        droppedSchema = true;
      } catch {
        droppedSchema = false;
      }
    }
    return { dropped, droppedSchema };
  });
}

export async function status(sql: SqlClient, placement: PlacementOptions = {}): Promise<InstallStatus> {
  const names = resolveNames(placement);
  const tables = await existingTables(sql, names);
  const versions = tables.includes(names.bare.migrations) ? await appliedVersions(sql, names) : [];
  const applied = new Set(versions);
  const version = Math.max(0, ...versions);
  return {
    installed: version > 0,
    version,
    latest: LATEST_VERSION,
    pending: MIGRATIONS.filter((migration) => !applied.has(migration.version)).map((migration) => migration.version),
    tables,
  };
}
