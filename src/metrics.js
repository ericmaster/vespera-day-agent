// Deterministic day metrics and detectors over the granted activity stream. The model never
// computes these; alerts must quote them and the validator checks they match.
import { json } from './adapters/index.js';

export const dayEvents = () => json('day.json');
export const DRIFT_MIN = Number(process.env.DRIFT_MINUTES || 15);
const mins = (a, b) => Math.round((new Date(b) - new Date(a)) / 60000);

// Rubber-stamp detector: "reviewed" only counts when the evidence of review exists.
export function reviewFlags(evs) {
  const flags = [], has = (a) => evs.some((e) => e.action === a);
  const appr = evs.filter((e) => e.action === 'approved').pop();
  const ci = has('ci_run');
  if (appr?.lines && appr.review_seconds != null && appr.review_seconds < (60 * appr.lines) / 100)
    flags.push({ rule: 'too_fast', detail: `approved ${appr.lines} lines in ${appr.review_seconds}s (min ${Math.round((60 * appr.lines) / 100)}s at 1 min/100 lines)`, evidence: appr.id });
  if (!ci) flags.push({ rule: 'no_ci', detail: 'no test/CI run recorded', evidence: (appr || evs.at(-1)).id });
  const claim = evs.find((e) => e.source_id === 'agent:coding-sessions' && /tests? (pass|passed)/i.test(e.text));
  if (claim && !ci) flags.push({ rule: 'unverified_claim', detail: 'agent said tests pass, no CI log', evidence: claim.id });
  if (appr && !appr.review_comments && !appr.files_viewed) flags.push({ rule: 'no_review_activity', detail: '0 comments, 0 files viewed', evidence: appr.id });
  return flags;
}

// Task-drift detector: an anchor (assigned task + evidence) is active; a trigger event in another
// context (AI remark, mention, self-discovery) starts a side-quest that lasts until activity returns.
export function detectDrift(ev, now, minMinutes = DRIFT_MIN) {
  const out = []; let anchor = null, cur = null;
  const close = (end) => { cur.end = end; cur.minutes = mins(cur.start, end); if (cur.minutes >= minMinutes) out.push(cur); cur = null; };
  for (const e of ev) {
    if (e.action === 'anchor_start') { anchor = { context: e.context, event: e.id, assigned_by: e.assigned_by }; continue; }
    if (!anchor) continue;
    if (cur && e.context === anchor.context) close(e.ts);
    else if (cur) cur.evidence.push(e.id);
    else if (e.trigger && e.context !== anchor.context)
      cur = { anchor: anchor.context, anchor_evidence: [anchor.assigned_by, anchor.event].filter(Boolean), side_quest: e.context, trigger: e.trigger, trigger_event: e.id, start: e.ts, evidence: [e.id] };
  }
  if (cur && now) close(now);
  return out;
}

export const METRICS = ['switches_total', 'switches_max_per_hour', 'opened', 'closed_with_review', 'closed_without_review', 'rubber_stamp_reviews', 'review_backlog', 'drift_minutes_max'];

export function computeDay(events, grantedIds, now, { driftMinutes = DRIFT_MIN } = {}) {
  const ev = events.filter((e) => grantedIds.includes(e.source_id) && (!now || new Date(e.ts) <= new Date(now)))
    .sort((a, b) => a.ts.localeCompare(b.ts));
  const timeline = [], perHour = {};
  let switches = 0;
  ev.forEach((e, i) => {
    const sw = i > 0 && ev[i - 1].context !== e.context;
    if (sw) { switches++; const h = e.ts.slice(11, 13) + ':00'; perHour[h] = (perHour[h] || 0) + 1; }
    timeline.push({ id: e.id, ts: e.ts, source_id: e.source_id, context: e.context, action: e.action, trigger: e.trigger, switch: sw, text: e.text });
  });
  const items = {};
  for (const e of ev) {
    const it = (items[e.context] ||= { context: e.context, state: 'open', review_requested: false, evidence: [], events: [] });
    it.evidence.push(e.id); it.events.push(e);
    if (e.action === 'review_requested') it.review_requested = true;
    if (e.action === 'closed') it.state = e.review ? 'closed_reviewed' : 'closed_without_review';
  }
  const list = Object.values(items).map(({ events: evs, ...it }) => {
    if (it.state !== 'closed_reviewed') return it;
    const flags = reviewFlags(evs);
    return { ...it, state: flags.length ? 'rubber_stamp' : 'closed_with_review', review_flags: flags };
  });
  const count = (s) => list.filter((i) => i.state === s).length;
  const drift = detectDrift(ev, now, driftMinutes);
  return {
    now: now || null, timeline, switches_per_hour: perHour, items: list, drift,
    metrics: {
      switches_total: switches,
      switches_max_per_hour: Math.max(0, ...Object.values(perHour)),
      opened: list.length,
      closed_with_review: count('closed_with_review'),
      closed_without_review: count('closed_without_review'),
      rubber_stamp_reviews: count('rubber_stamp'),
      review_backlog: list.filter((i) => i.review_requested && i.state === 'open').length,
      drift_minutes_max: Math.max(0, ...drift.map((d) => d.minutes)),
    },
  };
}
