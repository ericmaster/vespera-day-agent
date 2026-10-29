// Source adapters. Each adapter: { id, kind, label, items(state?) }
// Item: { id, source_id, ts, title, text }. Calendar, tasks and notes read the live
// local state when given one, so approved changes and new voice notes show up.
import { readText } from '../files.js';
import { join } from 'node:path';
import { githubItems } from './github.js';
import { liveEvents } from './github-live.js';

const F = (p) => join(process.env.FIXTURES_DIR || 'fixtures', p);
export const json = (p) => JSON.parse(readText(F(p)));
// Intraday activity (fixtures/day.json) is split back into its own source, so consent still applies per source.
// With a state, only events up to the simulated clock (state.now) are visible.
const dayFor = (id, st) => json('day.json').filter((e) => e.source_id === id && (!st?.now || new Date(e.ts) <= new Date(st.now)))
  .map((e) => ({ id: e.id, source_id: id, ts: e.ts, title: `${e.context} (${e.action})`, text: e.text }));
const fixtureNotes = () => readText(F('ramblings.txt')).split(/\n\s*\n/).map((t, i) => ({ id: `note-${i}`, source_id: 'notes:ramblings', title: t.slice(0, 50), ts: null, text: t.trim() }));

export const adapters = [
  { id: 'repo:orbit-api', kind: 'repo', label: 'Local git repo: orbit-api (commits, TODOs, issues)',
    items: () => json('repo.json').map((x, i) => ({ id: `repo-${i}`, source_id: 'repo:orbit-api', ...x })) },
  { id: 'github:repo', kind: 'repo', label: `GitHub (read-only via gh)${process.env.GITHUB_REPO ? ': ' + process.env.GITHUB_REPO : ', fixture fallback'}`,
    items: (st) => [...githubItems(), ...dayFor('github:repo', st)] },
  { id: 'github:live', kind: 'repo', label: `GitHub LIVE, read-only: ${process.env.GITHUB_LIVE_REPO || '(set GITHUB_LIVE_REPO)'} (PRs, reviews, CI)`,
    items: (st) => liveEvents().filter((e) => !st?.now || new Date(e.ts) <= new Date(st.now)).map((e) => ({ id: e.id, source_id: 'github:live', ts: e.ts, title: `${e.context} (${e.action})`, text: e.text })) },
  { id: 'email:work', kind: 'email', label: 'Work email (fixture inbox)',
    items: (st) => json('emails.json').map((x, i) => ({ id: `mail-${i}`, source_id: 'email:work', title: x.subject, ts: x.date, text: `From: ${x.from}\n${x.body}` })).concat(dayFor('email:work', st)) },
  { id: 'chat:team', kind: 'chat', label: 'Team chat export',
    items: (st) => json('chat.json').map((x, i) => ({ id: `chat-${i}`, source_id: 'chat:team', title: `${x.user} in #${x.channel}`, ts: x.ts, text: x.text })).concat(dayFor('chat:team', st)) },
  { id: 'agent:coding-sessions', kind: 'agent-transcript', label: 'Coding-agent session transcripts',
    items: (st) => readText(F('agent-session.md')).split(/\n(?=## )/).map((t, i) => ({ id: `agent-${i}`, source_id: 'agent:coding-sessions', title: t.split('\n')[0].replace(/^#+\s*/, ''), ts: null, text: t })).concat(dayFor('agent:coding-sessions', st)) },
  { id: 'notes:ramblings', kind: 'ramblings', label: 'Voice/text brain-dumps',
    items: (st) => [...fixtureNotes(), ...(st ? st.notes : [])] },
  { id: 'calendar:main', kind: 'calendar', label: 'Calendar',
    items: (st) => (st ? st.events : json('calendar.json')).map((x) => ({ source_id: 'calendar:main', ...x })) },
  { id: 'tasks:main', kind: 'tasks', label: 'Task list',
    items: (st) => (st ? st.tasks : json('tasks.json')).map((x) => ({ source_id: 'tasks:main', ...x })) },
];

export const byId = (id) => adapters.find((a) => a.id === id);
