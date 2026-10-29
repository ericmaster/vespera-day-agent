#!/usr/bin/env python3
"""Builds docs/site/*.html (static, no build step to view). decisions.html and the demo script
are rendered from docs/DECISIONS.md and docs/DEMO.md so they never drift. Run: python3 scripts/build-site.py"""
import html, re, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
OUT = R / 'docs/site'

CSS = """:root{--bg:#0f1117;--panel:#171a23;--line:#2a2f3d;--fg:#e6e8ee;--mut:#9aa3b5;--acc:#8b7bff;--ok:#43c59e;--bad:#ff6b6b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}
nav{display:flex;gap:1.2rem;padding:.9rem 2rem;border-bottom:1px solid var(--line);background:var(--panel);position:sticky;top:0}
nav a{color:var(--mut);text-decoration:none}nav a.on,nav a:hover{color:var(--fg)}nav b{color:var(--acc);margin-right:1rem}
main{max-width:1100px;margin:0 auto;padding:1.5rem 2rem 4rem}h1{font-size:1.9rem;margin:.6rem 0}h2{margin-top:2rem;border-bottom:1px solid var(--line);padding-bottom:.3rem}
a{color:var(--acc)}code{background:#222738;padding:.1rem .35rem;border-radius:4px;font-size:.88em}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:1rem 1.2rem;margin:1rem 0}
.pitch{font-size:1.35rem;font-weight:600;color:#fff;border-left:4px solid var(--acc);padding-left:1rem}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem}@media(max-width:800px){.grid{grid-template-columns:1fr}}
table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{border-bottom:1px solid var(--line);padding:.45rem .5rem;text-align:left;vertical-align:top}th{color:var(--mut)}
.ok{color:var(--ok)}.bad{color:var(--bad)}.mut{color:var(--mut)}.es{border-color:var(--acc)}.mermaid{background:#fff;border-radius:10px;padding:1rem}"""

PAGES = [('index', 'Overview'), ('architecture', 'Architecture'), ('detectors', 'Detectors'), ('decisions', 'Decisions'), ('demo', 'Demo')]

def page(name, title, body, mermaid=False):
    nav = ''.join(f'<a href="{p}.html" class="{"on" if p == name else ""}">{t}</a>' for p, t in PAGES)
    mm = ('<script type="module">import m from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";'
          'm.initialize({startOnLoad:true,theme:"default",securityLevel:"strict"});</script>') if mermaid else ''
    (OUT / f'{name}.html').write_text(f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<title>{title} · Vespera Day Agent</title><link rel="stylesheet" href="style.css">{mm}</head><body>'
        f'<nav><b>Vespera Day Agent</b>{nav}<a href="https://github.com/ericmaster/vespera-day-agent">GitHub</a></nav><main>{body}</main></body></html>\n')

def inline(md):
    s = html.escape(md, quote=False)
    s = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', s)
    s = re.sub(r'`([^`]+)`', r'<code>\1</code>', s)
    s = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', s)
    return s.replace('⚠', '<span class="bad">⚠</span>')

