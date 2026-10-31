// Tier-1 attention adapter: category-only foreground spans. Fixture (fixtures/attention.json, SIMULATED)
// by default; a real local ActivityWatch server when AW_URL is set (e.g. http://localhost:5600).
// Window titles and URLs are read ONLY inside mapAwEvents/categorize and never leave this module:
// the rest of Vespera sees {start,end,category,signal} and minute aggregates.
import { json } from './index.js';

export const CATEGORIES = ['code_review', 'editor', 'ai_session', 'chat', 'email', 'meeting', 'docs', 'social_video', 'system', 'afk', 'other', 'unknown'];
export const SIGNALS = { 'attention:window': 'window', 'attention:web': 'web', 'attention:afk': 'afk' };
// Confidence thresholds on coverage of the span by granted signals. [hyp]: untested team hypotheses.
export const OBSERVED_MIN = 0.8, PARTIAL_MIN = 0.6; // [hyp]
export const OFF_TASK_MAX_SHARE = 0.5; // [hyp] review window flagged when code_review < 50% of the span
export const MAX_APPROVAL_WINDOW_MIN = 30; // [hyp] approval windows longer than this are not judged
export const LABEL = { code_review: 'code review', editor: 'editor', ai_session: 'AI session', chat: 'chat', email: 'email', meeting: 'meeting', docs: 'docs', social_video: 'video', system: 'system', afk: 'away', other: 'other', unknown: 'unknown' };

// Dev-editable local rules (regex on app / url). Unmatched -> other, never guessed.
// App names are normalized first: lowercased, path and ".exe" stripped ("C:\...\Antigravity IDE.exe" -> "antigravity ide").
const RULES = {
  web: [
    [/github\.com\/[^/]+\/[^/]+\/(pull\/|pulls\b|compare\/|commit\/)|github\.com\/pulls\b|github\.com\/notifications/, 'code_review'],
    [/(chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com|meta\.ai|grok\.com|x\.com\/i\/grok|perplexity\.ai|aistudio\.google\.com)/, 'ai_session'],
    [/(meet\.google\.com|zoom\.us\/(j|wc|my)\/|teams\.(microsoft|live)\.com\/.*(meetup-join|meeting))/, 'meeting'],
    [/(mail\.google\.com|outlook\.(office|office365|live)\.com|mail\.proton\.me)/, 'email'],
    [/(slack\.com|teams\.(microsoft|live)\.com|discord\.com|web\.whatsapp\.com|web\.telegram\.org|messenger\.com)/, 'chat'],
    [/(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|reddit\.com|twitch\.tv|(^|[/.])x\.com|twitter\.com|facebook\.com|netflix\.com)/, 'social_video'],
    [/(github\.com|gitlab\.com|bitbucket\.org|localhost|127\.0\.0\.1|vscode\.dev|cursor\.com)/, 'editor'],
    [/(docs\.google\.com|drive\.google\.com|notion\.so|stackoverflow\.com|developer\.mozilla\.org|readthedocs|\/docs?\/|docs\.|confluence|npmjs\.com|devdocs\.io)/, 'docs'],
  ],
  app: [
    [/^(code|code - insiders|cursor|windsurf|antigravity( ide)?|idea64|idea|pycharm64|pycharm|webstorm64|webstorm|rider64|goland64|clion64|android studio|studio64|devenv|vim|nvim|gvim|emacs|sublime_text|zed|notepad\+\+|windowsterminal|wt|powershell|pwsh|cmd|conhost|openconsole|wsl|wslhost|mintty|bash|alacritty|wezterm(-gui)?|kitty|iterm2|terminal|gnome-terminal(-server)?|konsole|tabby|warp|putty|mobaxterm|github ?desktop|gitkraken|docker desktop)$/, 'editor'],
    [/^(zoom|cpthost|webex|ciscowebexstart|skype)$/, 'meeting'],
    [/^(slack|ms-teams|teams|discord|whatsapp|whatsapp\.root|telegram|signal|messenger|element)$/, 'chat'],
    [/^(outlook|olk|hxoutlook|thunderbird|mail|mailspring)$/, 'email'],
    [/^(claude|chatgpt|codex|ollama app|lm studio|grok)$/, 'ai_session'],
    [/^(winword|excel|powerpnt|onenote|notion|obsidian|acrobat|acrord32|sumatrapdf|notepad|evince|okular)$/, 'docs'],
    [/^(explorer|aw-qt|aw-server(-rust)?|aw-watcher-.*|lockapp|logonui|searchhost|searchapp|searchui|shellexperiencehost|startmenuexperiencehost|applicationframehost|systemsettings|taskmgr|mmc|control|rundll32|dwm|unknown|loginwindow|finder|nautilus|gnome-shell)$/, 'system'],
    [/^(spotify|vlc|netflix|steam|tiktok|instagram)$/, 'social_video'],
  ],
};
const BROWSERS = /^(chrome|google-chrome|chromium|firefox|safari|msedge|microsoft edge|brave|arc|opera|vivaldi|zen)$/;
export const normApp = (app = '') => String(app).split(/[\\/]/).pop().trim().toLowerCase().replace(/\.exe$/, '');
export const isBrowser = (app) => BROWSERS.test(normApp(app));
export function categorize({ app = '', url = '' } = {}, rules = RULES) {
  if (url) { const u = String(url).toLowerCase(); for (const [re, c] of rules.web) if (re.test(u)) return c; return 'other'; }
  const a = normApp(app);
  if (BROWSERS.test(a)) return 'unknown'; // browser without a granted tab class = browser_unclassified -> unknown
  for (const [re, c] of rules.app) if (re.test(a)) return c;
  return a ? 'other' : 'unknown';
}

