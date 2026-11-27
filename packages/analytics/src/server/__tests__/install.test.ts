/**
 * @jest-environment node
 */
import { install } from "../install";
import type { SqlClient } from "../sql";

/** A client that reports the schema missing and refuses to create it, as a restricted role would. */
function restrictedClient(): SqlClient {
  const client: SqlClient = {
    async query<T>(text: string): Promise<T[]> {
      if (text.includes("pg_namespace")) return [{ exists: false }] as T[];
      if (text.startsWith("create schema")) {
        throw Object.assign(new Error("permission denied for database"), { code: "42501" });
      }
      return [];
    },
    async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      return fn(client);
    },
  };
  return client;
}

describe("install", () => {
  it("names the fix when the role may not create the schema", async () => {
    await expect(install(restrictedClient(), { schema: "analytics" })).rejects.toThrow(
      /may not create schema "analytics".*Pre-create it.*omit the `schema` option/,
    );
  });

  it("rejects an invalid placement before touching the database", async () => {
    await expect(install(restrictedClient(), { prefix: "Bad-Prefix" })).rejects.toThrow(/invalid table prefix/);
  });
});
