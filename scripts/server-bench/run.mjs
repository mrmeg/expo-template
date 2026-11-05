import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { Agent, request } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createApiFixture } from './api-fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const options = { targets: 'node,bun,rust', workload: 'tiny', duration: 10, warmup: 3, cooldown: 5, concurrency: 10, rps: 200, repeats: 3 };
for (const arg of process.argv.slice(2)) {
  if (arg === '--help') {
    console.log('bun run bench:server [--workload=tiny|api] [--targets=node,bun,rust] [--duration=10] [--warmup=3] [--cooldown=5] [--concurrency=10] [--rps=200] [--repeats=3]\nRequires node, bun and (for rust) a release build: cargo build --release --manifest-path scripts/server-bench/rust/Cargo.toml --target-dir .build/server-bench-rust');
    process.exit(0);
  }
  const match = /^--([^=]+)=(.+)$/.exec(arg);
  if (!match || !(match[1] in options)) throw new Error(`Unknown option: ${arg}`);
  const [, key, value] = match;
  options[key] = ['targets', 'workload'].includes(key) ? value : Number(value);
}
for (const [key, value] of Object.entries(options)) {
  if (!['targets', 'workload'].includes(key) && (!Number.isFinite(value) || value <= 0)) throw new Error(`Invalid ${key}`);
}
if (!['tiny', 'api'].includes(options.workload)) throw new Error('Workload must be tiny or api');
if (!Number.isInteger(options.concurrency) || !Number.isInteger(options.repeats)) throw new Error('Concurrency and repeats must be integers');
const commands = {
  node: ['node', `scripts/server-bench/${options.workload === 'api' ? 'api' : 'node'}.mjs`],
  bun: ['bun', '--no-env-file', `scripts/server-bench/${options.workload === 'api' ? 'api' : 'bun'}.mjs`],
  rust: [fileURLToPath(new URL(`../../.build/server-bench-rust/release/${options.workload === 'api' ? 'axum-api' : 'server-bench'}`, import.meta.url))],
};
const targets = options.targets.split(',');
if (targets.some(target => !commands[target])) throw new Error('Targets must be node,bun,rust');
if (!['darwin', 'linux'].includes(process.platform)) throw new Error('RSS sampling requires macOS or Linux ps');
const version = command => execFileSync(command, ['--version'], { encoding: 'utf8' }).trim();
console.log(JSON.stringify({ platform: process.platform, arch: process.arch, node: version('node'), ...(targets.includes('bun') ? { bun: version('bun') } : {}), ...(targets.includes('rust') ? { rust: version('rustc') } : {}), options }));
const emit = data => { if (process.env.SERVER_BENCH_EVENTS === '1') console.log(JSON.stringify({ event: 'progress', ...data })); };
let interrupted = false;
const markInterrupted = () => { interrupted = true; };
process.on('SIGINT', markInterrupted);
process.on('SIGTERM', markInterrupted);
const fixture = options.workload === 'api' ? await createApiFixture() : null;

async function freePort() {
  const socket = createServer();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}

function get(port, agent, spec) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path: spec?.path ?? '/', method: spec?.method ?? 'GET', headers: spec?.headers, agent }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('error', reject);
      res.on('end', () => {
        try {
          if (spec) fixture.validate(spec, res.statusCode, body);
          else if (res.statusCode !== 200 || body !== '{"ok":true,"service":"server-bench"}') throw new Error(`Unexpected response: ${res.statusCode} ${body.slice(0, 200)}`);
          resolve();
        } catch (error) { reject(error); }
      });
    });
    req.setTimeout(5000, () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    req.end();
  });
}

