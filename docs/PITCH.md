# Pitch: Vespera Day Agent (3-minute narrated video)

_Meta Global AI Developer Hackathon (Cerebral Valley), indie track. Model: Meta Muse Spark (`muse-spark-1.3`). Submission due **Nov 4, 2026**. Deliverable: ~3:00 narrated video._
_Speaker: **Eric Aguayo**, Director of Applied AI, Nimblersoft (Quito)._

Method (hackathon-kit `templates/PITCH.md`): problem before solution. Hook → latent pain → hypothesis → solution → live demo → why Muse Spark → business → close.
Framing rules: this is about **review quality**. Workflow language only: no claims about a person's state, only about work items (same rule the validator enforces), no "tracking people" wording. Every number below comes from README.md, docs/VALIDATION.md, docs/DECISIONS.md, docs/DEMO.md or docs/site; sources are listed at the end.

**Core line:** "It doesn't measure your hours, it measures whether you got to review."

---

## Timed script (180 s)

| # | Section | Time | s | On screen |
|---|---|---|---|---|
| 1 | Hook | 0:00–0:15 | 15 | Title card, then dark screen with a merged-PR notification |
| 2 | Latent pain | 0:15–0:45 | 30 | Stat cards (Faros, LinearB, DORA, Atlassian, Gloria Mark) |
| 3 | Hypothesis | 0:45–0:55 | 10 | One sentence + the core metric "closed with proper review" |
| 4 | Solution | 0:55–1:10 | 15 | Architecture: sources → detectors → Muse Spark → validator → you approve |
| 5 | Live demo | 1:10–2:25 | 75 | App UI (DEMO.md beats, compressed) |
| 6 | Why Muse Spark | 2:25–2:35 | 10 | Tool-call trace + "8/8 passed the validator" |
| 7 | Business hypothesis | 2:35–2:48 | 13 | Card labelled UNVALIDATED |
| 8 | Close | 2:48–3:00 | 12 | Core line + repo URL |
| | **Total** | | **180** | |

### 1. Hook [0:00–0:15]

<!-- TODO(hooks): teammate hooks swapped in (C primary, A fallback, B as second beat). Swap again here if the team picks another; options below in "Hook options". -->

**Locked: Hook C (first person; Eric approved it on Oct 29).**
> "I approved eight hundred lines from an agent without running the tests, just to clear my queue before bed. That night we started building Vespera Day Agent. I'm Eric Aguayo, Director of Applied AI at Nimblersoft, in Quito."


### 2. Latent pain [0:15–0:45]

Second beat (teammate hook B):
> "In 2026 you barely write code. You orchestrate five agents, answer twenty messages, fall down three rabbit holes, and at midnight you realize you never tested what you just merged."

⚠ "five / twenty / three" are illustrative, not data. Number-free variant if we want zero unsourced figures: _"You orchestrate agents, answer messages, fall down rabbit holes, and at midnight you realize you never tested what you just merged."_

Then the data:
> "Agents write the code now, so the bottleneck is review. Faros, 22,000 developers: time in PR review up 441%, and 31% more PRs merge with no review at all. LinearB: agent PRs wait 5.3 times longer for a reviewer. DORA 2025: AI raises throughput, and instability with it. And the reviewer's day is in pieces: Atlassian says half of developers lose 10+ hours a week to friction, context switching in the top three. Gloria Mark at UC Irvine: about 25 minutes to get back to an interrupted project."

### 3. Hypothesis [0:45–0:55]
> "Our hypothesis: show a developer, during the day and with evidence, what got closed without proper review, protect one review block, and more work gets closed with proper review."

(Falsifiable version in VALIDATION.md §3: over 5 pilot workdays, closed-with-review must rise vs. the prior 5 days and switches inside blocks must stay ≤2/h.)

### 4. Solution [0:55–1:10]
> "Vespera Day Agent reads only the sources you grant: chat, email, agent sessions, PRs, commits. Code detects drift and rubber-stamp reviews. Muse Spark drafts alerts, a heads-down review block, and a note telling the team when you're free. A validator checks every number and quote. You approve each change."

### 5. Live demo [1:10–2:25] (beats follow docs/DEMO.md)

Before recording: `npm run demo:serve`, **Reset demo**, all sources off. A live **Check now** took 46–68 s in rehearsal: narrate over it or cut the wait in editing.

| Time | s | Do (DEMO.md step) | Say |
|---|---|---|---|
| 1:10 | 10 | Grant GitHub LIVE + other sources; click **Test consent: read notes** (left off) → blocked in red (DEMO 0:15) | "Every source starts off. I grant what I want; anything else is blocked and logged. There is no manager view." |
| 1:20 | 20 | Review evidence panel (DEMO 0:50) | "Real repo. PR #3: 785 lines, LGTM in 40 seconds, 'all tests pass' in the body, no CI, zero files viewed. Flagged. PR #4: CI passed, two comments, every file viewed. Closed with proper review." |
| 1:40 | 12 | Task drift panel, clock 12:30 (DEMO 0:35 + 1:10) | "Issue #1 was mine. I spotted something and opened #2: 17 minutes away, self-triggered. On the sample Friday, an AI side-remark became a 31-minute refactor." |
| 1:52 | 18 | **Check now**, Muse Spark trace (DEMO 1:30) | "Detectors are code. Muse Spark reads the metrics and proposes. If it says 31 minutes where the evidence says 17, the validator rejects it and the model retries." |
| 2:10 | 15 | Approve parked side-quest, PR #3 checklist, no-interrupt review block, #release draft (DEMO 2:00) | "I approve: park the side-quest, a checklist for PR #3, a no-interrupt review block, and a team note. It's a draft; nothing is sent." |

