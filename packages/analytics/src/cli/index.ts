#!/usr/bin/env node
/**
 * `expo-analytics <install|uninstall|status>`: manage the tables from a shell
 * or a deploy step, with the same placement options as the server.
 *
 * The package ships no driver. The CLI loads whichever one the host project
 * has installed (`postgres`, then `pg`), resolved from the working directory
 * rather than from this package, so it uses the project's own copy.
 */
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join, sep } from "node:path";

import { install, status, uninstall } from "../server/install";
import type { PlacementOptions } from "../server/schema";
import { fromPg, fromPostgresJs, type SqlClient } from "../server/sql";

export interface CliIo {
  stdout(line: string): void;
  stderr(line: string): void;
  /** Directory to resolve the driver from. Default `process.cwd()`. */
  cwd?: string;
  /** Overrides driver loading (tests). */
  connect?(url: string): Promise<Connection>;
}

export interface Connection {
  sql: SqlClient;
  driver: "postgres" | "pg";
  close(): Promise<void>;
}

const USAGE = `Usage: expo-analytics <install|uninstall|status> [options]

Options:
  --database-url <url>  Postgres URL (default: $DATABASE_URL)
  --schema <name>       Dedicated schema (default: the connection's search_path)
  --prefix <prefix>     Table name prefix (default: analytics_)
  --cascade             uninstall: also drop objects that depend on the tables
  --yes                 uninstall: actually drop (without it, prints what would be dropped)
  -h, --help            Show this help`;

const COMMANDS = ["install", "uninstall", "status"] as const;
type Command = (typeof COMMANDS)[number];

interface ParsedArgs {
  command: Command;
  databaseUrl?: string;
  schema?: string;
  prefix?: string;
  cascade: boolean;
  yes: boolean;
}

class UsageError extends Error {}

function parseArgs(argv: readonly string[]): ParsedArgs | "help" {
  const parsed: Partial<ParsedArgs> & { cascade: boolean; yes: boolean } = { cascade: false, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, inline] = arg.startsWith("--") && arg.includes("=") ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg, undefined];
    const value = () => {
      const next = inline ?? argv[++i];
      if (next === undefined || next.startsWith("--")) throw new UsageError(`${flag} needs a value`);
      return next;
    };
    switch (flag) {
      case "-h":
      case "--help":
        return "help";
      case "--database-url":
        parsed.databaseUrl = value();
        break;
      case "--schema":
        parsed.schema = value();
        break;
      case "--prefix":
        parsed.prefix = value();
        break;
      case "--cascade":
        parsed.cascade = true;
        break;
      case "--yes":
      case "-y":
        parsed.yes = true;
        break;
      default:
        if (flag.startsWith("-")) throw new UsageError(`unknown option ${flag}`);
        if (parsed.command) throw new UsageError(`unexpected argument ${flag}`);
        if (!(COMMANDS as readonly string[]).includes(flag)) throw new UsageError(`unknown command ${flag}`);
        parsed.command = flag as Command;
    }
  }
  if (!parsed.command) throw new UsageError("missing command");
  return parsed as ParsedArgs;
}

/** Loads `postgres`, then `pg`, from `cwd`'s node_modules. Null when neither is installed. */
export async function connectFromProject(url: string, cwd: string): Promise<Connection | null> {
  const require = createRequire(join(cwd, "package.json"));
  const load = (name: string): any => {
    try {
      return require(name);
    } catch (error) {
      if ((error as { code?: string }).code === "MODULE_NOT_FOUND") return null;
      throw error;
    }
  };

  const postgresModule = load("postgres");
  if (postgresModule) {
    const postgres = postgresModule.default ?? postgresModule;
    const client = postgres(url, { max: 1, onnotice: () => {} });
    return { sql: fromPostgresJs(client), driver: "postgres", close: () => client.end() };
  }
  const pgModule = load("pg");
  if (pgModule) {
    const Pool = pgModule.Pool ?? pgModule.default?.Pool;
    const pool = new Pool({ connectionString: url, max: 1 });
    return { sql: fromPg(pool), driver: "pg", close: () => pool.end() };
  }
  return null;
}

