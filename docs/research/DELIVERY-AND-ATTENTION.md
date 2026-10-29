# Delivery surfaces and attention sensing (research, Oct 29 2026)

Research only, nothing implemented. Companion to [ATTENTION-AND-TRACEABILITY.md](ATTENTION-AND-TRACEABILITY.md). `⚠` = from prior knowledge, not re-verified this session. `[hyp]` = team hypothesis. Marketing input (menu-bar hero, no browser extension, opt-in Slack status, no chat delivery) was weighed against the evidence below. Where we disagree with it, the reason is stated.

## 1. The constraint: a nudge is itself an interruption
- **Interruption cost depends on timing.** Interruptions at task breakpoints (between subtasks) cost less resumption time and annoyance than mid-task ones ⚠ ([Adamczyk & Bailey, CHI 2004](https://dl.acm.org/doi/10.1145/985692.985715); [Iqbal & Bailey, CHI 2006/TOCHI 2008](https://dl.acm.org/doi/10.1145/1314683.1314689)).
- **Notifications pull people into side tasks.** Alerts lead users to switch, and they often stay off the primary task much longer than the alert itself ⚠ ([Iqbal & Horvitz, CHI 2007 "Disruption and recovery of computing tasks"](https://dl.acm.org/doi/10.1145/1240624.1240730)).
- **Resumption is slow.** It takes ~25 min on average to get back to an interrupted project ([Gloria Mark, UC](https://www.universityofcalifornia.edu/news/cant-pay-attention-youre-not-alone)), and interrupted work is done faster but with more stress ⚠ ([Mark, Gudith, Klocke, CHI 2008](https://dl.acm.org/doi/10.1145/1357054.1357072)). Our output must stay workflow-framed (no health language).
- **What incumbents do:** batch, defer and hold.
  - Microsoft Focus Assist / Windows "Do not disturb" holds notifications and delivers a summary afterwards ⚠ ([Microsoft support](https://support.microsoft.com/windows/turn-focus-assist-on-or-off-in-windows-5492a638-b5a3-1ee0-0c4f-5ae044450e09)).
  - Slack DND pauses notifications, and statuses carry an expiry ⚠ ([Slack help](https://slack.com/help/articles/214908388)).
  - Clockwise and Reclaim defend focus blocks on the calendar and sync Slack status ⚠ ([Clockwise](https://www.getclockwise.com), [Reclaim](https://reclaim.ai)).
  - Centered runs focus sessions with a visible task and nudges on distraction ⚠ ([centered.app](https://www.centered.app)).
  - Opal, Freedom and Cold Turkey block sites or apps the user picked in advance ⚠ ([opal.so](https://www.opal.so), [freedom.to](https://freedom.to), [getcoldturkey.com](https://getcoldturkey.com)).

**Design rules we take from this:**
- At most one nudge per drift.
- Deliver it at a breakpoint: when the side-quest tab or app becomes foreground, or right after a commit, PR action or tab switch, not mid-typing.
- No sound.
- The widget always shows the anchor, so most of the "reminding" happens without any interruption.
- Hold everything during a protected block except the refocus card, and summarize at the end.

## 2. Surfaces evaluated

| Surface | Drift nudge | Rubber-stamp | End-of-day | Team status | Interruption cost | Native signal / invasiveness | Effort (5 days) |
|---|---|---|---|---|---|---|---|
| Chat agent (Slack/Teams/WhatsApp) | Poor: the nudge lands in the channel that causes drift | Poor | OK | Good (status API) | High; it pulls you into the chat app | None useful | Medium (Slack app + OAuth) |
| **Menu-bar / desktop widget** | **Good**: anchor always visible, card on drift | Good (private) | Good | Hosts the opt-in button | Low; glanceable, ambient | None itself; reads local ActivityWatch | Medium: Electron/Tauri tray ⚠, or a small always-on-top web window (lowest) |
| OS notification (from widget) | Good if at breakpoint | OK | Poor | n/a | Medium; respects OS Focus/DND ⚠ | None | Low once the widget exists |
| IDE extension (VS Code status bar) | Partial: blind when you've left the IDE, which is when drift happens | Weak (review is in browser) | No | No | Low | Editor focus and file (paths) | Medium |
| Browser extension | Good: can show the card exactly when a social/video tab opens | Good on PR page | No | No | Low–medium | Tab URL, needs `tabs`/host permissions; Chrome warns "read your browsing history" ⚠ | Medium–high + sideload |
| Email digest | No (too late) | No | **Good** | No | ~0 | None | Low |
| Mobile app / push | Poor; phone is often the distraction | No | OK | No | High | n/a | High, out of scope |
| GitHub PR check / comment | No | Good at the moment of approval | No | n/a | Low, in context | Already-shared artifacts | Low–medium (GitHub App or Action) |

**About marketing's "private reviewer-only GitHub check": not possible as stated.**
- Check runs and PR comments are visible to everyone who can read the repo ⚠ ([Checks API](https://docs.github.com/en/rest/checks/runs)).
- Anything posted on GitHub is therefore team-visible, which conflicts with "no manager view".
- The rubber-stamp alert stays private in the widget.
- Any GitHub output is a dev-triggered, opt-in action: the dev clicks "add my verification checklist as a PR comment", worded as their own checklist and never as a red gate. Optional and roadmap.

**Browser extension vs ActivityWatch (explicit tradeoff).**
- **Extension pros:**
  - It is the best place to time the nudge (tab-open moment).
  - It can classify the tab inside the browser and drop the URL.
- **Extension cons:**
  - Broad permissions that look like spyware.
  - Chrome-only.
  - Sideload friction for judges.
  - It doesn't see non-browser apps.
- **ActivityWatch pros:**
  - Open source (MPL-2.0) and already trusted.
  - Covers all apps.
  - We never ask for browser permissions ourselves.
- **ActivityWatch cons:**
  - Separate install.
  - Its own raw store keeps titles/URLs locally. It is the dev's own tool, but our adapter must only read categories.
  - Polling adds latency, so the card arrives seconds after the tab switch, not at the instant ⚠ (poll interval [hyp] 15–30 s).
  - Browser tab detail needs AW's own web watcher extension, so the permission question doesn't fully disappear. The dev installs it from AW, not from us.
- **Decision:** go with marketing. No Vespera extension for Nov 4. ActivityWatch window + AFK watchers give app-level categories (browser vs editor). Tab-level class comes only if the dev already runs aw-watcher-web. Otherwise a browser in front is `browser_unclassified`, which counts as `unknown`, not `social_video`.

## 3. Product shape (recommendation)
**Tagline:** "It lives in your menu bar, speaks up only when you drift, and tells your team only what you choose." Every promise in that line is backed below.

- **Primary: Vespera widget (menu bar / small always-on-top window).** Shows:
  - The anchor task (e.g. "Review PR #44") and the protected block end time.
  - A sensing indicator (● sensing: categories / ○ paused / ? unknown).
  - A queue of pending proposals with Approve/Reject and "Why?".
  - Pause and Delete buttons.
- **Secondary 1: local OS notification ("refocus card")**, fired by the widget at a breakpoint when drift crosses the threshold. Text: "Back to PR #44? Side-quest 'middleware refactor' parked as a task." [Return] [Park & return] [Not drift]. "Not drift" is logged as a user decision and teaches nothing silently.
- **Secondary 2: one-click Slack status**, offered from the card or block start. "Reviewing PR #44 until 12:20" with expiry and DND, never automatic. Uses the existing `team_status_draft` proposal type. Needs Slack `users.profile:write` ⚠ ([Slack API](https://api.slack.com/methods/users.profile.set)).
- **Optional: dev-only daily email recap** (items closed with proper review, drifts, rubber-stamps). Off by default.
- **Dropped:** chat/WhatsApp delivery (same channel that causes drift), mobile, IDE extension (roadmap), a team-visible GitHub gate.

## 4. Privacy tiers
| Tier | Signals | Status |
|---|---|---|
| **0: work artifacts the dev already shares** | GitHub PRs/reviews/viewed files/CI, calendar, tasks, granted chat/email/agent sessions | In product (today) |
| **1: local, category-only foreground** | ActivityWatch app class + AFK (+ tab class only if the dev runs aw-watcher-web), mapped locally to `code_review, editor, terminal, ai_agent, chat, email, docs, social_video, other, afk, unknown` | Demo: fixture + optional local AW |
| **2: content** | Screenshots, keystrokes, URLs, window titles, page content, camera/mic presence | **Out of scope, never** |

**Guarantees:**
- Tier 1 is processed on the dev's machine. Only per-span category minutes reach the agent.
- Opt-in per signal, off by default, logged in the consent log.
- A visible indicator whenever sensing is on, plus one-click pause.
- A delete button that purges the cache.
- No manager or team view. The team sees only a Slack status the dev clicked.
- Explicit `unknown`, with confidence labels observed/partial/unknown (see companion doc).
- The validator rejects judgement or health words.

**What cannot be inferred (say it):**
- Whether the dev is reading or thinking.
- Phone use, paper, or a conversation at the desk.
- Whether a YouTube tab is a conference talk.
- Why they drifted.

Foreground is not attention. Vespera reports spans, the dev decides.

## 5. One day (user journey)
1. **09:05 widget:** "Anchor: Review PR #44 (assigned by Ana)". Proposal: protected block 10:00–11:30 [Approve]. Card offers "Set Slack status?" [one click].
2. **10:00 widget:** the block starts; the widget shows a countdown. OS notifications from Vespera are held except the refocus card.
3. **10:12 nothing.** An agent remark leads to a middleware side-quest. Vespera stays silent below the 15-min threshold.
4. **10:29 OS notification at a breakpoint** (the dev switched app/tab or committed): refocus card with the 17-min side-quest and [Park & return]. If foreground is `social_video` for most of the span, the card says only "foreground: video 9 of 17 min (observed)", with no judgement.
5. **11:40 widget, private:** PR #47 approved, 800 lines in 40 s, no CI. Rubber-stamp card with a checklist [Re-review] [Add my checklist as PR comment (opt-in)]. Nothing goes to GitHub without a click.
6. **Any time, "Why?":** evidence quotes ✔, detector rule, validator checks, model/prompt version, the user's past decisions (from the audit log).
7. **17:30 widget summary** (and optional email): items closed with proper review 3/5, drifts 2, rubber-stamps 1, attention unknown for 40% of the day. [Export audit log] [Delete today's sensing].

## 6. Demo: build vs mock vs roadmap
- **Build (Nov 4):**
  - Widget as a compact "widget mode" of the existing web UI (`/widget`, small window, pinned), with the anchor, block, indicator, cards and Why? panel.
  - Refocus card via the browser [Notification API](https://developer.mozilla.org/docs/Web/API/Notifications_API) from that page (real OS notification, no native app).
  - Tier 1 from `fixtures/attention.json`, plus a real ActivityWatch read when `AW_URL` is set locally.
  - Audit log + Why?
  - The Slack status shown as an approved `team_status_draft` (not sent).
- **Mock (clearly labelled in the video):**
  - A native menu-bar shell (screenshot or Tauri wrapper only if time allows).
  - The Slack status actually being set.
  - The PR-comment checklist.
- **Roadmap:**
  - Native tray app (Tauri ⚠).
  - Our own browser extension for instant tab timing.
  - VS Code status bar.
  - Email recap.
  - Real Slack OAuth.

**Effort ([hyp]):**
- Widget mode + notifications: 1.5 d
- Attention adapter + fixture + flag: 1 d
- Audit log + Why?: 1 d
- Polish/rehearsal/video: 1 d
- Buffer: 0.5 d

That fills the ~5 days, so no extension and no native app.

## 7. Risks
- **Notification permission:** a browser notification needs a granted permission, and OS Focus modes may suppress it ⚠. The fallback is an in-widget banner.
- **Pitch overclaim:** a web "widget mode" is not a real menu-bar app. Say so in the pitch.
- **AW latency:** polling delays the card, and without aw-watcher-web the browser stays `unknown`. The social-video case in the demo is fixture-backed.
- **Surveillance optics:** an attention signal still reads as monitoring even at category level. Mitigation: indicator, pause, delete, off by default, wording rule.
- **Nudge annoyance:** one card per drift, deferred to a breakpoint, plus the "Not drift" escape.
- **Team visibility:** GitHub outputs are team-visible by nature. Keep them opt-in and worded as the dev's own checklist.
- **Unvalidated numbers:** the threshold (15 min) and the coverage percentages are hypotheses, not validated with users.