If time runs short: drop the fixture 31-minute sentence in the drift beat.
Plan B: if the API fails, the UI shows OFFLINE FALLBACK (scripted agent, same validator). Say so on camera; do not hide it.

### 6. Why Muse Spark [2:25–2:35]
> "Why Muse Spark: reliable multi-step tool calling. 16 to 22 tool calls per check, and in our last live run 8 of 8 proposals passed the validator."

(16–22: live runs and rehearsal, VALIDATION.md §6 and DEMO.md; 8/8: live run 2, the first live run was 6/6. Also in the build: Muse Voice Transcribe for voice notes. Provider is env-swappable; see Gaps.)

### 7. Business hypothesis [2:35–2:48] (on screen: **UNVALIDATED**)
> "Business hypothesis, unvalidated: the team lead pays about 8 to 20 dollars per dev per month. First channel: Latin American software factories billing US clients by the hour, where review quality is billable risk."

### 8. Close [2:48–3:00]
> "Your agents write the code. You're still the one who signs off. Vespera doesn't measure your hours. It measures whether you got to review. And it's yours, not your manager's."

Short alt closer (if over time): "You orchestrate the agents. We make sure you're still the one reviewing them."

---

## Rehearsal (say it out loud)

One line = one breath. `/` = short pause (beat). `//` = full pause (about 1 s). **Bold** = emphasis. The spoken text is about 510 words (numbers spelled out), so 3:00 needs a brisk ~170 words a minute. At a relaxed ~150, drop the two (cut) lines (about 45 words) and trim pauses in editing.

**Hook (0:00–0:15)**
- I **approved** eight hundred lines from an agent /
- **without running the tests**, /
- just to clear my queue before bed. //
- **That night** we started building **Vespera Day Agent**. /
- I'm Eric Aguayo, Director of Applied AI at Nimblersoft, in Quito. //

**Pain (0:15–0:45)**
- In 2026 you **barely write code**. /
- You orchestrate five agents, / answer twenty messages, / fall down three rabbit holes, /
- and at **midnight** you realize / you **never tested** what you just merged. //
- Agents write the code now, / so the bottleneck is **review**. /
- Faros, twenty-two thousand developers: / time in PR review up **four hundred forty-one percent**, /
- and **thirty-one percent more** PRs merge with **no review at all**. //
- LinearB: agent PRs wait **five point three times** longer for a reviewer. /
- DORA 2025: AI raises throughput, / and **instability** with it. //
- (cut) And the reviewer's day is in **pieces**: / Atlassian says **half** of developers lose ten-plus hours a week to friction, / context switching in the top three. /
- Gloria Mark at UC Irvine: / about **twenty-five minutes** to get back to an interrupted project. //

**Hypothesis (0:45–0:55)**
- Our hypothesis: / show a developer, **during the day** and **with evidence**, /
- what got closed **without proper review**, / protect **one** review block, /
- and more work gets closed **with proper review**. //

**Solution (0:55–1:10)**
- Vespera Day Agent reads **only the sources you grant**: / chat, email, agent sessions, PRs, commits. /
- **Code** detects drift and **rubber-stamp** reviews. /
- **Muse Spark** drafts alerts, / a heads-down review block, / and a note telling the team when you're free. /
- A validator checks **every number** and **every quote**. / **You** approve each change. //

**Demo (1:10–2:25)**
- Every source starts **off**. / I grant what I want; / anything else is **blocked** and logged. / There is **no manager view**. //
- Real repo. / PR **number three**: / **seven hundred eighty-five** lines, / LGTM in **forty seconds**, /
- "all tests pass" in the body, / **no CI**, / **zero** files viewed. / **Flagged.** //
- PR **number four**: / CI passed, / two comments, / every file viewed. / **Closed with proper review.** //
- Issue one was mine. / I spotted something and opened issue two: / **seventeen minutes** away, / self-triggered. /
- (cut) On the sample Friday, / an **AI side-remark** became a **thirty-one-minute** refactor. //
- Detectors are **code**. / Muse Spark reads the metrics and **proposes**. /
- If it says thirty-one minutes / where the evidence says **seventeen**, / the validator **rejects** it / and the model retries. //
- I approve: / park the side-quest, / a checklist for PR three, / a **no-interrupt** review block, / and a team note. /
- It's a **draft**; / **nothing is sent**. //

**Why Muse Spark (2:25–2:35)**
- Why Muse Spark: / reliable **multi-step tool calling**. /
- Sixteen to twenty-two tool calls per check, / and in our last live run / **eight of eight** proposals passed the validator. //

