# Vespera Day Agent

**It doesn't measure your hours, it measures whether you got to review.**

AI agents write most of the code now; the dev's job is to review it, and the review queue keeps growing while every ping pulls you out of the PR. Vespera is a dev-owned monitor: from sources *you* grant (chat, email, coding-agent sessions, PRs/commits) it builds a context-switch timeline and tracks the one number that matters, **items closed with proper review** (PR reviewed before merge, agent session closed with tests run). During the day a Meta **Muse Spark** agent raises evidence-backed alerts and proposes no-interrupt review/testing blocks and a team status draft. A deterministic validator checks every proposal (metric values must match, quotes must be verbatim, no calendar conflicts, workflow language only), and you approve each one. Nothing is sent; there is no manager view.

Not WakaTime (coding time), not RescueTime/Rize (which apps), not Reclaim (fills your calendar). Why: see [docs/VALIDATION.md](docs/VALIDATION.md).

Built for the Meta Global AI Developer Hackathon (Cerebral Valley, indie track). Uses Muse Spark (`muse-spark-1.3`) for tool-calling and Muse Voice Transcribe for voice notes.

> An earlier personal prototype called "Vespera" existed before this hackathon; only the name is reused. None of its code is used here. All code in this repo was written from Oct 29, 2026 onward.

## Intraday review monitor
- `fixtures/day.json`: one fictional Friday, 22 events across 4 sources, 6 work items, review overload.
- `src/metrics.js` (deterministic, granted sources only, up to the simulated clock): `switches_total`, `switches_max_per_hour`, `opened`, `closed_with_review`, `closed_without_review`, `review_backlog`.
- Tool `get_day_metrics`; new proposal types `alert {metric,value,message}` (value must equal the computed metric) and `team_status_draft {channel,text}` (stored, never sent); `schedule_block` with `no_interrupt:true`.
- **Task-drift detector** (`detectDrift`): an anchor is the assigned task plus its evidence (`anchor_start`, `assigned_by`). A trigger event (`ai_remark`, `mention`, `self`) in another context starts a side-quest that lasts until activity returns to the anchor; ≥ `DRIFT_MINUTES` (default 15) → drift. Fixture: an agent remark during the PR #44 review leads to a 31-min middleware refactor. The agent proposes a parked task and a return to the anchor.
- **Rubber-stamp detector** (`reviewFlags`): "reviewed" counts only with evidence. Flags `too_fast` (< 1 min per 100 lines), `no_ci`, `unverified_claim` (agent said tests pass, no CI log), `no_review_activity` (0 comments, 0 files viewed). Fixture: PR #47, 800 lines approved in 40 s. The agent proposes a verification checklist.
- Detector alerts must cite the detector's own evidence event (drift trigger, flag event) or the validator rejects them.
- Guardrail: proposals with health/wellness language are rejected by the validator.
- UI: core-metric card, Task drift and Review evidence panels, before → now card (since the first check), timeline (↯ = switch), simulated clock + **Check now**, drafts panel.

## 3-minute demo
| Time | Do | Show / say |
|---|---|---|
| 0:00 | Title | "Agents write the code. Reviewing it is the job. Faros: 31% more PRs merge with no review." |
| 0:15 | All sources off; grant chat, GitHub, agent sessions, email, calendar, tasks | Consent log; one ungranted read blocked in red. "The dev owns the data." |
| 0:35 | Clock 11:30 → Check now | Card: 1/7 closed with proper review. Review evidence: PR #47 "marked reviewed, evidence missing": 800 lines in 40 s, agent said "all tests pass", no CI log |
| 1:05 | Clock 12:30 → Check now | Task drift: 31 min on the middleware refactor while PR #44 was assigned; trigger = AI remark "want me to refactor it?" |
| 1:30 | Muse Spark trace | `get_day_metrics` → alerts quoting the trigger and the 40 s approval; one malformed alert rejected, then fixed |
| 1:55 | Approve: parked side-quest, PR #47 checklist, no-interrupt review block, #release draft | Calendar 🚫 block; checklist ☐; draft "not sent"; before → now card updates |
| 2:35 | Close | "It doesn't measure your hours, it measures whether you got to review." Deterministic detectors, Muse Spark phrases and proposes, validator checks, you approve. |