const ms = (iso) => new Date(iso).getTime();
// Local ISO with the real offset of the configured timezone at that instant (no hardcoded -05:00).
export const TZ = () => process.env.VDA_TZ || 'America/Bogota';
export function offsetMinutes(t, tz = TZ()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return Math.round((Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(t / 1000) * 1000) / 60000);
}
export function toIso(t, tz = TZ()) {
  const off = offsetMinutes(t, tz), d = new Date(t + off * 60000), p = (n) => String(n).padStart(2, '0');
  const sign = off < 0 ? '-' : '+', o = Math.abs(off);
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00${sign}${p(Math.floor(o / 60))}:${p(o % 60)}`;
}

const WEB_SLACK = 120000;
function bestTab(web, t) {
  let best = null, score = -Infinity;
  for (const e of web) { const a = ms(e.timestamp), b = a + e.duration * 1000;
    const ov = Math.min(b, t + 60000) - Math.max(a, t), gap = ov > 0 ? 0 : Math.max(a - (t + 60000), t - b);
    const sc = ov > 0 ? ov : -gap; if (gap <= WEB_SLACK && sc > score) { score = sc; best = e; } }
  return best;
}
// AW bucket events -> per-minute categories -> merged segments. Titles/URLs are dropped here.
export function mapAwEvents({ window = [], web = [], afk = [] }, start, end) {
  const covers = (evs, t) => evs.find((e) => ms(e.timestamp) <= t && t < ms(e.timestamp) + e.duration * 1000);
  const segs = [];
  for (let t = ms(start); t < ms(end); t += 60000) {
    const mid = t + 30000; let category = null, signal = null;
    const a = covers(afk, mid);
    if (a?.data?.status === 'afk') { category = 'afk'; signal = 'afk'; }
    else { const w = covers(window, mid);
      // aw-watcher-web heartbeats leave short gaps and start late on tab switches: if no tab event covers the
      // minute's midpoint, take the tab that overlaps this minute the most (else the nearest within WEB_SLACK).
      if (w) { const tab = isBrowser(w.data?.app) ? (covers(web, mid) || bestTab(web, t)) : null;
        if (tab) { category = categorize({ url: tab.data?.url }); signal = 'web'; } else { category = categorize({ app: w.data?.app }); signal = category === 'unknown' ? 'web' : 'window'; } } }
    if (!category) continue;
    const last = segs.at(-1);
    if (last && last.category === category && last.signal === signal && ms(last.end) === t) last.end = toIso(t + 60000);
    else segs.push({ start: toIso(t), end: toIso(t + 60000), category, signal });
  }
  return segs.map((s, i) => ({ id: `aw${i + 1}`, ...s }));
}

let awCache = null, awStatus = { source: 'fixture', error: null };
// ActivityWatch REST (https://docs.activitywatch.net/en/latest/api/rest.html). Error bodies may be HTML
// (aw-server-rust), so never trust them: check res.ok and parse text ourselves.
export async function awGet(url, path, { fetchFn = fetch, apiKey = process.env.AW_API_KEY } = {}) {
  const res = await fetchFn(`${url}${path}`, { headers: { Accept: 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path.split('?')[0]} HTTP ${res.status}${/^\s*</.test(text) ? ' (HTML error page)' : ''}`);
  try { return JSON.parse(text); } catch { throw new Error(`${path.split('?')[0]} returned non-JSON${/^\s*</.test(text) ? ' (HTML)' : ''}`); }
}
// Buckets for THIS host (from /api/0/info, or AW_HOSTNAME). aw-watcher-web buckets often report hostname
// "unknown", so those are accepted too; all web buckets (one per browser) are merged.
export function pickBuckets(buckets, hostname) {
  const all = Object.entries(buckets).map(([id, b]) => ({ id, ...b }));
  const mine = (b) => b.hostname === hostname;
  return {
    window: all.filter((b) => (b.type === 'currentwindow' || b.id.startsWith('aw-watcher-window')) && mine(b)).map((b) => b.id),
    afk: all.filter((b) => (b.type === 'afkstatus' || b.id.startsWith('aw-watcher-afk')) && mine(b)).map((b) => b.id),
    web: all.filter((b) => b.id.startsWith('aw-watcher-web') && (mine(b) || !b.hostname || b.hostname === 'unknown')).map((b) => b.id),
  };
}
export async function refreshActivityWatch(start, end, url = process.env.AW_URL, fetchFn = fetch, { apiKey = process.env.AW_API_KEY, hostname = process.env.AW_HOSTNAME } = {}) {
  if (!url) return null;
  url = url.replace(/\/+$/, '');
  const fail = (reason) => { awCache = null; awStatus = { source: 'fixture', error: `ActivityWatch: ${reason}; using the simulated fixture` }; return null; };
  try {
    const o = { fetchFn, apiKey };
    const host = hostname || (await awGet(url, '/api/0/info', o)).hostname;
    const ids = pickBuckets(await awGet(url, '/api/0/buckets/', o), host);
    if (!ids.window.length) return fail(`no aw-watcher-window bucket for host "${host}"`);
    const q = `?start=${encodeURIComponent(new Date(start).toISOString())}&end=${encodeURIComponent(new Date(end).toISOString())}&limit=-1`;
    const get = async (list) => (await Promise.all(list.map((id) => awGet(url, `/api/0/buckets/${encodeURIComponent(id)}/events${q}`, o)))).flat();
    const segs = mapAwEvents({ window: await get(ids.window), web: await get(ids.web), afk: await get(ids.afk) }, start, end);
    awCache = segs; awStatus = { source: 'activitywatch', error: null, host, buckets: ids, segments: segs.length };
    return segs;
  } catch (e) { return fail(e.message); }
}
export const attentionStatus = () => awStatus;
export const attentionSegments = () => awCache || json('attention.json').segments;

