// Agent loop: Muse Spark via the OpenAI-compatible Chat Completions endpoint.
import { config } from './config.js';
import { toolSchemas, makeToolbox } from './tools.js';
import { adapters } from './adapters/index.js';
import { createGrants } from './grants.js';
import { runOffline } from './offline-agent.js';

const SYSTEM = (now) => `You are Vespera Day Agent, an intraday review-quality monitor owned by the developer. You read ONLY the sources the user granted (call list_granted_sources first).
Core metric: items closed with proper review (PR reviewed before merge, agent session closed with tests run). Call get_day_metrics for the deterministic context-switch timeline and metrics; never compute or invent numbers yourself.
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

export async function runAgent(grants, store, { maxSteps = 12, log = () => {}, state } = {}) {
  const tb = makeToolbox(grants, store, state);
  if (isOffline()) return { ...runOffline(tb, { log }), offline: true, proposals: store };
  const messages = [{ role: 'system', content: SYSTEM(tb.state.now) }, { role: 'user', content: 'Check now: how is my review quality today, and what should change for the rest of the day?' }];
  for (let step = 0; step < maxSteps; step++) {
    const msg = (await chat(messages, toolSchemas)).choices[0].message;
    messages.push(msg);
    if (!msg.tool_calls?.length) return { summary: msg.content, proposals: store };
    for (const call of msg.tool_calls) {
      let out;
      try { out = tb[call.function.name](JSON.parse(call.function.arguments || '{}')); }
      catch (e) { out = { error: e.message }; }
      log({ tool: call.function.name, args: call.function.arguments });
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(out).slice(0, 20000) });
    }
  }
  return { summary: '(step limit reached)', proposals: store };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const g = createGrants(adapters);
  adapters.forEach((a) => g.set(a.id, true));
  const store = [];
  runAgent(g, store, { log: (l) => console.log('tool:', l.tool) })
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
