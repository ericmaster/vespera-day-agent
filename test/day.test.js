import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adapters } from '../src/adapters/index.js';
import { createGrants } from '../src/grants.js';
import { makeToolbox } from '../src/tools.js';
import { computeDay, dayEvents } from '../src/metrics.js';
import { createState, approve } from '../src/state.js';
import { runOffline } from '../src/offline-agent.js';

const ALL = ['chat:team', 'email:work', 'agent:coding-sessions', 'github:repo'];
const NOON = '2026-10-30T11:30:00-05:00';
const grantAll = () => { const g = createGrants(adapters); adapters.forEach((a) => g.set(a.id, true)); return g; };
const alert = (metric, value, evidence = [{ source_id: 'chat:team', item_id: 'd15', quote: 'pinging again on PR #44' }]) =>
  ({ type: 'alert', summary: 'x', payload: { metric, value, message: 'm' }, evidence });

test('metrics: switches, closed with proper review, backlog at 11:30', () => {
  const m = computeDay(dayEvents(), ALL, NOON).metrics;
  assert.deepEqual(m, { switches_total: 20, switches_max_per_hour: 9, opened: 6, closed_with_review: 1, closed_without_review: 2, review_backlog: 2 });
});
test('metrics respect the simulated clock', () => {
  assert.equal(computeDay(dayEvents(), ALL, '2026-10-30T09:30:00-05:00').metrics.closed_with_review, 0);
});
test('metrics only use granted sources', () => {
  const d = computeDay(dayEvents(), ['email:work'], NOON);
  assert.ok(d.timeline.every((e) => e.source_id === 'email:work'));
  assert.equal(computeDay(dayEvents(), [], NOON).timeline.length, 0);
});
test('alert value must equal the computed metric', () => {
  const tb = makeToolbox(grantAll(), [], createState());
  assert.equal(tb.propose_change(alert('switches_max_per_hour', 9)).status, 'pending');
  const bad = tb.propose_change(alert('switches_max_per_hour', 3));
  assert.equal(bad.status, 'invalid'); assert.match(bad.errors.join(), /is 9, not 3/);
});
test('evidence from events after the simulated clock is not found', () => {
  const st = createState(); st.now = '2026-10-30T09:00:00-05:00';
  const r = makeToolbox(grantAll(), [], st).propose_change(alert('switches_max_per_hour', 0));
  assert.equal(r.status, 'invalid');
});
test('health/wellness language is rejected', () => {
  const r = makeToolbox(grantAll(), [], createState()).propose_change({ type: 'team_status_draft', summary: 'x', payload: { channel: '#release', text: 'I am burned out and stressed' }, evidence: [{ source_id: 'chat:team', item_id: 'd21', quote: 'QA is waiting on PR #44' }] });
  assert.equal(r.status, 'invalid'); assert.match(r.errors.join(), /workflow framing/);
});
test('blocks before now are rejected', () => {
  const r = makeToolbox(grantAll(), [], createState()).propose_change({ type: 'schedule_block', summary: 'x', payload: { title: 'x', start: '2026-10-30T09:30:00-05:00', end: '2026-10-30T10:00:00-05:00' }, evidence: [{ source_id: 'chat:team', item_id: 'd21', quote: 'QA is waiting on PR #44' }] });
  assert.match(r.errors.join(), /before now/);
});
test('offline check-now: alerts, heads-down block and draft all validate; approving the draft stores it unsent', () => {
  const st = createState(), store = [], g = grantAll(), tb = makeToolbox(g, store, st);
  runOffline(tb);
  for (const t of ['alert', 'team_status_draft']) assert.ok(store.some((p) => p.type === t && p.status === 'pending'), t);
  const blk = store.find((p) => p.payload.no_interrupt);
  assert.equal(blk.status, 'pending');
  approve(store, blk.id, st, tb.ctx);
  assert.ok(st.events.find((e) => e.no_interrupt));
  const dr = store.find((p) => p.type === 'team_status_draft');
  approve(store, dr.id, st, tb.ctx);
  assert.equal(st.drafts[0].sent, false);
});
