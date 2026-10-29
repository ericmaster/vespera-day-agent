// Offline mode: a deterministic, scripted agent over the fixtures. It goes through the
// SAME toolbox (consent checks, consent log, quote verification, validator) as the
// Muse Spark loop, so the demo works end to end before an API key exists.
const SCRIPT = [
  { needs: ['email:work'], type: 'create_task', summary: 'Sign off on the billing migration review',
    payload: { title: 'Billing migration review sign-off (Priya)', deadline: '2026-11-02T12:00:00-05:00', due_by: '2026-11-02T23:59:00-05:00' },
    evidence: [{ source_id: 'email:work', item_id: 'mail-0', quote: 'I need your sign-off by Monday Nov 2' }] },
  { needs: ['agent:coding-sessions', 'repo:orbit-api', 'calendar:main'], type: 'schedule_block', summary: 'Two-hour block for export pagination before the customer audit',
    payload: { title: 'Export endpoint: cursor pagination', start: '2026-11-02T13:00:00-05:00', end: '2026-11-02T15:00:00-05:00' },
    evidence: [{ source_id: 'agent:coding-sessions', item_id: 'agent-1', quote: 'needs about 2 hours' },
               { source_id: 'repo:orbit-api', item_id: 'repo-1', quote: 'Customer needs a fix before their audit on Nov 3' }] },
  { needs: ['email:work', 'tasks:main'], type: 'set_deadline', summary: 'Meetup slides deadline with a buffer before the 17:00 cutoff',
    payload: { task_id: 't2', deadline: '2026-11-04T12:00:00-05:00', due_by: '2026-11-04T17:00:00-05:00' },
    evidence: [{ source_id: 'email:work', item_id: 'mail-1', quote: 'due Wednesday Nov 4 at 17:00' }] },
];

// Intraday checks: values come from get_day_metrics, evidence from events visible at the simulated clock.
const INTRADAY = [
  { needs: ['chat:team', 'github:repo'], events: ['d09', 'd15'], type: 'alert', metric: 'switches_max_per_hour',
    summary: (v) => `Context switching: ${v} switches in your busiest hour across PRs, email and chat`,
    evidence: [{ source_id: 'chat:team', item_id: 'd09', quote: 'PR #44 is blocking the QA build' }, { source_id: 'chat:team', item_id: 'd15', quote: 'pinging again on PR #44' }] },
  { needs: ['github:repo', 'agent:coding-sessions'], events: ['d13', 'd19'], type: 'alert', metric: 'closed_without_review',
    summary: (v) => `${v} item(s) closed without review or tests`,
    evidence: [{ source_id: 'github:repo', item_id: 'd13', quote: 'merged by dana without review comments; CI skipped' }, { source_id: 'agent:coding-sessions', item_id: 'd19', quote: 'closed with tests not run' }] },
  { needs: ['chat:team', 'calendar:main'], events: ['d21'], type: 'schedule_block',
    summary: () => 'Heads-down review + testing block: PR #44, PR #46, run tests for PR #43 (no interruptions)',
    payload: { title: 'Heads-down: review #44, #46 + test #43', start: '2026-10-30T13:00:00-05:00', end: '2026-10-30T15:00:00-05:00', no_interrupt: true },
    evidence: [{ source_id: 'chat:team', item_id: 'd21', quote: 'QA is waiting on PR #44' }] },
  { needs: ['chat:team'], events: ['d20', 'd21'], type: 'team_status_draft',
    summary: () => 'Draft team status for #release (not sent)',
    payload: { channel: '#release', text: 'Heads-down on reviews 13:00-15:00: PR #44 first (QA), then #46. Will reply to pings after 15:00. Release cut 15:00 unchanged.' },
    evidence: [{ source_id: 'chat:team', item_id: 'd21', quote: 'QA is waiting on PR #44' }, { source_id: 'chat:team', item_id: 'd20', quote: 'could you look at #46 before lunch?' }] },
];

export function runOffline(tb, { log = () => {} } = {}) {
  const call = (name, args = {}) => { log({ tool: name, args: JSON.stringify(args) }); try { return tb[name](args); } catch (e) { return { error: e.message }; } };
  const granted = call('list_granted_sources').map((s) => s.id);
  for (const id of granted) call('read_source', { source_id: id });
  let made = 0, skipped = 0;
  for (const { needs, ...p } of SCRIPT) {
    if (!needs.every((n) => granted.includes(n))) { skipped++; continue; }
    call('propose_change', structuredClone(p)); made++;
  }
  if (granted.some((g) => ['chat:team', 'github:repo', 'email:work', 'agent:coding-sessions'].includes(g))) {
    const day = call('get_day_metrics');
    const visible = new Set(day.timeline.map((e) => e.id));
    for (const x of INTRADAY) {
      if (!x.needs.every((n) => granted.includes(n)) || !x.events.every((e) => visible.has(e))) { skipped++; continue; }
      const v = x.metric ? day.metrics[x.metric] : undefined;
      const payload = x.payload || { metric: x.metric, value: v, message: x.summary(v) };
      call('propose_change', structuredClone({ type: x.type, summary: x.summary(v), payload, evidence: x.evidence })); made++;
    }
  }
  return { summary: `Offline mode (scripted, no model call): read ${granted.length} granted source(s), made ${made} proposal(s), skipped ${skipped} that needed sources you have not granted.` };
}
