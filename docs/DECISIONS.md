# Decision log
One row per decision. Evidence = what we observed or a source; `[hyp]` = team hypothesis, not validated.

| # | Date | Decision | Evidence / source |
|---|---|---|---|
| 1 | Oct 29 | Pivot from calendar planner to review quality ("closed with proper review") | PR review time +91% (2025) and +441%, 31% more PRs merged with no review (2026): [Faros](https://www.faros.ai/blog/key-takeaways-from-the-dora-report-2025); agentic PRs wait 5.3× longer: [LinearB](https://linearb.io/blog/code-generation-faster-shipping-isnt); see VALIDATION.md |
| 2 | Oct 29 | Detectors are deterministic code; Muse Spark only phrases and proposes; validator checks values and evidence | Reviewers distrust tools that move things "without telling me why": [Temporal](https://temporal.day/blog/ai-scheduling-out-of-control); kit lesson "LLM solo donde suma… validador, fail closed" (hackathon-kit PLAYBOOK) |
| 3 | Oct 29 | Drift = trigger (AI remark / mention / self) in another context while an anchor task is active, ≥15 min default | Eric's account of rabbit holes `[hyp]`; ~25 min to return to an interrupted project: [Gloria Mark, UC](https://www.universityofcalifornia.edu/news/cant-pay-attention-youre-not-alone) |
| 4 | Oct 29 | Rubber-stamp rule: < 1 min per 100 lines, no CI, unverified "tests pass", 0 comments and 0 files viewed | Eric's input `[hyp]`; reviewers catch fewer bugs past a few hundred lines ([r/AI_Coders thread](https://www.reddit.com/r/AI_Coders/comments/1v5d2v7/ai_made_writing_code_effortless_but_code_reviews/)); 1 min/100 lines is our heuristic, not a sourced standard ⚠ |
| 5 | Oct 29 | Live GitHub via `gh api graphql`, read-only, new source `github:live`, off by default | gh already authenticated as ericmaster; consent per source is the product's core guarantee |
| 6 | Oct 29 | Built public demo repo `ericmaster/vda-demo-target` instead of using an existing repo | Scanned Eric's public repos: PRs exist (blinka-ap-agent 12, trail-log 15, agentic-inbox 20) but 0–1 reviews each, so no "proper review" contrast (gh pr list, Oct 29) |
| 7 | Oct 29 | On a solo repo a COMMENTED review counts as the approval signal | GitHub does not allow approving your own PR; real data has only COMMENTED reviews ⚠ |
| 8 | Oct 29 | PR linked to an issue via "Closes #N" shares the issue's context; issue assignment = anchor; "Noticed while working on #N" = self trigger | Lets the same detectors run on real data without new rules; keyword rule is simple, may miss phrasing ⚠ |
| 9 | Oct 29 | Offline scripted agent is a fallback: live Muse Spark first, fallback on API error, labelled in UI | Kit lesson: a build silently fell back to simulated mode (hackathon-kit LESSONS); demo must survive API failure |
