// Deterministic validator: every agent proposal must pass these checks
// before the user even sees an "approve" button.
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const overlaps = (a, b) => new Date(a.start) < new Date(b.end) && new Date(b.start) < new Date(a.end);
const localHHMM = (iso) => iso.slice(11, 16); // ISO with explicit local offset, e.g. 2026-10-30T10:00:00-05:00

export const PROPOSAL_TYPES = ['create_task', 'schedule_block', 'move_event', 'decline_event', 'set_deadline', 'link_evidence', 'alert', 'team_status_draft'];
// Guardrail: workflow framing only. Any proposal text with health/wellness language is rejected.
export const BANNED = /\b(burn ?out|stress\w*|wellness|wellbeing|well-being|health\w*|mental|anxi\w+|tired|exhaust\w*|fatigue|sleep\w*|mood|feel(ing)?s?)\b/i;

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
  const words = `${p.summary || ''} ${JSON.stringify(pl)}`.match(BANNED);
  if (words) errors.push(`out-of-scope language "${words[0]}": workflow framing only`);
  if (p.type === 'alert') {
    const m = ctx.metrics || {};
    if (!(pl.metric in m)) errors.push(`unknown metric ${pl.metric}`);
    else if (pl.value !== m[pl.metric]) errors.push(`metric ${pl.metric} is ${m[pl.metric]}, not ${pl.value}`);
    if (!pl.message) errors.push('message required');
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
