// Source adapters. Each adapter: { id, kind, label, items(): Item[] }
// Item: { id, source_id, ts, title, text }. Real connectors (Gmail, GitHub API,
// Google Calendar) implement the same shape later and plug in here.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const F = (p) => join(process.env.FIXTURES_DIR || 'fixtures', p);
const json = (p) => JSON.parse(readFileSync(F(p), 'utf8'));

export const adapters = [
  { id: 'repo:orbit-api', kind: 'repo', label: 'Git repo: orbit-api (commits, TODOs, issues)',
    items: () => json('repo.json').map((x, i) => ({ id: `repo-${i}`, source_id: 'repo:orbit-api', ...x })) },
  { id: 'email:work', kind: 'email', label: 'Work email (fixture inbox)',
    items: () => json('emails.json').map((x, i) => ({ id: `mail-${i}`, source_id: 'email:work', title: x.subject, ts: x.date, text: `From: ${x.from}\n${x.body}` })) },
  { id: 'chat:team', kind: 'chat', label: 'Team chat export',
    items: () => json('chat.json').map((x, i) => ({ id: `chat-${i}`, source_id: 'chat:team', title: `${x.user} in #${x.channel}`, ts: x.ts, text: x.text })) },
  { id: 'agent:coding-sessions', kind: 'agent-transcript', label: 'Coding-agent session transcripts',
    items: () => readFileSync(F('agent-session.md'), 'utf8').split(/\n(?=## )/).map((t, i) => ({ id: `agent-${i}`, source_id: 'agent:coding-sessions', title: t.split('\n')[0].replace(/^#+\s*/, ''), ts: null, text: t })) },
  { id: 'notes:ramblings', kind: 'ramblings', label: 'Voice/text brain-dumps',
    items: () => readFileSync(F('ramblings.txt'), 'utf8').split(/\n\s*\n/).map((t, i) => ({ id: `note-${i}`, source_id: 'notes:ramblings', title: t.slice(0, 50), ts: null, text: t.trim() })) },
  { id: 'calendar:main', kind: 'calendar', label: 'Calendar',
    items: () => json('calendar.json').map((x) => ({ source_id: 'calendar:main', ...x })) },
  { id: 'tasks:main', kind: 'tasks', label: 'Task list',
    items: () => json('tasks.json').map((x) => ({ source_id: 'tasks:main', ...x })) },
];

export const byId = (id) => adapters.find((a) => a.id === id);
