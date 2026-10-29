// Scripted demo run (rehearsal for the video). Same toolbox, validator and approval flow as the UI.
// npm run demo            -> live Muse Spark if MODEL_API_KEY is set, else offline fallback
// OFFLINE=1 npm run demo  -> deterministic rehearsal
process.env.GITHUB_LIVE_REPO ||= 'ericmaster/vda-demo-target';
const { adapters } = await import('../src/adapters/index.js');
const { createGrants } = await import('../src/grants.js');
const { makeToolbox } = await import('../src/tools.js');
const { createState, approve } = await import('../src/state.js');
const { runAgent } = await import('../src/agent.js');
const { computeDay, dayEvents } = await import('../src/metrics.js');

const say = (s) => console.log(`\n▶ ${s}`);
const g = createGrants(adapters), state = createState(), store = [];
const m = () => computeDay(dayEvents(), g.grantedIds(), state.now);
const card = (x) => `closed with proper review ${x.metrics.closed_with_review}/${x.metrics.opened} · rubber-stamped ${x.metrics.rubber_stamp_reviews} · backlog ${x.metrics.review_backlog} · max drift ${x.metrics.drift_minutes_max} min · ${x.metrics.switches_total} switches`;

say('All sources start OFF. An ungranted read is blocked:');
try { makeToolbox(g, [], state).read_source({ source_id: 'email:work' }); } catch (e) { console.log('  ✘', e.message); }
for (const id of ['github:live', 'github:repo', 'chat:team', 'agent:coding-sessions', 'email:work', 'calendar:main', 'tasks:main']) g.set(id, true);
say(`Granted 7 sources (notes stays off). Live repo: ${process.env.GITHUB_LIVE_REPO}`);
const live = m().timeline.filter((e) => e.source_id === 'github:live');
console.log(`  ${live.length} real GitHub events (issues, PRs, reviews, CI)`);
for (const [hhmm, label] of [['11:30', 'late morning'], ['12:30', 'after lunch']]) {
  state.now = `2026-10-30T${hhmm}:00-05:00`;
  const d = m();
  say(`Clock ${hhmm} (${label}) → ${card(d)}`);
  for (const i of d.items.filter((x) => x.state === 'rubber_stamp')) console.log(`  ⚠ ${i.context}: ${i.review_flags.map((f) => f.rule).join(', ')}`);
  for (const x of d.drift) console.log(`  ↪ drift ${x.minutes} min: "${x.side_quest}" while assigned "${x.anchor}" (trigger ${x.trigger}, ${x.trigger_event})`);
}
const before = m();
say('Check now: agent run');
const r = await runAgent(g, store, { state, log: (l) => console.log('  tool:', l.tool) });
console.log(r.offline ? `  OFFLINE FALLBACK${r.fallback ? ' (model error: ' + r.fallback + ')' : ''}` : '  LIVE Muse Spark');
for (const p of store) console.log(`  ${p.status === 'pending' ? '✔' : '✘'} ${p.id} ${p.type}: ${p.payload.message || p.payload.title || p.payload.text || p.summary} ⟵ ${p.evidence.map((e) => e.item_id).join(",")}${p.validation.errors.length ? ' [' + p.validation.errors.join('; ') + ']' : ''}`);
say('Approve: drift + rubber-stamp alerts, parked side-quest, checklist, no-interrupt block, team draft');
const tb = makeToolbox(g, store, state);
for (const p of store.filter((x) => x.status === 'pending' && (x.payload.parked || x.payload.checklist || x.payload.no_interrupt || x.type === 'team_status_draft' || ['drift_minutes_max', 'rubber_stamp_reviews'].includes(x.payload.metric))))
  console.log(`  ${approve(store, p.id, state, tb.ctx).error ? '✘' : '✔'} ${p.id} ${p.type}`);
say(`Before → now: ${card(before)}`);
console.log(`  approved: ${state.applied.length} · blocks ${state.events.filter((e) => e.no_interrupt).length} · drafts (not sent) ${state.drafts.length} · tasks ${state.tasks.filter((t) => t.from_proposal).length}`);
