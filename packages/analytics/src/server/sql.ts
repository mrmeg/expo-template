/**
 * The one database seam. Everything in `./server` talks to Postgres through
 * `SqlClient`, so the package imports no driver and works with whichever one
 * the host already has.
 *
 * Conventions every query in this package follows, so both adapters behave the
 * same:
 * - Positional parameters (`$1`, `$2`, ...) only.
 * - Every parameter is a string, number, boolean, `null`, or `Date`. Arrays and
 *   objects travel as one JSON string cast in SQL as `$1::text::jsonb`, then
 *   `jsonb_array_elements_text` or `jsonb_to_recordset`. Never a bare
 *   `$1::jsonb`: postgres.js JSON-encodes a string parameter the server types
 *   as jsonb a second time, so the value arrives as a JSON string scalar.
 * - Result columns are selected with explicit casts where the driver default
 *   is lossy: `count(*)::int`, `sum(x)::bigint` read as string, dates as
 *   `to_char(..., 'YYYY-MM-DD')`.
 */

export type SqlParam = string | number | boolean | null | Date;

export interface SqlClient {
  query<T = Record<string, unknown>>(text: string, params?: readonly SqlParam[]): Promise<T[]>;
  /** Runs `fn` in one transaction; rolls back when it throws. */
  transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T>;
}

/** The parts of a postgres.js (`postgres`) client this package uses. */
export interface PostgresJsLike {
  unsafe(text: string, params?: any[]): PromiseLike<any>;
  begin?(fn: (tx: any) => Promise<any>): Promise<any>;
  savepoint?(fn: (tx: any) => Promise<any>): Promise<any>;
}

/** Wraps a postgres.js client: `fromPostgresJs(postgres(url))`. */
export function fromPostgresJs(sql: PostgresJsLike): SqlClient {
  return {
    async query<T>(text: string, params: readonly SqlParam[] = []): Promise<T[]> {
      const rows = await sql.unsafe(text, params as any[]);
      return Array.from(rows as ArrayLike<T>);
    },
    async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      // Inside a transaction postgres.js exposes `savepoint`; at the top level, `begin`.
      const open = sql.begin ?? sql.savepoint;
      if (!open) throw new Error("fromPostgresJs: the client has neither begin() nor savepoint()");
      return open.call(sql, (tx: PostgresJsLike) => fn(fromPostgresJs(tx))) as Promise<T>;
    },
  };
}

/** The parts of a node-postgres (`pg`) pool this package uses. */
export interface PgPoolLike {
  query(text: string, params?: any[]): Promise<{ rows: any[] }>;
  connect(): Promise<PgClientLike>;
}
export interface PgClientLike {
  query(text: string, params?: any[]): Promise<{ rows: any[] }>;
  release(): void;
}

/** Wraps a node-postgres pool: `fromPg(new Pool({ connectionString }))`. */
export function fromPg(pool: PgPoolLike): SqlClient {
  const onClient = (client: PgClientLike): SqlClient => ({
    async query<T>(text: string, params: readonly SqlParam[] = []): Promise<T[]> {
      return (await client.query(text, params as any[])).rows as T[];
    },
    async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      // Already inside a transaction on this connection: nest with a savepoint.
      const name = `expo_analytics_${Math.random().toString(36).slice(2, 10)}`;
      await client.query(`savepoint ${name}`);
      try {
        const result = await fn(onClient(client));
        await client.query(`release savepoint ${name}`);
        return result;
      } catch (error) {
        await client.query(`rollback to savepoint ${name}`);
        throw error;
      }
    },
  });

  return {
    async query<T>(text: string, params: readonly SqlParam[] = []): Promise<T[]> {
      return (await pool.query(text, params as any[])).rows as T[];
    },
    async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await fn(onClient(client));
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
