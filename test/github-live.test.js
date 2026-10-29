// Real gh GraphQL response captured from ericmaster/vda-demo-target on Oct 29, 2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapRepo } from '../src/adapters/github-live.js';
import { computeDay } from '../src/metrics.js';
import { adapters } from '../src/adapters/index.js';
import { createGrants } from '../src/grants.js';

const ev = mapRepo('ericmaster/vda-demo-target', JSON.parse(readFileSync('fixtures/github-live-sample.json', 'utf8')));
const day = computeDay(ev, ['github:live'], null);

test('live source is off by default', () => assert.equal(createGrants(adapters).isGranted('github:live'), false));
test('real data, ungranted: nothing is computed', () => assert.equal(computeDay(ev, [], null).timeline.length, 0));
test('real PR #3: 785 lines reviewed in 40 s, no CI, "all tests pass" claim, nothing viewed → rubber stamp', () => {
  const r = ev.find((e) => e.id === 'gh-pr3-review');
  assert.equal(r.review_seconds, 40); assert.equal(r.lines, 785); assert.equal(r.files_viewed, 0);
  const it = day.items.find((i) => i.context.includes('#2'));
  assert.equal(it.state, 'rubber_stamp');
  assert.deepEqual(it.review_flags.map((f) => f.rule), ['too_fast', 'no_ci', 'unverified_claim', 'no_review_activity']);
});
test('real PR #4: CI passed, 2 inline comments, 3/3 files viewed → closed with proper review', () => {
  const r = ev.find((e) => e.id === 'gh-pr4-review');
  assert.equal(r.review_comments, 2); assert.equal(r.files_viewed, 3);
  assert.ok(ev.some((e) => e.id.startsWith('gh-pr4-ci') && e.action === 'ci_run'));
  assert.equal(day.items.find((i) => i.context.includes('#1')).state, 'closed_with_review');
});
test('real drift: self-discovered issue #2 while assigned #1, 17 min until PR for #1', () => {
  const [d] = day.drift;
  assert.equal(d.trigger, 'self'); assert.equal(d.trigger_event, 'gh-i2'); assert.equal(d.minutes, 17);
  assert.match(d.anchor, /#1 Add CSV export/);
});
