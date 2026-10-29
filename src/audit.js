// Append-only decision record (JSONL), field names after the OpenTelemetry GenAI semantic conventions
// (gen_ai.*; spec status "Development", names may change). Dev-owned: export is manual via
// GET /api/audit.jsonl and nothing is sent anywhere. Storage: memory (+ optional file locally,
// Durable Object storage on the Worker) through the onAppend sink.
import { createHash } from 'node:crypto';

export const sha256 = (s) => 'sha256:' + createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
const iso = () => new Date().toISOString();

export function createAudit({ onAppend } = {}) {
  const recs = [];
  const match = (f) => (r) => Object.entries(f).every(([k, v]) => v == null || v === '' || r[k] === v);
  return {
    sink: onAppend,
    append(r) { const x = Object.freeze({ at: iso(), ...r }); recs.push(x); (this.sink || (() => {}))(x, recs.length - 1); return x; },
    load(list) { recs.push(...list.map((r) => Object.freeze({ ...r }))); },
    list: (f = {}) => recs.filter(match(f)),
    jsonl(f = {}) { return recs.filter(match(f)).map((r) => JSON.stringify(r)).join('\n') + (recs.length ? '\n' : ''); },
    get size() { return recs.length; },
  };
}

export const newRunId = (simClock) => `r_${iso().replace(/[-:]/g, '').slice(0, 15)}Z_${Math.random().toString(36).slice(2, 6)}`;

// Short, content-light result summary for a tool call (counts, status), plus a hash of the full result.
export function summarizeResult(name, out) {
  if (out?.error) return `error: ${String(out.error).slice(0, 160)}`;
  if (Array.isArray(out)) return `${out.length} item(s)`;
  if (name === 'propose_change') return `${out.id} ${out.status}${out.errors?.length ? ': ' + out.errors.join('; ') : ''}`;
  if (name === 'get_day_metrics') return `metrics ${JSON.stringify(out.metrics)}; drift ${out.drift?.length || 0}`;
  return Object.keys(out || {}).slice(0, 6).join(',');
}

// Wrap a toolbox so every tool call is recorded with timestamps, duration, args and a result summary.
// Validator-rejected propose_change calls are also recorded as `attempt` records with their reasons.
export function instrument(tb, audit, run_id) {
  let n = 0;
  const wrapped = { ...tb };
  for (const [name, fn] of Object.entries(tb)) {
    if (typeof fn !== 'function' || name === 'ctx') continue;
    wrapped[name] = (args) => {
      const id = `tc${++n}`, start = Date.now(), at = iso();
      let out, err;
      try { out = fn(args); } catch (e) { err = e; out = { error: e.message }; }
      audit.append({ record: 'tool_call', run_id, 'gen_ai.operation.name': 'execute_tool', 'gen_ai.tool.call.id': id, 'gen_ai.tool.name': name,
        started_at: at, duration_ms: Date.now() - start, args: args ?? null, result_summary: summarizeResult(name, out), result_hash: sha256(JSON.stringify(out)), allowed: !err });
      if (name === 'propose_change' && out?.status === 'invalid')
        audit.append({ record: 'attempt', run_id, proposal_id: out.id, 'gen_ai.tool.call.id': id, type: args?.type, summary: args?.summary, errors: out.errors });
      if (err) throw err;
      return out;
    };
  }
  return wrapped;
}

export function startRun(audit, { run_id, model, gateway, prompt_version, granted_sources, sim_clock }) {
  audit.append({ record: 'run', event: 'start', run_id, 'gen_ai.operation.name': 'invoke_agent', 'gen_ai.agent.name': 'vespera-day-agent',
    'gen_ai.request.model': model, 'gen_ai.provider.name': gateway, prompt_version, granted_sources, sim_clock });
}

// After a run: one `proposal` record per proposal (evidence, earlier rejected attempts, validator result) and a run end.
export function finishRun(audit, run_id, { mode, model, prompt_version, store, summary, fallback, usage, steps }) {
  const attempts = audit.list({ record: 'attempt', run_id });
  for (const p of store) {
    p.run_id = run_id;
    audit.append({ record: 'proposal', run_id, proposal_id: p.id, type: p.type, summary: p.summary,
      agent: { mode, 'gen_ai.request.model': model, prompt_version },
      evidence: (p.evidence || []).map((e) => ({ source_id: e.source_id, item_id: e.item_id, quote: e.quote, verified: !!e.verified })),
      attempts: attempts.filter((a) => a.type === p.type && a.proposal_id !== p.id && a.proposal_id < p.id).map((a) => ({ proposal_id: a.proposal_id, at: a.at, errors: a.errors })),
      validator: { status: p.status, errors: p.validation?.errors || [] } });
  }
  audit.append({ record: 'run', event: 'end', run_id, mode, steps: steps ?? null, summary: summary ?? null, fallback_reason: fallback ?? null,
    'gen_ai.usage.input_tokens': usage?.input ?? null, 'gen_ai.usage.output_tokens': usage?.output ?? null, proposals: store.length });
}

export function recordDecision(audit, { run_id = null, proposal_id, action, source, ...rest }) {
  return audit.append({ record: 'decision', run_id, proposal_id, user_decision: { action, at: iso() }, source, ...rest });
}

// Everything that explains one proposal: run start/end, tool calls in order, the proposal record, attempts, decisions.
export function why(audit, proposal_id, run_id) {
  const run = run_id ? audit.list({ record: 'run', run_id }) : [];
  return {
    run_id: run_id || null,
    run_start: run.find((r) => r.event === 'start') || null,
    run_end: run.find((r) => r.event === 'end') || null,
    tool_calls: run_id ? audit.list({ record: 'tool_call', run_id }) : [],
    proposal: audit.list({ record: 'proposal', run_id, proposal_id }).at(-1) || null,
    attempts: run_id ? audit.list({ record: 'attempt', run_id }) : [],
    decisions: audit.list({ record: 'decision', proposal_id }).filter((d) => !run_id || d.run_id === run_id),
  };
}
