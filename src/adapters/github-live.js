// Live GitHub source, read-only (gh api graphql). Maps issues, PRs, reviews, review comments,
// viewed files and CI check runs into the same day-event model as fixtures/day.json, so the
// drift and rubber-stamp detectors run unchanged on real data. Off until the user grants it.
import { execFileSync } from 'node:child_process';

const Q = `query($o:String!,$n:String!){repository(owner:$o,name:$n){
 issues(last:30){nodes{number title body createdAt author{login}
  timelineItems(itemTypes:[ASSIGNED_EVENT],first:5){nodes{... on AssignedEvent{createdAt assignee{... on User{login}}}}}
  comments(first:30){nodes{body createdAt author{login}}}}}
 pullRequests(last:30){nodes{number title body createdAt mergedAt closedAt additions deletions author{login}
  reviews(first:30){nodes{state body submittedAt author{login} comments{totalCount}}}
  comments(first:30){nodes{body createdAt author{login}}}
  files(first:100){totalCount nodes{viewerViewedState}}
  commits(last:1){nodes{commit{checkSuites(first:10){nodes{checkRuns(first:10){nodes{name conclusion completedAt detailsUrl}}}}}}}}}}}`;

// Same local-offset ISO form as the fixtures (America/Bogota, UTC-5, no DST).
const iso = (t) => new Date(new Date(t).getTime() - 5 * 3600e3).toISOString().slice(0, 19) + '-05:00';
const closesRe = /\b(?:closes|fixes|resolves)\s+#(\d+)/i;

export function mapRepo(repo, data) {
  const r = data.data.repository, out = [];
  const src = 'github:live', short = repo.split('/')[1];
  const issueCtx = {};
  for (const i of r.issues.nodes) issueCtx[i.number] = `${short}#${i.number} ${i.title}`;
  const push = (e) => out.push({ source_id: src, ...e, ts: iso(e.ts) });
  for (const i of r.issues.nodes) {
    const ctx = issueCtx[i.number], self = /noticed while|while working on #\d+/i.test(i.body || '');
    push({ id: `gh-i${i.number}`, ts: i.createdAt, context: ctx, action: 'work', ...(self ? { trigger: 'self' } : {}),
      text: `issue #${i.number} opened by ${i.author?.login}: ${i.title}. ${(i.body || '').slice(0, 400)}`, url: `https://github.com/${repo}/issues/${i.number}` });
    for (const a of i.timelineItems.nodes) push({ id: `gh-i${i.number}-assigned`, ts: a.createdAt, context: ctx, action: 'anchor_start', assigned_by: `gh-i${i.number}`,
      text: `issue #${i.number} assigned to ${a.assignee?.login}` });
    i.comments.nodes.forEach((c, k) => push({ id: `gh-i${i.number}-c${k}`, ts: c.createdAt, context: ctx, action: 'work', ...(/@\w/.test(c.body) ? { trigger: 'mention' } : {}),
      text: `${c.author?.login} on issue #${i.number}: ${c.body.slice(0, 300)}` }));
  }
  for (const p of r.pullRequests.nodes) {
    const linked = (p.body || '').match(closesRe)?.[1];
    const ctx = linked && issueCtx[linked] ? issueCtx[linked] : `${short} PR #${p.number} ${p.title}`;
    const lines = p.additions + p.deletions, id = `gh-pr${p.number}`;
    push({ id, ts: p.createdAt, context: ctx, action: 'pr_opened', lines,
      text: `PR #${p.number} opened by ${p.author?.login}: ${p.title}, ${lines} lines changed. ${(p.body || '').slice(0, 400)}`, url: `https://github.com/${repo}/pull/${p.number}` });
    const runs = p.commits.nodes.flatMap((c) => c.commit.checkSuites.nodes.flatMap((s) => s.checkRuns.nodes)).filter((x) => x.completedAt);
    runs.forEach((x, k) => push({ id: `${id}-ci${k}`, ts: x.completedAt, context: ctx, action: x.conclusion === 'SUCCESS' ? 'ci_run' : 'ci_failed',
      text: `CI check ${x.name} on PR #${p.number}: ${x.conclusion}. Log: ${x.detailsUrl}` }));
    const reviews = p.reviews.nodes.filter((v) => v.submittedAt);
    const viewed = p.files.nodes.filter((f) => f.viewerViewedState === 'VIEWED').length;
    const inline = reviews.reduce((n, v) => n + v.comments.totalCount, 0) + p.comments.nodes.length;
    // First review counts as the approval signal. GitHub forbids approving your own PR, so a
    // COMMENTED review is accepted as the approval on a solo repo (see docs/DECISIONS.md).
    const first = reviews[0];
    if (first) {
      const secs = Math.round((new Date(first.submittedAt) - new Date(p.createdAt)) / 1000);
      push({ id: `${id}-review`, ts: first.submittedAt, context: ctx, action: 'approved', lines, review_seconds: secs, review_comments: inline, files_viewed: viewed,
        text: `PR #${p.number} reviewed (${first.state}) by ${first.author?.login} after ${secs} s: ${inline} comments, ${viewed} of ${p.files.totalCount} files viewed. "${(first.body || '').slice(0, 120)}"` });
    }
    if (p.mergedAt) push({ id: `${id}-merged`, ts: p.mergedAt, context: ctx, action: 'closed', review: reviews.length > 0,
      text: `PR #${p.number} merged; ${reviews.length} review(s), ${runs.length} CI check run(s).` });
  }
  return out.sort((a, b) => a.ts.localeCompare(b.ts));
}

let cache = null;
export function liveEvents(repo = process.env.GITHUB_LIVE_REPO, { refresh = false } = {}) {
  if (!repo || process.env.OFFLINE_GITHUB === '1') return [];
  if (cache && !refresh) return cache;
  try {
    const [o, n] = repo.split('/');
    const raw = execFileSync('gh', ['api', 'graphql', '-f', `query=${Q}`, '-F', `o=${o}`, '-F', `n=${n}`], { encoding: 'utf8', timeout: 20000 });
    cache = mapRepo(repo, JSON.parse(raw)); cache.error = null;
  } catch (e) { cache = []; cache.error = e.message.slice(0, 200); }
  return cache;
}
export const liveStatus = () => ({ repo: process.env.GITHUB_LIVE_REPO || null, events: cache?.length ?? null, error: cache?.error ?? null });