// Aggregate a span: minutes per category from GRANTED signals only; everything else is unknown.
export function aggregate(segments, start, end, grantedSignals) {
  const a = ms(start), b = ms(end), span = Math.max(0, Math.round((b - a) / 60000)), by = {};
  let known = 0;
  for (const s of segments) {
    const o = Math.round((Math.min(b, ms(s.end)) - Math.max(a, ms(s.start))) / 60000);
    if (o <= 0) continue;
    const cat = grantedSignals.includes(s.signal) && s.category !== 'unknown' ? s.category : 'unknown';
    by[cat] = (by[cat] || 0) + o; if (cat !== 'unknown') known += o;
  }
  if (span - known - (by.unknown || 0) > 0) by.unknown = span - known;
  const coverage = span ? known / span : 0;
  return { start, end, span_min: span, minutes_by_category: by, coverage: Math.round(coverage * 100) / 100,
    confidence: !grantedSignals.length ? 'unknown' : coverage >= OBSERVED_MIN ? 'observed' : coverage >= PARTIAL_MIN ? 'partial' : 'unknown' };
}

// "foreground: video 9 of 31 min (observed)". Unknown spans say only that.
export function phrase(agg, focus) {
  if (agg.confidence === 'unknown') return `foreground: unknown for ${agg.span_min} min`;
  const cats = Object.entries(agg.minutes_by_category).filter(([c]) => c !== 'unknown').sort((x, y) => y[1] - x[1]);
  const pick = focus && agg.minutes_by_category[focus] != null ? [[focus, agg.minutes_by_category[focus]]] : cats.slice(0, 2);
  return `foreground: ${pick.map(([c, n]) => `${LABEL[c]} ${n}`).join(', ')} of ${agg.span_min} min (${agg.confidence})`;
}

export const grantedSignals = (grantedIds) => Object.entries(SIGNALS).filter(([id]) => grantedIds.includes(id)).map(([, s]) => s);

// Signal review_window_off_task: anchor review windows (anchor_start -> next anchor activity) and
// approval windows (pr_opened -> approved, <= MAX_APPROVAL_WINDOW_MIN) with code_review < OFF_TASK_MAX_SHARE.
// Describes the span, never the person.
export function reviewWindows(events, segments, grantedIds) {
  const sig = grantedSignals(grantedIds); if (!sig.length) return [];
  const ev = [...events].sort((a, b) => a.ts.localeCompare(b.ts)), out = [];
  for (const [i, e] of ev.entries()) {
    let endE = null, kind = null;
    if (e.action === 'anchor_start') { endE = ev.slice(i + 1).find((x) => x.context === e.context); kind = 'anchor'; }
    if (e.action === 'pr_opened') { endE = ev.slice(i + 1).find((x) => x.context === e.context && x.action === 'approved'); kind = 'approval';
      if (endE && (ms(endE.ts) - ms(e.ts)) / 60000 > MAX_APPROVAL_WINDOW_MIN) endE = null; }
    if (!endE) continue;
    const agg = aggregate(segments, e.ts, endE.ts, sig), cr = agg.minutes_by_category.code_review || 0;
    const flagged = agg.confidence !== 'unknown' && agg.span_min > 0 && cr / agg.span_min < OFF_TASK_MAX_SHARE;
    out.push({ signal: 'review_window_off_task', kind, context: e.context, evidence: [e.id, endE.id], ...agg, code_review_min: cr, flagged,
      text: `${e.context} ${kind} window ${e.ts.slice(11, 16)}–${endE.ts.slice(11, 16)}: ${cr} of ${agg.span_min} min foreground in code review (${agg.confidence})` });
  }
  return out;
}