def md_table(md):
    rows = [l for l in md.splitlines() if l.startswith('|')]
    cells = [[c.strip() for c in r.strip('|').split('|')] for r in rows if not re.match(r'^\|\s*-', r)]
    head, body = cells[0], cells[1:]
    return '<table><tr>' + ''.join(f'<th>{inline(h)}</th>' for h in head) + '</tr>' + ''.join(
        '<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in r) + '</tr>' for r in body) + '</table>'

def md_paras(md):
    return ''.join(f'<p>{inline(l)}</p>' for l in md.splitlines() if l.strip() and not l.startswith(('|', '#')))

# index
page('index', 'Overview', """
<h1>Review quality, evidenced.</h1>
<p class="pitch">It doesn't measure your hours, it measures whether you got to review.</p>
<div class="card"><b>What it is.</b> A developer-owned agent. From sources <i>you</i> grant (chat, email, coding-agent sessions, GitHub PRs/commits, calendar, tasks) it builds a context-switch timeline and tracks one number: <b>items closed with proper review</b>. Two deterministic detectors (task drift, rubber-stamp review) feed a Meta <b>Muse Spark</b> agent that proposes alerts, parked side-quests, verification checklists, no-interrupt review blocks and team status drafts. A deterministic validator checks every proposal; you approve each one. Nothing is sent. There is no manager view.</div>
<h2>The problem (sourced)</h2>
<table><tr><th>Evidence</th><th>Source</th></tr>
<tr><td>Median time in PR review +441%; 31% more PRs merge with no review at all (22,000 devs, 2026)</td><td><a href="https://www.faros.ai/blog/key-takeaways-from-the-dora-report-2025">Faros</a></td></tr>
<tr><td>PR review time +91% while AI users merge 98% more PRs (1,255 teams, 2025)</td><td><a href="https://243608892.fs1.hubspotusercontent-na2.net/hubfs/243608892/AI_Engineering_Impact_Report_July_2025_Faros_AI.pdf">Faros 2025</a></td></tr>
<tr><td>Agentic AI PRs wait 5.3× longer before pickup; AI PRs are 2.6× larger (8M PRs)</td><td><a href="https://linearb.io/blog/code-generation-faster-shipping-isnt">LinearB 2026</a></td></tr>
<tr><td>AI raises throughput but still raises delivery instability</td><td><a href="https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report">DORA 2025</a></td></tr>
<tr><td>~47 s on a screen before switching; ~25 min to return to an interrupted project</td><td><a href="https://www.universityofcalifornia.edu/news/cant-pay-attention-youre-not-alone">Gloria Mark, UC</a></td></tr>
<tr><td>"my primary job shifted overnight from builder to an exhausted reviewer reading 15 pull requests a day"</td><td><a href="https://www.reddit.com/r/AI_Coders/comments/1v5d2v7/ai_made_writing_code_effortless_but_code_reviews/">r/AI_Coders</a></td></tr>
</table>
<p class="mut">Full research, persona and hypothesis: <a href="https://github.com/ericmaster/vespera-day-agent/blob/main/docs/VALIDATION.md">VALIDATION.md</a>. Persona and business rows there are marked as team hypotheses.</p>
<div class="grid">
<div class="card"><b>Not</b> WakaTime (coding time), RescueTime/Rize (which apps), LinearB/Swarmia (team git dashboards), Reclaim (fills your calendar).</div>
<div class="card"><b>Meta tooling:</b> Muse Spark <code>muse-spark-1.3</code> for multi-step tool calling; Muse Voice Transcribe for voice notes. Provider is env-swappable (OpenAI-compatible).</div></div>
<div class="card es"><b>Summary</b><ul>
<li><b>Anchor</b>: the assigned task with its evidence (assigned issue, chat request).</li>
<li><b>Drift</b>: a trigger (AI comment, mention or self-discovery) pulls you into another context for 15+ min before returning to the anchor.</li>
<li><b>Rubber stamp</b>: something got marked "reviewed" without evidence: approved too fast for its size, no CI, AI claimed "tests pass" with no log, or 0 comments and 0 files viewed.</li>
<li><b>Validator</b>: deterministic code; rejects numbers or quotes that don't match the evidence. Muse Spark only drafts and proposes.</li>
<li><b>Offline fallback</b>: if the API fails, a scripted agent runs through the same validator and the UI labels it.</li></ul></div>
<h2>Pages</h2><p><a href="architecture.html">Architecture</a> · <a href="detectors.html">Detectors</a> · <a href="decisions.html">Decisions</a> · <a href="demo.html">Demo</a></p>
""")

# architecture
page('architecture', 'Architecture', """
<h1>Architecture</h1>
<p>Zero runtime dependencies: Node 20+, <code>node:http</code>, <code>fetch</code>, <code>node:test</code>. File names below are the real modules in <code>src/</code>.</p>
<h2>Components</h2>
<pre class="mermaid">
flowchart TB
  subgraph Sources["Sources (fixtures + live)"]
    F1[fixtures: chat, email, agent sessions, repo, notes, calendar, tasks]
    F2[fixtures/day.json: Friday activity]
    GL[GitHub LIVE: gh api graphql, read-only]
  end
  G["grants.js: per-source consent, all OFF by default"]
  A["adapters/index.js + github-live.js: items + day events"]
  M["metrics.js: computeDay, timeline, 8 metrics, detectDrift, reviewFlags"]
  subgraph Agent["agent.js: Muse Spark loop, max 24 steps"]
    T["tools.js: list_granted_sources, read_source, read_calendar, read_tasks, get_day_metrics, propose_change"]
  end
  O["offline-agent.js: scripted fallback, same toolbox"]
  V["validator.js: evidence, quotes, overlaps, hours, metric values, detector evidence, numbers in text, banned language"]
  S["state.js: local calendar, tasks, alerts, drafts, approve and revalidate"]
  U["server.js + public/index.html: approval UI, consent log, clock, Check now"]
  F1 --> A
  F2 --> A
  GL --> A
  G --> A
  A --> M
  M --> T
  A --> T
  T --> V
  O --> T
  V --> S
  S --> U
  U -->|grant, clock, run, approve| G
</pre>
<h2>Sequence: Check now</h2>
<pre class="mermaid">
sequenceDiagram
  actor Dev
  participant UI as UI (public/index.html)
  participant S as server.js
  participant Ag as agent.js
  participant MS as Muse Spark (chat/completions)
  participant TB as tools.js
  participant Me as metrics.js
  participant V as validator.js
  Dev->>UI: pick clock time, click Check now
  UI->>S: POST /api/clock {now}
  UI->>S: POST /api/run
  S->>S: snapshot baseline metrics (first run)
  S->>Ag: runAgent(grants, proposals, state)
  loop until no tool calls or 24 steps
    Ag->>MS: messages + tool schemas
    MS-->>Ag: tool_calls
    Ag->>TB: list_granted_sources / read_source / get_day_metrics
    TB->>Me: computeDay(granted only, up to clock)
    Me-->>TB: timeline, metrics, drift[], items with review_flags
    Ag->>TB: propose_change(type, payload, evidence)
    TB->>TB: quote must appear verbatim in cited item
    TB->>V: validateProposal(ctx with day and metrics)
    V-->>Ag: pending or invalid + reasons (model retries)
  end
  Note over Ag: model API error -> offline-agent.js, same toolbox, labelled OFFLINE FALLBACK
  S-->>UI: summary, trace, proposals
  Dev->>UI: Approve one proposal
  UI->>S: POST /api/proposals/:id/approve
  S->>V: revalidate now, apply to local state, revalidate the rest
</pre>
<h2>Event model</h2>
<div class="card"><code>{ id, ts, source_id, context, action, text, lines?, review_seconds?, review_comments?, files_viewed?, review?, trigger?, assigned_by?, approved_via? }</code><br>
Actions: <code>session_started, pr_opened, review_requested, ping, work, approved, ci_run, ci_failed, closed, anchor_start</code>. Triggers: <code>ai_remark, mention, self</code>. Fixture and live GitHub events share this shape, so detectors run unchanged on both.</div>
<h2>HTTP API (server.js)</h2>
<table><tr><th>Route</th><th>Does</th></tr>
<tr><td><code>GET /api/sources</code></td><td>sources + grants, model, offline flag, GitHub live status</td></tr>
<tr><td><code>POST /api/grants</code></td><td>grant/revoke one source, logged</td></tr>
<tr><td><code>POST /api/probe</code></td><td>try a read (demo of a blocked, logged ungranted read)</td></tr>
<tr><td><code>POST /api/clock</code></td><td>set the simulated clock, revalidate</td></tr>
<tr><td><code>POST /api/run</code></td><td>Check now: agent run (live, offline fallback on error)</td></tr>
<tr><td><code>POST /api/proposals/:id/approve|reject</code></td><td>per-change approval</td></tr>
<tr><td><code>GET /api/state</code></td><td>proposals, calendar, tasks, drafts, consent log, day metrics, baseline</td></tr>
<tr><td><code>POST /api/github/refresh</code>, <code>/api/voice</code>, <code>/api/reset</code></td><td>re-read live repo; voice/pasted note; reset</td></tr></table>
""", mermaid=True)

# detectors
page('detectors', 'Detectors', """
<h1>Detectors and validator</h1>
<p>Both detectors are plain functions in <code>src/metrics.js</code>. The model never computes them; it reads them through <code>get_day_metrics</code>.</p>
<h2>1. Task drift: <code>detectDrift(events, now, minMinutes = DRIFT_MINUTES || 15)</code></h2>
<div class="card"><ol>
<li>An <code>anchor_start</code> event sets the anchor: the assigned task plus its evidence (<code>assigned_by</code>).</li>
<li>An event with a <code>trigger</code> (<code>ai_remark</code>, <code>mention</code>, <code>self</code>) in another context starts a side-quest.</li>
<li>It ends at the first event back in the anchor context, at <code>now</code>, or (never spanning days or a new anchor) at the last side-quest event.</li>
<li>Kept only if minutes ≥ threshold. Output: <code>{anchor, anchor_evidence, side_quest, trigger, trigger_event, start, end, minutes}</code>.</li></ol></div>
<div class="grid">
<div class="card"><b>Fixture d29 (Friday)</b><br>Anchor: PR #44 auth review (chat d03, started d28 11:35).<br>Trigger d29 11:41, <code>ai_remark</code>: "the session middleware uses a deprecated crypto API, want me to refactor it?"<br>Back on PR #44 at d32 12:12 → <b class="bad">31 min</b>.</div>
<div class="card"><b>Real: vda-demo-target</b><br>Anchor: issue #1 "Add CSV export" assigned to ericmaster.<br>Trigger: issue #2 "Noticed while working on #1…" → <code>self</code>.<br>Back on #1 when PR #4 ("Closes #1") opened → <b class="bad">17 min</b>.</div></div>
<h2>2. Rubber-stamp review: <code>reviewFlags(events)</code></h2>
<p>A closed, "reviewed" item counts as <b>closed with proper review</b> only if no flag fires:</p>
<table><tr><th>Rule</th><th>Fires when</th></tr>
<tr><td><code>too_fast</code></td><td>approval <code>review_seconds</code> &lt; 60 × lines / 100 (1 min per 100 lines; our heuristic)</td></tr>
<tr><td><code>no_ci</code></td><td>no <code>ci_run</code> event in the item</td></tr>
<tr><td><code>unverified_claim</code></td><td>a non-CI event says "tests pass/passed" and there is no CI run</td></tr>
<tr><td><code>no_review_activity</code></td><td>0 review comments and 0 files viewed</td></tr></table>
<p>Live repos (<code>github-live.js</code>): approval moment = earliest of first review (COMMENTED counts; GitHub blocks self-approval), an "LGTM" comment, or the merge. Every merge is the closure. A bare "LGTM" is not review activity.</p>
<div class="grid">
<div class="card"><b class="bad">PR #3 (real): rubber stamp</b><br>785 lines, review after 40 s (minimum 471 s), no CI, body says "all tests pass", 0 comments, 0 of 1 files viewed.<br>Flags: too_fast, no_ci, unverified_claim, no_review_activity.</div>
<div class="card"><b class="ok">PR #4 (real): closed with proper review</b><br>37 lines, review after 170 s, CI <code>test</code> passed, 2 inline comments, 3 of 3 files viewed.<br>Flags: none.</div></div>
<p class="mut">Same pattern in the fixture: PR #47 (800 lines, 40 s, "all tests pass", no CI) is flagged; PR #41 (CI run #812, 18 min, 3 comments, 9/9 files) is clean.</p>
<h2>3. Validator (src/validator.js)</h2>
<table><tr><th>Check</th><th>Applies to</th></tr>
<tr><td>evidence present, only from granted sources; quote verbatim in the cited item (tools.js)</td><td>all</td></tr>
<tr><td>health/wellness words rejected (workflow framing only)</td><td>all</td></tr>
<tr><td>payload not nested under its type</td><td>all</td></tr>
<tr><td>no overlaps, within 09:00–18:00, same day, not before now, fixed events untouchable</td><td>blocks, moves, declines</td></tr>
<tr><td>deadline valid and ≤ external due date</td><td>tasks, deadlines</td></tr>
<tr><td><code>value</code> equals the computed metric; detector alerts cite the detector's evidence event</td><td>alert</td></tr>
<tr><td><b>numbers in the text</b> ("N min", "N lines", "N s", "#N", "N switches") must match the cited drift/items or day metrics</td><td>alert</td></tr></table>
<div class="card"><b>Number check, real case.</b> An alert citing the 17-min drift (<code>gh-i2</code>) said "up to 31 min". Now rejected: <code class="bad">text says 31 min but cited evidence has 17</code>. The model gets the reason and retries; citing <code>d29</code> with "31 min" passes.</div>
""")

# decisions
dec = (R / 'docs/DECISIONS.md').read_text()
page('decisions', 'Decisions', '<h1>Decision log</h1><p class="mut">Rendered from <a href="https://github.com/ericmaster/vespera-day-agent/blob/main/docs/DECISIONS.md">docs/DECISIONS.md</a> by <code>scripts/build-site.py</code>. <span class="bad">⚠</span> = uncertain.</p>' + md_paras(dec) + md_table(dec))

# demo
demo = (R / 'docs/DEMO.md').read_text()
page('demo', 'Demo', """<h1>Run it</h1><div class="card"><pre><code>git clone https://github.com/ericmaster/vespera-day-agent && cd vespera-day-agent
cp .env.example .env        # MODEL_API_KEY (Meta Model API or an OpenAI-compatible gateway)
npm test                    # no key needed
npm run demo:serve          # UI at http://localhost:3000, live repo ericmaster/vda-demo-target
npm run demo                # scripted run in the terminal (OFFLINE=1 for the fallback)</code></pre></div>
<h2>3-minute script</h2>""" + md_paras(demo) + md_table(demo))
(OUT / 'style.css').write_text(CSS)
print('built', [p for p, _ in PAGES])
