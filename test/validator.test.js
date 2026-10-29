import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProposal } from '../src/validator.js';

const events = [
  { id: 'ev1', title: 'Standup', start: '2026-10-30T09:00:00-05:00', end: '2026-10-30T09:30:00-05:00', fixed: true },
  { id: 'ev2', title: 'Vendor demo', start: '2026-10-30T10:00:00-05:00', end: '2026-10-30T11:30:00-05:00', fixed: false },
];
const ev = [{ source_id: 'chat:team', item_id: 'chat-0', quote: 'merged by noon' }];
const ctx = { events, tasks: [{ id: 't1' }], grantedIds: ['chat:team', 'calendar:main'] };
const block = (start, end, evidence = ev) => ({ type: 'schedule_block', payload: { title: 'Focus', start, end }, evidence });

test('valid focus block passes', () => assert.ok(validateProposal(block('2026-10-30T12:00:00-05:00', '2026-10-30T14:00:00-05:00'), ctx).ok));
test('overlap with fixed event fails', () => {
  const r = validateProposal(block('2026-10-30T09:15:00-05:00', '2026-10-30T10:00:00-05:00'), ctx);
  assert.ok(r.errors.some((e) => e.includes('overlaps fixed')));
});
test('outside working hours fails', () => assert.ok(validateProposal(block('2026-10-30T18:00:00-05:00', '2026-10-30T19:00:00-05:00'), ctx).errors.includes('outside working hours')));
test('end before start fails', () => assert.ok(!validateProposal(block('2026-10-30T14:00:00-05:00', '2026-10-30T13:00:00-05:00'), ctx).ok));
test('evidence from non-granted source fails', () => {
  const r = validateProposal(block('2026-10-30T12:00:00-05:00', '2026-10-30T13:00:00-05:00', [{ source_id: 'email:work', item_id: 'mail-0', quote: 'x' }]), ctx);
  assert.ok(r.errors.some((e) => e.includes('non-granted')));
});
test('no evidence fails', () => assert.ok(validateProposal(block('2026-10-30T12:00:00-05:00', '2026-10-30T13:00:00-05:00', []), ctx).errors.includes('proposal has no evidence')));
test('cannot move or decline fixed event', () => {
  assert.ok(!validateProposal({ type: 'decline_event', payload: { event_id: 'ev1' }, evidence: ev }, ctx).ok);
  assert.ok(validateProposal({ type: 'decline_event', payload: { event_id: 'ev2' }, evidence: ev }, ctx).ok);
});
test('move_event ignores its own old slot', () => {
  const p = { type: 'move_event', payload: { event_id: 'ev2', start: '2026-10-30T10:30:00-05:00', end: '2026-10-30T12:00:00-05:00' }, evidence: ev };
  assert.ok(validateProposal(p, ctx).ok);
});
test('deadline after due date fails', () => {
  const p = { type: 'set_deadline', payload: { task_id: 't1', deadline: '2026-11-04T12:00:00-05:00', due_by: '2026-11-03T00:00:00-05:00' }, evidence: ev };
  assert.ok(validateProposal(p, ctx).errors.includes('deadline is after the external due date'));
});
