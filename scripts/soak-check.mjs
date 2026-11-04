#!/usr/bin/env node
/**
 * Memory soak check: `bun run build && bun run soak`.
 *
 * Starts the built production server (`dist/`, the same entry as `bun run
 * start`) on a free port with a blank environment, sends sequential HTML
 * requests, samples the server's RSS, and fails when memory keeps climbing
 * after warm-up. Peak memory cannot show a per-render leak; only the slope of
 * RSS against request count over a sustained run can.
 *
 * It does not build. It never loads a `.env` file (`--no-env-file`) and the
 * child gets only PATH, HOME, NODE_ENV=production and PORT, so no secret can
 * reach the server. A blank env is a supported state of this template.
 *
 * Usage:
 *   node scripts/soak-check.mjs [--routes=/,/settings] [--warmup=500]
 *     [--requests=3000] [--sample-every=100] [--max-slope=20]
 *
 *   --max-slope is MB of RSS growth per 1,000 requests.
 *
 * Exit codes: 0 pass, 1 slope over the limit, 2 setup or request failure.
 */
import { spawn, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Real routes that answer 200 with server-rendered HTML on a blank env. */
export const DEFAULT_ROUTES = ["/", "/settings", "/screen-pricing", "/screen-list"];

export const DEFAULTS = {
  routes: DEFAULT_ROUTES,
  warmup: 500,
  requests: 3000,
  sampleEvery: 100,
  maxSlope: 20,
};

const READY_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Least-squares slope of y against x, in y units per x unit.
 * @param {Array<[number, number]>} points `[x, y]` pairs
 * @returns {number}
 */
export function leastSquaresSlope(points) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new Error("leastSquaresSlope needs at least two points");
  }
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  for (const [x, y] of points) {
    sumX += x;
    sumY += y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let covariance = 0;
  let varianceX = 0;
  for (const [x, y] of points) {
    covariance += (x - meanX) * (y - meanY);
    varianceX += (x - meanX) ** 2;
  }
  if (varianceX === 0) {
    throw new Error("leastSquaresSlope needs at least two distinct x values");
  }
  return covariance / varianceX;
}

