// Transport-agnostic request handler: used by the Node server (src/server.js) and the Cloudflare Worker (worker/index.js).
import { readText } from './files.js';
import { config } from './config.js';
import { adapters } from './adapters/index.js';
import { createGrants } from './grants.js';
import { runAgent, isOffline } from './agent.js';
import { makeToolbox } from './tools.js';
import { createState, approve, revalidate } from './state.js';
import { computeDay, dayEvents } from './metrics.js';
import { liveEvents, liveStatus } from './adapters/github-live.js';
import { buildReplay } from './playback.js';
import { widgetState } from './widget.js';
import { createAudit, recordDecision, why } from './audit.js';
const replay = () => buildReplay(json('day.json'), json('calendar.json'), { grants: ['chat:team', 'email:work', 'agent:coding-sessions', 'github:repo'] });
import { json } from './adapters/index.js';
import { transcribeWav, addNote } from './transcribe.js';

const grants = createGrants(adapters);
// Decision record. The host (Node server / Worker Durable Object) may set audit.sink to persist and audit.load() to restore.
export const audit = createAudit();
let state = createState();
let proposals = [];
const tb = () => makeToolbox(grants, proposals, state);

// Protect model credits on the public demo: global hourly cap + per-client cooldown.
// Over the limit, "Check now" still runs, but on the labeled offline fallback.
const RUN_CAP = Number(process.env.RUN_CAP_PER_HOUR || 30), RUN_COOLDOWN_MS = Number(process.env.RUN_COOLDOWN_SEC || 20) * 1000;
let runTimes = [], running = false; const lastRun = new Map();
function modelBudget(req) {
  const now = Date.now(), ip = req.ip;
  runTimes = runTimes.filter((t) => now - t < 3600e3);
  if (runTimes.length >= RUN_CAP) return 'rate limit: hourly model-call cap reached';
  if (now - (lastRun.get(ip) || 0) < RUN_COOLDOWN_MS) return 'rate limit: please wait a few seconds between checks';
  runTimes.push(now); lastRun.set(ip, now); return null;
}

// req: { method, url, headers, ip, raw: () => Promise<Uint8Array> } -> { code, type, body }
const raw = (req) => req.raw();
const body = async (req) => { const b = await raw(req); return b.length ? JSON.parse(new TextDecoder().decode(b)) : {}; };
const send = (res, code, obj) => ({ code, type: 'application/json', body: JSON.stringify(obj) });
const res = null;

