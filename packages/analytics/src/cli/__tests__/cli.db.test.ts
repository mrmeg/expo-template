/**
 * @jest-environment node
 */
import { join } from "node:path";

import postgres from "postgres";

import { TEST_DATABASE_URL, describeDb } from "../../__tests__/dbHarness";
import { runCli } from "../index";

describeDb("expo-analytics CLI", (ctx) => {
  // Its own schema: the CLI connects without the harness's search_path.
  const schema = `expo_analytics_cli_${Math.random().toString(36).slice(2, 8)}`;
  // The package directory, where `postgres` resolves the way it would in a host project.
  const cwd = join(__dirname, "..", "..", "..");

  // The harness closes `ctx.raw` in its own afterAll, which runs first.
  afterAll(async () => {
    if (!TEST_DATABASE_URL) return;
    const admin = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
    await admin.unsafe(`drop schema if exists "${schema}" cascade`);
    await admin.end();
  });

  async function run(...argv: string[]) {
    const out: string[] = [];
    const err: string[] = [];
    const code = await runCli(argv, { DATABASE_URL: TEST_DATABASE_URL }, {
      cwd,
      stdout: (line) => out.push(line),
      stderr: (line) => err.push(line),
    });
    return { code, out: out.join("\n"), err: err.join("\n") };
  }

  it("installs, reports status, and uninstalls with the project's driver", async () => {
    expect(await run("status", "--schema", schema)).toMatchObject({ code: 0, out: expect.stringContaining("Installed: no") });

    const installed = await run("install", "--schema", schema);
    expect(installed).toMatchObject({ code: 0, out: expect.stringContaining("Installed migrations 1") });
    expect(installed.out).toContain(`Created schema ${schema}`);
    expect(await run("install", "--schema", schema)).toMatchObject({ out: expect.stringContaining("Already up to date") });

    const state = await run("status", "--schema", schema);
    expect(state.out).toContain("Installed: yes");
    expect(state.out).toContain("analytics_events");

    expect((await run("uninstall", "--schema", schema)).code).toBe(1);
    expect((await run("status", "--schema", schema)).out).toContain("Installed: yes");

    const removed = await run("uninstall", "--schema", schema, "--yes");
    expect(removed).toMatchObject({ code: 0, out: expect.stringContaining(`Dropped schema ${schema}`) });
    const rows = await ctx.raw.unsafe("select 1 from pg_namespace where nspname = $1", [schema]);
    expect(rows).toHaveLength(0);
  });
});
