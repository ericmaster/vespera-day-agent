// Agent loop: Muse Spark via the OpenAI-compatible Chat Completions endpoint.
import { config } from './config.js';
import { toolSchemas, makeToolbox } from './tools.js';
import { adapters } from './adapters/index.js';
import { createGrants } from './grants.js';
import { runOffline } from './offline-agent.js';
import { sha256, instrument, startRun, finishRun, newRunId } from './audit.js';

const SYSTEM = (now) => `You are Vespera Day Agent, an intraday review-quality monitor owned by the developer. You read ONLY the sources the user granted (call list_granted_sources first).
Core metric: items closed with proper review (PR reviewed before merge, agent session closed with tests run). Call get_day_metrics for the deterministic context-switch timeline and metrics; never compute or invent numbers yourself.
Two deterministic detectors run inside get_day_metrics: task drift (drift[]: anchor task, side_quest, trigger_event) and rubber-stamp review (items with state rubber_stamp and review_flags). For each drift, alert on drift_minutes_max citing the trigger_event and propose create_task {parked:true} for the side-quest so the user returns to the anchor. For each rubber_stamp item, alert on rubber_stamp_reviews citing a flag's evidence event and propose create_task with a short checklist[] of verifications. Describe evidence of review only, never the person's state. Every number you write in an alert (minutes, lines, seconds, #refs, switches) must come from the drift or item you cite; the validator rejects mismatches.
Then call propose_change for: (1) an alert per real problem (metric value copied exactly from get_day_metrics), (2) a heads-down block (schedule_block with no_interrupt:true) for code review and testing in a free calendar slot after now, (3) a team_status_draft telling the team when you are heads-down and what you will review first (a draft; it is never sent), plus any task or deadline changes.
Every proposal must cite evidence with an exact verbatim quote from a source item. Workflow language only: never mention health, wellness, stress, feelings or the user's state. Judge work items, never the person.
Current simulated time: ${now}, timezone ${config.timezone}, working hours ${config.workingHours.start}-${config.workingHours.end}.
If a proposal is rejected by the validator, fix it and propose again. Finish with a short summary.`;

export async function chat(messages, tools) {
  const r = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, messages, tools, tool_choice: 'auto' }),
  });
  if (!r.ok) throw new Error(`Model API ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

export const isOffline = () => !config.apiKey || process.env.OFFLINE === '1';

// Prompt version = hash of the SYSTEM template (clock left as a placeholder).
export const PROMPT_VERSION = sha256(SYSTEM('{now}'));

export async function runAgent(grants, store, { maxSteps = 24, log = () => {}, state, audit, forceOffline = null } = {}) {
  const base = makeToolbox(grants, store, state);
  const run_id = newRunId();
  const tb = audit ? instrument(base, audit, run_id) : base;
  tb.state = base.state;
  const meta = { prompt_version: PROMPT_VERSION };
  const done = (r, mode, model) => { if (audit) finishRun(audit, run_id, { mode, model, ...meta, store, summary: r.summary, fallback: r.fallback, usage: r.usage, steps: r.steps }); return { ...r, run_id, mode, proposals: store }; };
  const offlineModel = 'offline-script';
  if (audit) startRun(audit, { run_id, model: forceOffline || isOffline() ? offlineModel : config.model, gateway: forceOffline || isOffline() ? 'none' : new URL(config.baseUrl).host, ...meta, granted_sources: grants.grantedIds(), sim_clock: base.state.now });
  if (forceOffline) return done({ ...runOffline(tb, { log }), offline: true, fallback: forceOffline }, 'fallback', offlineModel);
  if (isOffline()) return done({ ...runOffline(tb, { log }), offline: true }, 'offline', offlineModel);
  try { return done(await runLive(tb, store, { maxSteps, log }), 'live', config.model); }
  catch (e) {
    // Fallback, not the default: if the model API fails mid-demo, the scripted agent runs through the
    // same toolbox and validator, and the UI labels the run as a fallback with the error.
    store.splice(0);
    return done({ ...runOffline(tb, { log }), offline: true, fallback: e.message.slice(0, 200) }, 'fallback', offlineModel);
  }
}

async function runLive(tb, store, { maxSteps, log }) {
  const messages = [{ role: 'system', content: SYSTEM(tb.state.now) }, { role: 'user', content: 'Check now: how is my review quality today, and what should change for the rest of the day?' }];
  const usage = { input: 0, output: 0 };
  for (let step = 0; step < maxSteps; step++) {
    const res = await chat(messages, toolSchemas), msg = res.choices[0].message;
    usage.input += res.usage?.prompt_tokens || 0; usage.output += res.usage?.completion_tokens || 0;
    messages.push(msg);
    if (!msg.tool_calls?.length) return { summary: msg.content, proposals: store, usage, steps: step + 1 };
    for (const call of msg.tool_calls) {
      let out;
      try { out = tb[call.function.name](JSON.parse(call.function.arguments || '{}')); }
      catch (e) { out = { error: e.message }; }
      log({ tool: call.function.name, args: call.function.arguments });
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(out).slice(0, 20000) });
    }
  }
  return { summary: '(step limit reached)', proposals: store, usage, steps: maxSteps };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const g = createGrants(adapters);
  adapters.forEach((a) => g.set(a.id, true));
  const store = [];
  runAgent(g, store, { log: (l) => console.log('tool:', l.tool) })
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
