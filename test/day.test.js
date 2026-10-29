import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adapters } from '../src/adapters/index.js';
import { createGrants } from '../src/grants.js';
import { makeToolbox } from '../src/tools.js';
import { computeDay, dayEvents, detectDrift, reviewFlags } from '../src/metrics.js';
import { createState, approve } from '../src/state.js';
import { runOffline } from '../src/offline-agent.js';

const ALL = ['chat:team', 'email:work', 'agent:coding-sessions', 'github:repo'];
const NOON = '2026-10-30T11:30:00-05:00';
const grantAll = () => { const g = createGrants(adapters); adapters.forEach((a) => g.set(a.id, true)); return g; };
const alert = (metric, value, evidence = [{ source_id: 'chat:team', item_id: 'd15', quote: 'pinging again on PR #44' }]) =>
  ({ type: 'alert', summary: 'x', payload: { metric, value, message: 'm' }, evidence });

test('metrics: switches, closed with proper review, backlog at 11:30', () => {
  const m = computeDay(dayEvents(), ALL, NOON).metrics;
  assert.deepEqual(m, { switches_total: 21, switches_max_per_hour: 9, opened: 7, closed_with_review: 1, closed_without_review: 2, rubber_stamp_reviews: 1, review_backlog: 2, drift_minutes_max: 0 });
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

const LATE = '2026-10-30T12:30:00-05:00';
test('drift: AI remark during PR #44 review starts a 31-min side-quest citing the trigger', () => {
  const [d] = computeDay(dayEvents(), ALL, LATE).drift;
  assert.equal(d.anchor, 'PR #44 auth ownership check'); assert.equal(d.side_quest, 'Session middleware refactor');
  assert.equal(d.trigger, 'ai_remark'); assert.equal(d.trigger_event, 'd29'); assert.equal(d.minutes, 31);
  assert.deepEqual(d.anchor_evidence, ['d03', 'd28']);
});
test('drift: threshold is configurable and ongoing drift counts up to now', () => {
  assert.equal(computeDay(dayEvents(), ALL, LATE, { driftMinutes: 40 }).drift.length, 0);
  assert.equal(computeDay(dayEvents(), ALL, '2026-10-30T12:00:00-05:00').drift[0].minutes, 19);
});
test('drift: no trigger, no drift; no anchor, no drift', () => {
  const t = (id, ts, context, extra = {}) => ({ id, ts: `2026-10-30T${ts}:00-05:00`, context, source_id: 's', action: 'work', ...extra });
  assert.equal(detectDrift([t('a', '10:00', 'A', { action: 'anchor_start' }), t('b', '10:05', 'B'), t('c', '10:40', 'A')]).length, 0);
  assert.equal(detectDrift([t('b', '10:05', 'B', { trigger: 'mention' }), t('c', '10:40', 'A')]).length, 0);
  assert.equal(detectDrift([t('a', '10:00', 'A', { action: 'anchor_start' }), t('b', '10:05', 'B', { trigger: 'self' }), t('c', '10:40', 'A')])[0].minutes, 35);
});
test('rubber stamp: PR #47 (800 lines in 40 s, claimed tests, no CI) is not closed with proper review', () => {
  const it = computeDay(dayEvents(), ALL, LATE).items.find((i) => i.context.startsWith('PR #47'));
  assert.equal(it.state, 'rubber_stamp');
  assert.deepEqual(it.review_flags.map((f) => f.rule), ['too_fast', 'no_ci', 'unverified_claim', 'no_review_activity']);
  assert.equal(computeDay(dayEvents(), ALL, LATE).items.find((i) => i.context.startsWith('PR #41')).state, 'closed_with_review');
});
test('rubber stamp: a slow approval with CI and comments passes', () => {
  assert.deepEqual(reviewFlags([{ id: 'x', action: 'ci_run', source_id: 'github:repo', text: 'ok' }, { id: 'y', action: 'approved', lines: 300, review_seconds: 600, review_comments: 2, files_viewed: 4, source_id: 'github:repo', text: '' }]), []);
});
test('detector alerts must cite detector evidence', () => {
  const tb = makeToolbox(grantAll(), [], createState());
  const bad = tb.propose_change(alert('drift_minutes_max', 31));
  assert.match(bad.errors.join(), /must cite detector evidence \(d29\)/);
  const ok = tb.propose_change(alert('drift_minutes_max', 31, [{ source_id: 'agent:coding-sessions', item_id: 'd29', quote: 'want me to refactor it?' }]));
  assert.equal(ok.status, 'pending');
});
