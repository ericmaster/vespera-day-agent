# Attention gap and AI decision traceability (research, Oct 29 2026)

Status: research only, nothing implemented. `✔` = checked this session against the linked source. `⚠` = from prior knowledge or secondary source, not re-verified today. `[hyp]` = team hypothesis.

Product constraints that bound every option: data belongs to the dev; no manager view; no health/wellness advice (validator `BANNED`); no surveillance framing; every decision backed by evidence, nothing invented.

---

## A. The attention gap

### Problem
Detectors (`src/metrics.js`) only see events from granted sources (PRs, reviews, chat, email, agent sessions, calendar). A 25-min silence between "opened PR #44" and "approved PR #44" is ambiguous: real reading, or a social-video loop. Today the review would look slow-and-careful when it may have been neither. We must not guess.

### Principle: we don't infer attention, we record *where the foreground was* at category level
Activity signals show which app or domain class was in front of the user and whether input was idle. They don't show what the person was thinking about. A PR tab in front for 10 min with no input could be reading or a phone in hand. So the claim we can defend is "foreground was in *code-review* for 18 of 25 min, input active", never "you were focused".

### Tool comparison

| Tool | What it captures | Local? | License | Effort (≤1 week) | Privacy risk |
|---|---|---|---|---|---|
| **ActivityWatch** ([site](https://activitywatch.net), [repo](https://github.com/ActivityWatch/activitywatch)) | `aw-watcher-window` (app + window title), `aw-watcher-afk` (keyboard/mouse idle), `aw-watcher-web` browser extension (active tab URL/title). Built-in user-defined categories (regex → class). REST API on `localhost:5600` ⚠ | Yes, local SQLite; no cloud by default ⚠ | MPL-2.0 ✔ ([LICENSE](https://github.com/ActivityWatch/activitywatch/blob/master/LICENSE.txt)) | Low: install, define categories, call `/api/0/buckets/.../events` or query API ⚠ from a small Node adapter; fixture for the demo | Raw data includes full window titles and URLs (PR titles, DMs, video titles). Must be reduced to categories *before* entering Vespera |
| **RescueTime** ([site](https://www.rescuetime.com)) | App/site time, productivity scores | No, cloud SaaS ⚠ | Proprietary | Medium: OAuth/API key, paid tiers ⚠ | Data already sits with a third party; "productivity score" is the judgement framing we avoid |
| **WakaTime** ([site](https://wakatime.com)) | Editor heartbeats: project, file, language, branch | Cloud by default; self-host via [Wakapi](https://github.com/muety/wakapi) ⚠ | Plugins open source, server proprietary ⚠ | Medium | File names leave the machine; only covers the editor, not the browser where PR review and procrastination happen |
| **Rize** ([site](https://rize.io)) | App/site time, AI-based "focus" classification | Cloud ⚠ | Proprietary | Medium-high, no confirmed public API ⚠ | AI classification of the person's focus is exactly the inference we refuse to make |
| **Chrome `idle` + `tabs` APIs** ([idle](https://developer.chrome.com/docs/extensions/reference/api/idle), [tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs)) | Idle/active/locked state (min detection interval 15 s ⚠); active tab URL with `tabs` permission | Yes (our own extension) | Ours | Medium: write + sideload an MV3 extension; Chrome only; no non-browser apps | `tabs` permission warns "read your browsing history". Fine if we hash to a category in the extension |
| **OS active window** (X11 `xprop`/`xdotool`, macOS Accessibility/NSWorkspace, Win32 `GetForegroundWindow`) | Frontmost app + title | Yes | OS | High: three platforms, permissions prompts (macOS Screen Recording/Accessibility ⚠). ActivityWatch already packages this | Same as AW raw |
| **IDE telemetry (own VS Code extension)** ([API](https://code.visualstudio.com/api/references/vscode-api)) | `window.onDidChangeWindowState` (focused), active editor, diff views | Yes | Ours | Medium | File paths; only the IDE |
| **GitHub PR "Viewed" files** (already in use: `viewerViewedState` via GraphQL ⚠) | Which files the dev marked viewed | GitHub-side, already granted source | n/a | Done | Low; it's review evidence the dev produced, not tracking |

### Proposed design (for when it's built)
1. **Local only.** New adapter `src/adapters/attention.js` reads ActivityWatch on `localhost:5600`. Raw window titles/URLs never enter Vespera's state, the model prompt, the Worker, or logs.
2. **Category-level only.** Map in the adapter (dev-editable rules) to a closed set: `code_review` (github.com/*/pull/*), `editor`, `terminal`, `ai_agent`, `chat`, `email`, `docs`, `social_video` (youtube, tiktok, instagram, x, reddit…), `other`, plus `afk`. Unmatched → `other`, never guessed.
3. **Opt-in per signal**, off by default like every source: `attention:window`, `attention:afk`, `attention:web` granted separately in the existing grants panel, revocable, logged as `user:grant` in the consent log.
4. **Aggregate before use.** Emit only per-window summaries, e.g. `{start,end, minutes_by_category:{code_review:14, social_video:9, afk:2}, coverage:0.92}` for the span between two evidence events. No per-event timeline leaves the adapter.
5. **Explicit `unknown`.** If AW not running, signal not granted, or `coverage < 0.6` [hyp threshold], the span is `attention: unknown` and detectors behave exactly as today. Silence ≠ review.
6. **Confidence labels** (rule-based, shown in UI and checked by validator):
   - `observed`: ≥ 80% of the span covered by a granted category signal [hyp]
   - `partial`: 60–80% [hyp]
   - `unknown`: below that or no signal
7. **Use in detectors, workflow framing only.** E.g. a new rubber-stamp flag `review_window_off_task`: "PR #47 approval span: 3 of 25 min foreground in code review (observed)". The alert describes evidence of review, never the person (no "distracted", "procrastinating", "addicted"; add these words to the validator's banned list). Proposed action stays a workflow one (re-review checklist, no-interrupt block).
8. **Dev-owned.** Data only on the dev's machine/Worker instance; delete button purges the attention cache; no export to teammates; no ranking.

### Evidence on reliability and ethics
- Interruptions and switching are real and measurable: ~25 min average to resume an interrupted task ([Gloria Mark, UC](https://www.universityofcalifornia.edu/news/cant-pay-attention-youre-not-alone), already row 3 in DECISIONS). Mark et al. measured attention with computer logging plus experience sampling and found the two diverge, so logs need self-report to interpret ⚠ ([Mark, Iqbal, Czerwinski, Johns, CHI 2014 "Bored Mondays and Focused Afternoons"](https://dl.acm.org/doi/10.1145/2556288.2557204)).
- Foreground ≠ attention: window-logging tools capture what was in front, not engagement; validity studies of automated time trackers report gaps from idle-but-present, second devices and phones ⚠ ([Kim et al., CHI 2016 "TimeAware"](https://dl.acm.org/doi/10.1145/2858036.2858428) on framing effects of self-tracking productivity data). → justifies `unknown` and "foreground" wording.
- Self-tracking design: users reflect best on data they control and can interpret; abandonment follows when data feels judgmental ⚠ ([Li, Dey, Forlizzi, CHI 2010 stage-based model of personal informatics](https://dl.acm.org/doi/10.1145/1753326.1753409); [Epstein et al., UbiComp 2015 "lived informatics"](https://dl.acm.org/doi/10.1145/2750858.2804250)). Critique of self-tracking turning into workplace surveillance ⚠ (Lupton, *The Quantified Self*, Polity 2016).
- Law: GDPR Art. 5(1)(c) data minimisation, "adequate, relevant and limited to what is necessary" ([gdpr-info.eu Art. 5](https://gdpr-info.eu/art-5-gdpr/)); Art. 25 data protection by design and by default ([Art. 25](https://gdpr-info.eu/art-25-gdpr/)). Employee monitoring needs strict necessity and transparency ⚠ ([EDPB / ex-WP29 Opinion 2/2017 on data processing at work](https://ec.europa.eu/newsroom/article29/items/610169)). Our category-only, local, dev-owned, off-by-default design follows these; it is not a legal opinion.

### Recommendation for the demo
**ActivityWatch with a category-only adapter + a fixture.** Ship `fixtures/attention.json` (aggregated spans, as if from AW) so the hosted Worker demo works, and a local path that reads a real AW server when `AW_URL` is set. Show one case: PR #47 approved after a 25-min span that was mostly `social_video` → alert "approval span had 3 min in code review (observed)" + re-review checklist; and one `unknown` case where no signal exists and nothing is claimed.

**Honest pitch line:** "Vespera doesn't know what you're thinking. If you opt in, a local tracker tells it which *kind* of app was in front, never the URL or content, and when it doesn't know, it says unknown." Don't claim AW integration is live on the hosted demo (it's fixture-backed there); don't claim we detect procrastination.

---

## B. Observability and traceability of AI decisions

### What exists today (verified in code)
- **Validator** (`src/validator.js`): type, evidence present, evidence from granted sources only, quote+item_id, flat payload, banned language, metric value equality, numbers in text vs cited evidence (`checkAlertNumbers`), detector alerts must cite the detector's own evidence. Result stored on `p.validation` and re-run on grant/clock changes (`revalidate` in `src/state.js`).
- **Quote verification** (`propose_change` in `src/tools.js`): `e.verified` = quote literally in the cited item.
- **Consent log** (`state.log`): `{at, tool, source_id, allowed, note}` per tool call, plus `user:grant` entries.
- **Trace** (`src/agent.js` `runLive` → `log({tool,args})`, returned as `trace` by `/api/check` in `src/app.js`): tool name + raw args, no results, no timestamps, no model/prompt version, not persisted.
- Offline fallback is labelled (`offline`, `fallback` error) in the response.

Gaps: no run id; proposals don't link to the run, model, prompt version or tool calls that produced them; validator rejections of earlier attempts are lost; user approve/reject decision has no timestamp record tying back; nothing exportable.

### What to add
**Decision record** per proposal (one JSON object, append-only):
```json
{"record":"proposal","run_id":"r_2026-10-30T10:02Z_ab12","proposal_id":"p3","at":"…",
 "agent":{"mode":"live|offline|fallback","model":"muse-spark-1.3","gateway":"kilo","prompt_version":"sha256:…(SYSTEM text)","step":7},
 "inputs":{"granted_sources":["github:live","chat:team"],"sim_clock":"…","metrics_snapshot_hash":"…"},
 "tool_calls":["tc1","tc2"],
 "evidence":[{"source_id":"…","item_id":"…","quote":"…","verified":true}],
 "attempts":[{"at":"…","errors":["text says 31 min but cited evidence has 17"]}],
 "validator":{"status":"pending","errors":[]},
 "user_decision":{"action":"approved|rejected","at":"…"},
 "usage":{"input_tokens":null,"output_tokens":null}}
```
Plus `run` (start/end, mode, step count, summary), `tool_call` (name, args, result size/hash, duration, allowed) and `consent` records, all sharing `run_id`.

**Export:** `GET /api/audit.jsonl?run_id=` streams the records; a "Download audit log" button. Dev-owned, nothing sent anywhere.

**UI "Why?" panel** on each proposal card: evidence quotes with ✔ verified, the detector fact it rests on (drift/flag), validator checks passed (and earlier rejected attempts), model + prompt version + mode, tool calls in order, and the user's decision.

### Options

| Option | Fit | Deps / hosting | Notes |
|---|---|---|---|
| **Plain JSONL** | Best | Zero deps; array in Durable Object storage on the Worker, file locally | Name fields after OTel GenAI attributes so we can migrate later |
| **OpenTelemetry GenAI semantic conventions** ([spec](https://opentelemetry.io/docs/specs/semconv/gen-ai/)) | Good as a *vocabulary* | Full SDK adds deps; Workers have their own tracing ⚠ | Status "Development" ⚠ (moving spec); attributes like `gen_ai.request.model`, `gen_ai.operation.name`, `gen_ai.usage.input_tokens`, `gen_ai.tool.name` ⚠ |
| **Langfuse** ([repo](https://github.com/langfuse/langfuse)) | Overkill for a week | Cloud or self-host (Postgres, ClickHouse, Redis…) ⚠ | Core MIT, `ee/` dirs separate license ✔ ([LICENSE](https://github.com/langfuse/langfuse/blob/main/LICENSE)); sends prompts+evidence to another service unless self-hosted, which conflicts with "data belongs to the dev" |
| **Arize Phoenix** ([repo](https://github.com/Arize-ai/phoenix)) | Overkill | Python server, OTel/OpenInference ingest ⚠ | Elastic License 2.0 ✔ ([LICENSE](https://github.com/Arize-ai/phoenix/blob/main/LICENSE)), source-available, not OSI open source |

### Recommendation
**Plain JSONL decision log, with OTel GenAI attribute names** (`gen_ai.request.model`, `gen_ai.tool.name`, …) in the records. Zero dependencies, works in Node and in the Durable Object, keeps all data with the dev, and gives judges a downloadable artefact. Langfuse/Phoenix are a later option behind an explicit opt-in exporter.

---

## 1–2 day implementation scope (proposed, not started)
Day 1 (B, higher value for judges): `src/audit.js` (append, list, export); `run_id` + timestamps + tool results summary in `runLive` and offline agent; `prompt_version` = hash of SYSTEM; record validator attempts in `propose_change`; record approve/reject in `state.js`; `/api/audit.jsonl`; "Why?" panel. Test: one live and one offline run produce a complete record per proposal.
Day 2 (A): `fixtures/attention.json` + `src/adapters/attention.js` (fixture, or AW via `AW_URL`, category mapping in adapter); 3 grants; `unknown`/`partial`/`observed`; one new flag `review_window_off_task` with validator check that the cited minutes match the aggregate; extend `BANNED` with judgement words; UI chip on the span; DECISIONS rows.

## Risks
- Optics: any attention signal can read as surveillance. Mitigation: off by default, category-only, local, purge button, wording rule in the validator.
- Foreground ≠ attention (phone on the side, reading on paper) → false "off-task". Mitigation: `unknown`/confidence, the flag is phrased as a span fact, not a verdict.
- Category rules are ours [hyp]; misclassification (e.g. YouTube conference talk = `social_video`). Dev-editable rules.
- AW not running in the hosted Worker: fixture only there; must be said in the pitch.
- Audit log may contain quotes from private sources; it stays dev-side, export is manual.
- OTel GenAI spec is still in development ⚠; names may change.
- Thresholds (60/80% coverage) are untested hypotheses.
