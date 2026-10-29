// Smoke: the server boots and serves the UI and API (caught a real syntax regression on Oct 29).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('server boots, serves UI and sources (offline)', async () => {
  const port = 3900 + Math.floor(Math.random() * 90);
  const p = spawn('node', ['src/server.js'], { env: { ...process.env, PORT: String(port), OFFLINE: '1', GITHUB_LIVE_REPO: '' } });
  try {
    await new Promise((ok, no) => { p.stdout.on('data', (d) => /localhost/.test(d) && ok()); p.on('exit', (c) => no(new Error(`exit ${c}`))); });
    const html = await (await fetch(`http://localhost:${port}/`)).text();
    assert.match(html, /closed with proper review|id="kpi"/);
    const s = await (await fetch(`http://localhost:${port}/api/sources`)).json();
    assert.equal(s.sources.find((x) => x.id === 'github:live').granted, false);
  } finally { p.kill(); }
});