/** Nearest-rank percentile (0-100) of a list of numbers. */
export function percentile(values, p) {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

/**
 * The child process: `bun run start`'s command (`bun ./server.bun.ts`) with
 * `--no-env-file` so Bun never reads `.env`, `.env.local` or
 * `.env.production`, and an environment holding nothing else.
 */
export function buildServerSpec({ port, env = process.env, bun = "bun" }) {
  const childEnv = { NODE_ENV: "production", PORT: String(port) };
  if (env.PATH !== undefined) childEnv.PATH = env.PATH;
  if (env.HOME !== undefined) childEnv.HOME = env.HOME;
  return { command: bun, args: ["--no-env-file", "./server.bun.ts"], env: childEnv };
}

export function parseArgs(argv) {
  const options = { ...DEFAULTS, routes: [...DEFAULTS.routes] };
  const int = (name, value, min) => {
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < min) {
      throw new Error(`--${name} must be an integer >= ${min} (got "${value}")`);
    }
    return n;
  };
  for (const arg of argv) {
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (!match) throw new Error(`Unknown argument "${arg}". Use --name=value.`);
    const [, name, value] = match;
    if (name === "routes") {
      const routes = value.split(",").map((r) => r.trim()).filter(Boolean);
      if (routes.length === 0 || routes.some((r) => !r.startsWith("/"))) {
        throw new Error('--routes must be a comma-separated list of paths starting with "/"');
      }
      options.routes = routes;
    } else if (name === "warmup") options.warmup = int(name, value, 0);
    else if (name === "requests") options.requests = int(name, value, 2);
    else if (name === "sample-every") options.sampleEvery = int(name, value, 1);
    else if (name === "max-slope") {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new Error(`--max-slope must be a number (got "${value}")`);
      options.maxSlope = n;
    } else throw new Error(`Unknown option --${name}`);
  }
  return options;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function readRssMb(pid) {
  const out = execFileSync("ps", ["-o", "rss=", "-p", String(pid)], { encoding: "utf8" }).trim();
  const kb = Number(out);
  if (!Number.isFinite(kb) || kb <= 0) throw new Error(`Could not read RSS for pid ${pid}: "${out}"`);
  return kb / 1024;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchHtml(base, route) {
  const response = await fetch(base + route, {
    headers: { accept: "text/html" },
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  await response.arrayBuffer();
  if (response.status !== 200) {
    throw new Error(`GET ${route} returned ${response.status}, expected 200; refusing to measure an error page`);
  }
  return response;
}

async function run(options) {
  const distDir = path.join(ROOT, "dist");
  if (!existsSync(path.join(distDir, "server")) || !existsSync(path.join(distDir, "client"))) {
    console.error("soak: dist/ is missing or incomplete. Run `bun run build` first; this check does not build.");
    return 2;
  }

  const port = await freePort();
  const spec = buildServerSpec({ port });
  const base = `http://127.0.0.1:${port}`;

  const child = spawn(spec.command, spec.args, {
    cwd: ROOT,
    env: spec.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let exited = null;
  const tail = [];
  const keepTail = (chunk) => {
    for (const line of chunk.toString().split("\n")) if (line.trim()) tail.push(line);
    if (tail.length > 20) tail.splice(0, tail.length - 20);
  };
  child.stdout.on("data", keepTail);
  child.stderr.on("data", keepTail);
  child.on("error", (error) => {
    exited = { error };
  });
  child.on("exit", (code, signal) => {
    exited = { code, signal };
  });

  const kill = () => {
    if (child.pid && exited === null) {
      try {
        child.kill("SIGKILL");
      } catch {
        // already gone
      }
    }
  };
  const onSignal = (signal) => {
    kill();
    process.exit(signal === "SIGINT" ? 130 : 143);
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  process.once("exit", kill);

  const assertAlive = () => {
    if (exited !== null) {
      const why = exited.error ? exited.error.message : `code ${exited.code} signal ${exited.signal}`;
      throw new Error(`server exited (${why}). Last output:\n${tail.join("\n")}`);
    }
  };

  try {
    console.log(`soak: starting \`${spec.command} ${spec.args.join(" ")}\` on port ${port} (blank env, no .env files)`);
    const deadline = Date.now() + READY_TIMEOUT_MS;
    for (;;) {
      assertAlive();
      try {
        await fetch(base + options.routes[0], { headers: { accept: "text/html" }, signal: AbortSignal.timeout(5000) }).then((r) => r.arrayBuffer());
        break;
      } catch {
        if (Date.now() > deadline) throw new Error(`server did not respond within ${READY_TIMEOUT_MS / 1000}s`);
        await sleep(200);
      }
    }

    for (const route of options.routes) await fetchHtml(base, route);
    console.log(`soak: routes ok (200): ${options.routes.join(", ")}`);

    let sent = 0;
    const next = async () => {
      assertAlive();
      const route = options.routes[sent % options.routes.length];
      sent += 1;
      await fetchHtml(base, route);
    };

    console.log(`soak: warm-up ${options.warmup} requests`);
    for (let i = 0; i < options.warmup; i += 1) await next();

    console.log(`soak: measuring ${options.requests} requests, sampling RSS every ${options.sampleEvery}`);
    const samples = [[0, readRssMb(child.pid)]];
    const latencies = [];
    for (let i = 1; i <= options.requests; i += 1) {
      const startedAt = performance.now();
      await next();
      latencies.push(performance.now() - startedAt);
      if (i % options.sampleEvery === 0 || i === options.requests) {
        samples.push([i, readRssMb(child.pid)]);
      }
    }

    const slopePerRequest = leastSquaresSlope(samples);
    const slopePer1000 = slopePerRequest * 1000;
    const rss = samples.map(([, mb]) => mb);
    const f = (n) => n.toFixed(1);
    console.log("");
    console.log("Memory soak check");
    console.log(`  requests   ${options.requests} measured (+${options.warmup} warm-up), ${options.routes.length} route(s)`);
    console.log(`  RSS        start ${f(rss[0])} MB, end ${f(rss[rss.length - 1])} MB, peak ${f(Math.max(...rss))} MB`);
    console.log(`  slope      ${slopePer1000.toFixed(2)} MB per 1,000 requests (limit ${options.maxSlope})`);
    console.log(`  latency    p50 ${f(percentile(latencies, 50))} ms, p95 ${f(percentile(latencies, 95))} ms`);

    if (slopePer1000 > options.maxSlope) {
      console.error(`\nFAIL: RSS grew ${slopePer1000.toFixed(2)} MB per 1,000 requests, over the ${options.maxSlope} limit.`);
      return 1;
    }
    console.log("\nPASS");
    return 0;
  } finally {
    kill();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`soak: ${error.message}`);
    process.exit(2);
  }
  run(options).then(
    (code) => process.exit(code),
    (error) => {
      console.error(`soak: ${error.message}`);
      process.exit(2);
    },
  );
}