function redact(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return "<invalid url>";
  }
}

/** Runs the CLI and returns the exit code: 0 ok, 1 failed or refused, 2 usage. */
export async function runCli(
  argv: readonly string[],
  env: Record<string, string | undefined>,
  io: CliIo,
): Promise<number> {
  let args: ParsedArgs | "help";
  try {
    args = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    io.stderr(`expo-analytics: ${error.message}`);
    io.stderr(USAGE);
    return 2;
  }
  if (args === "help") {
    io.stdout(USAGE);
    return 0;
  }

  const url = args.databaseUrl ?? env.DATABASE_URL;
  if (!url) {
    io.stderr("expo-analytics: no database URL. Set DATABASE_URL or pass --database-url.");
    return 2;
  }
  const placement: PlacementOptions = { schema: args.schema, prefix: args.prefix };

  let connection: Connection | null;
  try {
    connection = io.connect ? await io.connect(url) : await connectFromProject(url, io.cwd ?? process.cwd());
  } catch (error) {
    io.stderr(`expo-analytics: could not load the database driver: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  if (!connection) {
    io.stderr(
      "expo-analytics: no Postgres driver found. Install one in this project (`npm install postgres` or `npm install pg`) and run again from its directory.",
    );
    return 1;
  }

  const where = `${redact(url)}${args.schema ? ` schema ${args.schema}` : ""}`;
  try {
    if (args.command === "install") {
      const result = await install(connection.sql, placement);
      io.stdout(
        result.applied.length > 0
          ? `Installed migrations ${result.applied.join(", ")} (now at version ${result.version}) on ${where}.`
          : `Already up to date at version ${result.version} on ${where}.`,
      );
      if (result.createdSchema) io.stdout(`Created schema ${args.schema}.`);
      return 0;
    }

    if (args.command === "status") {
      const state = await status(connection.sql, placement);
      io.stdout(`Database: ${where}`);
      io.stdout(`Installed: ${state.installed ? "yes" : "no"}`);
      io.stdout(`Version: ${state.version} (latest ${state.latest})`);
      io.stdout(`Pending: ${state.pending.length > 0 ? state.pending.join(", ") : "none"}`);
      io.stdout(`Tables: ${state.tables.length > 0 ? state.tables.join(", ") : "none"}`);
      return 0;
    }

    if (!args.yes) {
      const state = await status(connection.sql, placement);
      if (state.tables.length === 0) {
        io.stdout(`Nothing to drop on ${where}.`);
        return 0;
      }
      io.stdout(`Would drop from ${where}${args.cascade ? " (cascade)" : ""}:`);
      for (const table of [...state.tables].reverse()) io.stdout(`  ${table}`);
      if (args.schema) io.stdout(`  schema ${args.schema}, if install created it and it is then empty`);
      io.stderr("Refusing without --yes. Rerun with --yes to drop them; their data cannot be recovered.");
      return 1;
    }

    const result = await uninstall(connection.sql, placement, { cascade: args.cascade });
    io.stdout(result.dropped.length > 0 ? `Dropped ${result.dropped.join(", ")}.` : `Nothing to drop on ${where}.`);
    if (result.droppedSchema) io.stdout(`Dropped schema ${args.schema}.`);
    return 0;
  } catch (error) {
    io.stderr(`expo-analytics: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await connection.close().catch(() => {});
  }
}

/**
 * True when this file is the process entry (the `expo-analytics` bin or
 * `node dist/cli/index.js`). Checked by path instead of `import.meta`, which
 * the test transform does not support; `realpath` follows the `.bin` symlink.
 */
function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    const real = realpathSync(entry);
    return real.endsWith(`${sep}cli${sep}index.js`) || real.endsWith(`${sep}cli${sep}index.ts`);
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  runCli(process.argv.slice(2), process.env, {
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
  }).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`expo-analytics: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
      process.exitCode = 1;
    },
  );
}
