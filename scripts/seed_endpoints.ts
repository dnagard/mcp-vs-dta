// Simple mock HTTP server for benches (run with: pnpm tsx scripts/seed_endpoints.ts)
import http from "node:http";

const port = process.env.PORT ? Number(process.env.PORT) : 8080;

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  if (url.pathname === "/ping") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, t: Date.now() }));
    return;
  }
  if (url.pathname === "/blob") {
    const size = Number(url.searchParams.get("size") || 1024);
    const buf = Buffer.alloc(size, 65); // 'A's
    res.writeHead(200, { "content-type": "application/octet-stream" });
    res.end(buf);
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(port, () =>
  console.log(`mock upstream listening on http://localhost:${port}`),
);
