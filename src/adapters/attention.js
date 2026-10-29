// Tier-1 attention adapter: category-only foreground spans. Fixture (fixtures/attention.json, SIMULATED)
// by default; a real local ActivityWatch server when AW_URL is set (e.g. http://localhost:5600).
// Window titles and URLs are read ONLY inside mapAwEvents/categorize and never leave this module:
// the rest of Vespera sees {start,end,category,signal} and minute aggregates.
import { json } from './index.js';

export const CATEGORIES = ['code_review', 'editor', 'ai_session', 'chat', 'email', 'social_video', 'afk', 'other', 'unknown'];
export const SIGNALS = { 'attention:window': 'window', 'attention:web': 'web', 'attention:afk': 'afk' };
// Confidence thresholds on coverage of the span by granted signals. [hyp]: untested team hypotheses.
export const OBSERVED_MIN = 0.8, PARTIAL_MIN = 0.6; // [hyp]
export const OFF_TASK_MAX_SHARE = 0.5; // [hyp] review window flagged when code_review < 50% of the span
export const MAX_APPROVAL_WINDOW_MIN = 30; // [hyp] approval windows longer than this are not judged
export const LABEL = { code_review: 'code review', editor: 'editor', ai_session: 'AI session', chat: 'chat', email: 'email', social_video: 'video', afk: 'away', other: 'other', unknown: 'unknown' };

// Dev-editable local rules (regex on app / url). Unmatched -> other, never guessed.
const RULES = {
  web: [[/github\.com\/[^/]+\/[^/]+\/pull\//, 'code_review'], [/(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|reddit\.com|twitch\.tv|x\.com|twitter\.com|netflix\.com)/, 'social_video'],
    [/(mail\.google\.com|outlook\.(office|live)\.com)/, 'email'], [/(slack\.com|teams\.microsoft\.com|discord\.com)/, 'chat'], [/(chatgpt\.com|claude\.ai|cursor\.com|meta\.ai)/, 'ai_session']],
  app: [[/^(code|cursor|idea|webstorm|vim|nvim|emacs|sublime_text|zed)/i, 'editor'], [/(slack|teams|discord)/i, 'chat'], [/(mail|outlook|thunderbird)/i, 'email'], [/(claude|chatgpt|codex)/i, 'ai_session']],
};
const BROWSERS = /(chrome|chromium|firefox|safari|edge|brave|arc|opera)/i;
export function categorize({ app = '', url = '' } = {}, rules = RULES) {
  if (url) { for (const [re, c] of rules.web) if (re.test(url)) return c; return 'other'; }
  if (BROWSERS.test(app)) return 'unknown'; // browser without a granted tab class = browser_unclassified -> unknown
  for (const [re, c] of rules.app) if (re.test(app)) return c;
  return app ? 'other' : 'unknown';
}

const ms = (iso) => new Date(iso).getTime();
const toIso = (t) => { const d = new Date(t - 5 * 3600e3), p = (n) => String(n).padStart(2, '0'); return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00-05:00`; };

// AW bucket events -> per-minute categories -> merged segments. Titles/URLs are dropped here.
export function mapAwEvents({ window = [], web = [], afk = [] }, start, end) {
  const covers = (evs, t) => evs.find((e) => ms(e.timestamp) <= t && t < ms(e.timestamp) + e.duration * 1000);
  const segs = [];
  for (let t = ms(start); t < ms(end); t += 60000) {
    const mid = t + 30000; let category = null, signal = null;
    const a = covers(afk, mid);
    if (a?.data?.status === 'afk') { category = 'afk'; signal = 'afk'; }
    else { const w = covers(window, mid);
      if (w) { const tab = BROWSERS.test(w.data?.app || '') ? covers(web, mid) : null;
        if (tab) { category = categorize({ url: tab.data?.url }); signal = 'web'; } else { category = categorize({ app: w.data?.app }); signal = category === 'unknown' ? 'web' : 'window'; } } }
    if (!category) continue;
    const last = segs.at(-1);
    if (last && last.category === category && last.signal === signal && ms(last.end) === t) last.end = toIso(t + 60000);
    else segs.push({ start: toIso(t), end: toIso(t + 60000), category, signal });
  }
  return segs.map((s, i) => ({ id: `aw${i + 1}`, ...s }));
}

let awCache = null, awStatus = { source: 'fixture', error: null };
export async function refreshActivityWatch(start, end, url = process.env.AW_URL, fetchFn = fetch) {
  if (!url) return null;
  try {
    const buckets = await (await fetchFn(`${url}/api/0/buckets`)).json();
    const pick = (re) => Object.keys(buckets).find((k) => re.test(k));
    const get = async (id) => id ? (await fetchFn(`${url}/api/0/buckets/${encodeURIComponent(id)}/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)).json() : [];
    const segs = mapAwEvents({ window: await get(pick(/^aw-watcher-window/)), web: await get(pick(/^aw-watcher-web/)), afk: await get(pick(/^aw-watcher-afk/)) }, start, end);
    awCache = segs; awStatus = { source: 'activitywatch', error: null, segments: segs.length };
    return segs;
  } catch (e) { awCache = null; awStatus = { source: "fixture", error: `ActivityWatch: ${e.message}` }; return null; }
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
