// Experimental local API, not an Expo adapter or production auth configuration.
import { createServer } from 'node:http';
import { JwtVerifier } from 'aws-jwt-verify';

const db = typeof Bun === 'undefined'
  ? new (await import('node:sqlite')).DatabaseSync(process.env.BENCH_DB, { readOnly: true })
  : new (await import('bun:sqlite')).Database(process.env.BENCH_DB, { readonly: true });
db.exec('PRAGMA cache_size=-2048');
const statement = db.prepare('SELECT id, title, body FROM items WHERE user_id = ? ORDER BY id LIMIT ? OFFSET ?');
const verifier = JwtVerifier.create({ issuer: 'https://bench.invalid', audience: 'server-bench' });
verifier.cacheJwks(JSON.parse(process.env.BENCH_JWKS));
const health = '{"ok":true,"service":"server-bench"}';

function handle(method, path, authorization) {
  const url = new URL(path, 'http://127.0.0.1');
  if (url.pathname === '/' && method === 'GET') return [200, health];
  if (url.pathname !== '/api/bench/items') return [404, ''];
  if (method !== 'GET') return [405, ''];
  let user;
  try {
    if (!authorization?.startsWith('Bearer ')) throw new Error('missing token');
    user = verifier.verifySync(authorization.slice(7));
    if (typeof user.sub !== 'string' || !user.sub) throw new Error('missing subject');
  } catch { return [401, '{"error":"unauthorized"}']; }
  const rawLimit = url.searchParams.get('limit') ?? '20';
  const rawOffset = url.searchParams.get('offset') ?? '0';
  const limit = Number(rawLimit);
  const offset = Number(rawOffset);
  if (!/^\d+$/.test(rawLimit) || !/^\d+$/.test(rawOffset) || !Number.isSafeInteger(limit) || !Number.isSafeInteger(offset) || limit < 1 || limit > 100 || offset < 0 || offset > 480) {
    return [400, '{"error":"invalid-query"}'];
  }
  try {
    return [200, JSON.stringify({ user_id: user.sub, items: statement.all(user.sub, limit, offset) })];
  } catch (error) { console.error(error); return [500, '{"error":"internal"}']; }
}

if (typeof Bun !== 'undefined') {
  Bun.serve({
    hostname: '127.0.0.1', port: Number(process.env.PORT),
    fetch(req) {
      const [status, body] = handle(req.method, req.url, req.headers.get('authorization'));
      return new Response(body, { status, headers: { 'content-type': 'application/json' } });
    },
  });
} else {
  createServer((req, res) => {
    const [status, body] = handle(req.method, req.url, req.headers.authorization);
    res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }).end(body);
  }).listen(Number(process.env.PORT), '127.0.0.1');
}
