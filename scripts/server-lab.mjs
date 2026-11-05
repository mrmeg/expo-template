// Local-only gateway and process supervisor. No diagnostic handlers are added
// to the production Bun entry or Expo API route bundles.
import { spawn, execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { createServer as createSocket } from 'node:net';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.SERVER_LAB_PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid SERVER_LAB_PORT');
if (!['darwin', 'linux'].includes(process.platform)) throw new Error('Server Lab requires macOS or Linux (ps RSS sampling)');
const processes = new Map();
const logs = [];
const samples = [];
let nextLog = 1;
let stopping = false;
let benchmark = null;
let run = { status: 'idle', workload: null, profile: null, stage: null, rows: [] };

function log(source, message) {
  const entry = { id: nextLog++, at: new Date().toISOString(), source, message: String(message).slice(0, 2000) };
  logs.push(entry);
  if (logs.length > 400) logs.shift();
  console.log(`[${source}] ${entry.message}`);
}

function start(name, command, args, env = {}, onLine) {
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  processes.set(name, { name, pid: child.pid, rssMiB: null, peakMiB: null, status: 'running', child });
  for (const stream of [child.stdout, child.stderr]) {
    const lines = createInterface({ input: stream });
    lines.on('line', line => { log(name, line); onLine?.(line); });
  }
  child.on('error', error => {
    log(name, error.message);
    const info = processes.get(name);
    if (info?.child === child) info.status = 'stopped';
    if (['bun-ssr', 'rust-api'].includes(name)) void shutdown(1);
  });
  child.on('exit', (code, signal) => {
    const info = processes.get(name);
    if (info?.child === child) Object.assign(info, { status: 'stopped', rssMiB: null });
    log(name, `Exited (${signal ?? code})`);
    if (!stopping && ['bun-ssr', 'rust-api'].includes(name)) {
      log('lab', `${name} stopped; shutting down the lab.`);
      void shutdown(1);
    }
  });
  return child;
}

async function freePort() {
  const socket = createSocket();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const value = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return value;
}

async function sample() {
  const active = [...processes.values()].filter(info => info.status === 'running' && info.pid);
  const pids = [process.pid, ...active.map(info => info.pid)];
  try {
    const { stdout } = await exec('ps', ['-o', 'pid=,rss=', '-p', pids.join(',')], { timeout: 2000 });
    const memory = new Map(stdout.trim().split('\n').map(line => {
      const [pid, rss] = line.trim().split(/\s+/).map(Number);
      return [pid, rss / 1024];
    }));
    for (const info of active) {
      info.rssMiB = memory.get(info.pid) ?? null;
      if (info.rssMiB !== null) info.peakMiB = Math.max(info.peakMiB ?? 0, info.rssMiB);
    }
    const bunMiB = memory.get(processes.get('bun-ssr')?.pid) ?? null;
    const rustMiB = memory.get(processes.get('rust-api')?.pid) ?? null;
    samples.push({ at: Date.now(), bunMiB, rustMiB, supervisorMiB: memory.get(process.pid) ?? null });
    if (samples.length > 60) samples.shift();
  } catch (error) { log('lab', `RSS sampling failed: ${error.message}`); }
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' });
  response.end(JSON.stringify(body));
}

// A loopback bind alone does not prevent hostile pages or DNS rebinding.
// Require an allowlisted Host and same-origin browser requests; never use CORS.
export function allowedRequest(request, expectedPort, mutation = false) {
  const hosts = new Set([`localhost:${expectedPort}`, `127.0.0.1:${expectedPort}`]);
  const host = request.headers.host;
  if (!hosts.has(host)) return false;
  if (request.headers['sec-fetch-site'] === 'cross-site') return false;
  const origin = request.headers.origin;
  if (origin && origin !== `http://${host}`) return false;
  if (mutation && (origin !== `http://${host}` || request.headers['content-type'] !== 'application/json')) return false;
  return true;
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1024) throw new Error('Request too large');
  }
  return JSON.parse(body);
}

function startBenchmark(workload, profile) {
  if (benchmark) return false;
  run = { status: 'running', workload, profile, stage: null, rows: [], startedAt: new Date().toISOString() };
  benchmark = start('benchmark', 'node', ['scripts/server-bench/run.mjs', `--workload=${workload}`, '--duration=10', '--warmup=2', '--cooldown=3', '--repeats=1', `--rps=${profile === 'burst' ? 2000 : 200}`, `--concurrency=${profile === 'burst' ? 50 : 10}`], { SERVER_BENCH_EVENTS: '1' }, line => {
    try {
      const event = JSON.parse(line);
      if (event.event === 'progress') run.stage = event;
      if (event.target && 'peakMiB' in event && 'requests' in event) run.rows.push(event);
    } catch { /* The runner also prints a human-readable table. */ }
  });
  benchmark.once('close', code => {
    run.status = run.status === 'stopping' ? 'cancelled' : code === 0 ? 'complete' : 'failed';
    run.finishedAt = new Date().toISOString();
    benchmark = null;
  });
  return true;
}

