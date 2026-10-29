// Deterministic validator: every agent proposal must pass these checks
// before the user even sees an "approve" button.
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const overlaps = (a, b) => new Date(a.start) < new Date(b.end) && new Date(b.start) < new Date(a.end);
const localHHMM = (iso) => iso.slice(11, 16); // ISO with explicit local offset, e.g. 2026-10-30T10:00:00-05:00

export const PROPOSAL_TYPES = ['create_task', 'schedule_block', 'move_event', 'decline_event', 'set_deadline', 'link_evidence'];

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
