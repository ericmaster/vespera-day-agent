# 3-minute demo (recording script)
Setup: `npm run demo:serve` → http://localhost:3000 (live Muse Spark via `.env`; `ericmaster/vda-demo-target` read live). Rehearse in a terminal with `npm run demo` (or `OFFLINE=1 npm run demo`). Reset between takes with **Reset demo**.

| Time | Do | Show / say |
|---|---|---|
| 0:00 | Title card | "Agents write the code; reviewing it is the job. Faros 2026: 31% more PRs merge with no review." |
| 0:15 | All sources off. Grant GitHub LIVE, then chat, agent sessions, GitHub fixture, email, calendar, tasks | Click **Test consent: read notes** (left off): the consent log shows the read blocked in red. "I own this data; there is no manager view." |
| 0:35 | Point at **LIVE** rows in the timeline | Real repo: issue #1 assigned to me; 10 s later I opened #2, "Noticed while working on #1". |
| 0:50 | Review evidence panel | Real PR #3: 785 lines, reviewed in 40 s, "all tests pass" in the PR body, no CI, 0 files viewed → *marked reviewed, evidence missing*. Real PR #4: CI pass, 2 inline comments, 3/3 files viewed → closed with proper review. |
| 1:10 | Task drift panel; clock 12:30 | Real: 17 min on #2 while #1 was assigned (trigger: self). Fixture Friday: 31 min on a refactor an AI remark suggested during the PR #44 review. |
| 1:30 | **Check now** (Muse Spark trace) | `get_day_metrics` → alerts that cite the trigger and the 40 s review. "Detectors are code; Muse Spark phrases and proposes; the validator checks every number and quote." |
| 2:00 | Approve parked side-quest, PR #3 checklist, no-interrupt review block, #release draft | 🚫 block in calendar, ☐ checklist, draft marked not sent, before → now card |
| 2:35 | Close | "It doesn't measure your hours, it measures whether you got to review." |

Timing: a live **Check now** took 46–68 s in rehearsal (21–22 tool calls). Narrate the trace while it runs, or cut the wait in editing.

Plan B: if the model API fails, the run falls back to the scripted agent through the same validator and the UI says OFFLINE FALLBACK.