**Business (2:35–2:48)**
- Business hypothesis, / **unvalidated**: /
- the **team lead** pays about **eight to twenty dollars** per dev per month. /
- First channel: / **Latin American software factories** billing US clients by the hour, /
- where review quality is **billable risk**. //

**Close (2:48–3:00)**
- Your agents **write** the code. / **You're** still the one who **signs off**. //
- Vespera doesn't measure your **hours**. / It measures whether you **got to review**. //
- And it's **yours**, / not your manager's. //

Practice tips: say the numbers as written above (spelled out) so they land; look at the lens on "That night" and on the last three lines; let the demo screen carry the PR details and don't rush the 40 seconds.

## Hook options

<!-- TODO(hooks): swap point for teammate hook ideas. Raw list: /workspace/scratch/day-agent-hooks/ideas.md -->

| | Hook | Notes |
|---|---|---|
| **C (locked, Eric approved)** | "I approved eight hundred lines from an agent without running the tests, just to clear my queue before bed. That night we started building Vespera Day Agent." | First person; Eric approved it (Oct 29). 800 lines matches the fixture PR #47 pattern (800 lines approved in 40 s). |
| **A (fallback)** | "2 a.m. Eric clicks 'reviewed' on three pull requests from his agents. He didn't actually read any of them. Tomorrow that code goes to production. That's the problem." | Third person; "three PRs" and "2 a.m." are story details, not data. |
| **B (used as second beat)** | "In 2026 you barely write code. You orchestrate five agents, answer twenty messages, fall down three rabbit holes, and at midnight you realize you never tested what you just merged." | Counts are illustrative; number-free variant in §2. |
| **D (data-backed rabbit hole)** | "Friday, 11:35. Dana starts reviewing PR #44, an auth change QA is waiting on. Six minutes in, her coding agent says: 'the session middleware uses a deprecated crypto API, want me to refactor it?' She says yes. She's back on PR #44 31 minutes later." | Every detail is from `fixtures/day.json` (d28, d29, d33) and the 31-min drift. Fictional persona, no consent question. |
| **E (real repo)** | "Yesterday, in a real repository, a 785-line pull request was marked reviewed in 40 seconds. No CI. Zero files opened. The description said 'all tests pass'. Nobody checked." | PR #3 in ericmaster/vda-demo-target; it was staged for the demo, so say "a demo repo" if asked. |

## Sources cited in the script
- Faros, DORA 2025 takeaways (22,000 devs; review time +441%; 31% more PRs merged with no review): https://www.faros.ai/blog/key-takeaways-from-the-dora-report-2025
- Faros AI Engineering Report, Jul 2025 (review time +91%, 98% more PRs merged): VALIDATION.md row 1
- LinearB 2026 Benchmarks (8M+ PRs; agentic PRs wait 5.3× longer; AI PRs 2.6× larger): https://linearb.io/blog/code-generation-faster-shipping-isnt
- Google Cloud DORA 2025 (throughput up, instability still up; "reprioritizing code reviews"): https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report
- Atlassian DevEx 2025 (50% lose 10+ h/week; context switching top-3, n≈3,500): https://www.atlassian.com/blog/bitbucket/developer-experience-report-2025
- Gloria Mark, UC Irvine (~25 min to return to an interrupted project): https://www.universityofcalifornia.edu/news/cant-pay-attention-youre-not-alone
- Demo facts (PR #3, PR #4, 17-min and 31-min drifts, live runs 6/6 and 8/8, 46–68 s Check now): docs/DEMO.md, docs/site/detectors.html, docs/VALIDATION.md §6

## Gaps and checks before recording
1. Hook C is locked (Eric approved it, Oct 29). Fallback A stays in the table in case the opening has to change.
2. **Hook B and A numbers are illustrative**, not sourced. Use the number-free variant if we want zero unsourced figures.
3. **Muse Spark via gateway:** live runs used `meta/muse-spark-1.3` through the Kilo gateway while direct Meta API access was pending (README). Record the video on the direct Meta API if access arrives; otherwise don't claim "direct Meta API".
4. **Demo timing:** DEMO.md runs its demo 0:15–2:35; this pitch compresses it into 1:10–2:25 (75 s), so the Check now wait (46–68 s) must be cut in editing. DEMO.md timestamps are not updated to match.
5. **Business** is a team hypothesis (VALIDATION.md §5): no customer interviews, no price test. Keep the UNVALIDATED label on screen.
6. **Persona pain quotes** in VALIDATION.md §2 are team hypotheses, not interviews, so the script doesn't quote them as customer voice.
7. The 1 min / 100 lines rubber-stamp threshold is our heuristic, not a sourced standard (DECISIONS row 4). Don't present it as an industry rule.
8. **Script length is tight:** ~510 spoken words for 180 s. Time a full read-through; if it runs over, use the (cut) lines in Rehearsal and the short alt closer.
9. PR #3/#4 and the 17-min drift come from a demo repo built for the hackathon (DECISIONS row 6). They're real GitHub data, but staged.
