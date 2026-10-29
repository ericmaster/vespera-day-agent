// Agent tool definitions (OpenAI Chat Completions "tools" format) + executors.
import { byId } from './adapters/index.js';
import { PROPOSAL_TYPES } from './validator.js';
import { createState, revalidate } from './state.js';
import { computeDay, dayEvents } from './metrics.js';

export const toolSchemas = [
  { type: 'function', function: { name: 'list_granted_sources', description: 'List the sources the user has granted access to. Only these may be read.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'read_source', description: 'Read items from ONE granted source, optionally filtered by a keyword query.', parameters: { type: 'object', properties: { source_id: { type: 'string' }, query: { type: 'string' } }, required: ['source_id'] } } },
  { type: 'function', function: { name: 'read_calendar', description: 'Read calendar events (requires calendar grant).', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'read_tasks', description: 'Read the task list (requires tasks grant).', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_day_metrics', description: 'Deterministic context-switch timeline and metrics for today up to the simulated clock, computed ONLY from granted sources: switches_total, switches_max_per_hour, opened, closed_with_review, closed_without_review, review_backlog, plus per-item state and event ids for evidence.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'propose_change', description: 'Propose ONE calendar/task change. Must cite evidence quoting exact text from granted source items. Validated deterministically; the user approves or rejects.', parameters: { type: 'object', properties: {
    type: { type: 'string', enum: PROPOSAL_TYPES },
    summary: { type: 'string' },
    payload: { type: 'object', description: 'create_task:{title,deadline?,due_by?}; schedule_block:{title,start,end}; move_event:{event_id,start,end}; decline_event:{event_id,reason}; set_deadline:{task_id,deadline,due_by?}; link_evidence:{task_id}; alert:{metric,value,message} (value must equal get_day_metrics); team_status_draft:{channel,text} (a draft, never sent); schedule_block may set no_interrupt:true for heads-down review/testing. Times ISO 8601 with offset -05:00.' },
    evidence: { type: 'array', items: { type: 'object', properties: { source_id: { type: 'string' }, item_id: { type: 'string' }, quote: { type: 'string' } }, required: ['source_id', 'item_id', 'quote'] } },
  }, required: ['type', 'summary', 'payload', 'evidence'] } } },
];

export function makeToolbox(grants, store, state = createState()) {
  const calId = 'calendar:main', taskId = 'tasks:main';
  // Consent log: every tool call, which source it touched, and whether consent allowed it.
  const log = (tool, source_id, allowed, note) => state.log.push({ at: new Date().toISOString(), tool, source_id, allowed, ...(note ? { note } : {}) });
  const need = (tool, id) => {
    const ok = !!byId(id) && grants.isGranted(id);
    log(tool, id, ok, ok ? undefined : 'BLOCKED: source not granted');
    if (!ok) throw new Error(`source ${id} not granted`);
    return byId(id);
  };
  const ctx = () => ({
    events: grants.isGranted(calId) ? byId(calId).items(state) : [],
    tasks: grants.isGranted(taskId) ? byId(taskId).items(state) : [],
    grantedIds: grants.grantedIds(),
    now: state.now,
    metrics: computeDay(dayEvents(), grants.grantedIds(), state.now).metrics,
  });
  return {
    ctx, state,
    list_granted_sources: () => { log('list_granted_sources', null, true); return grants.list().filter((s) => s.granted); },
    read_source: ({ source_id, query }) => {
      const items = need('read_source', source_id).items(state);
      const q = (query || '').toLowerCase().split(/\s+/).filter(Boolean);
      return q.length ? items.filter((it) => q.some((w) => `${it.title} ${it.text}`.toLowerCase().includes(w))) : items;
    },
    read_calendar: () => need('read_calendar', calId).items(state),
    read_tasks: () => need('read_tasks', taskId).items(state),
    get_day_metrics: () => { log('get_day_metrics', null, true, `granted: ${grants.grantedIds().length}`); return computeDay(dayEvents(), grants.grantedIds(), state.now); },
    propose_change: (p) => {
      // Evidence quotes must literally appear in the cited item of a granted source.
      for (const e of p.evidence || []) {
        const a = byId(e.source_id), granted = !!a && grants.isGranted(e.source_id);
        log('propose_change', e.source_id, granted, granted ? `cites ${e.item_id}` : 'FLAGGED: evidence cites a non-granted source');
        const item = granted && a.items(state).find((i) => i.id === e.item_id);
        e.verified = !!(item && `${item.title}\n${item.text}`.includes(e.quote));
      }
      const rec = { id: `p${store.length + 1}`, status: 'pending', ...p };
      revalidate([rec], ctx());
      store.push(rec);
      return { id: rec.id, status: rec.status, errors: rec.validation.errors };
    },
  };
}
