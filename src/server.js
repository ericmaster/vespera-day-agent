// Minimal HTTP server, zero dependencies.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { config } from './config.js';
import { adapters } from './adapters/index.js';
import { createGrants } from './grants.js';
import { runAgent, isOffline } from './agent.js';
import { makeToolbox } from './tools.js';
import { createState, approve, revalidate } from './state.js';
import { computeDay, dayEvents } from './metrics.js';
import { liveEvents, liveStatus } from './adapters/github-live.js';
import { transcribeWav, addNote } from './transcribe.js';

const grants = createGrants(adapters);
let state = createState();
let proposals = [];
const tb = () => makeToolbox(grants, proposals, state);

const raw = (req) => new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); });
const body = async (req) => { const b = await raw(req); return b.length ? JSON.parse(b) : {}; };
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://x');
    const M = req.method;
    if (M === 'GET' && pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(readFileSync('public/index.html')); }
    if (M === 'GET' && pathname === '/api/sources') return send(res, 200, { sources: grants.list(), model: config.model, keyConfigured: !!config.apiKey, offline: isOffline(), github: liveStatus() });
    if (M === 'POST' && pathname === '/api/github/refresh') { liveEvents(undefined, { refresh: true }); revalidate(proposals, tb().ctx()); return send(res, 200, liveStatus()); }
    if (M === 'POST' && pathname === '/api/grants') { const { id, granted } = await body(req); grants.set(id, granted); state.log.push({ at: new Date().toISOString(), tool: 'user:grant', source_id: id, allowed: true, note: granted ? 'granted by user' : 'revoked by user' }); revalidate(proposals, tb().ctx()); return send(res, 200, grants.list()); }
    if (M === 'GET' && pathname === '/api/state') return send(res, 200, { proposals, events: state.events, tasks: state.tasks, notes: state.notes, applied: state.applied, log: state.log, alerts: state.alerts, drafts: state.drafts, now: state.now, baseline: state.baseline || null, day: computeDay(dayEvents(), grants.grantedIds(), state.now) });
    if (M === 'POST' && pathname === '/api/reset') { state = createState(); proposals = []; return send(res, 200, { ok: true }); }
    if (M === 'POST' && pathname === '/api/clock') { const { now } = await body(req); if (isNaN(new Date(now))) return send(res, 400, { error: 'bad time' }); state.now = now; revalidate(proposals, tb().ctx()); return send(res, 200, { now }); }
    if (M === 'POST' && pathname === '/api/run') {
      proposals.splice(0); const trace = [];
      state.baseline ||= { at: state.now, metrics: computeDay(dayEvents(), grants.grantedIds(), state.now).metrics };
      const r = await runAgent(grants, proposals, { log: (l) => trace.push(l), state });
      return send(res, 200, { summary: r.summary, offline: !!r.offline, fallback: r.fallback || null, trace, proposals });
    }
    if (M === 'POST' && pathname === '/api/voice') {
      // audio/wav body -> Muse Voice Transcribe; JSON {text} -> pasted transcript.
      const isWav = (req.headers['content-type'] || '').startsWith('audio/wav');
      const text = isWav ? await transcribeWav(await raw(req)) : (await body(req)).text;
      return send(res, 200, addNote(state, text, isWav ? 'muse-voice-transcribe-1.0' : 'pasted'));
    }
    const m = pathname.match(/^\/api\/proposals\/(\w+)\/(approve|reject)$/);
    if (m && M === 'POST') {
      if (m[2] === 'approve') { const r = approve(proposals, m[1], state, tb().ctx); return send(res, r.error ? 400 : 200, r); }
      const p = proposals.find((x) => x.id === m[1]);
      if (!p) return send(res, 404, { error: 'not found' });
      p.status = 'rejected';
      return send(res, 200, { proposal: p });
    }
    send(res, 404, { error: 'not found' });
  } catch (e) { send(res, 500, { error: e.message }); }
}).listen(config.port, () => { console.log(`Vespera Day Agent on http://localhost:${config.port} (model ${config.model}, ${isOffline() ? 'OFFLINE mode' : 'live'}; GitHub live: ${process.env.GITHUB_LIVE_REPO || 'off'})`); liveEvents(); });
