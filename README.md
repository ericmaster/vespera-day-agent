# Vespera Day Agent

**You pick exactly which sources the agent may read; it turns commitments buried in them into evidence-backed, validated calendar and task changes that you approve one by one.**

Built for the Meta Global AI Developer Hackathon (Cerebral Valley, indie track). Uses Meta **Muse Spark** (`muse-spark-1.3`) for tool-calling, with **Muse Voice Transcribe** planned for voice brain-dumps.

> An earlier personal prototype called "Vespera" existed before this hackathon; only the name is reused. None of its code is used here. All code in this repo was written from Oct 29, 2026 onward.

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

## Day-2 features
- **Local state that changes as you approve.** Approving a decline, move, focus block, new task or deadline updates the local calendar and task list. Every remaining proposal is checked again against the new state, so one approval can turn another proposal valid or invalid.
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

## What this is not
- It gives no health, medical, mental-health, nutrition or fitness advice.
- It does not assess you, your body, your feelings or your habits. It only reads the sources you grant and proposes calendar/task changes.
- It is not a chatbot and not document Q&A. It is an agent whose actions are checked and approved.

All demo data in `fixtures/` is fictional.
