// Agent tool definitions (OpenAI Chat Completions "tools" format) + executors.
import { adapters, byId } from './adapters/index.js';
import { validateProposal, PROPOSAL_TYPES } from './validator.js';

export const toolSchemas = [
  { type: 'function', function: { name: 'list_granted_sources', description: 'List the sources the user has granted access to. Only these may be read.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'read_source', description: 'Read items from ONE granted source, optionally filtered by a keyword query.', parameters: { type: 'object', properties: { source_id: { type: 'string' }, query: { type: 'string' } }, required: ['source_id'] } } },
  { type: 'function', function: { name: 'read_calendar', description: 'Read calendar events (requires calendar grant).', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'read_tasks', description: 'Read the task list (requires tasks grant).', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'propose_change', description: 'Propose ONE calendar/task change. Must cite evidence quoting exact text from granted source items. Validated deterministically; the user approves or rejects.', parameters: { type: 'object', properties: {
    type: { type: 'string', enum: PROPOSAL_TYPES },
    summary: { type: 'string' },
    payload: { type: 'object', description: 'create_task:{title,deadline?,due_by?}; schedule_block:{title,start,end}; move_event:{event_id,start,end}; decline_event:{event_id,reason}; set_deadline:{task_id,deadline,due_by?}; link_evidence:{task_id}. Times ISO 8601 with offset -05:00.' },
    evidence: { type: 'array', items: { type: 'object', properties: { source_id: { type: 'string' }, item_id: { type: 'string' }, quote: { type: 'string' } }, required: ['source_id', 'item_id', 'quote'] } },
  }, required: ['type', 'summary', 'payload', 'evidence'] } } },
];

export function makeToolbox(grants, store) {
  const need = (id) => { if (!grants.isGranted(id)) throw new Error(`source ${id} not granted`); return byId(id); };
  const calId = adapters.find((a) => a.kind === 'calendar').id;
  const taskId = adapters.find((a) => a.kind === 'tasks').id;
  const ctx = () => ({
    events: grants.isGranted(calId) ? byId(calId).items() : [],
    tasks: grants.isGranted(taskId) ? byId(taskId).items() : [],
    grantedIds: grants.grantedIds(),
  });
  return {
    ctx,
    list_granted_sources: () => grants.list().filter((s) => s.granted),
    read_source: ({ source_id, query }) => {
      const items = need(source_id).items();
      const q = (query || '').toLowerCase().split(/\s+/).filter(Boolean);
      return q.length ? items.filter((it) => q.some((w) => `${it.title} ${it.text}`.toLowerCase().includes(w))) : items;
    },
    read_calendar: () => need(calId).items(),
    read_tasks: () => need(taskId).items(),
    propose_change: (p) => {
      // Evidence quotes must literally appear in the cited item.
      for (const e of p.evidence || []) {
        const a = byId(e.source_id);
        const item = a && grants.isGranted(e.source_id) && a.items().find((i) => i.id === e.item_id);
        e.verified = !!(item && `${item.title}\n${item.text}`.includes(e.quote));
      }
      const v = validateProposal(p, { ...ctx() });
      if ((p.evidence || []).some((e) => !e.verified)) v.errors.push('evidence quote not found in cited item'), (v.ok = false);
      const rec = { id: `p${store.length + 1}`, status: v.ok ? 'pending' : 'invalid', ...p, validation: v };
      store.push(rec);
      return { id: rec.id, status: rec.status, errors: v.errors };
    },
  };
}
