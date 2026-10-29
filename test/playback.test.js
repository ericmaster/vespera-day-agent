import { test } from 'node:test';
import assert from 'node:assert/strict';
import { json } from '../src/adapters/index.js';
import { buildReplay, driftFlagMinute, stampFlags, laneOf } from '../src/playback.js';
import { computeDay, DRIFT_MIN } from '../src/metrics.js';

const ALL = ['chat:team', 'email:work', 'agent:coding-sessions', 'github:repo'];
const r = () => buildReplay(json('day.json'), json('calendar.json'), { grants: ALL });

test('without mode equals the full-day detector output', () => {
  const x = r(), d = computeDay(json('day.json'), ALL, null);
  assert.deepEqual(x.without.metrics, d.metrics);
  assert.equal(x.without.drift[0].minutes, 31);
  assert.equal(x.without.counters.at(-1).switches, d.metrics.switches_total);
});
test('drift is flagged exactly when the detector crosses its threshold', () => {
  const f = driftFlagMinute(json('day.json').filter((e) => ALL.includes(e.source_id)).sort((a, b) => a.ts.localeCompare(b.ts)));
  assert.equal(f.at, '2026-10-30T11:56:00-05:00');
  assert.equal(f.drift.minutes, DRIFT_MIN);
  assert.equal(f.drift.anchor, 'PR #44 auth ownership check');
});
test('rubber-stamp flagged at the PR #47 approval with the detector rules', () => {
  const s = stampFlags(json('day.json'));
  assert.equal(s.length, 1); assert.equal(s[0].event, 'd26');
  assert.deepEqual(s[0].flags.map((f) => f.rule), ['too_fast', 'no_ci', 'unverified_claim', 'no_review_activity']);
});
test('with mode parks the side-quest and caps drift at the flag minute', () => {
  const w = r().with;
  assert.equal(w.simulated, true); assert.deepEqual(w.parked, ['d31']);
  assert.equal(w.metrics.drift_minutes_max, DRIFT_MIN);
  assert.equal(w.block.start, w.flag_at); assert.equal(w.block.end, '2026-10-30T12:16:00-05:00');
});
test('lanes and dwell', () => {
  const x = r();
  assert.equal(laneOf('agent:coding-sessions'), 'agent');
  assert.ok(x.events.every((e) => x.lanes.includes(e.lane) && e.dwell >= 0));
  assert.equal(x.calendar.length, 3);
});
test('anchor resume time per mode', () => {
  const x = r();
  assert.equal(x.without.anchor_resumed_at, '2026-10-30T12:12:00-05:00');
  assert.equal(x.with.anchor_resumed_at, '2026-10-30T11:56:00-05:00');
});
