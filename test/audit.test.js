import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adapters } from '../src/adapters/index.js';
import { createGrants } from '../src/grants.js';
import { createState, approve } from '../src/state.js';
import { makeToolbox } from '../src/tools.js';
import { runAgent, PROMPT_VERSION } from '../src/agent.js';
import { config } from '../src/config.js';
import { createAudit, why, recordDecision } from '../src/audit.js';

const grantAll = () => { const g = createGrants(adapters); adapters.forEach((a) => g.set(a.id, true)); return g; };

test('offline run: complete record per proposal, append-only JSONL, decision linked', async () => {
  process.env.OFFLINE = '1';
  const audit = createAudit(), sunk = [], store = [], st = createState(), g = grantAll();
  audit.sink = (r) => sunk.push(r);
  const r = await runAgent(g, store, { state: st, audit });
  delete process.env.OFFLINE;
  assert.equal(r.mode, 'offline'); assert.match(r.run_id, /^r_/);
  const start = audit.list({ record: 'run', run_id: r.run_id })[0];
  assert.equal(start.prompt_version, PROMPT_VERSION); assert.match(PROMPT_VERSION, /^sha256:[0-9a-f]{16}$/);
  assert.deepEqual(start.granted_sources, g.grantedIds());
  const tc = audit.list({ record: 'tool_call', run_id: r.run_id });
  assert.ok(tc.length > 3 && tc.every((t) => t['gen_ai.tool.name'] && t.started_at && t.result_summary && t.result_hash));
  const props = audit.list({ record: 'proposal', run_id: r.run_id });
  assert.equal(props.length, store.length);
  assert.ok(props.every((p) => p.validator.status && p.evidence.every((e) => e.quote && 'verified' in e)));
  const p = store.find((x) => x.status === 'pending');
  approve(store, p.id, st, makeToolbox(g, store, st).ctx);
  recordDecision(audit, { run_id: p.run_id, proposal_id: p.id, action: 'approved', source: 'live_agent' });
  const w = why(audit, p.id, r.run_id);
  assert.equal(w.decisions[0].user_decision.action, 'approved'); assert.ok(w.decisions[0].user_decision.at);
  assert.equal(w.proposal.proposal_id, p.id); assert.ok(w.run_end);
  assert.equal(sunk.length, audit.size);
  const lines = audit.jsonl().trim().split('\n');
  assert.equal(lines.length, audit.size); lines.forEach((l) => JSON.parse(l));
  assert.throws(() => { audit.list()[0].record = 'x'; });
});

test('live run (stubbed model): usage, model and validator-rejected attempt recorded', async () => {
  const realFetch = globalThis.fetch, key = config.apiKey; config.apiKey = 'test';
  const bad = { type: 'alert', summary: 'x', payload: { metric: 'switches_max_per_hour', value: 3, message: 'm' }, evidence: [{ source_id: 'chat:team', item_id: 'd15', quote: 'pinging again on PR #44' }] };
  const replies = [
    { choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'a', type: 'function', function: { name: 'propose_change', arguments: JSON.stringify(bad) } }] } }], usage: { prompt_tokens: 10, completion_tokens: 5 } },
    { choices: [{ message: { role: 'assistant', content: 'done' } }], usage: { prompt_tokens: 7, completion_tokens: 2 } }];
  globalThis.fetch = async () => ({ ok: true, json: async () => replies.shift() });
  try {
    const audit = createAudit(), store = [], st = createState(); st.now = '2026-10-30T11:30:00-05:00';
    const r = await runAgent(grantAll(), store, { state: st, audit });
    assert.equal(r.mode, 'live');
    const end = audit.list({ record: 'run', run_id: r.run_id }).find((x) => x.event === 'end');
    assert.equal(end['gen_ai.usage.input_tokens'], 17); assert.equal(end['gen_ai.usage.output_tokens'], 7);
    const att = audit.list({ record: 'attempt', run_id: r.run_id });
    assert.equal(att.length, 1); assert.match(att[0].errors.join(), /is 9, not 3/);
    assert.equal(audit.list({ record: 'proposal', run_id: r.run_id })[0].agent['gen_ai.request.model'], config.model);
  } finally { globalThis.fetch = realFetch; config.apiKey = key; }
});

test('widget decisions are recorded without a run', () => {
  const a = createAudit();
  recordDecision(a, { proposal_id: 'drift:d29', action: 'not_drift', source: 'widget' });
  assert.equal(why(a, 'drift:d29', null).decisions[0].user_decision.action, 'not_drift');
});
