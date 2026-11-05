import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deepStrictEqual } from 'node:assert';

export async function createApiFixture() {
  const { DatabaseSync } = await import('node:sqlite');
  const directory = await mkdtemp(join(tmpdir(), 'server-bench-'));
  const cleanup = () => rm(directory, { recursive: true, force: true });
  try {
    const path = join(directory, 'items.sqlite');
    const db = new DatabaseSync(path);
    const all = [];
    try {
      db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL); CREATE INDEX items_user_id ON items(user_id, id); BEGIN');
      const insert = db.prepare('INSERT INTO items VALUES (?, ?, ?, ?)');
      for (let user = 0; user < 10; user++) {
        const rows = [];
        for (let index = 0; index < 500; index++) {
          const id = user * 500 + index + 1;
          const item = { id, title: `Item ${id}`, body: `Content ${id}: ${'local fixture data '.repeat(12)}` };
          insert.run(item.id, `user-${user}`, item.title, item.body);
          rows.push(item);
        }
        all.push(rows);
      }
      db.exec('COMMIT');
    } finally { db.close(); }
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'bench-key', alg: 'RS256', use: 'sig' };
    const now = Math.floor(Date.now() / 1000);
    const jwt = (claims = {}, header = {}) => {
      const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
      const input = `${encode({ alg: 'RS256', kid: 'bench-key', typ: 'JWT', ...header })}.${encode({ iss: 'https://bench.invalid', aud: 'server-bench', sub: 'user-0', exp: now + 3600, ...claims })}`;
      return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
    };
    const tokens = all.map((_, user) => jwt({ sub: `user-${user}` }));
    const cases = Array.from({ length: 50 }, (_, index) => {
      const user = index % 10;
      const offset = Math.floor(index / 10) * 100;
      return {
        path: `/api/bench/items?limit=20&offset=${offset}`,
        headers: { authorization: `Bearer ${tokens[user]}` }, status: 200,
        expected: { user_id: `user-${user}`, items: all[user].slice(offset, offset + 20) },
      };
    });
    const badAuth = token => ({ path: '/api/bench/items', headers: token ? { authorization: `Bearer ${token}` } : {}, status: 401, expected: { error: 'unauthorized' } });
    const tampered = tokens[0].split('.');
    tampered[2] = (tampered[2][0] === 'a' ? 'b' : 'a') + tampered[2].slice(1);
    const checks = [
      ...cases,
      badAuth(null), badAuth('broken'), badAuth(tampered.join('.')),
      badAuth(jwt({ exp: now - 300 })), badAuth(jwt({ iss: 'https://wrong.invalid' })),
      badAuth(jwt({ aud: 'wrong' })), badAuth(jwt({ sub: '' })),
      badAuth(jwt({ nbf: now + 3600 })), badAuth(jwt({}, { alg: 'HS256' })),
      badAuth(jwt({}, { kid: 'unknown' })),
      ...['limit=0', 'limit=101', 'offset=-1', 'offset=481', 'limit=abc'].map(query => ({ ...cases[0], path: `/api/bench/items?${query}`, status: 400, expected: { error: 'invalid-query' } })),
      { ...cases[0], method: 'POST', status: 405, expected: undefined },
      { ...cases[0], path: '/missing', status: 404, expected: undefined },
    ];
    return {
      env: { BENCH_DB: path, BENCH_PUBLIC_KEY: publicKey.export({ type: 'spki', format: 'pem' }), BENCH_JWKS: JSON.stringify({ keys: [jwk] }) },
      cases, checks, cleanup,
      validate(spec, status, body) {
        deepStrictEqual(status, spec.status);
        if (spec.expected !== undefined) deepStrictEqual(JSON.parse(body), spec.expected);
      },
    };
  } catch (error) { await cleanup(); throw error; }
}
