// Minimal HTTP server, zero dependencies.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { config } from './config.js';
import { adapters } from './adapters/index.js';
import { createGrants } from './grants.js';
import { runAgent } from './agent.js';
import { makeToolbox } from './tools.js';

const grants = createGrants(adapters);
let proposals = [];
let applied = []; // local, approved changes only. Nothing is written externally.

const body = (req) => new Promise((ok) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => ok(d ? JSON.parse(d) : {})); });
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://x');
    if (req.method === 'GET' && pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(readFileSync('public/index.html')); }
    if (pathname === '/api/sources' && req.method === 'GET') return send(res, 200, { sources: grants.list(), model: config.model, keyConfigured: !!config.apiKey });
    if (pathname === '/api/grants' && req.method === 'POST') { const { id, granted } = await body(req); grants.set(id, granted); return send(res, 200, grants.list()); }
    if (pathname === '/api/proposals' && req.method === 'GET') return send(res, 200, { proposals, applied });
    if (pathname === '/api/run' && req.method === 'POST') {
      proposals = []; const trace = [];
      const r = await runAgent(grants, proposals, { log: (l) => trace.push(l) });
      return send(res, 200, { summary: r.summary, trace, proposals });
    }
    if (pathname === '/api/demo-proposal' && req.method === 'POST') {
      // Exercises the validator without a model call (used before a key exists).
      const out = makeToolbox(grants, proposals).propose_change(await body(req));
      return send(res, 200, out);
    }
    const m = pathname.match(/^\/api\/proposals\/(\w+)\/(approve|reject)$/);
    if (m && req.method === 'POST') {
      const p = proposals.find((x) => x.id === m[1]);
      if (!p) return send(res, 404, { error: 'not found' });
      if (m[2] === 'approve' && p.status !== 'pending') return send(res, 400, { error: 'only valid pending proposals can be approved' });
      p.status = m[2] === 'approve' ? 'approved' : 'rejected';
      if (p.status === 'approved') applied.push({ id: p.id, type: p.type, payload: p.payload });
      return send(res, 200, p);
    }
    send(res, 404, { error: 'not found' });
  } catch (e) { send(res, 500, { error: e.message }); }
}).listen(config.port, () => console.log(`Vespera Day Agent on http://localhost:${config.port} (model ${config.model}, key ${config.apiKey ? 'configured' : 'missing'})`));
