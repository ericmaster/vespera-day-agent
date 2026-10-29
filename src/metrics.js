// Deterministic day metrics over the granted activity stream. The model never computes
// these numbers; alerts must quote them and the validator checks they match.
import { json } from './adapters/index.js';

export const dayEvents = () => json('day.json');
export const METRICS = ['switches_total', 'switches_max_per_hour', 'opened', 'closed_with_review', 'closed_without_review', 'review_backlog'];

export function computeDay(events, grantedIds, now) {
  const ev = events.filter((e) => grantedIds.includes(e.source_id) && (!now || new Date(e.ts) <= new Date(now)))
    .sort((a, b) => a.ts.localeCompare(b.ts));
  const timeline = [], perHour = {};
  let switches = 0;
  ev.forEach((e, i) => {
    const sw = i > 0 && ev[i - 1].context !== e.context;
    if (sw) { switches++; const h = e.ts.slice(11, 13) + ':00'; perHour[h] = (perHour[h] || 0) + 1; }
    timeline.push({ id: e.id, ts: e.ts, source_id: e.source_id, context: e.context, action: e.action, switch: sw, text: e.text });
  });
  const items = {};
  for (const e of ev) {
    const it = (items[e.context] ||= { context: e.context, state: 'open', review_requested: false, evidence: [] });
    it.evidence.push(e.id);
    if (e.action === 'review_requested') it.review_requested = true;
    if (e.action === 'closed') it.state = e.verified ? 'closed_with_review' : 'closed_without_review';
  }
  const list = Object.values(items);
  const count = (s) => list.filter((i) => i.state === s).length;
  return {
    now: now || null,
    timeline, switches_per_hour: perHour, items: list,
    metrics: {
      switches_total: switches,
      switches_max_per_hour: Math.max(0, ...Object.values(perHour)),
      opened: list.length,
      closed_with_review: count('closed_with_review'),
      closed_without_review: count('closed_without_review'),
      review_backlog: list.filter((i) => i.review_requested && i.state === 'open').length,
    },
  };
}
