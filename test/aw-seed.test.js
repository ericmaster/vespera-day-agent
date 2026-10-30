import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toImport, checkTarget } from '../scripts/aw-seed.mjs';
import { mapAwEvents, pickBuckets } from '../src/adapters/attention.js';

const fx = JSON.parse(readFileSync('fixtures/attention.json', 'utf8')).segments;
const perMinute = (segs) => { const m = {}; for (const s of segs) for (let t = Date.parse(s.start); t < Date.parse(s.end); t += 60000) m[t] = s.category; return m; };

test('import format: three buckets with the documented fields and synthetic data', () => {
  const d = toImport(fx, 'box');
  assert.deepEqual(Object.keys(d.buckets).sort(), ['aw-watcher-afk_box', 'aw-watcher-web-chrome', 'aw-watcher-window_box']);
  for (const b of Object.values(d.buckets)) for (const k of ['id', 'type', 'client', 'hostname', 'created', 'events']) assert.ok(k in b, k);
  assert.equal(d.buckets['aw-watcher-window_box'].type, 'currentwindow');
  assert.equal(d.buckets['aw-watcher-afk_box'].type, 'afkstatus');
  const web = d.buckets['aw-watcher-web-chrome'];
  assert.equal(web.type, 'web.tab.current');
  assert.ok(web.events.every((e) => ['url', 'title', 'audible', 'incognito'].every((k) => k in e.data) && /synthetic/.test(e.data.title)));
  assert.ok(d.buckets['aw-watcher-window_box'].events.every((e) => /synthetic/.test(e.data.title)));
});
test('round trip: seeded events map back to exactly the fixture categories (gaps stay unknown)', () => {
  const d = toImport(fx, 'box'), ids = pickBuckets(d.buckets, 'box');
  const ev = (list) => list.flatMap((id) => d.buckets[id].events);
  const segs = mapAwEvents({ window: ev(ids.window), web: ev(ids.web), afk: ev(ids.afk) }, '2026-10-30T08:30:00-05:00', '2026-10-30T12:30:00-05:00');
  assert.deepEqual(perMinute(segs), perMinute(fx));
});
test('seeding refuses the real ActivityWatch port and non-testing servers unless --force', () => {
  assert.match(checkTarget('http://localhost:5600', null, false), /refusing port 5600/);
  assert.equal(checkTarget('http://localhost:5600', null, true), null);
  assert.match(checkTarget('http://localhost:5666', { testing: false }, false), /not in --testing mode/);
  assert.equal(checkTarget('http://localhost:5666', { testing: true }, false), null);
});
