import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adapters } from '../src/adapters/index.js';
import { createGrants } from '../src/grants.js';
import { makeToolbox } from '../src/tools.js';

test('sources are off by default and reads are refused', () => {
  const g = createGrants(adapters);
  assert.equal(g.grantedIds().length, 0);
  assert.throws(() => makeToolbox(g, []).read_source({ source_id: 'email:work' }), /not granted/);
});
test('granted source is readable and query filters', () => {
  const g = createGrants(adapters); g.set('email:work', true);
  const r = makeToolbox(g, []).read_source({ source_id: 'email:work', query: 'migration' });
  assert.ok(r.length >= 1 && r.every((i) => `${i.title} ${i.text}`.toLowerCase().includes('migration')));
});
test('propose_change verifies quote against the cited item', () => {
  const g = createGrants(adapters); g.set('chat:team', true); g.set('calendar:main', true);
  const store = []; const tb = makeToolbox(g, store);
  const ok = tb.propose_change({ type: 'schedule_block', summary: 'limiter', payload: { title: 'Merge limiter', start: '2026-10-30T16:00:00-05:00', end: '2026-10-30T16:30:00-05:00' }, evidence: [{ source_id: 'chat:team', item_id: 'chat-1', quote: "I'll get it merged by Friday noon" }] });
  assert.equal(ok.status, 'pending');
  const bad = tb.propose_change({ type: 'schedule_block', summary: 'x', payload: { title: 'x', start: '2026-10-30T16:30:00-05:00', end: '2026-10-30T17:30:00-05:00' }, evidence: [{ source_id: 'chat:team', item_id: 'chat-1', quote: 'made up text' }] });
  assert.equal(bad.status, 'invalid');
});
