const APP = 'https://vespera-day-agent.ericmaster.workers.dev';
const card = (inner) => `<!doctype html><html><head><style>
body{margin:0;width:1920px;height:1080px;background:radial-gradient(circle at 30% 20%,#1b2433,#0d1117 70%);color:#e6edf3;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center}
.w{max-width:1500px;padding:60px}.k{color:#2dd4bf;font-size:30px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:28px}
.q{font-size:64px;line-height:1.25;font-weight:600}.a{margin-top:40px;font-size:30px;color:#9aa4b2}
.g{display:grid;grid-template-columns:repeat(3,1fr);gap:36px;margin-top:20px}.c{background:#161b22;border:1px solid #30363d;border-radius:18px;padding:40px}
.n{font-size:84px;font-weight:700;color:#2dd4bf}.t{font-size:30px;margin-top:12px;line-height:1.3}.s{font-size:22px;color:#8b949e;margin-top:18px}
.big{font-size:72px;font-weight:700;line-height:1.2}.em{color:#2dd4bf}</style></head><body><div class="w">${inner}</div></body></html>`;
async function api(p, path, body) { return p.evaluate(([u, b]) => fetch(u, b ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) } : {}).then(r => r.json()), [path, body]); }
async function setup(h) {
  const p = h.page;
  await api(p, '/api/reset', {});
  for (const s of ['github:live', 'github:repo', 'chat:team', 'agent:coding-sessions', 'email:work', 'calendar:main', 'tasks:main', 'attention:window', 'attention:web'])
    await api(p, '/api/grants', { id: s, granted: true });
  await api(p, '/api/clock', { now: '2026-10-30T12:30:00-05:00' });
  const r = await api(p, '/api/run', {});            // real Muse Spark run, before the camera starts
  h.log('prerun', { tools: r.trace?.length, fallback: r.fallback || null, proposals: r.proposals?.length, run_id: r.run_id });
  console.log('prerun', r.run_id, r.trace?.length, r.fallback, r.proposals?.map(x => x.id + ':' + x.validation?.ok));
  await p.setContent(card(''));
}
async function run(h) {
  const { page: p, beat, endBeat, at, W, click, hl, zoom, cap, box, textBox, move } = h;
  const go = async (q) => { await p.goto(APP + '/' + q); await p.waitForSelector('#lane-attention'); await p.waitForTimeout(400); };

  await beat('b1');
  await p.setContent(card(`<div class="k">Vespera Day Agent</div><div class="q">“I approved 800 lines from an agent without running the tests, just to clear my queue before bed.”</div><div class="a">Eric Aguayo, Nimblersoft · his story, read by a narrator</div>`));
  await endBeat('b1', 1.5);

  await beat('b2');
  await p.setContent(card(`<div class="k">Agents write the code. Review is the bottleneck.</div><div class="g">
   <div class="c"><div class="n">+31%</div><div class="t">more PRs merged with no review at all</div><div class="s">Faros · 22,000 developers (DORA 2025 takeaways)</div></div>
   <div class="c"><div class="n">5.3×</div><div class="t">longer wait for a reviewer on agent PRs</div><div class="s">LinearB 2026 Benchmarks</div></div>
   <div class="c"><div class="n">AI ↑</div><div class="t">throughput up, and instability with it</div><div class="s">Google Cloud DORA 2025</div></div></div>`));
  await endBeat('b2', 2.5);

  await beat('b2h');
  await p.setContent(card(`<div class="k">Hypothesis</div><div class="big">Show what got closed <span class="em">without proper review</span>, during the day, with evidence. Protect one review block.</div><div class="a">Metric: work closed with proper review</div>`));
  await endBeat('b2h', 1.5);

  await beat('b3');
  await go('?mode=without&t=10:40&paused=1');
  cap('Sample Friday · fixture replay', 'Without Vespera');
  const st = await box('#lanes'); await hl(st); zoom(st, 1.3, 30); await at(W('b3', 'first')); await hl();
  await endBeat('b3', 1);

  await beat('b4');
  await go('?mode=without&t=11:24&speed=.5');
  cap('11:28 · PR #47 approved in 40 s', '800 lines · 0 of 23 files viewed');
  await at(W('b4', 'approved')); const k = await box('#kSt'); await hl({ x: k.x - 200, y: k.y - 40, w: 330, h: 80 });
  await at(W('b4', 'passes')); await endBeat('b4', 2.5); await hl(); zoom(null);

  await beat('b5');
  await go('?mode=without&t=11:38&speed=1');
  cap('11:41 · AI side remark → middleware refactor', 'PR #44 waits 31 min');
  await at(W('b5', 'foreground'));
  const lane = await box('#lane-attention'); await hl(lane); zoom(lane, 1.6, 80);
  cap('Foreground lane: SIMULATED fixture', 'category only · opt-in');
  await endBeat('b5', 4); await hl(); zoom(null);

  await beat('b6');
  await go('?mode=with&t=11:52&speed=.5&autochoose=0');
  await p.evaluate((u) => { const f = document.createElement('iframe'); f.src = u + '/widget?mode=with'; f.id = '__w';
    Object.assign(f.style, { position: 'fixed', right: '24px', bottom: '24px', width: '360px', height: '640px', border: '1px solid #30363d', borderRadius: '14px', zIndex: 9999, background: '#0d1117', boxShadow: '0 10px 40px #000a' }); document.body.appendChild(f); }, 'https://vespera-day-agent.ericmaster.workers.dev');
  cap('Rewind · same Friday, with Vespera', 'widget beside your work');
  await hl(await box('#__w')); await at(W('b6', '11')); await hl();
  await p.waitForSelector('#nudge', { state: 'visible', timeout: 30000 }).catch(() => {});
  cap('11:56 · 15 min into the drift', 'Only you see this');
  const n = await box('#nudge'); await hl(n); zoom(n, 1.5, 80);
  await endBeat('b6', 3); 

  await beat('b7');
  await hl(); await click('#nBack', 700); zoom(null);
  cap('Back to PR #44', 'side quest parked · 20-min review block protected');
  await p.waitForTimeout(1500);
  await at(W('b7', 'review')); const cal = await box('#lane-calendar'); await hl(cal);
  await at(W('b7', 'rubber')); const kk = await box('#kSt'); await hl({ x: kk.x - 200, y: kk.y - 40, w: 330, h: 80 });
  await endBeat('b7', 4); await hl();

  await beat('b8');
  await p.evaluate(() => document.getElementById('__w')?.remove());
  await click('#tabLive', 700);
  cap('Live agent · Muse Spark', 'real run, pre-recorded before this take');
  await p.locator('#proposals').scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -120));
  await p.waitForTimeout(500); await hl(await box('#proposals'));
  await endBeat('b8', 1.5); await hl();

  await beat('b9');
  await click('#proposals button:has-text("Why?")', 700);
  await p.waitForTimeout(1500);
  const w0 = await textBox('#proposals .whyp', 'Earlier rejected'); const wy = { x: w0.x - 10, y: w0.y - 120, w: 560, h: 260 }; await hl(wy); zoom(wy, 2.2, 40);
  cap('Why? · the decision record', 'every number and quote checked against source events');
  await endBeat('b9', 3); await hl(); zoom(null);

  await beat('b10');
  await p.locator('#sources').scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  const sr = await box('#sources'); await hl(sr); zoom(sr, 1.4, 60);
  cap('Every source off until you grant it', 'foreground: category only · opt-in · local adapter · no manager view');
  await endBeat('b10', 2); await hl(); zoom(null);

  await beat('b11');
  await p.setContent(card(`<div class="k">Vespera Day Agent · built with Muse Spark</div><div class="big">It doesn't measure your hours.<br><span class="em">It measures whether you got to review.</span></div><div class="a">vespera-day-agent.ericmaster.workers.dev</div>`));
  await endBeat('b11', 2.5);
}
export default { setup, run };
