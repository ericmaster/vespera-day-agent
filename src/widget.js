// Pure widget state at a replay time t (MVP increment 1 of docs/research/DELIVERY-AND-ATTENTION.md).
// Input is buildReplay() output; every number comes from the detectors. Mocked parts are flagged mock:true.
import { aggregate, phrase } from './adapters/attention.js';
const ms = (iso) => new Date(iso).getTime();
const ref = (c) => (String(c).match(/PR #\d+/) || [c])[0];
const hm = (iso) => { const d = new Date(ms(iso) - 5 * 3600e3); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
export const UNKNOWN_GAP_MIN = 30; // no granted event for this long = capture "unknown" (we do not guess)

export function widgetState(replay, t, { mode = 'with', choice = null, paused = false, decisions = {} } = {}) {
  const now = ms(t), seen = replay.events.filter((e) => ms(e.ts) <= now);
  const last = seen.at(-1);
  const capture = paused ? { state: 'paused', label: 'paused by you' }
    : !last || (now - ms(last.ts)) / 60000 > UNKNOWN_GAP_MIN || now > ms(replay.end) ? { state: 'unknown', label: 'no recent granted activity' }
    : { state: 'active', label: `work artifacts: ${[...new Set(seen.filter((e) => now - ms(e.ts) <= UNKNOWN_GAP_MIN * 60000).map((e) => e.lane))].join(', ')}` };
  const a = seen.filter((e) => e.action === 'anchor_start').pop();
  const anchor = a ? { context: a.context, ref: ref(a.context), since: hm(a.ts), evidence: a.id } : null;
  const W = replay.with, on = mode === 'with' && !paused;
  const flagged = on && W && now >= ms(W.flag_at);
  const back = flagged && choice === 'back';
  const block = back && now < ms(W.block.end) ? { title: W.block.title, start: hm(W.block.start), end: hm(W.block.end), remaining_min: Math.ceil((ms(W.block.end) - Math.max(now, ms(W.block.start))) / 60000), protected: true } : null;
  const d = W?.drift_at_flag;
  const nudge = flagged && !choice ? {
    id: `drift:${d.trigger_event}`, // one nudge per drift
    title: `Back to ${ref(d.anchor)}?`,
    body: `${d.minutes} min on "${d.side_quest}" (trigger: ${d.trigger}, ${d.trigger_event}). ${ref(d.anchor)} still needs a real review.`,
    actions: [{ action: 'back', title: 'Back' }, { action: 'park', title: 'Park and go back' }, { action: 'not_drift', title: 'Not drift' }],
    silent: true,
  } : null;
  const proposals = [];
  if (on) for (const s of replay.without.stamps) if (now >= ms(s.at)) proposals.push({ id: `stamp:${s.event}`, type: 'review_check', title: `${ref(s.context)}: approved without review evidence`, detail: s.flags.map((f) => f.detail).join('; '), why: { detector: 'reviewFlags', rules: s.flags.map((f) => f.rule), evidence: [...new Set(s.flags.map((f) => f.evidence))] } });
  if (flagged && choice !== 'not_drift' && choice !== 'keep') {
    proposals.push({ id: 'block:refocus', type: 'schedule_block', title: `Protected block ${hm(W.block.start)}–${hm(W.block.end)}: ${W.block.title}`, why: { detector: 'detectDrift', rules: [`drift >= ${W.threshold} min`], evidence: d.evidence } });
    proposals.push({ id: 'park:side_quest', type: 'park_task', title: `Park "${W.side_quest}" as a task`, why: { detector: 'detectDrift', rules: ['side-quest outside anchor'], evidence: [d.trigger_event] } });
    proposals.push({ id: 'slack:status', type: 'team_status_draft', mock: true, title: `Slack status: "Reviewing ${ref(W.anchor)} until ${hm(W.block.end)}"`, why: { detector: 'none (your one-click draft)', rules: ['never sent automatically'], evidence: [] } });
  }
  for (const p of proposals) { p.status = decisions[p.id] || 'pending'; if (p.type === 'team_status_draft' && p.status === 'approved') p.delivery = 'mock: not sent'; }
  // Tier-1 foreground (SIMULATED fixture in the replay): mix since the anchor started, category only.
  let attention = null;
  if (a && !paused && replay.attention) {
    const segs = (back && replay.attention.with) || replay.attention.without;
    const agg = aggregate(segs, a.ts, t, ['window', 'web', 'afk']);
    attention = { since: hm(a.ts), text: phrase(agg), confidence: agg.confidence, simulated: true };
  }
  if (capture.state === 'active' && replay.attention) capture.label += ' + foreground class (simulated)';
  return { attention, t, clock: hm(t), mode, vespera_on: on, capture, anchor, block, nudge, proposals };
}