function proxy(request, response, upstreamPort) {
  const upstream = httpRequest({ hostname: '127.0.0.1', port: upstreamPort, path: request.url, method: request.method,
    headers: { ...request.headers, connection: 'close' }, timeout: 30000 }, incoming => {
    response.writeHead(incoming.statusCode, incoming.headers);
    incoming.on('error', () => response.destroy());
    incoming.pipe(response);
  });
  upstream.on('timeout', () => upstream.destroy(new Error('Upstream timed out')));
  upstream.on('error', error => {
    log('lab', `Upstream request failed: ${error.message}`);
    if (!response.headersSent) json(response, 502, { error: 'upstream-unavailable' });
    else response.destroy();
  });
  response.on('close', () => upstream.destroy());
  request.on('error', () => upstream.destroy());
  request.pipe(upstream);
}

let gateway;
let sampler;
async function stopChild(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  const closed = new Promise(resolve => child.once('close', resolve));
  child.kill('SIGTERM');
  const force = setTimeout(() => child.kill('SIGKILL'), 10000);
  await closed;
  clearTimeout(force);
}

async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  clearTimeout(sampler);
  gateway?.close();
  gateway?.closeAllConnections();
  // Stop the runner first so its children and temporary fixtures are cleaned up.
  await stopChild(benchmark);
  await Promise.all([...processes.values()].filter(info => info.name !== 'benchmark').map(info => stopChild(info.child)));
  process.exitCode = code;
}

async function main() {
  await access(new URL('../dist/server/_expo/routes.json', import.meta.url));
  log('lab', 'Building the Rust API and benchmark binaries…');
  for (const [manifest, target] of [['server/rust/Cargo.toml', '.build/server-rust'], ['scripts/server-bench/rust/Cargo.toml', '.build/server-bench-rust']]) {
    const child = start('build', 'cargo', ['build', '--locked', '--release', '--manifest-path', manifest, '--target-dir', target]);
    const code = await new Promise(resolve => { child.once('error', () => resolve(1)); child.once('close', resolve); });
    if (code !== 0 || stopping) throw new Error('Rust build did not complete');
  }
  const bunPort = await freePort();
  const rustPort = await freePort();
  start('bun-ssr', 'bun', ['--no-env-file', './server.bun.ts'], { PORT: String(bunPort), HOST: '127.0.0.1' });
  start('rust-api', `${root}.build/server-rust/release/template-server`, [], { RUST_PORT: String(rustPort), RUST_HOST: '127.0.0.1' });
  for (const [targetPort, path] of [[bunPort, '/'], [rustPort, '/api/rust/health']]) {
    let ready = false;
    for (let attempt = 0; attempt < 300 && !stopping; attempt++) {
      try {
        const response = await fetch(`http://127.0.0.1:${targetPort}${path}`, { signal: AbortSignal.timeout(1000) });
        await response.body?.cancel();
        if (response.ok) { ready = true; break; }
      } catch { /* Wait for startup. */ }
      await sleep(100);
    }
    if (!ready) throw new Error('Service failed readiness');
  }
  gateway = createServer(async (request, response) => {
    if (!allowedRequest(request, port)) return json(response, 403, { error: 'local-origin-required' });
    const pathname = new URL(request.url, `http://localhost:${port}`).pathname;
    if (pathname.startsWith('/_server-lab/')) {
      if (request.method === 'GET' && pathname === '/_server-lab/state') {
        return json(response, 200, {
          version: 1, at: Date.now(), platform: process.platform, arch: process.arch,
          processes: [...processes.values()].filter(info => info.name !== 'build').map(({ child, ...info }) => info),
          samples, logs, run,
        });
      }
      if (request.method !== 'POST') return json(response, 405, { error: 'method-not-allowed' });
      if (!allowedRequest(request, port, true)) return json(response, 403, { error: 'local-origin-required' });
      try {
        if (pathname === '/_server-lab/run') {
          const body = await readJson(request);
          if (!['tiny', 'api'].includes(body.workload) || !['steady', 'burst'].includes(body.profile)) return json(response, 400, { error: 'invalid-options' });
          if (!startBenchmark(body.workload, body.profile)) return json(response, 409, { error: 'benchmark-already-running' });
          return json(response, 202, { ok: true });
        }
        if (pathname === '/_server-lab/stop') {
          if (benchmark) { run.status = 'stopping'; benchmark.kill('SIGTERM'); }
          return json(response, 202, { ok: true });
        }
      } catch { return json(response, 400, { error: 'invalid-request' }); }
      return json(response, 404, { error: 'not-found' });
    }
    proxy(request, response, pathname === '/api/rust' || pathname.startsWith('/api/rust/') ? rustPort : bunPort);
  });
  await new Promise((resolve, reject) => { gateway.once('error', reject); gateway.listen(port, '127.0.0.1', resolve); });
  const tick = async () => { await sample(); if (!stopping) sampler = setTimeout(tick, 1000); };
  await tick();
  log('lab', `Open http://localhost:${port}/server-lab — Ctrl+C stops all services`);
}

// Keep the origin policy importable for focused node:test coverage.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
  main().catch(async error => { log('lab', `${error.message}. Run bun run build before bun run server:lab.`); await shutdown(1); });
}
