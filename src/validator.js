// Deterministic validator: every agent proposal must pass these checks
// before the user even sees an "approve" button.
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const overlaps = (a, b) => new Date(a.start) < new Date(b.end) && new Date(b.start) < new Date(a.end);
const localHHMM = (iso) => iso.slice(11, 16); // ISO with explicit local offset, e.g. 2026-10-30T10:00:00-05:00

export const PROPOSAL_TYPES = ['create_task', 'schedule_block', 'move_event', 'decline_event', 'set_deadline', 'link_evidence', 'alert', 'team_status_draft'];
// Guardrail: workflow framing only. Any proposal text with health/wellness language is rejected.
export const BANNED = /\b(burn ?out|stress\w*|wellness|wellbeing|well-being|health\w*|mental|anxi\w+|tired|exhaust\w*|fatigue|sleep\w*|mood|feel(ing)?s?|distract\w*|procrastinat\w*|lazy|laziness|slack(ing|er)\s+off|slacker|addict\w*|unfocused|unproductive|undisciplined|wast(ed|ing)\s+time|time[- ]?wast\w*|careless|negligen\w*)\b/i;

// Numbers in an alert's free text must match the cited drift/items (or the day metrics).
// Checked: "N min", "N lines", "N s", "#N", "N switches". Mismatch -> reject with the reason.
export function checkAlertNumbers(p, day) {
  if (!day) return [];
  const ids = new Set((p.evidence || []).map((e) => e.item_id));
  const m = day.metrics, metric = p.payload?.metric;
  const drifts = day.drift.filter((d) => ids.has(d.trigger_event) || d.evidence.some((x) => ids.has(x)) || d.anchor_evidence.some((x) => ids.has(x)));
  const byMetric = { rubber_stamp_reviews: (i) => i.state === 'rubber_stamp', closed_without_review: (i) => i.state === 'closed_without_review', review_backlog: (i) => i.review_requested && i.state === 'open' };
  const items = day.items.filter((i) => i.evidence.some((x) => ids.has(x)) || byMetric[metric]?.(i)
    || drifts.some((d) => d.anchor === i.context || d.side_quest === i.context));
  // Attention (tier 1): minutes come from the aggregated windows/drift spans the alert cites.
  const wins = (day.attention || []).filter((w) => w.evidence.some((x) => ids.has(x)));
  const aggs = [...wins, ...(day.attention_drift || []).filter((a) => drifts.some((d) => d.trigger_event === a.trigger_event))];
  const allow = {
    min: new Set([...drifts.map((d) => d.minutes), ...(drifts.length ? [] : [m.drift_minutes_max]), ...aggs.flatMap((a) => [a.span_min, ...Object.values(a.minutes_by_category)])]),
    lines: new Set(items.flatMap((i) => i.facts.lines)),
    // Review seconds, plus the rule's own minimum (1 min per 100 lines) for each cited diff.
    s: new Set(items.flatMap((i) => [...i.facts.seconds, ...i.facts.lines.map((l) => Math.round((60 * l) / 100))])),
    ref: new Set(items.flatMap((i) => i.facts.refs)),
    switches: new Set([m.switches_total, m.switches_max_per_hour]),
  };
  const text = `${p.summary || ''} ${p.payload?.message || ''}`.replace(/\b1\s*min(?:ute)?\s*(?:\/|per)\s*100\s*lines\b/gi, ''), errors = [];
  const chk = (re, key, label) => { for (const x of text.matchAll(re)) { const n = Number(x[1]); if (!allow[key].has(n)) errors.push(`text says ${label.replace('N', n)} but cited evidence has ${[...allow[key]].join('/') || 'none'}`); } };
  chk(/\b(\d+)\s*(?:min|minutes)\b/gi, 'min', 'N min');
  // "X of Y min (confidence)": the pair and the label must match one cited aggregate exactly.
  for (const x of text.matchAll(/\b(\d+)\s+of\s+(\d+)\s*min(?:utes)?(?:[^()]*\((observed|partial|unknown)\))?/gi)) {
    const [a, b, conf] = [Number(x[1]), Number(x[2]), x[3]?.toLowerCase()];
    const hit = aggs.find((g) => g.span_min === b && Object.values(g.minutes_by_category).includes(a));
    if (!hit) errors.push(`text says ${a} of ${b} min but no cited attention span has that`);
    else if (conf && conf !== hit.confidence) errors.push(`text says (${conf}) but the cited span is ${hit.confidence}`);
  }
  chk(/\b(\d+)\s*lines\b/gi, 'lines', 'N lines');
  chk(/\b(\d+)\s*(?:s|sec|seconds)\b/gi, 's', 'N s');
  chk(/#(\d+)/g, 'ref', '#N');
  chk(/\b(\d+)\s*(?:context\s+)?switch(?:es)?\b/gi, 'switches', 'N switches');
  return errors;
}

export function validateProposal(p, ctx) {
  const errors = [];
  const { events = [], tasks = [], grantedIds = [], workingHours = { start: '09:00', end: '18:00' } } = ctx;
  if (!PROPOSAL_TYPES.includes(p.type)) errors.push(`unknown type ${p.type}`);
  if (!Array.isArray(p.evidence) || p.evidence.length === 0) errors.push('proposal has no evidence');
  for (const e of p.evidence || []) {
    if (!grantedIds.includes(e.source_id)) errors.push(`evidence from non-granted source ${e.source_id}`);
    if (!e.item_id || typeof e.quote !== 'string' || !e.quote.trim()) errors.push('evidence needs item_id and quote');
  }
  const pl = p.payload || {};
  // Seen in a live run: the model nested the payload under its type ({create_task:{...}}). Say so, so it retries flat.
  if (pl[p.type] && typeof pl[p.type] === 'object') errors.push(`payload must be flat, not nested under "${p.type}"`);
  const words = `${p.summary || ''} ${JSON.stringify(pl)}`.match(BANNED);
  if (words) errors.push(`out-of-scope language "${words[0]}": workflow framing only`);
  if (p.type === 'alert') {
    const m = ctx.metrics || {};
    if (!(pl.metric in m)) errors.push(`unknown metric ${pl.metric}`);
    else if (pl.value !== m[pl.metric]) errors.push(`metric ${pl.metric} is ${m[pl.metric]}, not ${pl.value}`);
    if (!pl.message) errors.push('message required');
    errors.push(...checkAlertNumbers(p, ctx.day));
    // Detector alerts must cite the detector's own evidence (drift trigger / review-flag event).
    const need = ctx.detectorEvidence?.[pl.metric];
    if (need && !(p.evidence || []).some((e) => need.includes(e.item_id))) errors.push(`${pl.metric} alert must cite detector evidence (${need.join(', ') || 'none found'})`);
  }
  if (p.type === 'team_status_draft' && (!pl.text || !pl.channel)) errors.push('channel and text required');
  if ((p.type === 'schedule_block' || p.type === 'move_event') && ctx.now && pl.start && new Date(pl.start) < new Date(ctx.now)) errors.push('block starts before now');
  if (p.type === 'schedule_block' || p.type === 'move_event') {
    if (!pl.start || !pl.end) errors.push('start and end required');
    else {
      if (new Date(pl.end) <= new Date(pl.start)) errors.push('end must be after start');
      if (pl.start.slice(0, 10) !== pl.end.slice(0, 10)) errors.push('block must not span days');
      if (toMin(localHHMM(pl.start)) < toMin(workingHours.start) || toMin(localHHMM(pl.end)) > toMin(workingHours.end))
        errors.push('outside working hours');
      for (const ev of events) {
        if (p.type === 'move_event' && ev.id === pl.event_id) continue;
        if (overlaps(pl, ev)) errors.push(`overlaps ${ev.fixed ? 'fixed ' : ''}event "${ev.title}"`);
      }
    }
    if (p.type === 'move_event') {
      const ev = events.find((e) => e.id === pl.event_id);
      if (!ev) errors.push(`unknown event ${pl.event_id}`);
      else if (ev.fixed) errors.push(`event "${ev.title}" is fixed`);
    }
  }
  if (p.type === 'decline_event') {
    const ev = events.find((e) => e.id === pl.event_id);
    if (!ev) errors.push(`unknown event ${pl.event_id}`);
    else if (ev.fixed) errors.push(`event "${ev.title}" is fixed`);
  }
  if (p.type === 'set_deadline' || (p.type === 'create_task' && pl.deadline)) {
    if (!pl.deadline || isNaN(new Date(pl.deadline))) errors.push('valid deadline required');
    else if (pl.due_by && new Date(pl.deadline) > new Date(pl.due_by)) errors.push('deadline is after the external due date');
    if (p.type === 'set_deadline' && pl.task_id && !tasks.find((t) => t.id === pl.task_id)) errors.push(`unknown task ${pl.task_id}`);
  }
  if (p.type === 'create_task' && !pl.title) errors.push('title required');
  return { ok: errors.length === 0, errors };
}
