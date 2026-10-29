// Minimal HTTP server, zero dependencies. Routes live in src/app.js.
import { createServer } from 'node:http';
import { config } from './config.js';
import { handle } from './app.js';
import { isOffline } from './agent.js';
import { liveEvents } from './adapters/github-live.js';

createServer(async (req, res) => {
  const out = await handle({
    method: req.method, url: req.url, ip: req.socket.remoteAddress,
    headers: { get: (k) => { const v = req.headers[k.toLowerCase()]; return Array.isArray(v) ? v.join(', ') : v ?? null; } },
    raw: () => new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); }),
  });
  res.writeHead(out.code, { 'Content-Type': out.type }); res.end(out.body);
}).listen(config.port, () => { console.log(`Vespera Day Agent on http://localhost:${config.port} (model ${config.model}, ${isOffline() ? 'OFFLINE mode' : 'live'}; GitHub live: ${process.env.GITHUB_LIVE_REPO || 'off'})`); liveEvents(); });
