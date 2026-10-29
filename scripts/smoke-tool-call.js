// One-command check that Muse Spark does tool calling: `npm run smoke`
import { config } from '../src/config.js';
import { chat } from '../src/agent.js';
if (!config.apiKey) { console.error('MODEL_API_KEY not set. Copy .env.example to .env and add your key.'); process.exit(2); }
const tools = [{ type: 'function', function: { name: 'list_granted_sources', description: 'List granted sources', parameters: { type: 'object', properties: {} } } }];
const res = await chat([{ role: 'user', content: 'Which sources can you read? Use the tool.' }], tools);
const calls = res.choices?.[0]?.message?.tool_calls || [];
console.log(`model=${res.model} tool_calls=${calls.map((c) => c.function.name).join(',') || 'none'}`);
process.exit(calls.length ? 0 : 1);
