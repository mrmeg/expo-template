import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedRequest } from './server-lab.mjs';

test('lab rejects DNS rebinding, cross-site reads, and forged mutation origins', () => {
  const request = headers => ({ headers: { host: 'localhost:3000', ...headers } });
  assert.equal(allowedRequest(request({}), 3000), true);
  assert.equal(allowedRequest(request({ host: '127.0.0.1:3000' }), 3000), true);
  for (const headers of [
    { host: 'attacker.example:3000' }, { host: 'localhost.attacker.example:3000' },
    { host: 'localhost:3001' }, { host: undefined },
    { origin: 'https://attacker.example' }, { origin: 'null' },
    { origin: 'http://127.0.0.1:3000' }, { 'sec-fetch-site': 'cross-site' },
  ]) assert.equal(allowedRequest(request(headers), 3000), false, JSON.stringify(headers));
  const mutation = { origin: 'http://localhost:3000', 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' };
  assert.equal(allowedRequest(request(mutation), 3000, true), true);
  assert.equal(allowedRequest(request({ ...mutation, origin: undefined }), 3000, true), false);
  assert.equal(allowedRequest(request({ ...mutation, 'content-type': 'text/plain' }), 3000, true), false);
});
