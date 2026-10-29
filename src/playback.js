// Pure replay builder for the demo UI: turns the fixture day into lanes, attention (dwell) and two
// scripted modes. Every number comes from computeDay / detectDrift / reviewFlags; nothing is invented.
import { computeDay, detectDrift, reviewFlags, DRIFT_MIN } from './metrics.js';
import { attentionSegments, aggregate, phrase, reviewWindows } from './adapters/attention.js';
const ATT = ['attention:window', 'attention:web', 'attention:afk'], SIG = ['window', 'web', 'afk'];

// Replay attention lane: the SIMULATED fixture, as if all three signals were opted in. With Vespera, after the
// refocus the protected block is simulated as code review (labelled simulated), so later spans are replaced.
export function replayAttention(ev, flag, blockEnd, segments = attentionSegments()) {
  const strip = (s) => ({ start: s.start, end: s.end, category: s.category, signal: s.signal });
  const without = segments.map(strip);
  const d = detectDrift(ev, null)[0];
  const out = { simulated: true, without, drift_phrase: d ? phrase(aggregate(segments, d.start, d.end, SIG), 'social_video') : null,
    windows: reviewWindows(ev, segments, ATT).map(({ text, flagged, kind, context }) => ({ text, flagged, kind, context })) };
  if (flag) {
    const cut = (s, a, b) => ({ ...s, start: a, end: b });
    const w = [];
    for (const s of without) {
      if (s.end <= flag.at || s.start >= blockEnd) { w.push(s); continue; }
      if (s.start < flag.at) w.push(cut(s, s.start, flag.at));
      if (s.end > blockEnd) w.push(cut(s, blockEnd, s.end));
    }
    w.push({ start: flag.at, end: blockEnd, category: 'code_review', signal: 'web', simulated: true });
    w.sort((a, b) => a.start.localeCompare(b.start));
    out.with = w; out.flag_phrase = phrase(aggregate(segments, flag.drift.start, flag.at, SIG));
  }
  return out;
}

export const LANES = ['chat', 'email', 'github', 'agent', 'calendar'];
export const laneOf = (sourceId) => ({ 'chat:team': 'chat', 'email:work': 'email', 'github:repo': 'github', 'github:live': 'github', 'agent:coding-sessions': 'agent', 'calendar:main': 'calendar' })[sourceId] || 'chat';
const addMin = (iso, m) => { const d = new Date(new Date(iso).getTime() + m * 60000); const p = (n) => String(n).padStart(2, '0');
  const l = new Date(d.getTime() - 5 * 3600000); return `${l.getUTCFullYear()}-${p(l.getUTCMonth() + 1)}-${p(l.getUTCDate())}T${p(l.getUTCHours())}:${p(l.getUTCMinutes())}:00-05:00`; };
const minsBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 60000);

// First minute at which the deterministic detector reports drift (>= threshold), or null.
export function driftFlagMinute(events, minMinutes = DRIFT_MIN) {
  const full = detectDrift(events, null, minMinutes)[0] || detectDrift(events, events.at(-1)?.ts, minMinutes)[0];
  if (!full) return null;
  for (let m = 0; m <= full.minutes; m++) {
    const now = addMin(full.start, m);
    const seen = events.filter((e) => new Date(e.ts) <= new Date(now));
    const d = detectDrift(seen, now, minMinutes)[0];
    if (d) return { at: now, drift: d, full };
  }
  return null;
}

// Event at which a rubber-stamp becomes visible: the first approval whose evidence so far fails reviewFlags.
export function stampFlags(events) {
  const out = [];
  const byCtx = {};
  for (const e of events) {
    (byCtx[e.context] ||= []).push(e);
    if (e.action === 'approved') { const f = reviewFlags(byCtx[e.context]); if (f.length) out.push({ context: e.context, event: e.id, at: e.ts, flags: f }); }
  }
  return out;
}

export function buildReplay(dayEvents, calendar = [], { grants, driftMinutes = DRIFT_MIN } = {}) {
  const ids = grants || [...new Set(dayEvents.map((e) => e.source_id))];
  const ev = dayEvents.filter((e) => ids.includes(e.source_id)).sort((a, b) => a.ts.localeCompare(b.ts));
  const day = ev[0]?.ts.slice(0, 10);
  const end = addMin(ev.at(-1).ts, 15);
  const base = computeDay(ev, ids, null, { driftMinutes });
  const sw = Object.fromEntries(base.timeline.map((t) => [t.id, t.switch]));
  const events = ev.map((e, i) => ({ id: e.id, ts: e.ts, lane: laneOf(e.source_id), source_id: e.source_id, context: e.context, action: e.action, trigger: e.trigger || null, text: e.text,
    switch: !!sw[e.id], dwell: minsBetween(e.ts, ev[i + 1]?.ts || end) }));
  const cal = calendar.filter((c) => c.start.slice(0, 10) === day).map((c) => ({ id: c.id, lane: 'calendar', title: c.title, start: c.start, end: c.end, fixed: !!c.fixed }));
  const stamps = stampFlags(ev);
  const flag = driftFlagMinute(ev, driftMinutes);
  // Running counters for "without" at each event (computeDay on the prefix).
  const counters = (list) => list.map((e) => { const m = computeDay(list, ids, e.ts, { driftMinutes }).metrics;
    return { id: e.id, ts: e.ts, switches: m.switches_total, reviewed: m.closed_with_review, stamped: m.rubber_stamp_reviews, drift: m.drift_minutes_max }; });
  const without = { metrics: base.metrics, drift: base.drift, stamps, counters: counters(ev) };
  let withV = null;
  if (flag) {
    // Simulated refocus: at the flag minute the dev returns to the anchor; later side-quest events are parked.
    const parked = ev.filter((e) => e.context === flag.drift.side_quest && e.ts > flag.at).map((e) => e.id);
    const back = { id: 'sim-refocus', ts: flag.at, source_id: 'github:repo', context: flag.drift.anchor, action: 'work', simulated: true, text: `Simulated: back to ${flag.drift.anchor} (protected review block).` };
    const sim = [...ev.filter((e) => !parked.includes(e.id)), back].sort((a, b) => a.ts.localeCompare(b.ts) || (a.simulated ? 1 : -1));
    const m = computeDay(sim, ids, null, { driftMinutes });
    const pending = base.items.find((i) => i.context === flag.drift.anchor);
    withV = { simulated: true, flag_at: flag.at, threshold: driftMinutes, drift_at_flag: flag.drift, parked, refocus_event: back,
      block: { title: `Review ${flag.drift.anchor}`, start: flag.at, end: addMin(flag.at, 20), protected: true },
      anchor: flag.drift.anchor, anchor_state: pending?.state || 'open', side_quest: flag.drift.side_quest,
      metrics: m.metrics, drift: m.drift, stamps_flagged: stamps.map((s) => s.context), counters: counters(sim) };
  }
  const resumed = (list) => { const d = base.drift[0]; return d ? list.find((e) => e.context === d.anchor && e.ts > d.start)?.ts || null : null; };
  without.anchor_resumed_at = resumed(ev);
  if (withV) withV.anchor_resumed_at = withV.flag_at;
  const attention = replayAttention(ev, flag, withV?.block.end);
  return { attention, day, start: ev[0].ts, end, lanes: LANES, events, calendar: cal, without, with: withV, threshold: driftMinutes };
}
