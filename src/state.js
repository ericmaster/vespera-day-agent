// Local, in-memory calendar/task/notes state. Approved proposals mutate it;
// nothing is written to any outside system.
import { json } from './adapters/index.js';
import { validateProposal } from './validator.js';

export function createState() {
  return { events: json('calendar.json'), tasks: json('tasks.json'), notes: [], applied: [], log: [] };
}

export function applyProposal(state, p) {
  const pl = p.payload;
  switch (p.type) {
    case 'schedule_block':
      state.events.push({ id: `ev-${p.id}`, title: pl.title, start: pl.start, end: pl.end, fixed: false, from_proposal: p.id }); break;
    case 'move_event': {
      const ev = state.events.find((e) => e.id === pl.event_id); ev.start = pl.start; ev.end = pl.end; break;
    }
    case 'decline_event':
      state.events = state.events.filter((e) => e.id !== pl.event_id); break;
    case 'create_task':
      state.tasks.push({ id: `t-${p.id}`, title: pl.title, text: p.summary || '', deadline: pl.deadline || null, evidence: p.evidence, from_proposal: p.id }); break;
    case 'set_deadline':
      state.tasks.find((t) => t.id === pl.task_id).deadline = pl.deadline; break;
    case 'link_evidence': {
      const t = state.tasks.find((x) => x.id === pl.task_id); if (t) t.evidence = [...(t.evidence || []), ...p.evidence]; break;
    }
  }
  state.applied.push({ id: p.id, type: p.type, payload: pl });
}

// Re-run the deterministic validator on every undecided proposal against current state.
export function revalidate(proposals, ctx) {
  for (const p of proposals) {
    if (!['pending', 'invalid'].includes(p.status)) continue;
    const v = validateProposal(p, ctx);
    if ((p.evidence || []).some((e) => !e.verified)) v.errors.push('evidence quote not found in cited item'), (v.ok = false);
    p.validation = v;
    p.status = v.ok ? 'pending' : 'invalid';
  }
}

// Approve one proposal: re-check it right now, apply, then re-check the rest.
export function approve(proposals, id, state, ctxFn) {
  const p = proposals.find((x) => x.id === id);
  if (!p) return { error: 'not found' };
  revalidate([p], ctxFn());
  if (p.status !== 'pending') return { error: `cannot approve: ${p.validation.errors.join('; ')}`, proposal: p };
  applyProposal(state, p);
  p.status = 'approved';
  revalidate(proposals, ctxFn());
  return { proposal: p };
}
