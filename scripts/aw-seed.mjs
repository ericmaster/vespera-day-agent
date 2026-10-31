#!/usr/bin/env node
// Seed a TESTING ActivityWatch server with the SIMULATED Friday from fixtures/attention.json.
// Synthetic titles/URLs only (no real data). Default target: http://localhost:5666 (aw-server --testing).
// Refuses port 5600 (your real ActivityWatch) and non-testing servers unless --force.
//   node scripts/aw-seed.mjs [--url http://localhost:5666] [--dry-run] [--force]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Synthetic foreground per category; chosen so the adapter's own rules map them back to the same category.
export const SYNTH = {
  window: { editor: { app: 'Code', title: 'session-middleware.js - orbit-api (synthetic)' }, ai_session: { app: 'Claude', title: 'Agent session (synthetic)' },
    chat: { app: 'Slack', title: '#team (synthetic)' }, email: { app: 'Thunderbird', title: 'Inbox (synthetic)' }, other: { app: 'gimp', title: 'Image (synthetic)' } },
  web: { code_review: { url: 'https://github.com/example/orbit-api/pull/44/files', title: 'PR #44 (synthetic)' },
    social_video: { url: 'https://www.youtube.com/watch?v=synthetic', title: 'Video (synthetic)' } },
};
const BROWSER = { app: 'Google-chrome', title: 'Browser (synthetic)' };

export function toImport(segments, hostname, created = new Date().toISOString()) {
  const b = (id, type, client, host) => ({ id, type, client, hostname: host, created, events: [] });
  const win = b(`aw-watcher-window_${hostname}`, 'currentwindow', 'aw-watcher-window', hostname);
  const afk = b(`aw-watcher-afk_${hostname}`, 'afkstatus', 'aw-watcher-afk', hostname);
  const web = b('aw-watcher-web-chrome', 'web.tab.current', 'aw-watcher-web-chrome', 'unknown');
  for (const s of segments) {
    const ev = (data) => ({ timestamp: new Date(s.start).toISOString(), duration: (new Date(s.end) - new Date(s.start)) / 1000, data });
    if (s.signal === 'afk' || s.category === 'afk') { afk.events.push(ev({ status: 'afk' })); continue; }
    afk.events.push(ev({ status: 'not-afk' }));
    if (s.signal === 'web') {
      const w = SYNTH.web[s.category]; if (!w) throw new Error(`no synthetic URL for ${s.category}`);
      win.events.push(ev(BROWSER)); web.events.push(ev({ ...w, audible: s.category === 'social_video', incognito: false }));
    } else {
      const w = SYNTH.window[s.category]; if (!w) throw new Error(`no synthetic app for ${s.category}`);
      win.events.push(ev(w));
    }
  }
  return { buckets: Object.fromEntries([win, afk, web].map((x) => [x.id, x])) };
}

export function checkTarget(url, info, force) {
  if (!force && new URL(url).port === '5600') return 'refusing port 5600 (your real ActivityWatch); use the testing server on 5666 or pass --force';
  if (!force && info && info.testing !== true) return `server at ${url} is not in --testing mode; pass --force to seed it anyway`;
  return null;
}

async function main() {
  const args = process.argv.slice(2), flag = (f) => args.includes(f), val = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
  const url = val('--url', process.env.AW_SEED_URL || 'http://localhost:5666').replace(/\/+$/, ''), force = flag('--force');
  const pre = checkTarget(url, null, force); if (pre) { console.error(pre); process.exit(2); }
  const auth = process.env.AW_API_KEY ? { Authorization: `Bearer ${process.env.AW_API_KEY}` } : {};
  const j = async (path, opt = {}) => { const r = await fetch(url + path, { ...opt, headers: { 'Content-Type': 'application/json', ...auth, ...(opt.headers || {}) } }); const t = await r.text();
    if (!r.ok) throw new Error(`${opt.method || 'GET'} ${path}: HTTP ${r.status}${/^\s*</.test(t) ? ' (HTML error page)' : ': ' + t.slice(0, 200)}`); try { return JSON.parse(t); } catch { return t; } };
  const info = await j('/api/0/info');
  const bad = checkTarget(url, info, force); if (bad) { console.error(bad); process.exit(2); }
  const fx = JSON.parse(readFileSync(new URL('../fixtures/attention.json', import.meta.url), 'utf8'));
  const data = toImport(fx.segments, info.hostname);
  if (flag('--dry-run')) { console.log(JSON.stringify(data, null, 1)); return; }
  // The Python aw-server fails importing into an existing bucket: replace our own synthetic buckets (testing server only).
  const existing = await j('/api/0/buckets/');
  for (const id of Object.keys(data.buckets)) if (existing[id]) await j(`/api/0/buckets/${encodeURIComponent(id)}?force=1`, { method: 'DELETE' });
  await j('/api/0/import', { method: 'POST', body: JSON.stringify(data) });
  const n = Object.values(data.buckets).reduce((a, b) => a + b.events.length, 0);
  console.log(`Seeded ${n} SIMULATED events into ${url} (host ${info.hostname}, testing=${info.testing}): ${Object.keys(data.buckets).join(', ')}`);
  console.log(`Read them back: AW_URL=${url} AW_START=2026-10-30T08:30:00-05:00 AW_END=2026-10-30T12:30:00-05:00 npm run demo:serve`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e.message); process.exit(1); });
