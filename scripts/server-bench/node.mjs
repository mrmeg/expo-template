import { createServer } from 'node:http';

const body = '{"ok":true,"service":"server-bench"}';
createServer((req, res) => {
  if (req.method !== 'GET' || req.url !== '/') {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
  }).end(body);
}).listen(Number(process.env.PORT), '127.0.0.1');