## How consent works
- Every source (git repo, email, chat, coding-agent transcripts, voice/text notes, calendar, task list) starts **off**.
- You switch on each source you want. The agent's tools refuse to read anything else (`read_source` throws on ungranted sources).
- The validator also rejects any proposal whose evidence cites an ungranted source, and each evidence quote must appear verbatim in the cited item.
- Approved changes go into a local "applied" list. Nothing is sent or written to an outside system without your approval.

## Architecture
```
fixtures/ & (later) Gmail, GitHub, Calendar connectors
        │  adapters: { id, kind, items() }
        ▼
grants (per-source on/off) ──► tools: list_granted_sources, read_source,
                                     read_calendar, read_tasks, propose_change
                                        ▲               │
              Muse Spark (Chat Completions + tools) ────┘               ▼
                                         deterministic validator (no overlaps, working hours,
                                         fixed events, deadline ≤ due date, granted sources, quote check)
                                                        ▼
                                         web UI: evidence + approve/reject per change
```
Zero runtime dependencies: Node 20+, `node:http`, `fetch`, `node:test`.

## Earlier features
- **Local state that changes as you approve.** Approving a decline, move, time block, new task or deadline updates the local calendar and task list. Every remaining proposal is checked again against the new state, so one approval can turn another proposal valid or invalid.
- **Consent log.** The UI lists every tool call, the source it touched, and whether consent allowed it. Reads of sources you have not granted are blocked and shown in red, and so is evidence that cites them.
- **Voice brain-dump.** Record or upload audio. The browser converts it to 16 kHz mono WAV and the server sends it to Muse Voice Transcribe (`POST /v1/asr/transcribe`, `muse-voice-transcribe-1.0`). Without a key, paste a transcript. Either way it becomes a new item in the notes source.
- **GitHub source (read-only).** Set `GITHUB_REPO=owner/name`. When you grant the source, it reads open issues and recent commits through `gh`. Off by default. Falls back to `fixtures/github.json`.
- **Offline mode.** With no `MODEL_API_KEY` (or `OFFLINE=1`), a scripted agent makes the same tool calls over the fixtures, through the same consent checks and validator. The UI labels it OFFLINE MODE.

## Run
```bash
cp .env.example .env      # put your Meta Model API key in MODEL_API_KEY
npm test                  # validator + tool tests (no key needed)
npm run smoke             # one real Muse Spark tool-calling call
npm start                 # http://localhost:3000 (offline mode until a key is set)
```
API: base URL `https://api.meta.ai/v1`, header `Authorization: Bearer $MODEL_API_KEY`, model `muse-spark-1.3`.

## Model provider (swappable)

**Target model: Meta Muse Spark (`muse-spark-1.3`).** The agent talks to any OpenAI-compatible `/chat/completions` endpoint with tool calling, picked by env:

| Var | Default |
| --- | --- |
| `MODEL_BASE_URL` | `https://api.meta.ai/v1` |
| `MODEL_API_KEY` | none (no key = offline mode) |
| `MODEL_NAME` | `muse-spark-1.3` |

Legacy `MODEL_API_BASE` / `MUSE_MODEL` still work. While direct Meta Model API access was pending, development ran against Muse Spark through an OpenAI-compatible gateway (`MODEL_BASE_URL=https://api.kilo.ai/api/gateway`, `MODEL_NAME=meta/muse-spark-1.3`). Swapping back to the direct Meta API is just the three env vars above; no code changes. Voice transcription (`/asr/transcribe`) uses the same base URL and is Meta-API specific.

## Pre-existing vs. new during the hackathon

- **Pre-existing (before the event):** none of this app's code; only general tooling (Node 20, `node:test`).
- **New during the hackathon:** everything in this repo: consent/grants, adapters, validator, agent loop, offline mode, voice route, UI, and the env-swappable model provider.

## What this is not
- It gives no health, medical, mental-health, nutrition or fitness advice.
- It does not assess you, your body, your feelings or your habits. It only reads the sources you grant and proposes calendar/task changes.
- It is not a chatbot and not document Q&A. It is an agent whose actions are checked and approved.

All demo data in `fixtures/` is fictional.
