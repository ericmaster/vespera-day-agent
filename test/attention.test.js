import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adapters } from '../src/adapters/index.js';
import { createGrants } from '../src/grants.js';
import { makeToolbox } from '../src/tools.js';
import { createState } from '../src/state.js';
import { computeDay, dayEvents } from '../src/metrics.js';
import { categorize, mapAwEvents, aggregate, phrase, attentionSegments, refreshActivityWatch } from '../src/adapters/attention.js';
import { BANNED } from '../src/validator.js';

const WORK = ['chat:team', 'email:work', 'agent:coding-sessions', 'github:repo'];
const ATT = ['attention:window', 'attention:web', 'attention:afk'];
const at = (h) => `2026-10-30T${h}:00-05:00`;

test('attention sources are off by default and add nothing until granted', () => {
  const g = createGrants(adapters);
  for (const id of ATT) assert.equal(g.isGranted(id), false);
  const d = computeDay(dayEvents(), WORK, null);
  assert.deepEqual(d.attention, []); assert.deepEqual(d.attention_drift, []);
});
test('drift foreground mix: video 9 of 31 min (observed)', () => {
  const d = computeDay(dayEvents(), [...WORK, ...ATT], null);
  assert.equal(phrase(d.attention_drift[0], 'social_video'), 'foreground: video 9 of 31 min (observed)');
});
test('review_window_off_task: PR #44 anchor window flagged, PR #47 approval window not', () => {
  const w = computeDay(dayEvents(), [...WORK, ...ATT], null).attention;
  const a = w.find((x) => x.kind === 'anchor');
  assert.equal(a.code_review_min, 6); assert.equal(a.span_min, 37); assert.equal(a.flagged, true); assert.deepEqual(a.evidence, ['d28', 'd32']);
  assert.equal(w.find((x) => x.kind === 'approval').flagged, false);
});
test('confidence: without the web grant, browser spans become unknown', () => {
  const s = attentionSegments();
  assert.equal(aggregate(s, at('11:41'), at('12:12'), ['window', 'web', 'afk']).confidence, 'observed');
  const partial = aggregate(s, at('11:41'), at('12:12'), ['window']);
  assert.equal(partial.minutes_by_category.unknown, 9); assert.equal(partial.confidence, 'partial'); // 22/31 = 0.71, between the [hyp] thresholds
  assert.equal(aggregate(s, at('11:00'), at('11:25'), ['window', 'web', 'afk']).confidence, 'unknown'); // 11:05-11:20 gap
  assert.equal(phrase(aggregate(s, at('11:00'), at('11:25'), ['window'])), 'foreground: unknown for 25 min');
});
test('categorize: closed set, browsers without tab class are unknown, unmatched is other', () => {
  assert.equal(categorize({ url: 'https://github.com/a/b/pull/44/files' }), 'code_review');
  assert.equal(categorize({ url: 'https://www.youtube.com/watch?v=x' }), 'social_video');
  assert.equal(categorize({ url: 'https://example.org' }), 'other');
  assert.equal(categorize({ app: 'Google-chrome' }), 'unknown');
  assert.equal(categorize({ app: 'Code' }), 'editor');
  assert.equal(categorize({ app: 'gimp' }), 'other');
});
test('ActivityWatch mapping keeps only categories: no titles or URLs leave the adapter', async () => {
  const T = (h) => new Date(at(h)).toISOString();
  const B = { 'aw-watcher-window_h': {}, 'aw-watcher-afk_h': {}, 'aw-watcher-web-chrome_h': {} };
  const ev = {
    'aw-watcher-window_h': [{ timestamp: T('10:00'), duration: 600, data: { app: 'Google-chrome', title: 'SECRET PR title' } }, { timestamp: T('10:10'), duration: 300, data: { app: 'Code', title: 'secret.js' } }],
    'aw-watcher-web-chrome_h': [{ timestamp: T('10:00'), duration: 300, data: { url: 'https://github.com/o/r/pull/9', title: 'SECRET' } }, { timestamp: T('10:05'), duration: 300, data: { url: 'https://youtube.com/watch?v=1', title: 'SECRET video' } }],
    'aw-watcher-afk_h': [{ timestamp: T('10:15'), duration: 300, data: { status: 'afk' } }],
  };
  const fetchFn = async (u) => ({ json: async () => (u.endsWith('/buckets') ? B : ev[decodeURIComponent(u.split('/buckets/')[1].split('/events')[0])]) });
  const segs = await refreshActivityWatch(at('10:00'), at('10:20'), 'http://aw', fetchFn);
  assert.deepEqual(segs.map((s) => [s.category, s.start.slice(11, 16), s.end.slice(11, 16)]), [['code_review', '10:00', '10:05'], ['social_video', '10:05', '10:10'], ['editor', '10:10', '10:15'], ['afk', '10:15', '10:20']]);
  const dump = JSON.stringify(segs);
  assert.ok(!/SECRET|secret|github\.com|youtube/.test(dump));
  for (const s of segs) assert.deepEqual(Object.keys(s).sort(), ['category', 'end', 'id', 'signal', 'start']);
  await refreshActivityWatch(null, null, 'http://aw', async () => { throw new Error('down'); }); // falls back to fixture
  assert.ok(attentionSegments().length > 0);
});
const tbAll = () => { const g = createGrants(adapters); adapters.forEach((a) => g.set(a.id, true)); const st = createState(); return makeToolbox(g, [], st); };
const alert = (message, value = 1, extra = []) => ({ type: 'alert', summary: 'Review window', payload: { metric: 'review_window_off_task', value, message },
  evidence: [{ source_id: 'chat:team', item_id: 'd28', quote: 'starting the review of PR #44 now' }, ...extra] });
test('validator: review_window_off_task value and "X of Y min (confidence)" must match the aggregate', () => {
  const tb = tbAll();
  assert.equal(tb.propose_change(alert('PR #44 anchor window: 6 of 37 min foreground in code review (observed)')).status, 'pending');
  assert.match(tb.propose_change(alert('PR #44 anchor window: 3 of 37 min foreground in code review (observed)')).errors.join(), /3 of 37 min/);
  assert.match(tb.propose_change(alert('PR #44 anchor window: 6 of 37 min foreground in code review (partial)')).errors.join(), /cited span is observed/);
  assert.match(tb.propose_change(alert('6 of 37 min in code review (observed)', 2)).errors.join(), /is 1, not 2/);
});
test('judgment words are rejected', () => {
  for (const w of ['distracted', 'procrastinating', 'lazy', 'slacking off', 'unproductive', 'wasting time', 'addicted']) assert.match(`you were ${w}`, BANNED, w);
  const r = tbAll().propose_change(alert('PR #44: 6 of 37 min in code review (observed), you got distracted'));
  assert.match(r.errors.join(), /out-of-scope language/);
});
