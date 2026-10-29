// Read-only GitHub source via the gh CLI (issues + recent commits).
// Falls back to fixtures/github.json when GITHUB_REPO is unset or gh fails.
import { execFileSync } from 'node:child_process';
import { readText } from '../files.js';
import { join } from 'node:path';

let cache = null;
export function githubItems(repo = process.env.GITHUB_REPO) {
  if (cache) return cache;
  let raw = null, mode = 'fixture';
  if (repo && process.env.OFFLINE !== '1') {
    try {
      const gh = (args) => JSON.parse(execFileSync('gh', args, { encoding: 'utf8', timeout: 15000 }));
      const issues = gh(['issue', 'list', '-R', repo, '--state', 'open', '--limit', '20', '--json', 'number,title,body,createdAt']);
      const commits = gh(['api', `repos/${repo}/commits?per_page=15`]);
      raw = [
        ...issues.map((i) => ({ title: `issue #${i.number}: ${i.title}`, text: (i.body || '').slice(0, 2000), ts: i.createdAt })),
        ...commits.map((c) => ({ title: `commit ${c.sha.slice(0, 7)}`, text: c.commit.message.slice(0, 2000), ts: c.commit.author?.date })),
      ];
      mode = 'live';
    } catch { raw = null; }
  }
  if (!raw) raw = JSON.parse(readText(join(process.env.FIXTURES_DIR || 'fixtures', 'github.json')));
  cache = raw.map((x, i) => ({ id: `gh-${i}`, source_id: 'github:repo', ...x }));
  cache.mode = mode;
  return cache;
}
export const resetGithubCache = () => { cache = null; };