function rss(pid) {
  const value = Number(execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' }).trim());
  if (!(value > 0)) throw new Error('Server exited during RSS sampling');
  return value / 1024;
}

async function load(port, seconds) {
  const agent = new Agent({ keepAlive: true, maxSockets: options.concurrency });
  const times = [];
  let errors = 0;
  let firstError;
  const start = performance.now();
  const end = start + seconds * 1000;
  const interval = 1000 * options.concurrency / options.rps;
  try {
    await Promise.all(Array.from({ length: options.concurrency }, async (_, index) => {
      let due = start + index * 1000 / options.rps;
      let sequence = index;
      while (performance.now() < end && !interrupted) {
        const delay = due - performance.now();
        if (delay > 0) await sleep(delay);
        if (performance.now() >= end) break;
        const before = performance.now();
        const spec = fixture?.cases[sequence % fixture.cases.length];
        sequence += options.concurrency;
        try { await get(port, agent, spec); times.push(performance.now() - before); }
        catch (error) { errors++; firstError ??= String(error); }
        // Do not queue an unbounded backlog when the server cannot keep up.
        due = Math.max(due + interval, performance.now());
      }
    }));
  } finally { agent.destroy(); }
  if (interrupted) throw new Error('Benchmark cancelled');
  const elapsed = (performance.now() - start) / 1000;
  times.sort((a, b) => a - b);
  return { requests: times.length, errors, firstError, rps: times.length / elapsed, p95ms: times[Math.max(0, Math.ceil(times.length * .95) - 1)] ?? null };
}

const rows = [];
try {
  for (let repeat = 1; repeat <= options.repeats; repeat++) {
    // Rotate order between runs to reduce consistent first/last bias.
    const ordered = targets.map((_, index) => targets[(index + repeat - 1) % targets.length]);
    for (const target of ordered) {
      if (interrupted) throw new Error('Benchmark cancelled');
      const port = await freePort();
      const [command, ...args] = commands[target];
      const child = spawn(command, args, { cwd: root, env: { ...process.env, ...fixture?.env, PORT: String(port), NODE_ENV: 'production' }, stdio: ['ignore', 'ignore', 'pipe'] });
      emit({ target, repeat, phase: 'starting', pid: child.pid });
      let logs = '';
      let spawnError;
      child.stderr.on('data', chunk => { logs = (logs + chunk).slice(-4000); });
      child.on('error', error => { spawnError = error; });
      const interrupt = () => child.kill('SIGTERM');
      process.once('SIGINT', interrupt);
      process.once('SIGTERM', interrupt);
      let samplingError;
      let sampler;
      try {
        let ready = false;
        const deadline = performance.now() + 15000;
        while (performance.now() < deadline) {
          if (spawnError || child.exitCode !== null || child.signalCode) throw new Error(`${target} failed: ${spawnError ?? logs}`);
          try { await get(port, false); ready = true; break; } catch { await sleep(50); }
        }
        if (!ready) throw new Error(`${target} did not become ready: ${logs}`);
        await sleep(1000);
        const idleMiB = rss(child.pid);
        emit({ target, repeat, phase: 'checking', pid: child.pid, rssMiB: idleMiB });
        if (fixture) {
          for (const check of fixture.checks) await get(port, false, check);
          console.log(JSON.stringify({ target, repeat, contractChecks: fixture.checks.length }));
        }
        emit({ target, repeat, phase: 'warming', pid: child.pid, rssMiB: rss(child.pid) });
        const warmup = await load(port, options.warmup);
        if (warmup.errors) throw new Error(`Warmup failed: ${warmup.firstError}`);
        let peakMiB = rss(child.pid);
        const measuringAt = performance.now();
        let lastEventAt = 0;
        emit({ target, repeat, phase: 'measuring', pid: child.pid, rssMiB: peakMiB, elapsedSeconds: 0 });
        sampler = setInterval(() => {
          try {
            const rssMiB = rss(child.pid);
            peakMiB = Math.max(peakMiB, rssMiB);
            if (performance.now() - lastEventAt >= 1000) {
              lastEventAt = performance.now();
              emit({ target, repeat, phase: 'measuring', pid: child.pid, rssMiB, elapsedSeconds: (performance.now() - measuringAt) / 1000 });
            }
          }
          catch (error) { samplingError = error; }
        }, 200);
        const result = await load(port, options.duration);
        peakMiB = Math.max(peakMiB, rss(child.pid));
        clearInterval(sampler);
        if (samplingError) throw samplingError;
        emit({ target, repeat, phase: 'cooling', pid: child.pid, rssMiB: rss(child.pid) });
        await sleep(options.cooldown * 1000);
        const row = { target, workload: options.workload, repeat, idleMiB, peakMiB, postLoadMiB: rss(child.pid), ...result };
        rows.push(row);
        console.log(JSON.stringify(row));
        if (result.errors) throw new Error(`Load failed: ${result.firstError}`);
      } finally {
        clearInterval(sampler);
        process.off('SIGINT', interrupt);
        process.off('SIGTERM', interrupt);
        if (child.exitCode === null && child.signalCode === null && !spawnError) {
          const stopped = new Promise(resolve => child.once('exit', resolve));
          child.kill('SIGTERM');
          const force = setTimeout(() => child.kill('SIGKILL'), 2000);
          await stopped;
          clearTimeout(force);
        }
      }
    }
  }
  console.table(rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'firstError').map(([key, value]) => [key, typeof value === 'number' ? Math.round(value * 100) / 100 : value]))));
} finally {
  process.off('SIGINT', markInterrupted);
  process.off('SIGTERM', markInterrupted);
  await fixture?.cleanup();
}
