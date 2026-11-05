const body = '{"ok":true,"service":"server-bench"}';
Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.PORT),
  fetch(req) {
    if (req.method !== 'GET' || new URL(req.url).pathname !== '/') {
      return new Response(null, { status: 404 });
    }
    return new Response(body, {
      headers: { 'content-type': 'application/json', 'content-length': String(body.length) },
    });
  },
});
