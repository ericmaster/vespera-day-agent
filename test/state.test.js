import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adapters } from '../src/adapters/index.js';
import { createGrants } from '../src/grants.js';
import { makeToolbox } from '../src/tools.js';
import { createState, approve } from '../src/state.js';
import { runOffline } from '../src/offline-agent.js';
import { addNote } from '../src/transcribe.js';

process.env.OFFLINE = '1';
const setup = (ids = adapters.map((a) => a.id)) => {
  const g = createGrants(adapters); ids.forEach((i) => g.set(i, true));
  const store = [], state = createState();
  return { g, store, state, tb: makeToolbox(g, store, state) };
};

test('block overlapping the optional demo is invalid until decline is approved', () => {
  const { store, state, tb } = setup();
  state.now = '2026-10-30T08:00:00-05:00';
  const ev = [{ source_id: 'chat:team', item_id: 'chat-1', quote: "yes, I'll get it merged by Friday noon" }];
  tb.propose_change({ type: 'decline_event', summary: 'skip demo', payload: { event_id: 'ev2', reason: 'limiter' }, evidence: ev });
  tb.propose_change({ type: 'schedule_block', summary: 'limiter', payload: { title: 'Finish + merge rate limiter', start: '2026-10-30T09:30:00-05:00', end: '2026-10-30T11:30:00-05:00' }, evidence: ev });
  const [decline, block] = store;
  assert.equal(block.status, 'invalid');
  assert.ok(block.validation.errors.some((e) => e.includes('Vendor demo')));
  assert.ok(!approve(store, block.id, state, tb.ctx).proposal?.status?.includes('approved'));
  assert.equal(approve(store, decline.id, state, tb.ctx).proposal.status, 'approved');
  assert.ok(!state.events.find((e) => e.id === 'ev2'));
  assert.equal(block.status, 'pending');
  approve(store, block.id, state, tb.ctx);
  assert.ok(state.events.find((e) => e.title === 'Finish + merge rate limiter'));
});

test('applied block makes a later overlapping proposal invalid', () => {
  const { store, state, tb } = setup();
  const ev = [{ source_id: 'chat:team', item_id: 'chat-1', quote: "yes, I'll get it merged by Friday noon" }];
  const a = tb.propose_change({ type: 'schedule_block', summary: 'a', payload: { title: 'A', start: '2026-10-30T16:00:00-05:00', end: '2026-10-30T17:00:00-05:00' }, evidence: ev });
  const b = tb.propose_change({ type: 'schedule_block', summary: 'b', payload: { title: 'B', start: '2026-10-30T16:30:00-05:00', end: '2026-10-30T17:30:00-05:00' }, evidence: ev });
  assert.equal(b.status, 'pending');
  approve(store, a.id, state, tb.ctx);
  assert.equal(store[1].status, 'invalid');
  assert.equal(approve(store, b.id, state, tb.ctx).error?.startsWith('cannot approve'), true);
});

test('create_task and set_deadline update local tasks; move_event updates calendar', () => {
  const { store, state, tb } = setup();
  runOffline(tb);
  approve(store, 'p1', state, tb.ctx); approve(store, 'p3', state, tb.ctx);
  assert.ok(state.tasks.find((t) => t.title.startsWith('Billing migration')));
  assert.equal(state.tasks.find((t) => t.id === 't2').deadline, '2026-11-04T12:00:00-05:00');
  const ev = [{ source_id: 'chat:team', item_id: 'chat-1', quote: 'merged by Friday noon' }];
  const mv = tb.propose_change({ type: 'move_event', summary: 'm', payload: { event_id: 'ev2', start: '2026-10-30T13:00:00-05:00', end: '2026-10-30T14:00:00-05:00' }, evidence: ev });
  approve(store, mv.id, state, tb.ctx);
  assert.equal(state.events.find((e) => e.id === 'ev2').start, '2026-10-30T13:00:00-05:00');
});

test('offline agent only proposes from granted sources', () => {
  const { store, tb } = setup(['email:work']);
  const r = runOffline(tb);
  assert.equal(store.length, 1);
  assert.match(r.summary, /skipped [1-9]/);
});

test('consent log records reads and blocks non-granted attempts', () => {
  const { state, tb } = setup(['email:work']);
  tb.read_source({ source_id: 'email:work' });
  assert.throws(() => tb.read_source({ source_id: 'chat:team' }));
  tb.propose_change({ type: 'create_task', summary: 'x', payload: { title: 'x' }, evidence: [{ source_id: 'chat:team', item_id: 'chat-1', quote: 'noon' }] });
  assert.deepEqual(state.log.map((l) => [l.tool, l.source_id, l.allowed]), [['read_source', 'email:work', true], ['read_source', 'chat:team', false], ['propose_change', 'chat:team', false]]);
});

test('voice/pasted note becomes a readable item in the notes source', () => {
  const { state, tb } = setup(['notes:ramblings']);
  const n = addNote(state, 'remember to send the invoice draft to Leo by Tuesday', 'pasted');
  assert.ok(tb.read_source({ source_id: 'notes:ramblings', query: 'invoice' }).some((i) => i.id === n.id));
  assert.throws(() => addNote(state, '  ', 'pasted'));
});

test('github adapter falls back to fixtures', async () => {
  const { githubItems, resetGithubCache } = await import('../src/adapters/github.js');
  resetGithubCache();
  const items = githubItems(undefined);
  assert.equal(items.mode, 'fixture');
  assert.ok(items[0].id === 'gh-0' && items[0].source_id === 'github:repo');
});

test('approved checklist / parked tasks keep their fields; nested payload is rejected with a reason', () => {
  const { store, state, tb } = setup();
  const ev = [{ source_id: 'chat:team', item_id: 'chat-1', quote: 'merged by Friday noon' }];
  const a = tb.propose_change({ type: 'create_task', summary: 'v', payload: { title: 'Verify', checklist: ['Run CI'] }, evidence: ev });
  approve(store, a.id, state, tb.ctx);
  assert.deepEqual(state.tasks.at(-1).checklist, ['Run CI']);
  const n = tb.propose_change({ type: 'create_task', summary: 'n', payload: { create_task: { title: 'x' } }, evidence: ev });
  assert.match(n.errors.join(), /must be flat/);
});
