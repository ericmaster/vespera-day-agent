# Validation: market → pain → problem → hypothesis → solution
_Oct 29, 2026. Follows the hackathon-kit flow. Every figure has a source; nothing below was measured by us yet._

## 1. Market evidence
| # | Evidence | Source |
|---|---|---|
| 1 | 50% of developers lose 10+ h/week to non-coding inefficiencies, 90% lose 6+ h. Top causes: finding information, new tech, **switching context between tools**. Developers code ~16% of their time. (n≈3,500, 2025) | [Atlassian State of DevEx 2025](https://www.atlassian.com/blog/bitbucket/developer-experience-report-2025), [SD Times](https://sdtimes.com/ai/report-ai-productivity-gains-cancelled-out-by-friction-points-in-other-areas-that-slow-developers-down/) |
| 2 | 75% of developers lose 6–15 h/week to tool sprawl; 7.4 tools on average (n=300). | [Port, State of Internal Developer Portals](https://www.port.io/state-of-internal-developer-portals) |
| 3 | Solo founder: "you personally become the inbox, the calendar, the person who remembers… what you last said… at 11pm trying to remember if you already replied to the investor". "The switching was the cost." (author works on a vendor; pain quoted only) | [r/StartupSoloFounder](https://www.reddit.com/r/StartupSoloFounder/comments/1tiqcft/solo_founder_reality_my_actual_second_fulltime/) |
| 4 | Founder: "drowning in tools… none of them talk to each other… I genuinely have to dig through 4 different platforms." | [r/smallbusinessowner](https://www.reddit.com/r/smallbusinessowner/comments/1tn71qz/founders_with_small_teams_how_do_you_actually/) |
| 5 | Parallel coding agents: "when you have 5 agents running in parallel, you lose track of what happened fast… I'd have no idea what my agents actually did overnight." | [r/ClaudeCode](https://www.reddit.com/r/ClaudeCode/comments/1ru3i4q/how_i_run_56_claude_code_agents_in_parallel/), [r/ClaudeCode thread](https://www.reddit.com/r/ClaudeCode/comments/1vm8u30/how_do_you_actually_manage_multiple_parallel/) |
| 6 | AI schedulers: "It moves things without telling me why", "I don't trust it with important work" (compiled by a competitor blog). Reclaim reviews: moved an exact-time meeting, causing duplicate work. | [Temporal blog](https://temporal.day/blog/ai-scheduling-out-of-control), [Hack'celeration Reclaim review](https://hackceleration.com/labs/review/reclaim) |

### Competitors and the gap
| Tool | What it does | Gap for our user |
|---|---|---|
| Motion, Reclaim | Auto-schedule tasks/habits into the calendar | Opaque moves, no evidence for *why* (row 6); input is a task list you already typed |
| Clockwise | Meeting optimizer; sunsetting March 2026 ([Reclaim](https://reclaim.ai/blog/clockwise-vs-reclaim)) | Gone; team meetings, not solo commitments |
| Sunsama, Akiflow | Pull Gmail/Slack/GitHub items into an inbox, then **you** plan by hand ([Sunsama](https://www.sunsama.com/daily-planning), [Akiflow Gmail](https://product.akiflow.com/en/help/articles/0294053-gmail)) | Capture needs stars/labels; no extraction of promises from text; no agent transcripts |
| Commitment trackers (type.com skill, Town) | Find promises in meetings/mail, remind you ([type.com](https://type.com/library/skills/commitment-tracker)) | Report only; no calendar changes, no deterministic check; type.com notes "the script does not verify quote wording" |
| Notion AI | Q&A over workspace docs | Not verified for this use; Q&A, not scheduling actions |

**Gap:** nobody turns commitments buried in *granted* sources (incl. coding-agent transcripts) into calendar/task changes that show the verbatim evidence, pass a deterministic check, and wait for one-by-one approval.

## 2. Pain and problem
- **Pain:** indie devs juggle repos, email, chat and several AI agent sessions; promises ("merged by noon", "fix before Nov 3 audit") live in text, not in the calendar. 50% lose 10+ h/week to this kind of friction (row 1).
- **Problem:** existing AI schedulers act on tasks you already entered and move things without showing why, so users don't trust them with important work; trackers find promises but change nothing.

## 3. Hypothesis (falsifiable)
> On a realistic day of fixtures (6 sources, ~8 buried commitments), Vespera surfaces ≥80% of the commitments as proposals, 100% of shown proposals carry a verbatim quote from a granted source, 0 approved changes create a calendar conflict, and the user reviews the day in < 2 min (vs. ~15 min opening each source by hand).

Falsified if recall < 80%, any shown proposal fails quote/consent checks, or any approved change produces an overlap. Measured with a scripted eval over `fixtures/` (gold list of commitments) in offline and Muse Spark modes.

## 4. Persona
**Eric-type indie dev / solo founder**, Quito, 1–2 client repos, Gmail + Slack/WhatsApp, 3–6 Claude/Cursor agent sessions a day, voice notes while walking. Wants: "what did I promise today, and is there time for it?" Will not give an AI write access to the calendar without seeing why.

## 5. Primary demo scenario (≤3 min)
1. All sources off → grant repo, email, chat, agent sessions, calendar, tasks (leave one off: its read is blocked in red).
2. 20 s voice note via Muse Voice Transcribe adds "promised Ana the slides by Friday".
3. Muse Spark tool trace → proposals, each with quote + source. One proposal is rejected by the validator (overlap) and shown with the reason.
4. Approve 3 → calendar updates; another proposal flips invalid live.
5. Before/after card: conflicts 2 → 0, focus hours 0 → 3, commitments with a slot 1/8 → 7/8.

## 6. App vs. hypothesis: gaps ranked (demo impact ÷ effort, ship by Nov 3)
| # | Change | Impact | Effort |
|---|---|---|---|
| 1 | **Before/after metrics card** (conflicts, focus hours, commitments scheduled) computed from state; KPI in-app (kit lesson) | High | S |
| 2 | **Eval script + gold commitments list** for fixtures; prints recall, quote-pass rate, conflicts; cite result in README/video | High (tech depth, falsifies hypothesis) | S |
| 3 | **Validator retry loop**: send rejection reasons back to Muse Spark once, then fail closed; show "rejected → fixed" in trace | High | M |
| 4 | **Draft reschedule message** proposal type (`draft_message`, never sent) for declines/moves | Medium | S |
| 5 | Fixture day with deliberate double-booking so the demo shows a real conflict resolved | Medium | S |
| 6 | Real Google Calendar test account read/write (approved changes only) — "one real action off-screen" | Medium | M–L |
| 7 | Copy: lead with "agent sessions + chats → calendar" for indie devs; keep "no health advice" line | Low | S |
Cut if late: 6. Stretch only: whiteboard photo → tasks.
