import { test } from 'node:test';
import assert from 'node:assert/strict';
import { json } from '../src/adapters/index.js';
import { buildReplay } from '../src/playback.js';
import { widgetState } from '../src/widget.js';

const R = buildReplay(json('day.json'), json('calendar.json'), { grants: ['chat:team', 'email:work', 'agent:coding-sessions', 'github:repo'] });
const at = (hhmm, o) => widgetState(R, `2026-10-30T${hhmm}:00-05:00`, o);

test('anchor comes from anchor_start; none before it', () => {
  assert.equal(at('11:00').anchor, null);
  assert.equal(at('11:40').anchor.ref, 'PR #44');
});
test('nudge appears at the detector flag minute, once per drift id, silent with three actions', () => {
  assert.equal(at('11:55').nudge, null);
  const n = at('11:56').nudge;
  assert.equal(n.id, 'drift:d29'); assert.equal(n.silent, true);
  assert.deepEqual(n.actions.map((a) => a.action), ['back', 'park', 'not_drift']);
  assert.match(n.body, /15 min/);
  assert.equal(at('11:57', { choice: 'back' }).nudge, null);
  assert.equal(at('11:56', { mode: 'without' }).nudge, null);
});
test('protected block countdown after Back', () => {
  assert.equal(at('12:06', { choice: 'back' }).block.remaining_min, 10);
  assert.equal(at('12:20', { choice: 'back' }).block, null);
  assert.equal(at('12:06', { choice: 'not_drift' }).block, null);
});
test('capture indicator: active, paused, unknown', () => {
  assert.equal(at('11:00').capture.state, 'active');
  assert.equal(at('11:00', { paused: true }).capture.state, 'paused');
  assert.equal(at('08:00').capture.state, 'unknown');
  assert.equal(at('11:00', { paused: true }).nudge, null);
});
test('rubber-stamp proposal from reviewFlags; Slack draft approved stays mock not sent', () => {
  assert.ok(!at('11:27').proposals.length);
  assert.equal(at('11:28').proposals[0].id, 'stamp:d26');
  const s = at('11:58', { choice: 'back', decisions: { 'slack:status': 'approved' } }).proposals.find((p) => p.id === 'slack:status');
  assert.equal(s.delivery, 'mock: not sent'); assert.equal(s.mock, true);
});
test('widget attention chip: foreground mix since the anchor, category only', () => {
  assert.equal(at('12:12').attention.text, 'foreground: editor 15, video 9 of 37 min (observed)');
  assert.match(at('12:12', { mode: 'with', choice: 'back' }).attention.text, /code review 22, editor 8 of 37 min/);
  assert.equal(at('11:00').attention, null);
  assert.equal(at('12:00', { paused: true }).attention, null);
});
