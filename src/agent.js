// Agent loop: Muse Spark via the OpenAI-compatible Chat Completions endpoint.
import { config } from './config.js';
import { toolSchemas, makeToolbox } from './tools.js';
import { adapters } from './adapters/index.js';
import { createGrants } from './grants.js';

const SYSTEM = `You are Vespera Day Agent. You read ONLY the sources the user granted (call list_granted_sources first).
Extract commitments, open loops, deadlines and calendar conflicts, then call propose_change once per concrete change.
Every proposal must cite evidence with an exact verbatim quote from a source item. Never invent facts.
You only plan calendar and task changes. You never comment on the user's health, body, feelings or habits.
Today is ${new Date().toISOString().slice(0, 10)}, timezone ${config.timezone}, working hours ${config.workingHours.start}-${config.workingHours.end}.
If a proposal is rejected by the validator, fix it and propose again. Finish with a one-paragraph summary.`;

export async function chat(messages, tools) {
  const r = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, messages, tools, tool_choice: 'auto' }),
  });
  if (!r.ok) throw new Error(`Model API ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

export async function runAgent(grants, store, { maxSteps = 12, log = () => {} } = {}) {
  if (!config.apiKey) throw new Error('MODEL_API_KEY not set (see .env.example)');
  const tb = makeToolbox(grants, store);
  const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: 'Plan my next working days from my granted sources.' }];
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
