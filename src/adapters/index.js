// Source adapters. Each adapter: { id, kind, label, items(state?) }
// Item: { id, source_id, ts, title, text }. Calendar, tasks and notes read the live
// local state when given one, so approved changes and new voice notes show up.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { githubItems } from './github.js';

const F = (p) => join(process.env.FIXTURES_DIR || 'fixtures', p);
export const json = (p) => JSON.parse(readFileSync(F(p), 'utf8'));
const fixtureNotes = () => readFileSync(F('ramblings.txt'), 'utf8').split(/\n\s*\n/).map((t, i) => ({ id: `note-${i}`, source_id: 'notes:ramblings', title: t.slice(0, 50), ts: null, text: t.trim() }));

export const adapters = [
  { id: 'repo:orbit-api', kind: 'repo', label: 'Local git repo: orbit-api (commits, TODOs, issues)',
    items: () => json('repo.json').map((x, i) => ({ id: `repo-${i}`, source_id: 'repo:orbit-api', ...x })) },
  { id: 'github:repo', kind: 'repo', label: `GitHub (read-only via gh)${process.env.GITHUB_REPO ? ': ' + process.env.GITHUB_REPO : ', fixture fallback'}`,
    items: () => githubItems() },
  { id: 'email:work', kind: 'email', label: 'Work email (fixture inbox)',
    items: () => json('emails.json').map((x, i) => ({ id: `mail-${i}`, source_id: 'email:work', title: x.subject, ts: x.date, text: `From: ${x.from}\n${x.body}` })) },
  { id: 'chat:team', kind: 'chat', label: 'Team chat export',
    items: () => json('chat.json').map((x, i) => ({ id: `chat-${i}`, source_id: 'chat:team', title: `${x.user} in #${x.channel}`, ts: x.ts, text: x.text })) },
  { id: 'agent:coding-sessions', kind: 'agent-transcript', label: 'Coding-agent session transcripts',
    items: () => readFileSync(F('agent-session.md'), 'utf8').split(/\n(?=## )/).map((t, i) => ({ id: `agent-${i}`, source_id: 'agent:coding-sessions', title: t.split('\n')[0].replace(/^#+\s*/, ''), ts: null, text: t })) },
  { id: 'notes:ramblings', kind: 'ramblings', label: 'Voice/text brain-dumps',
    items: (st) => [...fixtureNotes(), ...(st ? st.notes : [])] },
  { id: 'calendar:main', kind: 'calendar', label: 'Calendar',
    items: (st) => (st ? st.events : json('calendar.json')).map((x) => ({ source_id: 'calendar:main', ...x })) },
  { id: 'tasks:main', kind: 'tasks', label: 'Task list',
    items: (st) => (st ? st.tasks : json('tasks.json')).map((x) => ({ source_id: 'tasks:main', ...x })) },
];

export const byId = (id) => adapters.find((a) => a.id === id);
