# Validation: market → pain → problem → hypothesis → solution
_Updated Oct 30, 2026 (pivot to review quality). Follows the hackathon-kit flow. Sourced facts carry a link. Rows marked **[team hypothesis]** are our own assumptions, not validated with customers._

## 1. Market evidence (sourced)
| # | Evidence | Source |
|---|---|---|
| 1 | Telemetry, 1,255 teams: devs using AI merge 98% more PRs, but **PR review time +91%**, "human review remains a bottleneck"; devs touch 47% more PRs per day. | [Faros AI Engineering Report, Jul 2025](https://243608892.fs1.hubspotusercontent-na2.net/hubfs/243608892/AI_Engineering_Impact_Report_July_2025_Faros_AI.pdf) |
| 2 | 2026 telemetry, 22,000 devs: **median time in PR review +441%**, **31% more PRs merge with no review at all**, incidents per PR +242.7%. | [Faros, DORA 2025 takeaways](https://www.faros.ai/blog/key-takeaways-from-the-dora-report-2025) |
| 3 | 8M+ PRs: AI PRs are 2.6× larger; agentic PRs wait **5.3× longer** before pickup (P75 1,055 vs 201 min). "An agent generates the code in seconds, and then it waits." | [LinearB 2026 Benchmarks](https://linearb.io/blog/code-generation-faster-shipping-isnt) |
| 4 | DORA 2025: AI now raises throughput but **still raises delivery instability**; it suggests "reprioritizing code reviews as part of their daily work". | [Google Cloud DORA 2025](https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report), [report PDF](https://www.thoughtworks.com/content/dam/thoughtworks/documents/report/tw_report_state_of_ai_assisted_software_development_2025.pdf) |
| 5 | Gloria Mark (UCI): ~47 s on a screen before switching; ~25 min to return to an interrupted project, after other work in between. Interrupted people work faster but with more time pressure (CHI 2008; note the "23 min to refocus" figure is often misquoted). | [UC interview](https://www.universityofcalifornia.edu/news/cant-pay-attention-youre-not-alone), [CHI 2008 paper](https://ics.uci.edu/~gmark/chi08-mark.pdf), [figure provenance](https://evy.so/facts/time-to-resume-after-interruption/) |
| 6 | 50% of devs lose 10+ h/week to non-coding friction; context switching between tools is a top-3 cause (n≈3,500). | [Atlassian DevEx 2025](https://www.atlassian.com/blog/bitbucket/developer-experience-report-2025) |
| 7 | "my primary job shifted overnight from *builder* to an *exhausted reviewer* reading 15 pull requests a day" | [r/AI_Coders, Jul 2026](https://www.reddit.com/r/AI_Coders/comments/1v5d2v7/ai_made_writing_code_effortless_but_code_reviews/) |
| 8 | "I am basically a PR reviewer for Claude now… I have to check every detail." | [Ask HN](https://news.ycombinator.com/item?id=50083555) |
| 9 | "half the PRs on our team are AI generated now… you cant just skim it"; an auth ownership bug was missed by three human reviewers. | [r/codereview, Aug 2026](https://www.reddit.com/r/codereview/comments/1vuddna/how_are_you_actually_reviewing_ai_generated_code/) |
| 10 | "when you have 5 agents running in parallel, you lose track of what happened fast" | [r/ClaudeCode](https://www.reddit.com/r/ClaudeCode/comments/1ru3i4q/how_i_run_56_claude_code_agents_in_parallel/) |

### Competitors and the gap
| Tool | Measures / does | Gap |
|---|---|---|
| WakaTime | Editor coding time; reviews, chat and meetings are invisible ([Rize comparison](https://rize.io/best/time-tracking-for-developers-2026)) | Hours typed, not review quality |
| Rize / RescueTime | Which apps and windows you use, auto-categorized ([Rize](https://rize.io/blog/best-time-tracking-software-for-developers)) | Time per app, no link to PR/agent state |
| LinearB, Swarmia | Team git metrics: cycle/review time, review rate; Slack nudges, working agreements ([Swarmia](https://www.swarmia.com/product/working-agreements/)) | Manager/team dashboards over git only; no chat/email/agent-session context; no calendar action |
| Reclaim, Motion | Auto-fill calendar; Clockwise shut down Mar 2026 ([Reclaim](https://reclaim.ai/blog/clockwise-vs-reclaim)) | Moves things without evidence; knows nothing about PRs |
| Claude Code agent view / Projects | Status of each agent session ([docs](https://code.claude.com/docs/en/agents)) | Per tool; no review/close quality across sources |

**Gap:** no developer-owned tool links switches across chat, email, agent sessions and PRs to whether work was **closed with proper review**, then proposes evidence-backed, validated calendar and team-status changes.

## 2. Persona, pain, problem
- **Persona [team hypothesis]:** tech lead / senior dev, 5+ yrs, small team or startup; >50% of the day reviewing agent output (Cursor, Claude Code, Copilot) and teammates' PRs while handling Slack, email and meetings.
- **Pain, their words [team hypothesis, not interviews]:** "I spend the day approving things I can't review properly." "Every ping pulls me out of the PR." Real fear: merging code that wasn't properly reviewed (consistent with rows 2 and 9).
- **Problem:** review demand grew with AI output (rows 1–3) while the reviewer's day is fragmented by pings (rows 5–6). Existing tools measure hours or apps, or team git stats; none shows the dev, intraday and with evidence, what got closed without review and when to protect review time.

## 3. Hypothesis (falsifiable)
> For the persona, an intraday "check now" that shows switches/hour, items closed with vs. without proper review, and review backlog, plus one approved heads-down review block and a team status draft, raises **items closed with proper review per day** and cuts **switches/hour inside the block to ≤2**, with 0 approved changes that conflict with the calendar.

Measured per day: `closed_with_review / opened`, `closed_without_review`, `review_backlog` at end of day, `switches_max_per_hour`, approved heads-down blocks. Falsified if, over 5 workdays of a pilot user, closed-with-review does not rise vs. their prior 5 days, or switches inside blocks stay >2/h. In-app today only on fixtures: at 11:30 the fixture day shows **1/6 closed with proper review**, 2 closed without review/tests, backlog 2, 20 switches (max 9/h).

## 4. Primary demo scenario
Fri 11:30 on a fixture day: 6 work items, 22 events across chat, email, agent sessions and GitHub. Agent alerts (values checked by the validator), proposes a 🚫 no-interrupt review/testing block and a #release status draft; user approves; core metric card stays the hero. See README "3-minute demo".

## 5. Business [team hypothesis, no customer validation yet]
- Buyer: team lead pays, ~USD 8–20 per dev per month.
- First channel: LATAM software factories billing US clients by the hour (review quality is billable risk).
- Key risk: read as surveillance. Mitigation built in: per-source consent by the dev, data stays local, no manager view, metrics on work items, never on the person.

## 6. Status vs. hypothesis (Nov 3 cutoff)
| Done | Next (impact ÷ effort) |
|---|---|
| Timeline + 6 metrics from granted sources only; alerts validated against computed values; heads-down `no_interrupt` blocks; team status drafts never sent; banned-language guardrail; simulated clock + Check now; 29 tests | 1. End-of-day before/after card (S). 2. Live GitHub PR review state via `gh` into the timeline (M). 3. Eval script: gold alerts per clock time (S). 4. Live Muse Spark run recorded for the video (S) |

Live run (Oct 29, Muse Spark `meta/muse-spark-1.3` via Kilo gateway, all sources granted, clock 11:30): 16 tool calls, 6 proposals (3 alerts, 1 no-interrupt block 11:30–13:00, 1 #release draft, 1 task), **6/6 passed the validator**.
