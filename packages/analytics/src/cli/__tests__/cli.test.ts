/**
 * @jest-environment node
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SqlClient } from "../../server/sql";
import { runCli, type CliIo, type Connection } from "../index";

function capture(over: Partial<CliIo> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIo = { stdout: (line) => out.push(line), stderr: (line) => err.push(line), ...over };
  return { io, out, err };
}

/** A database where every owned table exists at version 1, recording what was run. */
function fakeConnection(): Connection & { statements: string[]; closed: boolean } {
  const statements: string[] = [];
  const sql: SqlClient = {
    async query<T>(text: string): Promise<T[]> {
      statements.push(text);
      if (text.includes("pg_namespace")) return [{ exists: true }] as T[];
      if (text.includes("to_regclass")) {
        return ["migrations", "events", "sessions", "users", "linkClicks", "revenueEvents", "salts"].map((key) => ({
          key,
          tagged: true,
        })) as T[];
      }
      if (text.includes("select version")) return [{ version: 1 }] as T[];
      return [];
    },
    async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      return fn(sql);
    },
  };
  const connection = {
    sql,
    driver: "pg" as const,
    statements,
    closed: false,
    async close() {
      connection.closed = true;
    },
  };
  return connection;
}

describe("runCli", () => {
  it("prints usage for bad arguments", async () => {
    const { io, err } = capture();
    await expect(runCli([], {}, io)).resolves.toBe(2);
    await expect(runCli(["migrate"], {}, io)).resolves.toBe(2);
    await expect(runCli(["status", "--schema"], {}, io)).resolves.toBe(2);
    expect(err.join("\n")).toMatch(/Usage: expo-analytics/);
  });

  it("prints help", async () => {
    const { io, out } = capture();
    await expect(runCli(["--help"], {}, io)).resolves.toBe(0);
    expect(out[0]).toMatch(/Usage/);
  });

  it("needs a database URL", async () => {
    const { io, err } = capture();
    await expect(runCli(["status"], {}, io)).resolves.toBe(2);
    expect(err[0]).toMatch(/DATABASE_URL/);
  });

  it("says how to install a driver when none resolves from the working directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "expo-analytics-cli-"));
    try {
      const { io, err } = capture({ cwd: dir });
      await expect(runCli(["status"], { DATABASE_URL: "postgres://localhost/x" }, io)).resolves.toBe(1);
      expect(err[0]).toMatch(/no Postgres driver found.*npm install postgres.*npm install pg/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses to uninstall without --yes and lists what it would drop", async () => {
    const connection = fakeConnection();
    const { io, out, err } = capture({ connect: async () => connection });
    await expect(runCli(["uninstall", "--schema", "stats"], { DATABASE_URL: "postgres://u:secret@db/x" }, io)).resolves.toBe(1);
    expect(out.join("\n")).toContain("analytics_events");
    expect(out.join("\n")).toContain("schema stats");
    expect(out.join("\n")).not.toContain("secret");
    expect(err.join("\n")).toMatch(/--yes/);
    expect(connection.statements.some((text) => text.startsWith("drop"))).toBe(false);
    expect(connection.closed).toBe(true);
  });

  it("passes the placement and cascade through", async () => {
    const connection = fakeConnection();
    const { io } = capture({ connect: async () => connection });
    await expect(
      runCli(["uninstall", "--prefix=stats_", "--cascade", "--yes", "--database-url", "postgres://db/x"], {}, io),
    ).resolves.toBe(0);
    expect(connection.statements).toContain('drop table "stats_events" cascade');
  });

  it("reports database errors with exit code 1", async () => {
    const { io, err } = capture({
      connect: async () => ({
        sql: {
          query: async () => {
            throw new Error("connection refused");
          },
          transaction: async () => {
            throw new Error("connection refused");
          },
        },
        driver: "postgres",
        close: async () => {},
      }),
    });
    await expect(runCli(["install"], { DATABASE_URL: "postgres://db/x" }, io)).resolves.toBe(1);
    expect(err[0]).toMatch(/connection refused/);
  });
});