export async function handle(req) {
  try {
    const { pathname } = new URL(req.url, 'http://x');
    const M = req.method;
    if (M === 'GET' && pathname === '/') return { code: 200, type: 'text/html; charset=utf-8', body: readText('public/index.html') };
    if (M === 'GET' && pathname === '/widget') return { code: 200, type: 'text/html; charset=utf-8', body: readText('public/widget.html') };
    if (M === 'GET' && pathname === '/sw.js') return { code: 200, type: 'text/javascript', body: "self.addEventListener('notificationclick',(e)=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then((cs)=>{cs.forEach((c)=>c.postMessage({type:'nudge-action',action:e.action||'back'}));if(cs[0])return cs[0].focus();}));});" };
    if (M === 'GET' && pathname === '/api/widget') {
      const q = new URL(req.url, 'http://x').searchParams; let decisions = {};
      try { decisions = JSON.parse(q.get('decisions') || '{}'); } catch {}
      if (isNaN(new Date(q.get('t')))) return send(res, 400, { error: 'bad t' });
      return send(res, 200, widgetState(replay(), q.get('t'), { mode: q.get('mode') === 'without' ? 'without' : 'with', choice: q.get('choice') || null, paused: !!q.get('paused'), decisions }));
    }
    // Dev-only manual export of the decision record. Nothing is sent anywhere.
    if (M === 'GET' && pathname === '/api/audit.jsonl') { const q = new URL(req.url, 'http://x').searchParams;
      return { code: 200, type: 'application/x-ndjson; charset=utf-8', body: audit.jsonl({ run_id: q.get('run_id'), record: q.get('record') }) }; }
    if (M === 'GET' && pathname === '/api/why') { const q = new URL(req.url, 'http://x').searchParams, pid = q.get('proposal_id');
      const out = why(audit, pid, q.get('run_id') || proposals.find((p) => p.id === pid)?.run_id || null);
      const w = widgetState(replay(), '2026-10-30T23:00:00-05:00', { choice: 'back' }).proposals.find((p) => p.id === pid);
      if (w) { const R = replay(); out.detector = { ...w.why, quotes: w.why.evidence.map((id) => ({ item_id: id, quote: R.events.find((e) => e.id === id)?.text })) }; }
      return send(res, 200, out); }
    if (M === 'POST' && pathname === '/api/audit/decision') { const b = await body(req);
      if (!b.proposal_id || !['approved', 'rejected', 'not_drift', 'park', 'back'].includes(b.action)) return send(res, 400, { error: 'bad decision' });
      return send(res, 200, recordDecision(audit, { proposal_id: String(b.proposal_id).slice(0, 60), action: b.action, source: 'widget', replay_t: b.t || null, replay_mode: b.mode || null })); }
    if (M === 'GET' && pathname === '/api/replay') return send(res, 200, replay());
    if (M === 'GET' && pathname === '/api/sources') return send(res, 200, { sources: grants.list(), model: config.model, keyConfigured: !!config.apiKey, offline: isOffline(), github: liveStatus() });
    if (M === 'POST' && pathname === '/api/github/refresh') { liveEvents(undefined, { refresh: true }); revalidate(proposals, tb().ctx()); return send(res, 200, liveStatus()); }
    if (M === 'POST' && pathname === '/api/grants') { const { id, granted } = await body(req); grants.set(id, granted); state.log.push({ at: new Date().toISOString(), tool: 'user:grant', source_id: id, allowed: true, note: granted ? 'granted by user' : 'revoked by user' }); revalidate(proposals, tb().ctx()); return send(res, 200, grants.list()); }
    if (M === 'GET' && pathname === '/api/state') return send(res, 200, { proposals, events: state.events, tasks: state.tasks, notes: state.notes, applied: state.applied, log: state.log, alerts: state.alerts, drafts: state.drafts, now: state.now, baseline: state.baseline || null, day: computeDay(dayEvents(), grants.grantedIds(), state.now) });
    if (M === 'POST' && pathname === '/api/reset') { state = createState(); proposals = []; return send(res, 200, { ok: true }); }
    // Consent probe for the demo: try to read a source; ungranted reads are blocked and logged.
    if (M === 'POST' && pathname === '/api/probe') { const { id } = await body(req); try { tb().read_source({ source_id: id }); return send(res, 200, { allowed: true }); } catch (e) { return send(res, 200, { allowed: false, error: e.message }); } }
    if (M === 'POST' && pathname === '/api/clock') { const { now } = await body(req); if (isNaN(new Date(now))) return send(res, 400, { error: 'bad time' }); state.now = now; revalidate(proposals, tb().ctx()); return send(res, 200, { now }); }
    if (M === 'POST' && pathname === '/api/run') {
      // One check at a time: runs share the demo state, and parallel runs would burn credits.
      if (running) return send(res, 429, { error: 'a check is already running, try again in a moment' });
      running = true;
      try {
      proposals.splice(0); const trace = [];
      state.baseline ||= { at: state.now, metrics: computeDay(dayEvents(), grants.grantedIds(), state.now).metrics };
      const limited = isOffline() ? null : modelBudget(req);
      const r = await runAgent(grants, proposals, { log: (l) => trace.push(l), state, audit, forceOffline: limited });
      return send(res, 200, { summary: r.summary, offline: !!r.offline, fallback: r.fallback || null, mode: r.mode, run_id: r.run_id, trace, proposals });
      } finally { running = false; }
    }
    if (M === 'POST' && pathname === '/api/voice') {
      // audio/wav body -> Muse Voice Transcribe; JSON {text} -> pasted transcript.
      const isWav = (req.headers.get('content-type') || '').startsWith('audio/wav');
      const text = isWav ? await transcribeWav(await raw(req)) : (await body(req)).text;
      return send(res, 200, addNote(state, text, isWav ? 'muse-voice-transcribe-1.0' : 'pasted'));
    }
    const m = pathname.match(/^\/api\/proposals\/(\w+)\/(approve|reject)$/);
    if (m && M === 'POST') {
      if (m[2] === 'approve') {
        const r = approve(proposals, m[1], state, tb().ctx);
        if (!r.error) recordDecision(audit, { run_id: r.proposal.run_id || null, proposal_id: m[1], action: 'approved', source: 'live_agent' });
        return send(res, r.error ? 400 : 200, r);
      }
      const p = proposals.find((x) => x.id === m[1]);
      if (!p) return send(res, 404, { error: 'not found' });
      p.status = 'rejected';
      recordDecision(audit, { run_id: p.run_id || null, proposal_id: p.id, action: 'rejected', source: 'live_agent' });
      return send(res, 200, { proposal: p });
    }
    return send(res, 404, { error: 'not found' });
  } catch (e) { return send(res, 500, { error: e.message }); }
}
