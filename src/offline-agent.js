// Offline mode: a deterministic, scripted agent over the fixtures. It goes through the
// SAME toolbox (consent checks, consent log, quote verification, validator) as the
// Muse Spark loop, so the demo works end to end before an API key exists.
const SCRIPT = [
  { needs: ['chat:team', 'calendar:main'], type: 'decline_event', summary: 'Skip the optional vendor demo to keep the morning free for the promised limiter merge',
    payload: { event_id: 'ev2', reason: 'Committed to merging the rate limiter by Friday noon' },
    evidence: [{ source_id: 'chat:team', item_id: 'chat-1', quote: "yes, I'll get it merged by Friday noon" }] },
  { needs: ['chat:team', 'calendar:main'], type: 'schedule_block', summary: 'Focus block: finish and merge the rate limiter before the noon promise',
    payload: { title: 'Finish + merge rate limiter', start: '2026-10-30T09:30:00-05:00', end: '2026-10-30T11:30:00-05:00' },
    evidence: [{ source_id: 'chat:team', item_id: 'chat-1', quote: "yes, I'll get it merged by Friday noon" }] },
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

export function runOffline(tb, { log = () => {} } = {}) {
  const call = (name, args = {}) => { log({ tool: name, args: JSON.stringify(args) }); try { return tb[name](args); } catch (e) { return { error: e.message }; } };
  const granted = call('list_granted_sources').map((s) => s.id);
  for (const id of granted) call('read_source', { source_id: id });
  let made = 0, skipped = 0;
  for (const { needs, ...p } of SCRIPT) {
    if (!needs.every((n) => granted.includes(n))) { skipped++; continue; }
    call('propose_change', structuredClone(p)); made++;
  }
  return { summary: `Offline mode (scripted, no model call): read ${granted.length} granted source(s), made ${made} proposal(s), skipped ${skipped} that needed sources you have not granted.` };
}
